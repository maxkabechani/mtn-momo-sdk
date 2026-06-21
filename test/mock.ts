import { vi } from "vitest";

import type { Payment } from "../src/collections";
import type { AccessToken, Balance, Credentials } from "../src/common";
import type { Transfer } from "../src/disbursements";
import { HttpClient } from "../src/httpClient";

export const VALID_REFERENCE_ID = "11111111-1111-4111-8111-111111111111";
export const SECOND_REFERENCE_ID = "22222222-2222-4222-8222-222222222222";
export const FAILED_REFERENCE_ID = "ffffffff-ffff-4fff-bfff-ffffffffffff";

type Replier = {
  reply: (status: number, data?: any, headers?: any) => void;
};

export interface MockRequest {
  url: string;
  data?: string | URLSearchParams | null;
  headers?: Record<string, string>;
  method: string;
}

interface MockHistory {
  get: MockRequest[];
  post: MockRequest[];
  put: MockRequest[];
  delete: MockRequest[];
  patch: MockRequest[];
}

export class FetchMockAdapter {
  private client: HttpClient;
  private handlers: { method: string, matcher: string | RegExp, response?: any, status?: number, headers?: any }[] = [];
  public history: MockHistory = {
    get: [],
    post: [],
    put: [],
    delete: [],
    patch: []
  };

  constructor(client: HttpClient) {
    this.client = client;
    
    global.fetch = vi.fn().mockImplementation(async (url: string | URL | globalThis.Request, init?: RequestInit) => {
       const method = (init?.method || 'GET').toUpperCase();
       const urlStr = url.toString();
       const capturedHeaders =
         init?.headers instanceof Headers
           ? Object.fromEntries(init.headers.entries())
           : Array.isArray(init?.headers)
             ? Object.fromEntries(init.headers)
             : ({ ...(init?.headers || {}) } as Record<string, string>);
       
       let requestData = init?.body;
       if (requestData instanceof URLSearchParams) {
         requestData = requestData.toString();
       } else if (typeof requestData !== 'string' && requestData !== undefined) {
         requestData = JSON.stringify(requestData);
       }
       
       const historyKey = method.toLowerCase() as keyof MockHistory;
       this.history[historyKey].push({
          url: urlStr.replace(this.client.defaults.baseURL || "", ""),
          data: requestData,
          headers: capturedHeaders,
          method: method
       });
       
       const handler = this.handlers.find(h => {
          if (h.method !== method) return false;
          let path = urlStr;
          try {
            const urlObj = new URL(urlStr);
            path = urlObj.pathname + urlObj.search;
          } catch(e) {}
          
          if (typeof h.matcher === 'string') {
             return h.matcher === path || h.matcher === urlStr || path.endsWith(h.matcher);
          } else {
             return h.matcher.test(path) || h.matcher.test(urlStr);
          }
       });

       if (!handler) {
         return new Response(null, { status: 404, statusText: "Not Found" });
       }

       const responseBody =
         handler.response === undefined
           ? null
           : typeof handler.response === "string"
             ? handler.response
             : JSON.stringify(handler.response);
       return new Response(responseBody, {
         status: handler.status || 200,
         statusText: "OK",
         headers: handler.headers || { "content-type": "application/json" },
       });
    });
  }

  public resetHistory() {
     this.history = { get: [], post: [], put: [], delete: [], patch: [] };
  }

  private addHandler(method: string, matcher: string | RegExp): Replier {
     const handler = { method, matcher, status: 200, response: undefined, headers: undefined };
     this.handlers.push(handler);
     return {
       reply: (status: number, data?: any, headers?: any) => {
         handler.status = status;
         handler.response = data;
         handler.headers = headers;
       }
     };
  }

  onGet(matcher: string | RegExp) { return this.addHandler('GET', matcher); }
  onPost(matcher: string | RegExp) { return this.addHandler('POST', matcher); }
  onPut(matcher: string | RegExp) { return this.addHandler('PUT', matcher); }
  onDelete(matcher: string | RegExp) { return this.addHandler('DELETE', matcher); }
  onPatch(matcher: string | RegExp) { return this.addHandler('PATCH', matcher); }
}

