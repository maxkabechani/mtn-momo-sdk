import { afterEach, expect, vi } from "vitest";

import {
  Environment,
  PayerType,
  create,
  generateReferenceId,
} from "../src/index";
import type {
  CashTransferRequest,
  DepositRequest,
  RefundRequest,
  WithdrawalRequest,
} from "../src/common";
import type { PaymentRequest } from "../src/collections";
import type { TransferRequest } from "../src/disbursements";
import {
  HttpClient,
  HttpClientError,
  RequestAbortedError,
  RequestTimeoutError,
  ResponseSizeLimitError,
  UnexpectedRedirectError,
} from "../src/httpClient";
import { createTokenRefresher } from "../src/auth";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const REFERENCE_ID = "22222222-2222-4222-8222-222222222222";
const SECOND_REFERENCE_ID = "33333333-3333-4333-8333-333333333333";
const ORIGINAL_REFERENCE_ID = "44444444-4444-4444-8444-444444444444";
const PRIMARY_KEY = "subscription-secret-value";
const USER_SECRET = "api-user-secret-value";
const PRODUCT_TOKEN = "product-bearer-token";
const CONSENT_TOKEN = "customer-consent-token";

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  redirect?: RequestInit["redirect"];
}

function productConfig() {
  return {
    primaryKey: PRIMARY_KEY,
    userId: USER_ID,
    userSecret: USER_SECRET,
  };
}

function clients() {
  const momo = create({ callbackHost: "merchant.example" });
  return {
    collections: momo.Collections(productConfig()),
    disbursements: momo.Disbursements(productConfig()),
    remittance: momo.Remittance(productConfig()),
    users: momo.Users({ primaryKey: PRIMARY_KEY }),
  };
}

function response(
  data: unknown,
  status = 200,
  headers?: RequestInit["headers"],
): Response {
  const body = data === null ? null : JSON.stringify(data);
  return new Response(body, {
    status,
    headers: headers ?? { "content-type": "application/json" },
  });
}

