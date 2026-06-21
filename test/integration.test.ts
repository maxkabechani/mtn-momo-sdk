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

function isExpectedSandboxError(
  error: unknown,
  statuses: number[],
  names: string[] = [],
): boolean {
  if (!(error instanceof Error)) return false;
  const status =
    "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;
  return (
    (status !== undefined && statuses.includes(status)) ||
    names.includes(error.name)
  );
}

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
        const persistedReferenceId = uuid();
        const referenceId = await collectionsClient.requestToPay({
          referenceId: persistedReferenceId,
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

        expect(referenceId).toBe(persistedReferenceId);

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
        if (
          !isExpectedSandboxError(e, [401, 403, 404, 500], [
            "ResourceNotFoundError",
            "NotAllowedError",
            "UnspecifiedError",
          ])
        ) throw e;
      }
    });

    it("can get balance", async () => {
      try {
        const balance = await collectionsClient.getBalance();
        expect(balance.availableBalance).toBeDefined();
      } catch (e: any) {
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500, 503], [
            "ResourceNotFoundError",
            "NotAllowedError",
            "NotAllowedTargetEnvironmentError",
            "UnspecifiedError",
            "InternalProcessingError",
            "ServiceUnavailableError",
          ])
        ) throw e;
      }
    });

    it("can get balance in currency", async () => {
      try {
        const balance = await collectionsClient.getBalanceInCurrency("EUR");
        expect(balance.availableBalance).toBeDefined();
      } catch (e: any) {
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500, 503], [
            "ResourceNotFoundError",
            "NotAllowedError",
            "NotAllowedTargetEnvironmentError",
            "UnspecifiedError",
            "InternalProcessingError",
            "ServiceUnavailableError",
          ])
        ) throw e;
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
        if (!isExpectedSandboxError(e, [400, 401, 403, 404, 500, 503])) {
          throw e;
        }
      }
    }, timeout); // Use full timeout for BC authorize

    it("can request to withdraw (V1 and V2)", async () => {
      // V1
      try {
        const persistedReferenceId = uuid();
        const refV1 = await collectionsClient.requestToWithdraw({
          referenceId: persistedReferenceId,
          amount: "100",
          currency: "EUR",
          externalId: "withdraw-v1",
          payee: { partyIdType: PartyIdType.MSISDN, partyId: "46733123454" },
          payerMessage: "v1 test",
          payeeNote: "note"
        });
        expect(refV1).toBe(persistedReferenceId);
      } catch (e: any) {
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500, 503], [
            "NotAllowedError",
            "NotAllowedTargetEnvironmentError",
            "UnspecifiedError",
            "ServiceUnavailableError",
          ])
        ) throw e;
      }

      // V2
      try {
        const persistedReferenceId = uuid();
        const refV2 = await collectionsClient.requestToWithdrawV2({
          referenceId: persistedReferenceId,
          amount: "100",
          currency: "EUR",
          externalId: "withdraw-v2",
          payee: { partyIdType: PartyIdType.MSISDN, partyId: "46733123454" },
          payerMessage: "v2 test",
          payeeNote: "note"
        });
        expect(refV2).toBe(persistedReferenceId);
      } catch (e: any) {
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500, 503], [
            "NotAllowedError",
            "NotAllowedTargetEnvironmentError",
            "UnspecifiedError",
            "ServiceUnavailableError",
          ])
        ) throw e;
      }
    });

    it("can send delivery notification", async () => {
      try {
        // First create a requestToPay to get a valid referenceId
        const persistedReferenceId = uuid();
        const referenceId = await collectionsClient.requestToPay({
          referenceId: persistedReferenceId,
          amount: "100",
          currency: "EUR",
          externalId: "dn-test",
          payer: { partyIdType: PartyIdType.MSISDN, partyId: "46733123454" },
          payerMessage: "delivery notification test",
          payeeNote: "note",
        });
        expect(referenceId).toBe(persistedReferenceId);

        await collectionsClient.sendDeliveryNotification(referenceId, {
          notificationMessage: "Your payment was received",
        });
      } catch (e: any) {
        // Sandbox may reject — 400/404/500 are acceptable sandbox errors
        if (
          !isExpectedSandboxError(e, [400, 404, 500], [
            "UnspecifiedError",
            "ResourceNotFoundError",
          ])
        ) throw e;
      }
    }, timeout);

    it("can get oauth2 user info with consent", async () => {
      try {
        const info =
          await collectionsClient.getUserInfoWithConsent("test-consent-token");
        expect(info).toBeDefined();
      } catch (e: any) {
        // OAuth2 consent endpoints require prior auth flow, expect errors in sandbox
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500], [
            "ResourceNotFoundError",
            "NotAllowedError",
            "UnspecifiedError",
            "NotAllowedTargetEnvironmentError",
          ])
        ) throw e;
      }
    });

    it("can request oauth2 token", async () => {
      try {
        const tokenRes = await collectionsClient.getOAuth2Token({
          grant_type: "urn:openid:params:grant-type:ciba",
          auth_req_id: "dummy-auth-req-id",
        });
        expect(tokenRes.access_token).toBeDefined();
      } catch (e: any) {
        // Expected to fail without valid auth_req_id
        if (!isExpectedSandboxError(e, [400, 401, 500], ["UnspecifiedError"])) {
          throw e;
        }
      }
    });
  });

  describe("Disbursements", () => {
    it(
      "can transfer money and query transaction status",
      async () => {
        const persistedReferenceId = uuid();
        const referenceId = await disbursementsClient.transfer({
          referenceId: persistedReferenceId,
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

        expect(referenceId).toBe(persistedReferenceId);

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
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500, 503], [
            "ServiceUnavailableError",
            "InternalProcessingError",
            "UnspecifiedError",
            "NotAllowedError",
            "NotAllowedTargetEnvironmentError",
          ])
        ) throw e;
      }
    });

    it("can get balance in currency", async () => {
      try {
        const balance = await disbursementsClient.getBalanceInCurrency("EUR");
        expect(balance.availableBalance).toBeDefined();
      } catch (e: any) {
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500, 503], [
            "ServiceUnavailableError",
            "InternalProcessingError",
            "UnspecifiedError",
            "NotAllowedError",
            "NotAllowedTargetEnvironmentError",
          ])
        ) throw e;
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
        if (!isExpectedSandboxError(e, [400, 404, 500])) throw e;
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
        if (!isExpectedSandboxError(e, [400, 404, 500])) throw e;
      }
    });

    it("can deposit and refund (V1)", async () => {
      // 1. Deposit V1
      try {
        const persistedDepositReference = uuid();
        const depositRefToken = await disbursementsClient.deposit({
          referenceId: persistedDepositReference,
          amount: "50",
          currency: "EUR",
          externalId: "dep-v1",
          payee: { partyIdType: PartyIdType.MSISDN, partyId: "46733123454" },
          payerMessage: "deposit v1 test",
          payeeNote: "note"
        });
        expect(depositRefToken).toBe(persistedDepositReference);

        const depositStatus = await disbursementsClient.getDeposit(depositRefToken);
        expect(depositStatus).toBeDefined();

        // 2. Refund V1
        const persistedRefundReference = uuid();
        const refundRefToken = await disbursementsClient.refund({
          referenceId: persistedRefundReference,
          amount: "10",
          currency: "EUR",
          externalId: "ref-v1",
          payerMessage: "refund v1 test",
          payeeNote: "note",
          referenceIdToRefund: depositRefToken
        });
        expect(refundRefToken).toBe(persistedRefundReference);
      } catch (e: any) {
        if (!isExpectedSandboxError(e, [401, 403, 404, 500])) throw e;
      }
    });

    it("can deposit and refund (V2)", async () => {
      // 1. Deposit V2
      try {
        const persistedDepositReference = uuid();
        const depositRefToken = await disbursementsClient.depositV2({
          referenceId: persistedDepositReference,
          amount: "50",
          currency: "EUR",
          externalId: "dep-v2",
          payee: { partyIdType: PartyIdType.MSISDN, partyId: "46733123454" },
          payerMessage: "deposit v2 test",
          payeeNote: "note"
        });
        expect(depositRefToken).toBe(persistedDepositReference);

        const depositStatus = await disbursementsClient.getDeposit(depositRefToken);
        expect(depositStatus).toBeDefined();

        // 2. Refund V2
        const persistedRefundReference = uuid();
        const refundRefToken = await disbursementsClient.refundV2({
          referenceId: persistedRefundReference,
          amount: "10",
          currency: "EUR",
          externalId: "ref-v2",
          payerMessage: "refund v2 test",
          payeeNote: "note",
          referenceIdToRefund: depositRefToken
        });
        expect(refundRefToken).toBe(persistedRefundReference);
      } catch (e: any) {
        if (!isExpectedSandboxError(e, [401, 403, 404, 500, 503])) throw e;
        if (e.name === "InvalidCurrencyError") return; // Sandbox flakiness with currencies
      }
    });

    it("can get oauth2 user info with consent", async () => {
      try {
        const info =
          await disbursementsClient.getUserInfoWithConsent("test-consent-token");
        expect(info).toBeDefined();
      } catch (e: any) {
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500], [
            "ResourceNotFoundError",
            "NotAllowedError",
            "UnspecifiedError",
            "NotAllowedTargetEnvironmentError",
          ])
        ) throw e;
      }
    });

    it("can request oauth2 token", async () => {
      try {
        const tokenRes = await disbursementsClient.getOAuth2Token({
          grant_type: "urn:openid:params:grant-type:ciba",
          auth_req_id: "dummy-auth-req-id",
        });
        expect(tokenRes.access_token).toBeDefined();
      } catch (e: any) {
        if (!isExpectedSandboxError(e, [400, 401, 500], ["UnspecifiedError"])) {
          throw e;
        }
      }
    });
  });

  describe("Remittance", () => {
    it(
      "can check if payer is active",
      async () => {
        const isActive = await remittanceClient.isPayerActive(
          "46733123454",
          PartyIdType.MSISDN,
        );
        expect(isActive).toBeTypeOf("boolean");
      },
      timeout,
    );

    it(
      "can remit transfer and query transaction status",
      async () => {
        const persistedReferenceId = uuid();
        const referenceId = await remittanceClient.transfer({
          referenceId: persistedReferenceId,
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

        expect(referenceId).toBe(persistedReferenceId);

        await new Promise(r => setTimeout(r, 2000));
        const transaction = await remittanceClient.getTransaction(referenceId);
        expect(transaction).toBeDefined();
        expect(transaction.amount).toBe("150");
        expect(transaction.currency).toBe("EUR");
        expect(transaction.externalId).toBe("remit-123456");
        expect(["PENDING", "SUCCESSFUL", "FAILED"]).toContain(
          transaction.status,
        );
      },
      timeout,
    );
    it("can get balance", async () => {
      try {
        const balance = await remittanceClient.getBalance();
        expect(balance.availableBalance).toBeDefined();
      } catch (e: any) {
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500, 503], [
            "NotAllowedError",
            "NotAllowedTargetEnvironmentError",
            "UnspecifiedError",
            "ResourceNotFoundError",
            "ServiceUnavailableError",
            "InternalProcessingError",
          ])
        ) throw e;
      }
    });

    it("can get balance in currency", async () => {
      try {
        const balance = await remittanceClient.getBalanceInCurrency("EUR");
        expect(balance.availableBalance).toBeDefined();
      } catch (e: any) {
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500, 503], [
            "NotAllowedError",
            "NotAllowedTargetEnvironmentError",
            "UnspecifiedError",
            "ResourceNotFoundError",
            "ServiceUnavailableError",
            "InternalProcessingError",
          ])
        ) throw e;
      }
    });

    it("can get oauth2 user info", async () => {
      try {
        const info =
          await remittanceClient.getUserInfoWithConsent("test-consent-token");
        expect(info).toBeDefined();
      } catch(e: any) {
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500], [
            "ResourceNotFoundError",
            "NotAllowedError",
            "UnspecifiedError",
            "NotAllowedTargetEnvironmentError",
          ])
        ) throw e;
      }
    });

    it("can get basic user info", async () => {
      try {
        const info = await remittanceClient.getBasicUserInfo("46733123454");
        expect(info).toBeDefined();
      } catch(e: any) {
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500], [
            "ResourceNotFoundError",
            "UnspecifiedError",
          ])
        ) throw e;
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
        if (
          !isExpectedSandboxError(e, [400, 401, 403, 404, 500, 503], [
            "UnspecifiedError",
            "NotAllowedError",
            "ResourceNotFoundError",
          ])
        ) throw e;
      }
    });

    it("can send cash transfer (V2)", async () => {
      try {
        const persistedReferenceId = uuid();
        const referenceId = await remittanceClient.cashTransfer({
          referenceId: persistedReferenceId,
          amount: "75",
          currency: "EUR",
          externalId: "cashtx-v2",
          payee: {
            partyIdType: PartyIdType.MSISDN,
            partyId: "46733123454",
          },
          payerMessage: "cash transfer v2",
          payeeNote: "v2 note",
        });
        expect(referenceId).toBe(persistedReferenceId);

        await new Promise(r => setTimeout(r, 2000));
        const transfer = await remittanceClient.getCashTransfer(referenceId);
        expect(transfer).toBeDefined();
      } catch (e: any) {
        // V2 cash transfer may not be available in sandbox
        if (
          !isExpectedSandboxError(e, [400, 404, 500], [
            "UnspecifiedError",
            "NotAllowedError",
            "NotAllowedTargetEnvironmentError",
            "ServiceUnavailableError",
          ])
        ) throw e;
      }
    }, timeout);

    it("can request oauth2 token", async () => {
      try {
        const tokenRes = await remittanceClient.getOAuth2Token({
          grant_type: "urn:openid:params:grant-type:ciba",
          auth_req_id: "dummy-auth-req-id",
        });
        expect(tokenRes.access_token).toBeDefined();
      } catch (e: any) {
        if (!isExpectedSandboxError(e, [400, 401, 500], ["UnspecifiedError"])) {
          throw e;
        }
      }
    });
  });
});
