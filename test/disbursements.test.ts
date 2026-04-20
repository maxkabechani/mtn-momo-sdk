import type { HttpClient } from "../src/httpClient";
import type { FetchFetchMockAdapter } from "./mock";
import { expect } from "vitest";

import Disbursements from "../src/disbursements";

import { createMock } from "./mock";

import type { DepositRequest, RefundRequest } from "../src/common";
import { PartyIdType } from "../src/common";
import type { TransferRequest } from "../src/disbursements";

describe("Disbursements", function () {
  let disbursements: Disbursements;
  let mockAdapter: FetchMockAdapter;
  let mockClient: HttpClient;

  beforeEach(() => {
    [mockClient, mockAdapter] = createMock();
    disbursements = new Disbursements(mockClient, {
      baseUrl: "https://sandbox.momodeveloper.mtn.com",
      userId: "user",
      userSecret: "secret",
      primaryKey: "key",
      environment: "sandbox",
    } as any);
  });

  describe("transfer", function () {
    describe("when the amount is missing", function () {
      it("throws an error", async function () {
        const request = {} as TransferRequest;
        await expect(disbursements.transfer(request)).rejects.toThrow(
          "amount is required",
        );
      });
    });

    describe("when the amount is not numeric", function () {
      it("throws an error", async function () {
        const request = { amount: "alphabetic" } as TransferRequest;
        await expect(disbursements.transfer(request)).rejects.toThrow(
          "amount must be a number",
        );
      });
    });

    describe("when the currency is missing", function () {
      it("throws an error", async function () {
        const request = {
          amount: "1000",
        } as TransferRequest;
        await expect(disbursements.transfer(request)).rejects.toThrow(
          "currency is required",
        );
      });
    });

    describe("when the payee is missing", function () {
      it("throws an error", async function () {
        const request = {
          amount: "1000",
          currency: "UGX",
        } as TransferRequest;
        await expect(disbursements.transfer(request)).rejects.toThrow(
          "payee is required",
        );
      });
    });

    describe("when the party id is missing", function () {
      it("throws an error", async function () {
        const request = {
          amount: "1000",
          currency: "UGX",
          payee: {},
        } as TransferRequest;
        await expect(disbursements.transfer(request)).rejects.toThrow(
          "payee.partyId is required",
        );
      });
    });

    describe("when the party id type is missing", function () {
      it("throws an error", async function () {
        const request = {
          amount: "1000",
          currency: "UGX",
          payee: {
            partyId: "xxx",
          },
        } as TransferRequest;
        await expect(disbursements.transfer(request)).rejects.toThrow(
          "payee.partyIdType is required",
        );
      });
    });

    it("makes the correct request", async function () {
      const request: TransferRequest = {
        amount: "50",
        currency: "EUR",
        externalId: "123456",
        payee: {
          partyIdType: PartyIdType.MSISDN,
          partyId: "256774290781",
        },
        payerMessage: "testing",
        payeeNote: "hello",
      };
      await expect(
        disbursements.transfer({ ...request, callbackUrl: "callback url" }),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/disbursement/v1_0/transfer",
      );
      expect(mockAdapter.history.post[0]!.data).toBe(JSON.stringify(request));
      expect(
        mockAdapter.history.post[0]!.headers!["X-Reference-Id"],
      ).toBeTypeOf("string");
      expect(mockAdapter.history.post[0]!.headers!["X-Callback-Url"]).toBe(
        "callback url",
      );
    });
  });

  describe("getTransaction", function () {
    it("makes the correct request", async function () {
      await expect(
        disbursements.getTransaction("reference"),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/disbursement/v1_0/transfer/reference",
      );
    });

    it("rejects with error when transaction has FAILED status", async function () {
      await expect(
        disbursements.getTransaction("failed"),
      ).rejects.toThrow();
    });
  });

  describe("getBalance", function () {
    it("makes the correct request", async function () {
      await expect(disbursements.getBalance()).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/disbursement/v1_0/account/balance",
      );
    });
  });

  describe("ispayeeActive", function () {
    it("makes the correct request", async function () {
      await expect(
        disbursements.isPayerActive("0772000000", PartyIdType.MSISDN),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/disbursement/v1_0/accountholder/MSISDN/0772000000/active",
      );
    });
  });

  describe("deposit", function () {
    it("uses v1 deposit endpoint", async function () {
      const request: DepositRequest = {
        amount: "50",
        currency: "EUR",
        externalId: "123456",
        payee: {
          partyIdType: PartyIdType.MSISDN,
          partyId: "256774290781",
        },
        payerMessage: "testing",
        payeeNote: "hello",
      };

      await expect(disbursements.deposit(request)).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/disbursement/v1_0/deposit",
      );
    });

    it("uses v2 deposit endpoint", async function () {
      const request: DepositRequest = {
        amount: "50",
        currency: "EUR",
        externalId: "123456",
        payee: {
          partyIdType: PartyIdType.MSISDN,
          partyId: "256774290781",
        },
        payerMessage: "testing",
        payeeNote: "hello",
      };

      await expect(disbursements.depositV2(request)).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/disbursement/v2_0/deposit",
      );
    });
  });

  describe("getDeposit", function () {
    it("uses v1 deposit status endpoint", async function () {
      await expect(
        disbursements.getDeposit("reference"),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/disbursement/v1_0/deposit/reference",
      );
    });

    it("rejects with error when deposit has FAILED status", async function () {
      await expect(
        disbursements.getDeposit("failed"),
      ).rejects.toThrow();
    });
  });

  describe("refund", function () {
    it("uses v1 refund endpoint", async function () {
      const request: RefundRequest = {
        amount: "50",
        currency: "EUR",
        externalId: "123456",
        payerMessage: "testing",
        payeeNote: "hello",
        referenceIdToRefund: "a94f8f0b-bf58-4fd2-8fd2-2f137d8b5f73",
      };

      await expect(disbursements.refund(request)).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/disbursement/v1_0/refund",
      );
    });

    it("uses v2 refund endpoint", async function () {
      const request: RefundRequest = {
        amount: "50",
        currency: "EUR",
        externalId: "123456",
        payerMessage: "testing",
        payeeNote: "hello",
        referenceIdToRefund: "a94f8f0b-bf58-4fd2-8fd2-2f137d8b5f73",
      };

      await expect(disbursements.refundV2(request)).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/disbursement/v2_0/refund",
      );
    });
  });

  describe("getRefund", function () {
    it("uses v1 refund status endpoint", async function () {
      await expect(disbursements.getRefund("reference")).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/disbursement/v1_0/refund/reference",
      );
    });

    it("rejects with error when refund has FAILED status", async function () {
      await expect(
        disbursements.getRefund("failed"),
      ).rejects.toThrow();
    });
  });

  describe("getBasicUserInfo", function () {
    it("makes the correct request", async function () {
      await expect(
        disbursements.getBasicUserInfo(PartyIdType.MSISDN, "12345"),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/disbursement/v1_0/accountholder/MSISDN/12345/basicuserinfo",
      );
    });
  });

  describe("getBalanceInCurrency", function () {
    it("makes the correct request", async function () {
      await expect(
        disbursements.getBalanceInCurrency("XOF"),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/disbursement/v1_0/account/balance/XOF",
      );
    });
  });

  describe("bcAuthorize", function () {
    it("makes the correct request", async function () {
      const request = { 
        login_hint: "ID:12345/MSISDN", 
        scope: "profile", 
        access_type: "online" as const 
      };
      await expect(disbursements.bcAuthorize(request)).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/disbursement/v1_0/bc-authorize",
      );
      // Check if it's urlencoded
      expect(mockAdapter.history.post[0]!.data).toContain("login_hint=ID%3A12345%2FMSISDN");
      expect(mockAdapter.history.post[0]!.data).toContain("scope=profile");
      // Check for Basic Auth header
      expect(mockAdapter.history.post[0]!.headers?.Authorization).toMatch(/^Basic /);
    });
  });

  describe("getUserInfoWithConsent", function () {
    it("makes the correct request", async function () {
      await expect(
        disbursements.getUserInfoWithConsent(),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/disbursement/oauth2/v1_0/userinfo",
      );
    });
  });

  describe("getOAuth2Token", function () {
    it("makes the correct request", async function () {
      await expect(
        disbursements.getOAuth2Token({ grant_type: "urn:openid:params:grant-type:ciba", auth_req_id: "auth-123" }),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/disbursement/oauth2/token/",
      );
      expect(mockAdapter.history.post[0]!.data).toContain("auth_req_id=auth-123");
    });
  });
});
