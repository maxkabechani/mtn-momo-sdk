import type { AxiosInstance } from "axios";
import MockAdapter from "axios-mock-adapter";
import { expect } from "vitest";

import type { CashTransferRequest } from "../src/common";
import { PartyIdType } from "../src/common";
import Remittance from "../src/remittance";

import { createMock } from "./mock";

describe("Remittance", function () {
  let remittance: Remittance;
  let mockAdapter: MockAdapter;
  let mockClient: AxiosInstance;

  beforeEach(() => {
    [mockClient, mockAdapter] = createMock();
    remittance = new Remittance(mockClient, {
      baseUrl: "https://sandbox.momodeveloper.mtn.com",
      userId: "user",
      userSecret: "secret",
      primaryKey: "key",
      environment: "sandbox",
    } as any);
  });

  describe("transfer", function () {
    it("makes the correct request", async function () {
      const request: CashTransferRequest = {
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
        remittance.transfer({ ...request, callbackUrl: "callback url" }),
      ).resolves.toBeTypeOf("string");
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/remittance/v1_0/transfer",
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
        remittance.getTransaction("reference"),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/remittance/v1_0/transfer/reference",
      );
    });

    it("rejects with error when transaction has FAILED status", async function () {
      await expect(
        remittance.getTransaction("failed"),
      ).rejects.toThrow();
    });
  });

  describe("getBalance", function () {
    it("makes the correct request", async function () {
      await expect(remittance.getBalance()).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/remittance/v1_0/account/balance",
      );
    });
  });

  describe("getBalanceInCurrency", function () {
    it("makes the correct request", async function () {
      await expect(remittance.getBalanceInCurrency("USD")).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/remittance/v1_0/account/balance/USD",
      );
    });
  });

  describe("isPayerActive", function () {
    it("makes the correct request", async function () {
      await expect(
        remittance.isPayerActive("0772000000", PartyIdType.MSISDN),
      ).resolves.toBe(true);
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/remittance/v1_0/accountholder/MSISDN/0772000000/active",
      );
    });
  });

  describe("getBasicUserInfo", function () {
    it("makes the correct request", async function () {
      await expect(
        remittance.getBasicUserInfo("12345"),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/remittance/v1_0/accountholder/MSISDN/12345/basicuserinfo",
      );
    });
  });

  describe("getUserInfoWithConsent", function () {
    it("makes the correct request", async function () {
      await expect(remittance.getUserInfoWithConsent()).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe("/remittance/oauth2/v1_0/userinfo");
    });
  });

  describe("bcAuthorize", function () {
    it("makes the correct request", async function () {
      const request = { 
        login_hint: "ID:12345/MSISDN", 
        scope: "profile", 
        access_type: "online" as const 
      };
      await expect(remittance.bcAuthorize(request)).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/remittance/v1_0/bc-authorize",
      );
      // Check if it's urlencoded
      expect(mockAdapter.history.post[0]!.data).toContain("login_hint=ID%3A12345%2FMSISDN");
      expect(mockAdapter.history.post[0]!.data).toContain("scope=profile");
      // Check for Basic Auth header
      expect(mockAdapter.history.post[0]!.headers?.Authorization).toMatch(/^Basic /);
    });
  });

  describe("cashTransfer", function () {
    it("makes the correct request to v2 endpoint", async function () {
      const request: CashTransferRequest = {
        amount: "100",
        currency: "EUR",
        externalId: "ct-123",
        payee: {
          partyIdType: PartyIdType.MSISDN,
          partyId: "256774290781",
        },
        payerMessage: "cash transfer",
        payeeNote: "v2 note",
      };
      await expect(
        remittance.cashTransfer({ ...request, callbackUrl: "cb-url" }),
      ).resolves.toBeTypeOf("string");
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/remittance/v2_0/cashtransfer",
      );
      expect(mockAdapter.history.post[0]!.headers!["X-Reference-Id"]).toBeTypeOf("string");
      expect(mockAdapter.history.post[0]!.headers!["X-Callback-Url"]).toBe("cb-url");
    });
  });

  describe("getCashTransfer", function () {
    it("makes the correct request", async function () {
      await expect(
        remittance.getCashTransfer("reference"),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        "/remittance/v2_0/cashtransfer/reference",
      );
    });

    it("rejects with error when cash transfer has FAILED status", async function () {
      await expect(
        remittance.getCashTransfer("failed"),
      ).rejects.toThrow();
    });
  });

  describe("getOAuth2Token", function () {
    it("makes the correct request", async function () {
      await expect(
        remittance.getOAuth2Token({ grant_type: "urn:openid:params:grant-type:ciba", auth_req_id: "auth-123" }),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        "/remittance/oauth2/token/",
      );
      expect(mockAdapter.history.post[0]!.data).toContain("auth_req_id=auth-123");
    });
  });
});
