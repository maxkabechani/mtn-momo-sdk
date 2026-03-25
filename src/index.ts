export type { Payment, PaymentRequest } from "./collections";
export type { Transfer, TransferRequest } from "./disbursements";
export type {
  Withdrawal,
  WithdrawalRequest,
  Deposit,
  DepositRequest,
  Refund,
  RefundRequest,
  CashTransfer,
  CashTransferRequest,
} from "./common";
export * from "./errors";
export {
  PartyIdType as PayerType,
  TransactionStatus as Status,
  Environment,
} from "./common";
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
} from "./common";

import type { AxiosInstance } from "axios";

import Collections from "./collections";
import Disbursements from "./disbursements";
import Remittance from "./remittance";
import Users from "./users";

import {
  authorizeCollections,
  authorizeDisbursements,
  authorizeRemittance,
  createTokenRefresher,
} from "./auth";
import { createAuthClient, createClient } from "./client";
import {
  validateGlobalConfig,
  validateProductConfig,
  validateSubscriptionConfig,
} from "./validate";

import { Environment } from "./common";
import type {
  Config,
  GlobalConfig,
  ProductConfig,
  SubscriptionConfig,
} from "./common";

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

      const client: AxiosInstance = createAuthClient(
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

      const client: AxiosInstance = createAuthClient(
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

      const client: AxiosInstance = createAuthClient(
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

      const client: AxiosInstance = createClient(config);

      return new Users(client);
    },
  };
}
