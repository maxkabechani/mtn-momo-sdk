import type { AxiosInstance } from "axios";

import type {
  Balance,
  BasicUserInfo,
  BcAuthorizeRequest,
  BcAuthorizeResponse,
  CashTransfer,
  CashTransferRequest,
  ConsentKycResponse,
  Party,
  ProductConfig,
} from "./common";
import { TransactionStatus, PartyIdType } from "./common";
import { MtnMoMoError } from "./errors";
import { createBasicAuthToken } from "./auth";
import type { Config } from "./common";

import { v4 as uuid } from "uuid";

/**
 * Remittance product for cross-border money transfers with optional OAuth2 consent flows
 */
export default class Remittance {
  private readonly client: AxiosInstance;
  private readonly config: Config;

  constructor(client: AxiosInstance, config: Config) {
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
    const response = await this.client.post(
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

    // In MoMo API, a 202 Accepted means the request was received successfully.
    // The reference ID is what we supplied in the header.
    if (response.status === 202) {
      return referenceId;
    }
    throw new MtnMoMoError("Failed to retrieve transfer reference ID");
  }

  /**
   * Get the details and status of a specific transfer
   * @param referenceId - The unique identifier of the transfer transaction
   * @returns A promise that resolves to the transfer details and status
   */
  async getTransaction(referenceId: string): Promise<CashTransfer> {
    const response = await this.client.get(
      `/remittance/v1_0/transfer/${referenceId}`,
    );

    if (response.status !== 200) {
      throw new MtnMoMoError(
        `Failed to retrieve transfer: ${response.data?.message || "Unknown error"}`,
      );
    }

    return response.data;
  }

  /**
   * Get the current account balance
   * @returns A promise that resolves to the account balance with currency information
   */
  async getBalance(): Promise<Balance> {
    const response = await this.client.get(`/remittance/v1_0/account/balance`);

    if (response.status !== 200) {
      throw new MtnMoMoError(
        `Failed to retrieve balance: ${response.data?.message || "Unknown error"}`,
      );
    }

    return response.data;
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
    const type = String(partyIdType);
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
  async getUserInfoWithConsent(): Promise<ConsentKycResponse> {
    const response = await this.client.get(`/remittance/oauth2/v1_0/userinfo`);

    if (response.status !== 200) {
      throw new MtnMoMoError(
        `Failed to retrieve user info: ${response.data?.message || "Unknown error"}`,
      );
    }

    return response.data;
  }
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
}
