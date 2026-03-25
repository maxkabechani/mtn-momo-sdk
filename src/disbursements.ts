import type { AxiosInstance } from "axios";
import { v4 as uuid } from "uuid";

import { getTransactionError } from "./errors";
import { validateTransfer, validateDepositRequest, validateRefundRequest } from "./validate";
import { createBasicAuthToken } from "./auth";
import type { Config } from "./common";

import {
  type Balance,
  type BasicUserInfo,
  type BcAuthorizeRequest,
  type BcAuthorizeResponse,
  type ConsentKycResponse,
  type Deposit,
  type DepositRequest,
  FailureReason,
  type OAuth2TokenRequest,
  type OAuth2TokenResponse,
  PartyIdType,
  type Refund,
  type RefundRequest,
  TransactionStatus,
} from "./common";

export interface TransferRequest {
  /**
   * Unique Transfer Reference (UUID v4), will be automatically generated if not explicitly supplied
   */
  referenceId?: string;
  /**
   * Amount that will be debited from the payer account.
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
   *   MSISDN - Mobile Number validated according to ITU-T E.164. Validated with IsMSISDN
   *   EMAIL - Validated to be a valid e-mail format. Validated with IsEmail
   *   PARTY_CODE - UUID of the party. Validated with IsUuid
   */
  payee: {
    partyIdType: PartyIdType;
    partyId: string;
  };

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

export interface Transfer {
  /**
   * Amount that will be debited from the payer account.
   */
  amount: string;

  /**
   * ISO4217 Currency
   */
  currency: string;

  /**
   * Financial transactionIdd from mobile money manager.
   * Used to connect to the specific financial transaction made in the account
   */
  financialTransactionId: string;

  /**
   * External id is used as a reference to the transaction.
   * External id is used for reconciliation.
   * The external id will be included in transaction history report.
   * External id is not required to be unique.
   */
  externalId: string;

  /**
   * Party identifies a account holder in the wallet platform.
   * Party consists of two parameters, type and partyId.
   * Each type have its own validation of the partyId
   *   MSISDN - Mobile Number validated according to ITU-T E.164. Validated with IsMSISDN
   *   EMAIL - Validated to be a valid e-mail format. Validated with IsEmail
   *   PARTY_CODE - UUID of the party. Validated with IsUuid
   */
  payee: {
    partyIdType: "MSISDN";
    partyId: string;
  };
  status: TransactionStatus;
  reason?: FailureReason;
}

export default class Disbursements {
  private client: AxiosInstance;
  private config: Config;

  constructor(client: AxiosInstance, config: Config) {
    this.client = client;
    this.config = config;
  }

  /**
   * Transfer operation is used to transfer an amount from the owner’s
   * account to a payee account.
   * Status of the transaction can be validated by using the
   *
   * @param paymentRequest
   */
  public transfer({
    callbackUrl,
    referenceId = uuid(),
    ...payoutRequest
  }: TransferRequest): Promise<string> {
    return validateTransfer({ referenceId, ...payoutRequest }).then(() => {
      return this.client
        .post<void>("/disbursement/v1_0/transfer", payoutRequest, {
          headers: {
            "X-Reference-Id": referenceId,
            ...(callbackUrl ? { "X-Callback-Url": callbackUrl } : {}),
          },
        })
        .then(() => referenceId);
    });
  }

  /**
   * This method is used to retrieve the transaction. You can invoke this method
   * to at intervals until your transaction fails or succeeds.
   *
   * If the transaction has failed, it will throw an appropriate error. The error will be a subclass
   * of `MtnMoMoError`. Check [`src/error.ts`](https://github.com/maxkabechani/mtn-momo-sdk/blob/master/src/errors.ts)
   * for the various errors that can be thrown
   *
   * @param referenceId the value returned from `transfer`
   */
  public getTransaction(referenceId: string): Promise<Transfer> {
    return this.client
      .get<Transfer>(`/disbursement/v1_0/transfer/${referenceId}`)
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
      .get<Balance>("/disbursement/v1_0/account/balance")
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
    return this.client
      .get<{ result: boolean }>(
        `/disbursement/v1_0/accountholder/${type}/${id}/active`,
      )
      .then((response) => response.data)
      .then((data) => (data.result !== undefined ? data.result : false));
  }

  /**
   * Deposit money into a payee account (V1).
   *
   * @param depositRequest The deposit request details
   * @returns A promise that resolves to the deposit reference ID
   */
  public deposit(depositRequest: DepositRequest): Promise<string> {
    const referenceId: string = uuid();
    return validateDepositRequest(depositRequest).then(() => {
      return this.client
        .post<void>(
          "/disbursement/v1_0/deposit",
          {
            amount: depositRequest.amount,
            currency: depositRequest.currency,
            externalId: depositRequest.externalId,
            payee: depositRequest.payee,
            payerMessage: depositRequest.payerMessage,
            payeeNote: depositRequest.payeeNote,
          },
          {
            headers: {
              "X-Reference-Id": referenceId,
              ...(depositRequest.callbackUrl
                ? { "X-Callback-Url": depositRequest.callbackUrl }
                : {}),
            },
          },
        )
        .then(() => referenceId);
    });
  }

