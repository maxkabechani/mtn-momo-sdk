import type { HttpClient } from "./httpClient";

import type {
  Balance,
  BasicUserInfo,
  BcAuthorizeRequest,
  BcAuthorizeResponse,
  CashTransfer,
  CashTransferRequest,
  ConsentKycResponse,
  OAuth2TokenRequest,
  OAuth2TokenResponse,
  Party,
  ProductConfig,
} from "./common";
import { TransactionStatus, PartyIdType } from "./common";
import { getTransactionError, MtnMoMoError } from "./errors";
import { createBasicAuthToken } from "./auth";
import type { Config } from "./common";

import { v4 as uuid } from "uuid";

/**
 * Remittance product for cross-border money transfers with optional OAuth2 consent flows
 */
export default class Remittance {
  private readonly client: HttpClient;
  private readonly config: Config;

  constructor(client: HttpClient, config: Config) {
    this.client = client;
    this.config = config;
  }

  /**
   * Send money across borders to a beneficiary
   * @param request - The cash transfer request details (amount, currency, beneficiary, etc.)
   * @returns A promise that resolves to the financial transaction ID (referenceId)
   */
  async transfer(request: CashTransferRequest): Promise<string> {
    const referenceId = uuid();
    await this.client.post(
      `/remittance/v1_0/transfer`,
      {
        amount: request.amount,
        currency: request.currency,
        externalId: request.externalId,
        payee: request.payee,
        originatingCountry: request.originatingCountry,
        originalAmount: request.originalAmount,
        originalCurrency: request.originalCurrency,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      },
      {
        headers: {
          "X-Reference-Id": referenceId,
          "Content-Type": "application/json",
          ...(request.callbackUrl
            ? { "X-Callback-Url": request.callbackUrl }
            : {}),
        },
      },
    );

    return referenceId;
  }

  /**
   * Get the details and status of a specific transfer
   * @param referenceId - The unique identifier of the transfer transaction
   * @returns A promise that resolves to the transfer details and status
   */
  async getTransaction(referenceId: string): Promise<CashTransfer> {
    const response = await this.client.get<CashTransfer>(
      `/remittance/v1_0/transfer/${referenceId}`,
    );

    const transaction = response.data;
    if (transaction.status === TransactionStatus.FAILED) {
      return Promise.reject(getTransactionError(transaction));
    }

    return transaction;
  }

  /**
   * Get the current account balance
   * @returns A promise that resolves to the account balance with currency information
   */
  async getBalance(): Promise<Balance> {
    return this.client
      .get<Balance>(`/remittance/v1_0/account/balance`)
      .then((response) => response.data);
  }

  /**
   * Check if a beneficiary is active and can receive transfers
   * @param partyId - The ID of the beneficiary (in the format specified by partyIdType)
   * @param partyIdType - The type of ID (MSISDN, EMAIL, or PARTY_CODE)
   * @returns A promise that resolves to true if the beneficiary is active, false otherwise
   */
  async isPayerActive(
    partyId: string,
    partyIdType: PartyIdType = PartyIdType.MSISDN,
  ): Promise<boolean> {
    try {
      const response = await this.client.get(
        `/remittance/v1_0/accountholder/${partyIdType}/${partyId}/active`,
      );
      return response.status === 200;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get basic user information for an account holder.
   * Remittance only supports MSISDN for this endpoint in some versions.
   *
   * @param partyId The party identifier (MSISDN)
   * @returns A promise that resolves to the basic user information
   */
  public getBasicUserInfo(partyId: string): Promise<BasicUserInfo> {
    return this.client
      .get<BasicUserInfo>(
        `/remittance/v1_0/accountholder/MSISDN/${partyId}/basicuserinfo`,
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
      .get<Balance>(`/remittance/v1_0/account/balance/${currency}`)
      .then((response) => response.data);
  }

  /**
   * Retrieve user information with KYC consent (OAuth2-gated endpoint)
   * Requires prior OAuth2 user consent/login flow to obtain authorization
   * @returns A promise that resolves to the user's information and KYC consent details
   */
  public getUserInfoWithConsent(): Promise<ConsentKycResponse> {
    return this.client
      .get<ConsentKycResponse>(`/remittance/oauth2/v1_0/userinfo`)
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
      .post<BcAuthorizeResponse>("/remittance/v1_0/bc-authorize", params, {
        headers: {
          Authorization: `Basic ${basicAuthToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .then((response) => response.data);
  }

  /**
   * Send a cross-border cash transfer (V2).
   * Uses the v2_0 cashtransfer endpoint.
   *
   * @param request The cash transfer request details
   * @returns A promise that resolves to the reference ID
   */
  public cashTransfer(request: CashTransferRequest): Promise<string> {
    const referenceId = uuid();

    return this.client
      .post<void>(
        "/remittance/v2_0/cashtransfer",
        {
          amount: request.amount,
          currency: request.currency,
          externalId: request.externalId,
          payee: request.payee,
          originatingCountry: request.originatingCountry,
          originalAmount: request.originalAmount,
          originalCurrency: request.originalCurrency,
          payerMessage: request.payerMessage,
          payeeNote: request.payeeNote,
        },
        {
          headers: {
            "X-Reference-Id": referenceId,
            ...(request.callbackUrl
              ? { "X-Callback-Url": request.callbackUrl }
              : {}),
          },
        },
      )
      .then(() => referenceId);
  }

  /**
   * Get the details and status of a cash transfer (V2).
   *
   * @param referenceId The cash transfer reference ID
   * @returns A promise that resolves to the cash transfer details
   */
  public getCashTransfer(referenceId: string): Promise<CashTransfer> {
    return this.client
      .get<CashTransfer>(`/remittance/v2_0/cashtransfer/${referenceId}`)
      .then((response) => response.data)
      .then((transfer) => {
        if (transfer.status === TransactionStatus.FAILED) {
          return Promise.reject(getTransactionError(transfer));
        }
        return transfer;
      });
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
      .post<OAuth2TokenResponse>("/remittance/oauth2/token/", params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .then((response) => response.data);
  }
}
