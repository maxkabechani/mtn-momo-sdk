import type { HttpClient } from "./httpClient.js";

import { createBasicAuthToken } from "./auth.js";
import { getTransactionError } from "./errors.js";
import {
  validateRequestToPay,
  validateWithdrawalRequest,
} from "./validate.js";

import {
  type Balance,
  type BasicUserInfo,
  type BcAuthorizeRequest,
  type BcAuthorizeResponse,
  type Config,
  type ConsentKycResponse,
  type DeliveryNotification,
  FailureReason,
  type OAuth2TokenRequest,
  type OAuth2TokenResponse,
  type Party,
  PartyIdType,
  TransactionStatus,
  type Withdrawal,
  type WithdrawalRequest,
} from "./common.js";
import {
  pathCurrency,
  pathPartyId,
  pathPartyType,
  pathUuid,
  resolveReferenceId,
  validateAccessToken,
  type FinancialOperationOptions,
} from "./security.js";

export interface PaymentRequest extends FinancialOperationOptions {
  /**
   * Amount that will be debited from the payer account
   */
  amount: string;

  /**
   * ISO4217 Currency
   */
  currency: string;

  /**
   * External id is used as a reference to the transaction.
   * External id is used for reconciliation.
   * The external id will be included in transaction history report.
   * External id is not required to be unique.
   */
  externalId?: string;

  /**
   * Party identifies a account holder in the wallet platform.
   * Party consists of two parameters, type and partyId.
   * Each type have its own validation of the partyId
   *   - MSISDN - Mobile Number validated according to ITU-T E.164. Validated with IsMSISDN
   *   - EMAIL - Validated to be a valid e-mail format. Validated with IsEmail
   *   - PARTY_CODE - UUID of the party. Validated with IsUuid
   */
  payer: Party;

  /**
   * Message that will be written in the payer transaction history message field.
   */
  payerMessage?: string;

  /**
   * Message that will be written in the payee transaction history note field.
   */
  payeeNote?: string;

  /**
   * URL to the server where the callback should be sent.
   */
  callbackUrl?: string;
}

export interface Payment {
  /**
   * Financial transactionIdd from mobile money manager.
   * Used to connect to the specific financial transaction made in the account
   */
  financialTransactionId: string;

  /**
   * External id provided in the creation of the requestToPay transaction
   */
  externalId: string;

  /**
   * Amount that will be debited from the payer account.
   */
  amount: string;

  /**
   * ISO4217 Currency
   */
  currency: string;

  /**
   * Party identifies a account holder in the wallet platform.
   * Party consists of two parameters, type and partyId.
   * Each type have its own validation of the partyId
   *   - MSISDN - Mobile Number validated according to ITU-T E.164. Validated with IsMSISDN
   *   - EMAIL - Validated to be a valid e-mail format. Validated with IsEmail
   *   - PARTY_CODE - UUID of the party. Validated with IsUuid
   */
  payer: Party;

  /**
   * Message that will be written in the payer transaction history message field.
   */
  payerMessage: string;

  /**
   * Message that will be written in the payee transaction history note field.
   */
  payeeNote: string;

  reason?: FailureReason;

  status: TransactionStatus;
}

export default class Collections {
  private client: HttpClient;
  private config: Config;

  constructor(client: HttpClient, config: Config) {
    this.client = client;
    this.config = config;
  }

  /**
   * This method is used to request a payment from a consumer (Payer).
   * The payer will be asked to authorize the payment. The transaction will
   * be executed once the payer has authorized the payment.
   * The requesttopay will be in status PENDING until the transaction
   * is authorized or declined by the payer or it is timed out by the system.
   * Status of the transaction can be validated by using `getTransation`
   *
   * @param paymentRequest
   */
  public requestToPay(request: PaymentRequest): Promise<string> {
    const {
      callbackUrl,
      referenceId: suppliedReferenceId,
      ...paymentRequest
    } = request;
    return validateRequestToPay(request).then(() => {
      const referenceId = resolveReferenceId(suppliedReferenceId);
      return this.client
        .post<void>("/collection/v1_0/requesttopay", paymentRequest, {
          headers: {
            "X-Reference-Id": referenceId,
            ...(callbackUrl ? { "X-Callback-Url": callbackUrl } : {}),
          },
        })
        .then(() => referenceId);
    });
  }

