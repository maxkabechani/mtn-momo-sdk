import type { HttpClient } from "../src/httpClient";
import type { FetchFetchMockAdapter } from "./mock";
import { expect } from "vitest";

import Collections from "../src/collections";

import { createMock } from "./mock";

import type { PaymentRequest } from "../src/collections";
import { PartyIdType, type WithdrawalRequest } from "../src/common";

describe("Collections", function () {
  let collections: Collections;
  let mockAdapter: FetchMockAdapter;
  let mockClient: HttpClient;

  beforeEach(() => {
    [mockClient, mockAdapter] = createMock();
    collections = new Collections(mockClient, {
      baseUrl: "https://sandbox.momodeveloper.mtn.com",
      userId: "user",
      userSecret: "secret",
      primaryKey: "key",
      environment: "sandbox",
    } as any);
  });

  describe("requestToPay", function () {
    describe("when the amount is missing", function () {
      it("throws an error", async function () {
        const request = {} as PaymentRequest;
        await expect(collections.requestToPay(request)).rejects.toThrow(
          "amount is required",
        );
      });
    });

    describe("when the amount is not numeric", function () {
      it("throws an error", async function () {
        const request = { amount: "alphabetic" } as PaymentRequest;
        await expect(collections.requestToPay(request)).rejects.toThrow(
          "amount must be a number",
        );
      });
    });

    describe("when the currency is missing", function () {
      it("throws an error", async function () {
        const request = {
          amount: "1000",
        } as PaymentRequest;
        await expect(collections.requestToPay(request)).rejects.toThrow(
          "currency is required",
        );
      });
    });

    describe("when the payer is missing", function () {
      it("throws an error", async function () {
        const request = {
          amount: "1000",
          currency: "UGX",
        } as PaymentRequest;
        await expect(collections.requestToPay(request)).rejects.toThrow(
          "payer is required",
        );
      });
    });

    describe("when the party id is missing", function () {
      it("throws an error", async function () {
        const request = {
          amount: "1000",
          currency: "UGX",
          payer: {},
        } as PaymentRequest;
        await expect(collections.requestToPay(request)).rejects.toThrow(
          "payer.partyId is required",
        );
      });
    });

    describe("when the party id type is missing", function () {
      it("throws an error", async function () {
        const request = {
          amount: "1000",
          currency: "UGX",
          payer: {
            partyId: "xxx",
          },
        } as PaymentRequest;
        await expect(collections.requestToPay(request)).rejects.toThrow(
          "payer.partyIdType is required",
        );
      });
    });

    it("makes the correct request", async function () {
      const request: PaymentRequest = {
        amount: "50",
        currency: "EUR",
        externalId: "123456",
        payer: {
          partyIdType: PartyIdType.MSISDN,
          partyId: "256774290781",
        },
        payerMessage: "testing",
        payeeNote: "hello",
      };
      await expect(
        collections.requestToPay({ ...request, callbackUrl: "callback url" }),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]?.url).toBe(
        "/collection/v1_0/requesttopay",
      );
      expect(mockAdapter.history.post[0]?.data).toBe(JSON.stringify(request));
      expect(mockAdapter.history.post[0]?.headers?.["X-Reference-Id"]).toBeTypeOf(
        "string",
      );
      expect(mockAdapter.history.post[0]?.headers?.["X-Callback-Url"]).toBe(
        "callback url",
      );
    });
  });

  describe("getTransaction", function () {
    it("makes the correct request", async function () {
      await expect(
        collections.getTransaction("reference"),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]?.url).toBe(
        "/collection/v1_0/requesttopay/reference",
      );
    });

    it("rejects with error when transaction has FAILED status", async function () {
      await expect(
        collections.getTransaction("failed"),
      ).rejects.toThrow();
    });
  });

  describe("getBalance", function () {
    it("makes the correct request", async function () {
      await expect(collections.getBalance()).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]?.url).toBe(
        "/collection/v1_0/account/balance",
      );
    });
  });

  describe("isPayerActive", function () {
    it("makes the correct request", async function () {
      await expect(
        collections.isPayerActive("0772000000", PartyIdType.MSISDN),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]?.url).toBe(
        "/collection/v1_0/accountholder/MSISDN/0772000000/active",
      );
    });
  });
  describe("requestToWithdraw", function () {
    it("uses v1 requesttowithdraw endpoint", async function () {
      const request: WithdrawalRequest = {
        amount: "100",
        currency: "EUR",
        externalId: "ext123",
        payee: { partyIdType: PartyIdType.MSISDN, partyId: "12345" },
        payerMessage: "v1 msg",
        payeeNote: "v1 note",
      };
      await expect(
        collections.requestToWithdraw({ ...request, callbackUrl: "cb" }),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]?.url).toBe(
        "/collection/v1_0/requesttowithdraw",
      );
    });

    it("uses v2 requesttowithdraw endpoint", async function () {
      const request: WithdrawalRequest = {
        amount: "100",
        currency: "EUR",
        externalId: "ext123",
        payee: { partyIdType: PartyIdType.MSISDN, partyId: "12345" },
        payerMessage: "v2 msg",
        payeeNote: "v2 note",
      };
      await expect(
        collections.requestToWithdrawV2({ ...request, callbackUrl: "cb" }),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]?.url).toBe(
        "/collection/v2_0/requesttowithdraw",
      );
    });
  });

  describe("getWithdrawal", function () {
    it("makes the correct request", async function () {
      await expect(collections.getWithdrawal("ref1")).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]?.url).toBe(
        "/collection/v1_0/requesttowithdraw/ref1",
      );
    });

    it("rejects with error when withdrawal has FAILED status", async function () {
      await expect(
        collections.getWithdrawal("failed"),
      ).rejects.toThrow();
    });
  });

  describe("sendDeliveryNotification", function () {
    it("sends notificationMessage as a header", async function () {
      await expect(
        collections.sendDeliveryNotification("ref1", {
          notificationMessage: "Delivered",
        }),
      ).resolves.toBeUndefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]?.url).toBe(
        "/collection/v1_0/requesttopay/ref1/deliverynotification",
      );
      // notificationMessage should be a header, not a body
      expect(mockAdapter.history.post[0]?.headers?.notificationMessage).toBe(
        "Delivered",
      );
      // Body should be null (not contain notificationMessage as JSON)
      expect(mockAdapter.history.post[0]?.data).not.toContain("notificationMessage");
    });

    it("includes Language header when specified", async function () {
      await expect(
        collections.sendDeliveryNotification("ref1", {
          notificationMessage: "Delivered",
          language: "en",
        }),
      ).resolves.toBeUndefined();
      expect(mockAdapter.history.post[0]?.headers?.Language).toBe("en");
    });
  });

  describe("getBasicUserInfo", function () {
    it("makes the correct request", async function () {
      await expect(
        collections.getBasicUserInfo(PartyIdType.MSISDN, "12345"),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]?.url).toBe(
        "/collection/v1_0/accountholder/MSISDN/12345/basicuserinfo",
      );
    });
  });

  describe("getBalanceInCurrency", function () {
    it("makes the correct request", async function () {
      await expect(collections.getBalanceInCurrency("XOF")).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]?.url).toBe(
        "/collection/v1_0/account/balance/XOF",
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
      await expect(collections.bcAuthorize(request)).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]?.url).toBe(
        "/collection/v1_0/bc-authorize",
      );
      // Check if it's urlencoded
      expect(mockAdapter.history.post[0]?.data).toContain("login_hint=ID%3A12345%2FMSISDN");
      expect(mockAdapter.history.post[0]?.data).toContain("scope=profile");
    });

    it("includes optional params when specified", async function () {
      const request = { 
        login_hint: "ID:12345/MSISDN", 
        scope: "profile", 
        access_type: "online" as const,
        client_notification_token: "notify-token",
        scope_instruction: "do consent",
      };
      await expect(collections.bcAuthorize(request)).resolves.toBeDefined();
      expect(mockAdapter.history.post[0]?.data).toContain("client_notification_token=notify-token");
      expect(mockAdapter.history.post[0]?.data).toContain("scope_instruction=do+consent");
    });
  });

  describe("getUserInfoWithConsent", function () {
    it("makes the correct request", async function () {
      await expect(collections.getUserInfoWithConsent()).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]?.url).toBe(
        "/collection/oauth2/v1_0/userinfo",
      );
    });
  });

  describe("getOAuth2Token", function () {
    it("makes the correct request", async function () {
      await expect(
        collections.getOAuth2Token({ grant_type: "urn:openid:params:grant-type:ciba", auth_req_id: "auth-123" }),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]?.url).toBe(
        "/collection/oauth2/token/",
      );
      expect(mockAdapter.history.post[0]?.data).toContain("grant_type=");
      expect(mockAdapter.history.post[0]?.data).toContain("auth_req_id=auth-123");
    });
  });
});
