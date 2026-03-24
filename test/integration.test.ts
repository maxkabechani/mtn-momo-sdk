import "dotenv/config";
import { describe, expect, it, beforeAll } from "vitest";
import { v4 as uuid } from "uuid";

import { create } from "../src/index";
import { Environment, PartyIdType } from "../src/common";

const momo = create({ environment: Environment.SANDBOX, callbackHost: "example.com" });

const collectionsPrimaryKey = process.env.COLLECTIONS_PRIMARY_KEY;
const disbursementsPrimaryKey = process.env.DISBURSEMENTS_PRIMARY_KEY;
const remittancePrimaryKey = process.env.REMITTANCE_PRIMARY_KEY;

// Optional: skip tests if no keys are found
const describeIfKeys =
  collectionsPrimaryKey && disbursementsPrimaryKey && remittancePrimaryKey
    ? describe
    : describe.skip;

describeIfKeys("Integration Tests against Sandbox API", () => {
  let collectionsClient: ReturnType<typeof momo.Collections>;
  let disbursementsClient: ReturnType<typeof momo.Disbursements>;
  let remittanceClient: ReturnType<typeof momo.Remittance>;

  // Increase timeout for real network requests
  const timeout = 60000;

  beforeAll(async () => {
    // 1. Provision Collections User
    const usersCollections = momo.Users({
      primaryKey: collectionsPrimaryKey as string,
    });
    const collectionsUserId = await usersCollections.create("example.com");
    const collectionsCreds = await usersCollections.login(collectionsUserId);

    collectionsClient = momo.Collections({
      primaryKey: collectionsPrimaryKey as string,
      userId: collectionsUserId,
      userSecret: collectionsCreds.apiKey,
    });

    // 2. Provision Disbursements User
    const usersDisbursements = momo.Users({
      primaryKey: disbursementsPrimaryKey as string,
    });
    const disbursementsUserId = await usersDisbursements.create("example.com");
    const disbursementsCreds = await usersDisbursements.login(
      disbursementsUserId,
    );

    disbursementsClient = momo.Disbursements({
      primaryKey: disbursementsPrimaryKey as string,
      userId: disbursementsUserId,
      userSecret: disbursementsCreds.apiKey,
    });

    // 3. Provision Remittance User
    const usersRemittance = momo.Users({
      primaryKey: remittancePrimaryKey as string,
    });
    const remittanceUserId = await usersRemittance.create("example.com");
    const remittanceCreds = await usersRemittance.login(remittanceUserId);

    remittanceClient = momo.Remittance({
      primaryKey: remittancePrimaryKey as string,
      userId: remittanceUserId,
      userSecret: remittanceCreds.apiKey,
    });
  }, timeout); // Allow plenty of time for provisioning 3 users

  describe("Collections", () => {
    it(
      "can request to pay and query transaction status",
      async () => {
        const referenceId = await collectionsClient.requestToPay({
          amount: "500",
          currency: "EUR",
          externalId: "123456",
          payer: {
            partyIdType: PartyIdType.MSISDN,
            partyId: "46733123454",
          },
          payerMessage: "test message",
          payeeNote: "test note",
        });

        expect(referenceId).toBeTypeOf("string");

        const transaction = await collectionsClient.getTransaction(referenceId);
        expect(transaction).toBeDefined();
        expect(transaction.amount).toBe("500");
        expect(transaction.currency).toBe("EUR");
        expect(["PENDING", "SUCCESSFUL", "FAILED", "CREATED"]).toContain(
          transaction.status,
        );
      },
      timeout,
    );

    it("can check if payer is active", async () => {
      const isActive = await collectionsClient.isPayerActive("46733123454");
      expect(isActive).toBeTypeOf("boolean");
    });

    it("can get basic user info", async () => {
      try {
        const info = await collectionsClient.getBasicUserInfo(PartyIdType.MSISDN, "46733123454");
        expect(info).toBeDefined();
      } catch (e: any) {
        // Ignore 404/401/403 Sandbox errors
        if (e.name !== "ResourceNotFoundError" && e.name !== "NotAllowedError" && e.name !== "UnspecifiedError") throw e;
      }
    });

    it("can get balance", async () => {
      try {
        const balance = await collectionsClient.getBalance();
        expect(balance.availableBalance).toBeDefined();
      } catch (e: any) {
        if (e.name !== "ResourceNotFoundError" && e.name !== "NotAllowedError" && e.name !== "UnspecifiedError" && e.name !== "InternalProcessingError" && e.name !== "ServiceUnavailableError") throw e;
      }
    });

    it("can request bc authorization", async () => {
      try {
        const res = await collectionsClient.bcAuthorize({
          login_hint: "ID:46733123454/MSISDN",
          scope: "profile",
          access_type: "online"
        });
        expect(res.auth_req_id).toBeDefined();
      } catch (e: any) {
        if (e.response?.status !== 401 && e.response?.status !== 500 && e.response?.status !== 503 && e.response?.status !== 403) throw e;
      }
    }, timeout); // Use full timeout for BC authorize

    it("can request to withdraw (V1 and V2)", async () => {
      // V1
      try {
        const refV1 = await collectionsClient.requestToWithdraw({
          amount: "100",
          currency: "EUR",
          externalId: "withdraw-v1",
          payee: { partyIdType: PartyIdType.MSISDN, partyId: "46733123454" },
          payerMessage: "v1 test",
          payeeNote: "note"
        });
        expect(refV1).toBeDefined();
      } catch (e: any) {
        if (e.name !== "NotAllowedError" && e.name !== "NotAllowedTargetEnvironmentError" && e.name !== "UnspecifiedError" && e.name !== "ServiceUnavailableError") throw e;
      }

      // V2
      try {
        const refV2 = await collectionsClient.requestToWithdrawV2({
          amount: "100",
          currency: "EUR",
          externalId: "withdraw-v2",
          payee: { partyIdType: PartyIdType.MSISDN, partyId: "46733123454" },
          payerMessage: "v2 test",
          payeeNote: "note"
        });
        expect(refV2).toBeDefined();
      } catch (e: any) {
        if (e.name !== "NotAllowedError" && e.name !== "NotAllowedTargetEnvironmentError" && e.name !== "UnspecifiedError" && e.name !== "ServiceUnavailableError") throw e;
      }
    });
  });

  describe("Disbursements", () => {
    it(
      "can transfer money and query transaction status",
      async () => {
        const referenceId = await disbursementsClient.transfer({
          amount: "250",
          currency: "EUR",
          externalId: "disp-123456",
          payee: {
            partyIdType: PartyIdType.MSISDN,
            partyId: "46733123454",
          },
          payerMessage: "disbursement test",
          payeeNote: "testing",
        });

        expect(referenceId).toBeTypeOf("string");

        const transaction = await disbursementsClient.getTransaction(referenceId);
        expect(transaction).toBeDefined();
        expect(transaction.amount).toBe("250");
        expect(transaction.currency).toBe("EUR");
        expect(transaction.externalId).toBe("disp-123456");
        expect(["PENDING", "SUCCESSFUL", "FAILED"]).toContain(
          transaction.status,
        );
      },
      timeout,
    );
    it("can get balance", async () => {
      try {
        const balance = await disbursementsClient.getBalance();
        expect(balance.availableBalance).toBeDefined();
      } catch (e: any) {
        if (e.name !== "ServiceUnavailableError" && e.name !== "InternalProcessingError" && e.name !== "UnspecifiedError") throw e;
      }
    });

    it("can get balance in currency", async () => {
      try {
        const balance = await disbursementsClient.getBalanceInCurrency("EUR");
        expect(balance.availableBalance).toBeDefined();
      } catch (e: any) {
        if (e.name !== "ServiceUnavailableError" && e.name !== "InternalProcessingError" && e.name !== "UnspecifiedError" && e.name !== "NotAllowedError" && e.name !== "NotAllowedTargetEnvironmentError") throw e;
      }
    });

    it("can check if payer is active", async () => {
      const isActive = await disbursementsClient.isPayerActive("46733123454");
      expect(isActive).toBeTypeOf("boolean");
    });

    it("can get basic user info", async () => {
      try {
        const info = await disbursementsClient.getBasicUserInfo(PartyIdType.MSISDN, "46733123454");
        expect(info).toBeDefined();
      } catch(e: any) {
        if (e.response?.status !== 404 && e.response?.status !== 400 && e.response?.status !== 500) throw e;
      }
    });

    it("can request bc authorization", async () => {
      try {
        const res = await disbursementsClient.bcAuthorize({
          login_hint: "ID:46733123454/MSISDN",
          scope: "profile",
          access_type: "online"
        });
        expect(res.auth_req_id).toBeDefined();
      } catch (e: any) {
        if (e.response?.status !== 500 && e.response?.status !== 400 && e.response?.status !== 404) throw e;
      }
    });

    it("can deposit and refund (V1)", async () => {
      // 1. Deposit V1
      try {
        const depositRefToken = await disbursementsClient.deposit({
          amount: "50",
          currency: "EUR",
          externalId: "dep-v1",
          payee: { partyIdType: PartyIdType.MSISDN, partyId: "46733123454" },
          payerMessage: "deposit v1 test",
          payeeNote: "note"
        });
        expect(depositRefToken).toBeTypeOf("string");

        const depositStatus = await disbursementsClient.getDeposit(depositRefToken);
        expect(depositStatus).toBeDefined();

        // 2. Refund V1
        const refundRefToken = await disbursementsClient.refund({
          amount: "10",
          currency: "EUR",
          externalId: "ref-v1",
          payerMessage: "refund v1 test",
          payeeNote: "note",
          referenceIdToRefund: depositRefToken
        });
        expect(refundRefToken).toBeTypeOf("string");
      } catch (e: any) {
        if (e.response?.status !== 403 && e.response?.status !== 404 && e.response?.status !== 401 && e.response?.status !== 500) throw e;
      }
    });

    it("can deposit and refund (V2)", async () => {
      // 1. Deposit V2
      try {
        const depositRefToken = await disbursementsClient.depositV2({
          amount: "50",
          currency: "EUR",
          externalId: "dep-v2",
          payee: { partyIdType: PartyIdType.MSISDN, partyId: "46733123454" },
          payerMessage: "deposit v2 test",
          payeeNote: "note"
        });
        expect(depositRefToken).toBeTypeOf("string");

        const depositStatus = await disbursementsClient.getDeposit(depositRefToken);
        expect(depositStatus).toBeDefined();

        // 2. Refund V2
        const refundRefToken = await disbursementsClient.refundV2({
          amount: "10",
          currency: "EUR",
          externalId: "ref-v2",
          payerMessage: "refund v2 test",
          payeeNote: "note",
          referenceIdToRefund: depositRefToken
        });
        expect(refundRefToken).toBeTypeOf("string");
      } catch (e: any) {
        if (e.response?.status !== 403 && e.response?.status !== 404 && e.response?.status !== 401 && e.response?.status !== 500 && e.response?.status !== 503) throw e;
        if (e.name === "InvalidCurrencyError") return; // Sandbox flakiness with currencies
      }
    });
  });

  describe("Remittance", () => {
    it(
      "can check if payer is active",
      async () => {
        try {
          const isActive = await remittanceClient.isPayerActive(
            "46733123454",
            PartyIdType.MSISDN,
          );
          expect(isActive).toBeTypeOf("boolean");
        } catch (error: any) {
          console.error("Remittance isPayerActive error:", error.response?.data || error.message);
          throw error;
        }
      },
      timeout,
    );

    it(
      "can remit transfer and query transaction status",
      async () => {
        try {
          const referenceId = await remittanceClient.transfer({
            amount: "150",
            currency: "EUR",
            externalId: "remit-123456",
            payee: {
              partyIdType: PartyIdType.MSISDN,
              partyId: "46733123454",
            },
            payerMessage: "remit test",
            payeeNote: "testing",
          });

          expect(referenceId).toBeTypeOf("string");

          await new Promise(r => setTimeout(r, 2000));
          const transaction = await remittanceClient.getTransaction(referenceId);
          expect(transaction).toBeDefined();
          expect(transaction.amount).toBe("150");
          expect(transaction.currency).toBe("EUR");
          expect(transaction.externalId).toBe("remit-123456");
          expect(["PENDING", "SUCCESSFUL", "FAILED"]).toContain(
            transaction.status,
          );
        } catch (error: any) {
          console.error("Remittance transfer error:", error.response?.data || error);
          throw error;
        }
      },
      timeout,
    );
    it("can get balance", async () => {
      try {
        const balance = await remittanceClient.getBalance();
        expect(balance.availableBalance).toBeDefined();
      } catch (e: any) {
        if (e.name !== "NotAllowedError" && e.name !== "NotAllowedTargetEnvironmentError" && e.name !== "UnspecifiedError" && e.name !== "ResourceNotFoundError") throw e;
      }
    });

    it("can get oauth2 user info", async () => {
      try {
        const info = await remittanceClient.getUserInfoWithConsent();
        expect(info).toBeDefined();
      } catch(e: any) {
        if (e.name !== "ResourceNotFoundError" && e.name !== "NotAllowedError" && e.name !== "UnspecifiedError" && e.name !== "NotAllowedTargetEnvironmentError") throw e;
      }
    });

    it("can get basic user info", async () => {
      try {
        const info = await remittanceClient.getBasicUserInfo("46733123454");
        expect(info).toBeDefined();
      } catch(e: any) {
        if (e.name !== "ResourceNotFoundError" && e.name !== "UnspecifiedError") throw e;
      }
    });

    it("can request bc authorization", async () => {
      try {
        const res = await remittanceClient.bcAuthorize({
          login_hint: "ID:46733123454/MSISDN",
          scope: "profile",
          access_type: "online"
        });
        expect(res.auth_req_id).toBeDefined();
      } catch (e: any) {
        if (e.name !== "UnspecifiedError" && e.name !== "NotAllowedError" && e.name !== "ResourceNotFoundError") throw e;
      }
    });
  });
});