  /**
   * This method is used to retrieve transaction information. You can invoke it
   * at intervals until your transaction fails or succeeds.
   *
   * If the transaction has failed, it will throw an appropriate error. The error will be a subclass
   * of `MtnMoMoError`. Check [`src/error.ts`](https://github.com/maxkabechani/mtn-momo-sdk/blob/master/src/errors.ts)
   * for the various errors that can be thrown
   *
   * @param referenceId the value returned from `requestToPay`
   */
  public getTransaction(referenceId: string): Promise<Payment> {
    return this.client
      .get<Payment>(
        `/collection/v1_0/requesttopay/${pathUuid(referenceId)}`,
      )
      .then((response) => response.data)
      .then((transaction) => {
        if (transaction.status === TransactionStatus.FAILED) {
          return Promise.reject(getTransactionError(transaction));
        }

        return Promise.resolve(transaction);
      });
  }

  /**
   * Get the balance of the account.
   */
  public getBalance(): Promise<Balance> {
    return this.client
      .get<Balance>("/collection/v1_0/account/balance")
      .then((response) => response.data);
  }

  /**
   * This method is used to check if an account holder is registered and active in the system.
   *
   * @param id Specifies the type of the party ID. Allowed values [msisdn, email, party_code].
   *   accountHolderId should explicitly be in small letters.
   *
   * @param type The party number. Validated according to the party ID type (case Sensitive).
   *   msisdn - Mobile Number validated according to ITU-T E.164. Validated with IsMSISDN
   *   email - Validated to be a valid e-mail format. Validated with IsEmail
   *   party_code - UUID of the party. Validated with IsUuid
   */
  public isPayerActive(
    id: string,
    type: PartyIdType = PartyIdType.MSISDN,
  ): Promise<boolean> {
    const safeType = pathPartyType(type);
    const safeId = pathPartyId(safeType, id);
    return this.client
      .get<{ result: boolean }>(
        `/collection/v1_0/accountholder/${safeType}/${safeId}/active`,
      )
      .then((response) => response.data)
      .then((data) => (data.result !== undefined ? data.result : false));
  }

  /**
   * This method is used to request a withdrawal from a payer account (V1).
   * The payer will be asked to authorize the withdrawal.
   *
   * @param withdrawalRequest The withdrawal request details
   * @returns A promise that resolves to the withdrawal reference ID
   */
  public requestToWithdraw(
    withdrawalRequest: WithdrawalRequest,
  ): Promise<string> {
    return validateWithdrawalRequest(withdrawalRequest).then(() => {
      const referenceId = resolveReferenceId(withdrawalRequest.referenceId);
      return this.client
        .post<void>(
          "/collection/v1_0/requesttowithdraw",
          {
            amount: withdrawalRequest.amount,
            currency: withdrawalRequest.currency,
            externalId: withdrawalRequest.externalId,
            payee: withdrawalRequest.payee,
            payerMessage: withdrawalRequest.payerMessage,
            payeeNote: withdrawalRequest.payeeNote,
          },
          {
            headers: {
              "X-Reference-Id": referenceId,
              ...(withdrawalRequest.callbackUrl
                ? { "X-Callback-Url": withdrawalRequest.callbackUrl }
                : {}),
            },
          },
        )
        .then(() => referenceId);
    });
  }

  /**
   * This method is used to request a withdrawal from a payer account (V2).
   * The payer will be asked to authorize the withdrawal.
   *
   * @param withdrawalRequest The withdrawal request details
   * @returns A promise that resolves to the withdrawal reference ID
   */
  public requestToWithdrawV2(
    withdrawalRequest: WithdrawalRequest,
  ): Promise<string> {
    return validateWithdrawalRequest(withdrawalRequest).then(() => {
      const referenceId = resolveReferenceId(withdrawalRequest.referenceId);
      return this.client
        .post<void>(
          "/collection/v2_0/requesttowithdraw",
          {
            amount: withdrawalRequest.amount,
            currency: withdrawalRequest.currency,
            externalId: withdrawalRequest.externalId,
            payee: withdrawalRequest.payee,
            payerMessage: withdrawalRequest.payerMessage,
            payeeNote: withdrawalRequest.payeeNote,
          },
          {
            headers: {
              "X-Reference-Id": referenceId,
              ...(withdrawalRequest.callbackUrl
                ? { "X-Callback-Url": withdrawalRequest.callbackUrl }
                : {}),
            },
          },
        )
        .then(() => referenceId);
    });
  }

  /**
   * Get the details and status of a withdrawal request.
   *
   * @param referenceId The withdrawal reference ID from requestToWithdraw
   * @returns A promise that resolves to the withdrawal details
   */
  public getWithdrawal(referenceId: string): Promise<Withdrawal> {
    return this.client
      .get<Withdrawal>(
        `/collection/v1_0/requesttowithdraw/${pathUuid(referenceId)}`,
      )
      .then((response) => response.data)
      .then((withdrawal) => {
        if (withdrawal.status === TransactionStatus.FAILED) {
          return Promise.reject(getTransactionError(withdrawal));
        }
        return Promise.resolve(withdrawal);
      });
  }