  /**
   * Deposit money into a payee account (V2).
   *
   * @param depositRequest The deposit request details
   * @returns A promise that resolves to the deposit reference ID
   */
  public depositV2(depositRequest: DepositRequest): Promise<string> {
    const referenceId: string = uuid();
    return validateDepositRequest(depositRequest).then(() => {
      return this.client
        .post<void>(
          "/disbursement/v2_0/deposit",
          {
            amount: depositRequest.amount,
            currency: depositRequest.currency,
            externalId: depositRequest.externalId,
            payee: depositRequest.payee,
            payerMessage: depositRequest.payerMessage,
            payeeNote: depositRequest.payeeNote,
          },
          {
            headers: {
              "X-Reference-Id": referenceId,
              ...(depositRequest.callbackUrl
                ? { "X-Callback-Url": depositRequest.callbackUrl }
                : {}),
            },
          },
        )
        .then(() => referenceId);
    });
  }

  /**
   * Get the details and status of a deposit transaction.
   *
   * @param referenceId The deposit reference ID from deposit
   * @returns A promise that resolves to the deposit details
   */
  public getDeposit(referenceId: string): Promise<Deposit> {
    return this.client
      .get<Deposit>(`/disbursement/v1_0/deposit/${referenceId}`)
      .then((response) => response.data)
      .then((deposit) => {
        if (deposit.status === TransactionStatus.FAILED) {
          return Promise.reject(getTransactionError(deposit));
        }
        return Promise.resolve(deposit);
      });
  }

  /**
   * Refund money from a previous transfer or deposit (V1).
   *
   * @param refundRequest The refund request details
   * @returns A promise that resolves to the refund reference ID
   */
  public refund(refundRequest: RefundRequest): Promise<string> {
    const referenceId: string = uuid();
    return validateRefundRequest(refundRequest).then(() => {
      return this.client
        .post<void>(
          "/disbursement/v1_0/refund",
          {
            amount: refundRequest.amount,
            currency: refundRequest.currency,
            externalId: refundRequest.externalId,
            payerMessage: refundRequest.payerMessage,
            payeeNote: refundRequest.payeeNote,
            referenceIdToRefund: refundRequest.referenceIdToRefund,
          },
          {
            headers: {
              "X-Reference-Id": referenceId,
            },
          },
        )
        .then(() => referenceId);
    });
  }

  /**
   * Refund money from a previous transfer or deposit (V2).
   *
   * @param refundRequest The refund request details
   * @returns A promise that resolves to the refund reference ID
   */
  public refundV2(refundRequest: RefundRequest): Promise<string> {
    const referenceId: string = uuid();
    return validateRefundRequest(refundRequest).then(() => {
      return this.client
        .post<void>(
          "/disbursement/v2_0/refund",
          {
            amount: refundRequest.amount,
            currency: refundRequest.currency,
            externalId: refundRequest.externalId,
            payerMessage: refundRequest.payerMessage,
            payeeNote: refundRequest.payeeNote,
            referenceIdToRefund: refundRequest.referenceIdToRefund,
          },
          {
            headers: {
              "X-Reference-Id": referenceId,
            },
          },
        )
        .then(() => referenceId);
    });
  }

  /**
   * Get the details and status of a refund transaction.
   *
   * @param referenceId The refund reference ID from refund
   * @returns A promise that resolves to the refund details
   */
  public getRefund(referenceId: string): Promise<Refund> {
    return this.client
      .get<Refund>(`/disbursement/v1_0/refund/${referenceId}`)
      .then((response) => response.data)
      .then((refund) => {
        if (refund.status === TransactionStatus.FAILED) {
          return Promise.reject(getTransactionError(refund));
        }
        return Promise.resolve(refund);
      });
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
    return this.client
      .get<BasicUserInfo>(
        `/disbursement/v1_0/accountholder/${partyIdType}/${partyId}/basicuserinfo`,
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
      .get<Balance>(`/disbursement/v1_0/account/balance/${currency}`)
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

    const basicAuthToken: string = createBasicAuthToken(this.config);

    return this.client
      .post<BcAuthorizeResponse>("/disbursement/v1_0/bc-authorize", params, {
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
  public getUserInfoWithConsent(): Promise<ConsentKycResponse> {
    return this.client
      .get<ConsentKycResponse>("/disbursement/oauth2/v1_0/userinfo")
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

    return this.client
      .post<OAuth2TokenResponse>("/disbursement/oauth2/token/", params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .then((response) => response.data);
  }
}