export function createMock(): [HttpClient, FetchMockAdapter] {
  const client = new HttpClient({
    headers: {
      "Content-Type": "application/json",
    },
  });

  const mock = new FetchMockAdapter(client);

  mock.onGet("/test").reply(200);

  mock.onPost("/v1_0/apiuser").reply(201);

  mock.onPost(/\/v1_0\/apiuser\/[\w\-]+\/apikey/).reply(200, {
    apiKey: "api-key",
  } as Credentials);

  mock.onGet(/\/v1_0\/apiuser\/[\w\-]+/).reply(200, {
    providerCallbackHost: "example.com",
    paymentServerUrl: {
      apiKey: "https://sandbox.momodeveloper.mtn.com",
    },
    targetEnvironment: {
      apiKey: "sandbox",
    },
  });

  // ── Collections ──

  mock.onPost("/collection/token/").reply(200, {
    access_token: "token",
    token_type: "access_token",
    expires_in: 3600,
  } as AccessToken);

  mock
    .onGet(/\/collection\/v1_0\/accountholder\/(MSISDN|EMAIL|PARTY_CODE)\/\w+/i)
    .reply(200, { result: true });

  mock.onPost("/collection/v1_0/requesttopay").reply(201);

  mock.onGet(`/collection/v1_0/requesttopay/${FAILED_REFERENCE_ID}`).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payer: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    payerMessage: "test",
    payeeNote: "test",
    status: "FAILED",
    reason: "PAYER_NOT_FOUND",
  } as Payment);

  mock.onGet(/\/collection\/v1_0\/requesttopay\/[\w\-]+/).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payer: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    payerMessage: "test",
    payeeNote: "test",
    status: "SUCCESSFUL",
  } as Payment);

  mock.onGet("/collection/v1_0/account/balance").reply(200, {
    availableBalance: "2000",
    currency: "UGX",
  } as Balance);

  mock.onGet(/\/collection\/v1_0\/account\/balance\/\w+/).reply(200, {
    availableBalance: "2000",
    currency: "UGX",
  } as Balance);

  mock.onPost("/collection/v1_0/requesttowithdraw").reply(201);
  mock.onPost("/collection/v2_0/requesttowithdraw").reply(201);

  mock.onGet(`/collection/v1_0/requesttowithdraw/${FAILED_REFERENCE_ID}`).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "FAILED",
    reason: "PAYER_NOT_FOUND",
  });

  mock.onGet(/\/collection\/v1_0\/requesttowithdraw\/[\w\-]+/).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "SUCCESSFUL",
  });

  mock.onPost(/\/collection\/v1_0\/requesttopay\/[\w\-]+\/deliverynotification/).reply(200);

  mock.onGet(/\/collection\/v1_0\/accountholder\/\w+\/\w+\/basicuserinfo/i).reply(200, {
    given_name: "John",
    family_name: "Doe"
  });

  mock.onPost("/collection/v1_0/bc-authorize").reply(202, {
    auth_req_id: "auth-id",
    interval: 5,
    expires_in: 600
  });

  mock.onGet("/collection/oauth2/v1_0/userinfo").reply(200, {
    sub: "user-123",
    name: "Test User",
    phone_number: "256772000000",
    status: "ACTIVE",
  });

  mock.onPost("/collection/oauth2/token/").reply(200, {
    access_token: "consent-token",
    token_type: "Bearer",
    expires_in: 3600,
  });

  // ── Disbursements ──

  mock.onPost("/disbursement/token/").reply(200, {
    access_token: "token",
    token_type: "access_token",
    expires_in: 3600,
  } as AccessToken);

  mock.onPost("/oauth2/token/").reply(200, {
    access_token: "token",
    token_type: "access_token",
    expires_in: 3600,
  } as AccessToken);

  mock
    .onGet(
      /\/disbursement\/v1_0\/accountholder\/(msisdn|email|party_code)\/\w+/i,
    )
    .reply(200, { result: true });

  mock.onPost("/disbursement/v1_0/transfer").reply(201);

  mock.onPost("/disbursement/v1_0/deposit").reply(202);
  mock.onPost("/disbursement/v2_0/deposit").reply(202);

  mock.onPost("/disbursement/v1_0/refund").reply(202);
  mock.onPost("/disbursement/v2_0/refund").reply(202);

  mock.onGet(`/disbursement/v1_0/transfer/${FAILED_REFERENCE_ID}`).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "FAILED",
    reason: "PAYER_NOT_FOUND",
  } as Transfer);

  mock.onGet(/\/disbursement\/v1_0\/transfer\/[\w\-]+/).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "SUCCESSFUL",
  } as Transfer);

  mock.onGet(`/disbursement/v1_0/deposit/${FAILED_REFERENCE_ID}`).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "FAILED",
    reason: "PAYER_NOT_FOUND",
  });

  mock.onGet(/\/disbursement\/v1_0\/deposit\/[\w\-]+/).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "SUCCESSFUL",
  });

  mock.onGet(`/disbursement/v1_0/refund/${FAILED_REFERENCE_ID}`).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "FAILED",
    reason: "PAYER_NOT_FOUND",
  });

  mock.onGet(/\/disbursement\/v1_0\/refund\/[\w\-]+/).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "SUCCESSFUL",
  });

  mock.onGet("/disbursement/v1_0/account/balance").reply(200, {
    availableBalance: "2000",
    currency: "UGX",
  } as Balance);

  mock.onGet(/\/disbursement\/v1_0\/account\/balance\/\w+/).reply(200, {
    availableBalance: "2000",
    currency: "UGX",
  } as Balance);

  mock.onGet(/\/disbursement\/v1_0\/accountholder\/\w+\/\w+\/basicuserinfo/i).reply(200, {
    given_name: "John",
    family_name: "Doe"
  });

  mock.onPost("/disbursement/v1_0/bc-authorize").reply(202, {
    auth_req_id: "auth-id",
    interval: 5,
    expires_in: 600
  });

  mock.onGet("/disbursement/oauth2/v1_0/userinfo").reply(200, {
    sub: "user-123",
    name: "Test User",
    phone_number: "256772000000",
    status: "ACTIVE",
  });

  mock.onPost("/disbursement/oauth2/token/").reply(200, {
    access_token: "consent-token",
    token_type: "Bearer",
    expires_in: 3600,
  });

  // ── Remittance ──

  mock.onPost("/remittance/token/").reply(200, {
    access_token: "token",
    token_type: "access_token",
    expires_in: 3600,
  } as AccessToken);

  mock
    .onGet(/\/remittance\/v1_0\/accountholder\/(msisdn|email|party_code)\/\w+\/active/i)
    .reply(200, { result: true });

  mock
    .onPost("/remittance/v1_0/transfer")
    .reply(202, {}, { "x-reference-id": "reference-id" });

  mock.onGet(`/remittance/v1_0/transfer/${FAILED_REFERENCE_ID}`).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "FAILED",
    reason: "PAYER_NOT_FOUND",
  });

  mock.onGet(/\/remittance\/v1_0\/transfer\/[\w\-]+/).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "SUCCESSFUL",
  });

  mock.onGet("/remittance/v1_0/account/balance").reply(200, {
    availableBalance: "2000",
    currency: "UGX",
  } as Balance);

  mock.onGet(/\/remittance\/v1_0\/account\/balance\/\w+/).reply(200, {
    availableBalance: "2000",
    currency: "UGX",
  } as Balance);

  mock.onGet(/\/remittance\/v1_0\/accountholder\/\w+\/\w+\/basicuserinfo/i).reply(200, {
    given_name: "John",
    family_name: "Doe"
  });

  mock.onPost("/remittance/v1_0/bc-authorize").reply(202, {
    auth_req_id: "auth-id",
    interval: 5,
    expires_in: 600
  });

  mock.onGet(/\/remittance\/oauth2\/v1_0\/userinfo/).reply(200, {
    sub: "user-123",
    name: "Test User",
    phone_number: "256772000000",
    status: "ACTIVE",
  });

  mock.onPost("/remittance/v2_0/cashtransfer").reply(202);

  mock.onGet(`/remittance/v2_0/cashtransfer/${FAILED_REFERENCE_ID}`).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "FAILED",
    reason: "PAYER_NOT_FOUND",
  });

  mock.onGet(/\/remittance\/v2_0\/cashtransfer\/[\w\-]+/).reply(200, {
    financialTransactionId: "tx id",
    externalId: "string",
    amount: "2000",
    currency: "UGX",
    payee: {
      partyIdType: "MSISDN",
      partyId: "256772000000",
    },
    status: "SUCCESSFUL",
  });

  mock.onPost("/remittance/oauth2/token/").reply(200, {
    access_token: "consent-token",
    token_type: "Bearer",
    expires_in: 3600,
  });

  mock.onPost("/oauth2/v1_0/bc-authorize/confirm").reply(200);

  return [client, mock];
}