function installDefaultFetch(
  override?: (
    request: RecordedRequest,
    init: RequestInit,
  ) => Response | Promise<Response> | undefined,
): { records: RecordedRequest[]; fetchMock: ReturnType<typeof vi.fn> } {
  const records: RecordedRequest[] = [];
  const fetchMock = vi.fn(
    async (input: string | URL | Request, init: RequestInit = {}) => {
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      const request: RecordedRequest = {
        url: String(input),
        method: init.method ?? "GET",
        headers,
        body:
          init.body instanceof URLSearchParams
            ? init.body.toString()
            : String(init.body ?? ""),
        redirect: init.redirect,
      };
      records.push(request);

      const overridden = override?.(request, init);
      if (overridden) return overridden;

      const url = new URL(request.url);
      if (url.pathname.endsWith("/token/") && !url.pathname.includes("/oauth2/")) {
        return response({
          access_token: PRODUCT_TOKEN,
          token_type: "Bearer",
          expires_in: 3600,
        });
      }
      if (url.pathname.includes("/oauth2/token/")) {
        return response({
          access_token: CONSENT_TOKEN,
          token_type: "Bearer",
          expires_in: 3600,
        });
      }
      if (url.pathname.endsWith("/userinfo")) {
        return response({ sub: "customer" });
      }
      if (url.pathname.endsWith("/active")) {
        return response({ result: true });
      }
      if (url.pathname.includes("/account/balance")) {
        return response({ availableBalance: "10.00", currency: "EUR" });
      }
      if (url.pathname.includes("/basicuserinfo")) {
        return response({ given_name: "Customer" });
      }
      if (url.pathname.includes("/apiuser")) {
        return url.pathname.endsWith("/apikey")
          ? response({ apiKey: "sandbox-api-key" })
          : response(null, request.method === "POST" ? 201 : 200);
      }
      return response(null, 202);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return { records, fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SEC-001 stable financial references", () => {
  it("reuses a caller reference for every financial creation method", async () => {
    const { records } = installDefaultFetch();
    const sdk = clients();
    const party = {
      partyIdType: PayerType.MSISDN,
      partyId: "256772000000",
    };

    const operations: {
      path: string;
      invoke: () => Promise<string>;
    }[] = [
      {
        path: "/collection/v1_0/requesttopay",
        invoke: () =>
          sdk.collections.requestToPay({
            referenceId: REFERENCE_ID,
            amount: "10.25",
            currency: "EUR",
            payer: party,
          }),
      },
      {
        path: "/collection/v1_0/requesttowithdraw",
        invoke: () =>
          sdk.collections.requestToWithdraw({
            referenceId: REFERENCE_ID,
            amount: "10.25",
            currency: "EUR",
            payee: party,
          }),
      },
      {
        path: "/collection/v2_0/requesttowithdraw",
        invoke: () =>
          sdk.collections.requestToWithdrawV2({
            referenceId: REFERENCE_ID,
            amount: "10.25",
            currency: "EUR",
            payee: party,
          }),
      },
      {
        path: "/disbursement/v1_0/transfer",
        invoke: () =>
          sdk.disbursements.transfer({
            referenceId: REFERENCE_ID,
            amount: "10.25",
            currency: "EUR",
            payee: party,
          }),
      },
      {
        path: "/disbursement/v1_0/deposit",
        invoke: () =>
          sdk.disbursements.deposit({
            referenceId: REFERENCE_ID,
            amount: "10.25",
            currency: "EUR",
            payee: party,
          }),
      },
      {
        path: "/disbursement/v2_0/deposit",
        invoke: () =>
          sdk.disbursements.depositV2({
            referenceId: REFERENCE_ID,
            amount: "10.25",
            currency: "EUR",
            payee: party,
          }),
      },
      {
        path: "/disbursement/v1_0/refund",
        invoke: () =>
          sdk.disbursements.refund({
            referenceId: REFERENCE_ID,
            referenceIdToRefund: ORIGINAL_REFERENCE_ID,
            amount: "10.25",
            currency: "EUR",
          }),
      },
      {
        path: "/disbursement/v2_0/refund",
        invoke: () =>
          sdk.disbursements.refundV2({
            referenceId: REFERENCE_ID,
            referenceIdToRefund: ORIGINAL_REFERENCE_ID,
            amount: "10.25",
            currency: "EUR",
          }),
      },
      {
        path: "/remittance/v1_0/transfer",
        invoke: () =>
          sdk.remittance.transfer({
            referenceId: REFERENCE_ID,
            amount: "10.25",
            currency: "EUR",
            payee: party,
          }),
      },
      {
        path: "/remittance/v2_0/cashtransfer",
        invoke: () =>
          sdk.remittance.cashTransfer({
            referenceId: REFERENCE_ID,
            amount: "10.25",
            currency: "EUR",
            payee: party,
          }),
      },
    ];

    for (const operation of operations) {
      await expect(operation.invoke()).resolves.toBe(REFERENCE_ID);
      await expect(operation.invoke()).resolves.toBe(REFERENCE_ID);
      const matching = records.filter(
        (record) => new URL(record.url).pathname === operation.path,
      );
      expect(matching).toHaveLength(2);
      expect(
        matching.map((record) => record.headers["x-reference-id"]),
      ).toEqual([REFERENCE_ID, REFERENCE_ID]);
    }
  });

  it("rejects invalid references before dispatch and generates valid UUIDv4 values when omitted", async () => {
    const { records } = installDefaultFetch();
    const { collections } = clients();
    const request: PaymentRequest = {
      amount: "10",
      currency: "EUR",
      payer: {
        partyIdType: PayerType.MSISDN,
        partyId: "256772000000",
      },
    };

    await expect(
      collections.requestToPay({ ...request, referenceId: "../bad" }),
    ).rejects.toThrow("referenceId must be a valid uuid v4");
    expect(records).toHaveLength(0);

    const first = await collections.requestToPay(request);
    const second = await collections.requestToPay(request);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second).not.toBe(first);
    expect(generateReferenceId()).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("preserves the same reference after an ambiguous socket failure", async () => {
    let financialAttempts = 0;
    const { records } = installDefaultFetch((request) => {
      if (new URL(request.url).pathname === "/collection/v1_0/requesttopay") {
        financialAttempts += 1;
        if (financialAttempts === 1) {
          throw new TypeError("simulated socket reset");
        }
        return response(null, 202);
      }
      return undefined;
    });
    const { collections } = clients();
    const request: PaymentRequest = {
      referenceId: REFERENCE_ID,
      amount: "10",
      currency: "EUR",
      payer: {
        partyIdType: PayerType.MSISDN,
        partyId: "256772000000",
      },
    };

    await expect(collections.requestToPay(request)).rejects.toBeInstanceOf(
      HttpClientError,
    );
    await expect(collections.requestToPay(request)).resolves.toBe(REFERENCE_ID);

    const attempts = records.filter(
      (record) =>
        new URL(record.url).pathname === "/collection/v1_0/requesttopay",
    );
    expect(attempts.map((record) => record.headers["x-reference-id"])).toEqual([
      REFERENCE_ID,
      REFERENCE_ID,
    ]);
  });
});

describe("SEC-002 safe dynamic paths", () => {
  const pathAttacks = [
    "../account/balance?",
    "..",
    "%2e%2e",
    "/",
    "\\",
    "?",
    "#",
    "%2f",
    "%5c",
    "bad\u0000value",
  ];

  it("rejects traversal variants across every dynamic route before dispatch", async () => {
    const { records } = installDefaultFetch();
    const sdk = clients();

    for (const attack of pathAttacks) {
      const strictReferenceCalls: Array<
        () => unknown | Promise<unknown>
      > = [
        () => sdk.collections.getTransaction(attack),
        () => sdk.collections.getWithdrawal(attack),
        () =>
          sdk.collections.sendDeliveryNotification(attack, {
            notificationMessage: "Delivered",
          }),
        () => sdk.disbursements.getTransaction(attack),
        () => sdk.disbursements.getDeposit(attack),
        () => sdk.disbursements.getRefund(attack),
        () => sdk.remittance.getTransaction(attack),
        () => sdk.remittance.getCashTransfer(attack),
        () => sdk.users.login(attack),
        () => sdk.users.getApiUser(attack),
      ];

      const partyCalls: Array<() => unknown | Promise<unknown>> = [
        () => sdk.collections.isPayerActive(attack),
        () =>
          sdk.collections.getBasicUserInfo(PayerType.MSISDN, attack),
        () => sdk.disbursements.isPayerActive(attack),
        () =>
          sdk.disbursements.getBasicUserInfo(PayerType.MSISDN, attack),
        () => sdk.remittance.isPayerActive(attack),
        () => sdk.remittance.getBasicUserInfo(attack),
      ];

      const currencyCalls: Array<() => unknown | Promise<unknown>> = [
        () => sdk.collections.getBalanceInCurrency(attack),
        () => sdk.disbursements.getBalanceInCurrency(attack),
        () => sdk.remittance.getBalanceInCurrency(attack),
      ];

      for (const invoke of [
        ...strictReferenceCalls,
        ...partyCalls,
        ...currencyCalls,
      ]) {
        await expect(Promise.resolve().then(invoke)).rejects.toThrow();
      }
    }

    expect(records).toHaveLength(0);
  });

  it("validates currencies, party types, party IDs, and sandbox user IDs", async () => {
    const { records } = installDefaultFetch();
    const sdk = clients();

    expect(() => sdk.collections.getBalanceInCurrency("../EUR")).toThrow();
    expect(() =>
      sdk.collections.getBasicUserInfo(
        "MSISDN/../" as PayerType,
        "256772000000",
      ),
    ).toThrow();
    expect(() =>
      sdk.collections.getBasicUserInfo(
        PayerType.MSISDN,
        "../account/balance?",
      ),
    ).toThrow();
    expect(() => sdk.users.login("../apiuser")).toThrow();
    expect(records).toHaveLength(0);
  });

  it("encodes valid free-form email identifiers without changing routes", async () => {
    const { records } = installDefaultFetch();
    const sdk = clients();
    await sdk.collections.getBasicUserInfo(
      PayerType.EMAIL,
      "alice+payments@example.com",
    );
    await sdk.disbursements.getBasicUserInfo(
      PayerType.EMAIL,
      "alice+payments@example.com",
    );
    expect(
      records
        .filter((record) =>
          new URL(record.url).pathname.endsWith("/basicuserinfo"),
        )
        .map((record) => new URL(record.url).pathname),
    ).toEqual([
      "/collection/v1_0/accountholder/EMAIL/alice%2Bpayments%40example.com/basicuserinfo",
      "/disbursement/v1_0/accountholder/EMAIL/alice%2Bpayments%40example.com/basicuserinfo",
    ]);
  });
});

describe("SEC-003 production transport validation", () => {
  it.each([
    "http://example.com",
    "ftp://example.com",
    "not-a-url",
    "https://user:password@example.com",
    "https://example.com?secret=value",
    "https://example.com/#fragment",
  ])("rejects unsafe production base URL %j without dispatch", (baseUrl) => {
    const { fetchMock } = installDefaultFetch();
    expect(() =>
      create({
        callbackHost: "merchant.example",
        environment: Environment.PRODUCTION,
        baseUrl,
      }),
    ).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts HTTPS production and the official sandbox default", () => {
    expect(() =>
      create({
        callbackHost: "merchant.example",
        environment: Environment.PRODUCTION,
        baseUrl: "https://api.mtn.example/",
      }),
    ).not.toThrow();
    expect(() => create({ callbackHost: "merchant.example" })).not.toThrow();
  });

  it("rejects an unknown runtime environment before dispatch", () => {
    const { fetchMock } = installDefaultFetch();
    expect(() =>
      create({
        callbackHost: "merchant.example",
        environment: "staging" as Environment,
      }),
    ).toThrow("environment must be sandbox or production");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("permits HTTP loopback only while NODE_ENV is test", () => {
    expect(() =>
      create({
        callbackHost: "merchant.example",
        environment: Environment.SANDBOX,
        baseUrl: "http://127.0.0.1:9999",
      }),
    ).not.toThrow();

    expect(() =>
      create({
        callbackHost: "merchant.example",
        environment: Environment.PRODUCTION,
        baseUrl: "http://127.0.0.1:9999",
      }),
    ).toThrow("production baseUrl must use https");

    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(() =>
        create({
          callbackHost: "merchant.example",
          environment: Environment.SANDBOX,
          baseUrl: "http://127.0.0.1:9999",
        }),
      ).toThrow("baseUrl must use https");
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

describe("SEC-004 public error redaction", () => {
  it("removes credentials from network and provider errors recursively", async () => {
    let failBalance = true;
    installDefaultFetch((request) => {
      if (
        failBalance &&
        new URL(request.url).pathname === "/collection/v1_0/account/balance"
      ) {
        throw new TypeError("socket reset");
      }
      return undefined;
    });
    const { collections } = clients();

    const networkError = await collections.getBalance().catch((error) => error);
    expect(networkError).toBeInstanceOf(HttpClientError);
    assertSecretsAbsent(networkError);
    expect(networkError.config).toEqual({
      method: "GET",
      url: "https://sandbox.momodeveloper.mtn.com/collection/v1_0/account/balance",
      timeout: 30_000,
    });

    failBalance = false;
    vi.mocked(fetch).mockImplementationOnce(async () =>
      response(
        {
          code: "NOT_ALLOWED",
          message: `${PRIMARY_KEY} Bearer ${PRODUCT_TOKEN} +256772000000`,
        },
        403,
      ),
    );
    const providerError = await collections.getBalance().catch((error) => error);
    assertSecretsAbsent(providerError);
    expect(providerError.message).toContain("[redacted]");
  });

  it("returns safe timeout, abort, and response-size errors", async () => {
    const timeoutClient = new HttpClient({
      baseURL: "https://example.test",
      timeout: 5,
      headers: {
        Authorization: `Bearer ${PRODUCT_TOKEN}`,
        "Ocp-Apim-Subscription-Key": PRIMARY_KEY,
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: string | URL | Request, init: RequestInit = {}) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      ),
    );
    const timeoutError = await timeoutClient.get("/slow").catch((error) => error);
    expect(timeoutError).toBeInstanceOf(RequestTimeoutError);
    assertSecretsAbsent(timeoutError);

    const controller = new AbortController();
    const abortPromise = timeoutClient.get("/abort", {
      timeout: 1000,
      signal: controller.signal,
    });
    controller.abort();
    const abortError = await abortPromise.catch((error) => error);
    expect(abortError).toBeInstanceOf(RequestAbortedError);
    assertSecretsAbsent(abortError);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response("x".repeat(2048), 200, {
          "content-type": "application/json",
        }),
      ),
    );
    const sizeClient = new HttpClient({
      baseURL: "https://example.test",
      maxResponseBytes: 1024,
      headers: { Authorization: `Bearer ${PRODUCT_TOKEN}` },
    });
    const sizeError = await sizeClient.get("/large").catch((error) => error);
    expect(sizeError).toBeInstanceOf(ResponseSizeLimitError);
    assertSecretsAbsent(sizeError);
  });
});

describe("SEC-005 strict financial amounts", () => {
  const invalidAmounts = [
    "0",
    "0.0",
    "-1",
    "+1",
    "1abc",
    "1e3",
    "1e309",
    "NaN",
    "Infinity",
    "",
    " ",
    " 1",
    "1 ",
  ];

  it.each(invalidAmounts)("rejects malformed amount %j before dispatch", async (amount) => {
    const { records } = installDefaultFetch();
    const sdk = clients();
    const party = {
      partyIdType: PayerType.MSISDN,
      partyId: "256772000000",
    };
    const calls = [
      () =>
        sdk.collections.requestToPay({
          amount,
          currency: "EUR",
          payer: party,
        }),
      () =>
        sdk.collections.requestToWithdraw({
          amount,
          currency: "EUR",
          payee: party,
        }),
      () =>
        sdk.collections.requestToWithdrawV2({
          amount,
          currency: "EUR",
          payee: party,
        }),
      () =>
        sdk.disbursements.transfer({
          amount,
          currency: "EUR",
          payee: party,
        }),
      () =>
        sdk.disbursements.deposit({
          amount,
          currency: "EUR",
          payee: party,
        }),
      () =>
        sdk.disbursements.depositV2({
          amount,
          currency: "EUR",
          payee: party,
        }),
      () =>
        sdk.disbursements.refund({
          amount,
          currency: "EUR",
          referenceIdToRefund: ORIGINAL_REFERENCE_ID,
        }),
      () =>
        sdk.disbursements.refundV2({
          amount,
          currency: "EUR",
          referenceIdToRefund: ORIGINAL_REFERENCE_ID,
        }),
      () =>
        sdk.remittance.transfer({
          amount,
          currency: "EUR",
          payee: party,
        }),
      () =>
        sdk.remittance.cashTransfer({
          amount,
          currency: "EUR",
          payee: party,
        }),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toThrow();
    }
    expect(records).toHaveLength(0);
  });

  it("preserves an exact valid decimal string in the request body", async () => {
    const { records } = installDefaultFetch();
    const { collections } = clients();
    await collections.requestToPay({
      amount: "000" as never,
      currency: "EUR",
      payer: {
        partyIdType: PayerType.MSISDN,
        partyId: "256772000000",
      },
    }).catch(() => undefined);
    expect(records).toHaveLength(0);

    await collections.requestToPay({
      amount: "1234567890.123456789",
      currency: "EUR",
      payer: {
        partyIdType: PayerType.MSISDN,
        partyId: "256772000000",
      },
    });
    const financial = records.find(
      (record) =>
        new URL(record.url).pathname === "/collection/v1_0/requesttopay",
    )!;
    expect(JSON.parse(financial.body).amount).toBe("1234567890.123456789");
  });
});

describe("SEC-006 remittance active-account parsing", () => {
  it.each([
    [{ result: true }, true],
    [{ result: false }, false],
    [{}, false],
    [{ result: "true" }, false],
    ["not-json", false],
  ] as const)("maps provider body %j to %s", async (body, expected) => {
    installDefaultFetch((request) => {
      if (new URL(request.url).pathname.endsWith("/active")) {
        return typeof body === "string"
          ? new Response(body, { status: 200 })
          : response(body);
      }
      return undefined;
    });
    const { remittance } = clients();
    await expect(
      remittance.isPayerActive("256772000000", PayerType.MSISDN),
    ).resolves.toBe(expected);
  });

  it("returns false for 404 and rejects 500", async () => {
    let status = 404;
    installDefaultFetch((request) => {
      if (new URL(request.url).pathname.endsWith("/active")) {
        return response(null, status);
      }
      return undefined;
    });
    const { remittance } = clients();
    await expect(
      remittance.isPayerActive("256772000000", PayerType.MSISDN),
    ).resolves.toBe(false);
    status = 500;
    await expect(
      remittance.isPayerActive("256772000000", PayerType.MSISDN),
    ).rejects.toBeInstanceOf(HttpClientError);
  });
});

describe("SEC-007 explicit OAuth authentication contexts", () => {
  it("uses product, Basic, and consent bearer credentials on the correct endpoints", async () => {
    const { records } = installDefaultFetch();
    const sdk = clients();
    const oauthRequest = {
      grant_type: "urn:openid:params:grant-type:ciba",
      auth_req_id: "auth-request",
    };
    const bcRequest = {
      login_hint: "ID:256772000000/MSISDN",
      scope: "profile",
      access_type: "online" as const,
    };

    await sdk.collections.getBalance();
    await sdk.disbursements.getBalance();
    await sdk.remittance.getBalance();

    await sdk.collections.bcAuthorize(bcRequest);
    await sdk.disbursements.bcAuthorize(bcRequest);
    await sdk.remittance.bcAuthorize(bcRequest);

    await sdk.collections.getOAuth2Token(oauthRequest);
    await sdk.disbursements.getOAuth2Token(oauthRequest);
    await sdk.remittance.getOAuth2Token(oauthRequest);

    await sdk.collections.getUserInfoWithConsent(CONSENT_TOKEN);
    await sdk.disbursements.getUserInfoWithConsent(CONSENT_TOKEN);
    await sdk.remittance.getUserInfoWithConsent(CONSENT_TOKEN);

    const authorizationFor = (path: string) =>
      records.find((record) => new URL(record.url).pathname === path)!.headers
        .authorization;

    for (const path of [
      "/collection/v1_0/account/balance",
      "/disbursement/v1_0/account/balance",
      "/remittance/v1_0/account/balance",
    ]) {
      expect(authorizationFor(path)).toBe(`Bearer ${PRODUCT_TOKEN}`);
    }

    const expectedBasic = `Basic ${Buffer.from(
      `${USER_ID}:${USER_SECRET}`,
    ).toString("base64")}`;
    for (const path of [
      "/collection/v1_0/bc-authorize",
      "/disbursement/v1_0/bc-authorize",
      "/remittance/v1_0/bc-authorize",
      "/collection/oauth2/token/",
      "/disbursement/oauth2/token/",
      "/remittance/oauth2/token/",
    ]) {
      expect(authorizationFor(path)).toBe(expectedBasic);
    }

    for (const path of [
      "/collection/oauth2/v1_0/userinfo",
      "/disbursement/oauth2/v1_0/userinfo",
      "/remittance/oauth2/v1_0/userinfo",
    ]) {
      expect(authorizationFor(path)).toBe(`Bearer ${CONSENT_TOKEN}`);
    }
  });

  it("does not leak product tokens across clients or overwrite explicit authorization", async () => {
    let tokenNumber = 0;
    const { records } = installDefaultFetch((request) => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/token/") && !path.includes("/oauth2/")) {
        tokenNumber += 1;
        return response({
          access_token: `isolated-token-${tokenNumber}`,
          token_type: "Bearer",
          expires_in: 3600,
        });
      }
      return undefined;
    });
    const momo = create({ callbackHost: "merchant.example" });
    const first = momo.Collections(productConfig());
    const second = momo.Collections({
      ...productConfig(),
      userId: SECOND_REFERENCE_ID,
      userSecret: "second-secret",
    });

    await first.getBalance();
    await second.getBalance();
    await first.getUserInfoWithConsent(CONSENT_TOKEN);

    const balanceAuth = records
      .filter(
        (record) =>
          new URL(record.url).pathname === "/collection/v1_0/account/balance",
      )
      .map((record) => record.headers.authorization);
    expect(balanceAuth).toEqual([
      "Bearer isolated-token-1",
      "Bearer isolated-token-2",
    ]);
    expect(
      records.find(
        (record) =>
          new URL(record.url).pathname === "/collection/oauth2/v1_0/userinfo",
      )!.headers.authorization,
    ).toBe(`Bearer ${CONSENT_TOKEN}`);
  });
});

describe("high-priority hardening", () => {
  it.each([
    "https://sandbox.momodeveloper.mtn.com/next",
    "https://attacker.example/steal",
  ])("rejects redirect to %s without following it", async (location) => {
    const { records } = installDefaultFetch((request) => {
      if (new URL(request.url).pathname === "/collection/v1_0/account/balance") {
        return new Response(null, {
          status: 302,
          headers: { location },
        });
      }
      return undefined;
    });
    const { collections } = clients();
    await expect(collections.getBalance()).rejects.toBeInstanceOf(
      UnexpectedRedirectError,
    );
    expect(records.at(-1)!.redirect).toBe("manual");
    expect(records.some((record) => record.url === location)).toBe(false);
  });

  it("coalesces token refreshes and recovers after a failed refresh", async () => {
    const authorizer = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          access_token: PRODUCT_TOKEN,
          token_type: "Bearer",
          expires_in: 3600,
        };
      });
    const refresh = createTokenRefresher(authorizer, {
      callbackHost: "merchant.example",
      environment: Environment.SANDBOX,
      primaryKey: PRIMARY_KEY,
      userId: USER_ID,
      userSecret: USER_SECRET,
    });

    await expect(
      Promise.all([refresh(), refresh(), refresh()]),
    ).rejects.toThrow("temporary failure");
    expect(authorizer).toHaveBeenCalledTimes(1);

    await expect(
      Promise.all(Array.from({ length: 10 }, () => refresh())),
    ).resolves.toEqual(Array(10).fill(PRODUCT_TOKEN));
    expect(authorizer).toHaveBeenCalledTimes(2);
  });

  it("blocks sandbox provisioning in production before dispatch", async () => {
    const { records } = installDefaultFetch();
    const users = create({
      callbackHost: "merchant.example",
      environment: Environment.PRODUCTION,
      baseUrl: "https://api.mtn.example",
    }).Users({ primaryKey: PRIMARY_KEY });

    for (const invoke of [
      () => users.create("merchant.example"),
      () => users.login(USER_ID),
      () => users.getApiUser(USER_ID),
    ]) {
      expect(invoke).toThrow("only available in sandbox");
    }
    expect(records).toHaveLength(0);
  });
});

function assertSecretsAbsent(error: unknown): void {
  const strings = collectStrings(error);
  for (const secret of [
    PRIMARY_KEY,
    USER_SECRET,
    PRODUCT_TOKEN,
    CONSENT_TOKEN,
    Buffer.from(`${USER_ID}:${USER_SECRET}`).toString("base64"),
    "256772000000",
  ]) {
    expect(strings).not.toContain(secret);
  }
}

function collectStrings(value: unknown, seen = new Set<unknown>()): string {
  if (typeof value === "string") return value;
  if (
    value === null ||
    value === undefined ||
    (typeof value !== "object" && typeof value !== "function") ||
    seen.has(value)
  ) {
    return "";
  }
  seen.add(value);
  return Object.getOwnPropertyNames(value)
    .map((key) => {
      try {
        return `${key}:${collectStrings(
          (value as Record<string, unknown>)[key],
          seen,
        )}`;
      } catch {
        return key;
      }
    })
    .join("|");
}
