import axios from "axios";
import type { AxiosInstance } from "axios";
import MockAdapter from "axios-mock-adapter";

import type { Payment } from "../src/collections";
import type { AccessToken, Balance, Credentials } from "../src/common";
import type { Transfer } from "../src/disbursements";

export function createMock(): [AxiosInstance, MockAdapter] {
  const client = axios.create({
    headers: {
      "Content-Type": "application/json",
    },
  });

  const mock = new MockAdapter(client);

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

  mock.onPost("/collection/token/").reply(200, {
    access_token: "token",
    token_type: "access_token",
    expires_in: 3600,
  } as AccessToken);

  mock
    .onGet(/\/collection\/v1_0\/accountholder\/(MSISDN|EMAIL|PARTY_CODE)\/\w+/i)
    .reply(200, { result: true });

  mock.onPost("/collection/v1_0/requesttopay").reply(201);

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

  mock
    .onGet(/\/remittance\/v1_0\/accountholder\/(msisdn|email|party_code)\/\w+\/active/i)
    .reply(200, { result: true });

  mock
    .onPost("/remittance/v1_0/transfer")
    .reply(202, {}, { "x-reference-id": "reference-id" });

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

  mock.onPost("/oauth2/v1_0/bc-authorize/confirm").reply(200);

  return [client, mock];
}
