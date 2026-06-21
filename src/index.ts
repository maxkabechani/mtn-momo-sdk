export type { Payment, PaymentRequest } from "./collections.js";
export type { Transfer, TransferRequest } from "./disbursements.js";
export type {
  Withdrawal,
  WithdrawalRequest,
  Deposit,
  DepositRequest,
  Refund,
  RefundRequest,
  CashTransfer,
  CashTransferRequest,
} from "./common.js";
export * from "./errors.js";
export {
  generateReferenceId,
  type FinancialOperationOptions,
} from "./security.js";
export {
  PartyIdType as PayerType,
  TransactionStatus as Status,
  Environment,
} from "./common.js";
export type {
  ApiUserInfo,
  Party as Payer,
  Balance,
  FailureReason,
  GlobalConfig,
  ProductConfig,
  BasicUserInfo,
  BcAuthorizeRequest,
  BcAuthorizeResponse,
  OAuth2TokenRequest,
  OAuth2TokenResponse,
  ConsentKycResponse,
  DeliveryNotification,
} from "./common.js";

import type { HttpClient } from "./httpClient.js";

import Collections from "./collections.js";
import Disbursements from "./disbursements.js";
import Remittance from "./remittance.js";
import Users from "./users.js";

import {
  authorizeCollections,
  authorizeDisbursements,
  authorizeRemittance,
  createTokenRefresher,
} from "./auth.js";
import { createAuthClient, createClient } from "./client.js";
import {
  validateGlobalConfig,
  validateProductConfig,
  validateSubscriptionConfig,
} from "./validate.js";

import { Environment } from "./common.js";
import type {
  Config,
  GlobalConfig,
  ProductConfig,
  SubscriptionConfig,
} from "./common.js";

export interface MomoClient {
  Collections(productConfig: ProductConfig): Collections;
  Disbursements(productConfig: ProductConfig): Disbursements;
  Remittance(productConfig: ProductConfig): Remittance;
  Users(subscription: SubscriptionConfig): Users;
}

const defaultGlobalConfig: GlobalConfig = {
  baseUrl: "https://sandbox.momodeveloper.mtn.com",
  environment: Environment.SANDBOX,
};

/**
 * Initialise the library
 *
 * @param globalConfig Global configuration required to use any product
 */
export function create(globalConfig: GlobalConfig): MomoClient {
  validateGlobalConfig(globalConfig);

  return {
    Collections(productConfig: ProductConfig): Collections {
      validateProductConfig(productConfig);

      const config: Config = {
        ...defaultGlobalConfig,
        ...globalConfig,
        ...productConfig,
      };

      const client: HttpClient = createAuthClient(
        createTokenRefresher(authorizeCollections, config),
        createClient(config),
      );
      return new Collections(client, config);
    },

    Disbursements(productConfig: ProductConfig): Disbursements {
      validateProductConfig(productConfig);

      const config: Config = {
        ...defaultGlobalConfig,
        ...globalConfig,
        ...productConfig,
      };

      const client: HttpClient = createAuthClient(
        createTokenRefresher(authorizeDisbursements, config),
        createClient(config),
      );

      return new Disbursements(client, config);
    },

    Remittance(productConfig: ProductConfig): Remittance {
      validateProductConfig(productConfig);

      const config: Config = {
        ...defaultGlobalConfig,
        ...globalConfig,
        ...productConfig,
      };

      const client: HttpClient = createAuthClient(
        createTokenRefresher(authorizeRemittance, config),
        createClient(config),
      );

      return new Remittance(client, config);
    },

    Users(subscriptionConfig: SubscriptionConfig): Users {
      validateSubscriptionConfig(subscriptionConfig);

      const config: GlobalConfig & SubscriptionConfig = {
        ...defaultGlobalConfig,
        ...globalConfig,
        ...subscriptionConfig,
      };

      const client: HttpClient = createClient(config);

      return new Users(client, config.environment ?? Environment.SANDBOX);
    },
  };
}
