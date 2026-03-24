import { AssertionError } from "assert";
import { v4 as uuid } from "uuid";
import { expect } from "vitest";

import type { PaymentRequest } from "../src/collections";

import {
  Environment,
  PartyIdType,
  type ProductConfig,
  type SubscriptionConfig,
  type UserConfig,
} from "../src/common";
import type { TransferRequest } from "../src/disbursements";
import {
  validateGlobalConfig,
  validateProductConfig,
  validateRequestToPay,
  validateSubscriptionConfig,
  validateTransfer,
  validateUserConfig,
} from "../src/validate";

describe("Validate", function () {
  describe("validateGlobalConfig", function () {
    describe("when callbackHost is not specified", function () {
      it("throws an error", function () {
        expect(validateGlobalConfig.bind(null, {})).toThrowError(
          "callbackHost is required",
        );
      });
    });

    describe("when callbackHost is specified", function () {
      it("doesn't throw", function () {
        expect(
          validateGlobalConfig.bind(null, { callbackHost: "example.com" }),
        ).not.toThrowError();
      });
    });

    describe("when environment is specified", function () {
      describe("and is not sandbox", function () {
        describe("and baseUrl is not specified", function () {
          it("throws", function () {
            expect(
              validateGlobalConfig.bind(null, {
                callbackHost: "example.com",
                environment: Environment.PRODUCTION,
              }),
            ).toThrowError("baseUrl is required if environment is not sandbox");
          });
        });

        describe("and baseUrl is specified", function () {
          it("doesn't throw", function () {
            expect(
              validateGlobalConfig.bind(null, {
                callbackHost: "example.com",
                environment: Environment.PRODUCTION,
                baseUrl: "mtn production base url",
              }),
            ).not.toThrowError();
          });
        });
      });
    });
  });

  describe("validateProductConfig", function () {
    describe("when primaryKey is not specified", function () {
      it("throws an error", function () {
        expect(
          validateProductConfig.bind(null, {} as ProductConfig),
        ).toThrowError("primaryKey is required");
      });
    });

    describe("when userId is not specified", function () {
      it("throws an error", function () {
        expect(
          validateProductConfig.bind(null, {
            primaryKey: "test primary key",
          } as ProductConfig),
        ).toThrowError("userId is required");
      });
    });

    describe("when userSecret is not specified", function () {
      it("throws an error", function () {
        expect(
          validateProductConfig.bind(null, {
            primaryKey: "test primary key",
            userId: "test user id",
          } as ProductConfig),
        ).toThrowError("userSecret is required");
      });
    });

    describe("when userId is not a valid uuid", function () {
      it("throws an error", function () {
        expect(
          validateProductConfig.bind(null, {
            primaryKey: "test primary key",
            userId: "test user id",
            userSecret: "test user secret",
          }),
        ).toThrowError("userId must be a valid uuid v4");
      });
    });

    describe("when the config is valid", function () {
      it("throws an error", function () {
        expect(
          validateProductConfig.bind(null, {
            primaryKey: "test primary key",
            userId: uuid(),
            userSecret: "test user secret",
          }),
        ).not.toThrowError();
      });
    });
  });

  describe("validateSubscriptionConfig", function () {
    describe("when primaryKey is not specified", function () {
      it("throws an error", function () {
        expect(
          validateSubscriptionConfig.bind(null, {} as SubscriptionConfig),
        ).toThrowError("primaryKey is required");
      });
    });

    describe("when primaryKey is specified", function () {
      it("throws an error", function () {
        expect(
          validateSubscriptionConfig.bind(null, {
            primaryKey: "test primary key",
          }),
        ).not.toThrowError();
      });
    });
  });

  describe("validateUserConfig", function () {
    describe("when userId is not specified", function () {
      it("throws an error", function () {
        expect(validateUserConfig.bind(null, {} as UserConfig)).toThrowError(
          "userId is required",
        );
      });
    });

    describe("when userSecret is not specified", function () {
      it("throws an error", function () {
        expect(
          validateUserConfig.bind(null, {
            userId: "test user id",
          } as UserConfig),
        ).toThrowError("userSecret is required");
      });
    });

    describe("when userId is not a valid uuid", function () {
      it("throws an error", function () {
        expect(
          validateUserConfig.bind(null, {
            userId: "test user id",
            userSecret: "test user secret",
          }),
        ).toThrowError("userId must be a valid uuid v4");
      });
    });

    describe("when the config is valid", function () {
      it("throws an error", function () {
        expect(
          validateUserConfig.bind(null, {
            userId: uuid(),
            userSecret: "test user secret",
          }),
        ).not.toThrowError();
      });
    });
  });

  describe("validateRequestToPay", function () {
    describe("when the amount is missing", function () {
      it("throws an error", async function () {
        const request = {} as PaymentRequest;
        await expect(validateRequestToPay(request)).rejects.toThrowError(
          "amount is required",
        );
      });
    });

    describe("when the amount is not numeric", function () {
      it("throws an error", async function () {
        const request = { amount: "alphabetic" } as PaymentRequest;
        await expect(validateRequestToPay(request)).rejects.toThrowError(
          "amount must be a number",
        );
      });
    });

    describe("when the currency is missing", function () {
      it("throws an error", async function () {
        const request = {
          amount: "1000",
        } as PaymentRequest;
        await expect(validateRequestToPay(request)).rejects.toThrowError(
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
        await expect(validateRequestToPay(request)).rejects.toThrowError(
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
        await expect(validateRequestToPay(request)).rejects.toThrowError(
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
        await expect(validateRequestToPay(request)).rejects.toThrowError(
          "payer.partyIdType is required",
        );
      });
    });

    describe("when the request is valid", function () {
      it("fulfills", async function () {
        const request = {
          amount: "1000",
          currency: "UGX",
          payer: {
            partyId: "xxx",
            partyIdType: PartyIdType.MSISDN,
          },
        } as PaymentRequest;
        await expect(validateRequestToPay(request)).resolves.toBeUndefined();
      });
    });
  });

  describe("validateTransfer", function () {
    describe("when the referenceId is missing", function () {
      it("throws an error", async function () {
        const request = {} as TransferRequest;
        await expect(validateTransfer(request)).rejects.toThrowError(
          "referenceId is required",
        );
      });
    });

    describe("when referenceId is not a valid uuid", function () {
      it("throws an error", async function () {
        const request = { referenceId: "test reference id" } as TransferRequest;
        await expect(validateTransfer(request)).rejects.toThrowError(
          "referenceId must be a valid uuid v4",
        );
      });
    });

    describe("when the amount is missing", function () {
      it("throws an error", async function () {
        const request = { referenceId: uuid() } as TransferRequest;
        await expect(validateTransfer(request)).rejects.toThrowError(
          "amount is required",
        );
      });
    });

    describe("when the amount is not numeric", function () {
      it("throws an error", async function () {
        const request = {
          referenceId: uuid(),
          amount: "alphabetic",
        } as TransferRequest;
        await expect(validateTransfer(request)).rejects.toThrowError(
          "amount must be a number",
        );
      });
    });

    describe("when the currency is missing", function () {
      it("throws an error", async function () {
        const request = {
          referenceId: uuid(),
          amount: "1000",
        } as TransferRequest;
        await expect(validateTransfer(request)).rejects.toThrowError(
          "currency is required",
        );
      });
    });

    describe("when the payee is missing", function () {
      it("throws an error", async function () {
        const request = {
          referenceId: uuid(),
          amount: "1000",
          currency: "UGX",
        } as TransferRequest;
        await expect(validateTransfer(request)).rejects.toThrowError(
          "payee is required",
        );
      });
    });

    describe("when the party id is missing", function () {
      it("throws an error", async function () {
        const request = {
          referenceId: uuid(),
          amount: "1000",
          currency: "UGX",
          payee: {},
        } as TransferRequest;
        await expect(validateTransfer(request)).rejects.toThrowError(
          "payee.partyId is required",
        );
      });
    });

    describe("when the party id type is missing", function () {
      it("throws an error", async function () {
        const request = {
          referenceId: uuid(),
          amount: "1000",
          currency: "UGX",
          payee: {
            partyId: "xxx",
          },
        } as TransferRequest;
        await expect(validateTransfer(request)).rejects.toThrowError(
          "payee.partyIdType is required",
        );
      });
    });

    describe("when the request is valid", function () {
      it("fulfills", async function () {
        const request = {
          referenceId: uuid(),
          amount: "1000",
          currency: "UGX",
          payee: {
            partyId: "xxx",
            partyIdType: PartyIdType.MSISDN,
          },
        } as TransferRequest;
        await expect(validateTransfer(request)).resolves.toBeUndefined();
      });
    });
  });
});