  /**
   * Send a delivery notification for a completed request to pay.
   *
   * @param referenceId The request to pay reference ID
   * @param notification The delivery notification details
   * @returns A promise that resolves when the notification is sent
   */
  public sendDeliveryNotification(
    referenceId: string,
    notification: DeliveryNotification,
  ): Promise<void> {
    if (
      typeof notification?.notificationMessage !== "string" ||
      notification.notificationMessage.length === 0 ||
      notification.notificationMessage.length > 160 ||
      /[\r\n]/.test(notification.notificationMessage)
    ) {
      throw new TypeError(
        "notificationMessage must be between 1 and 160 characters",
      );
    }
    return this.client
      .post<void>(
        `/collection/v1_0/requesttopay/${pathUuid(referenceId)}/deliverynotification`,
        null,
        {
          headers: {
            notificationMessage: notification.notificationMessage,
            ...(notification.language
              ? { Language: notification.language }
              : {}),
          },
        },
      )
      .then(() => undefined);
  }

  /**
   * Get basic user information for an account holder.
   *
   * @param partyIdType The type of party ID (MSISDN, EMAIL, or PARTY_CODE)
   * @param partyId The party identifier
   * @returns A promise that resolves to the basic user information
   */
  public getBasicUserInfo(
    partyIdType: PartyIdType,
    partyId: string,
  ): Promise<BasicUserInfo> {
    const safeType = pathPartyType(partyIdType);
    const safeId = pathPartyId(safeType, partyId);
    return this.client
      .get<BasicUserInfo>(
        `/collection/v1_0/accountholder/${safeType}/${safeId}/basicuserinfo`,
      )
      .then((response) => response.data);
  }

  /**
   * Get the balance of the account in a specific currency.
   *
   * @param currency The ISO4217 currency code
   * @returns A promise that resolves to the account balance in the specified currency
   */
  public getBalanceInCurrency(currency: string): Promise<Balance> {
    return this.client
      .get<Balance>(
        `/collection/v1_0/account/balance/${pathCurrency(currency)}`,
      )
      .then((response) => response.data);
  }

  /**
   * Request Biometric Consent (BC) authorization.
   * This initiates the BC authorization flow for enhanced security.
   *
   * @param request The BC authorization request
   * @returns A promise that resolves to the BC authorization response with auth_req_id
   */
  public bcAuthorize(
    request: BcAuthorizeRequest,
  ): Promise<BcAuthorizeResponse> {
    const params = new URLSearchParams();
    params.append("login_hint", request.login_hint);
    params.append("scope", request.scope);
    params.append("access_type", request.access_type);
    if (request.consent_valid_in) {
      params.append("consent_valid_in", String(request.consent_valid_in));
    }
    if (request.client_notification_token) {
      params.append("client_notification_token", request.client_notification_token);
    }
    if (request.scope_instruction) {
      params.append("scope_instruction", request.scope_instruction);
    }

    const basicAuthToken = createBasicAuthToken(this.config);
    return this.client
      .post<BcAuthorizeResponse>("/collection/v1_0/bc-authorize", params, {
        headers: {
          Authorization: `Basic ${basicAuthToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .then((response) => response.data);
  }

  /**
   * Retrieve user information with KYC consent (OAuth2-gated endpoint).
   * Requires prior OAuth2 user consent/login flow to obtain authorization.
   *
   * @returns A promise that resolves to the user's information and KYC consent details
   */
  public getUserInfoWithConsent(
    consentToken: string,
  ): Promise<ConsentKycResponse> {
    validateAccessToken(consentToken);
    return this.client
      .get<ConsentKycResponse>("/collection/oauth2/v1_0/userinfo", {
        headers: {
          Authorization: `Bearer ${consentToken}`,
        },
      })
      .then((response) => response.data);
  }

  /**
   * Create an OAuth2 token for consent-based access.
   *
   * @param request The OAuth2 token request parameters
   * @returns A promise that resolves to the OAuth2 token response
   */
  public getOAuth2Token(
    request: OAuth2TokenRequest,
  ): Promise<OAuth2TokenResponse> {
    const params = new URLSearchParams();
    params.append("grant_type", request.grant_type);
    params.append("auth_req_id", request.auth_req_id);

    const basicAuthToken = createBasicAuthToken(this.config);
    return this.client
      .post<OAuth2TokenResponse>("/collection/oauth2/token/", params, {
        headers: {
          Authorization: `Basic ${basicAuthToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .then((response) => response.data);
  }
}
