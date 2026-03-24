export type Config = GlobalConfig & ProductConfig;

export type ProductConfig = SubscriptionConfig & UserConfig;

export interface GlobalConfig {
  /**
   * The provider callback host
   */
  callbackHost?: string;

  /**
   * The base URL of the EWP system where the transaction shall be processed.
   * This parameter is used to route the request to the EWP system that will
   * initiate the transaction.
   */
  baseUrl?: string;

  /**
   * The identifier of the EWP system where the transaction shall be processed.
   * This parameter is used to route the request to the EWP system that will
   * initiate the transaction.
   */
  environment?: Environment;
}

export interface SubscriptionConfig {
  /**
   * Subscription key which provides access to this API. Found in your Profile
   */
  primaryKey: string;
}

export interface UserConfig {
  /**
   * The API user's key
   */
  userSecret: string;

  /**
   * Recource ID for the API user
   */
  userId: string;
}

export interface Credentials {
  apiKey: string;
}

export interface ApiUserInfo {
  providerCallbackHost?: string;
  paymentServerUrl?: {
    apiKey?: string;
  };
  targetEnvironment?: {
    apiKey?: string;
  };
}

export interface AccessToken {
  /**
   * A JWT token which can be used to authrize against the other API end-points.
   * The format of the token follows the JWT standard format (see jwt.io for an example).
   * This is the token that should be sent in in the Authorization header when calling the other API end-points.
   */
  access_token: string;

  /**
   * The token type.
   *
   * TODO: Find list of complete token types
   */
  token_type: string;

  /**
   * The validity time in seconds of the token
   */
  expires_in: number;
}

/**
 * The available balance of the account
 */
export interface Balance {
  /**
   * The available balance of the account
   */
  availableBalance: string;

  /**
   * ISO4217 Currency
   */
  currency: string;
}

export interface Party {
  partyIdType: PartyIdType;
  partyId: string;
}

export enum PartyIdType {
  MSISDN = "MSISDN",
  EMAIL = "EMAIL",
  PARTY_CODE = "PARTY_CODE",
}

export enum Environment {
  SANDBOX = "sandbox",
  PRODUCTION = "production",
}

export enum TransactionStatus {
  SUCCESSFUL = "SUCCESSFUL",
  PENDING = "PENDING",
  FAILED = "FAILED",
}

export enum FailureReason {
  PAYEE_NOT_FOUND = "PAYEE_NOT_FOUND",
  PAYER_NOT_FOUND = "PAYER_NOT_FOUND",
  NOT_ALLOWED = "NOT_ALLOWED",
  NOT_ALLOWED_TARGET_ENVIRONMENT = "NOT_ALLOWED_TARGET_ENVIRONMENT",
  INVALID_CALLBACK_URL_HOST = "INVALID_CALLBACK_URL_HOST",
  INVALID_CURRENCY = "INVALID_CURRENCY",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  INTERNAL_PROCESSING_ERROR = "INTERNAL_PROCESSING_ERROR",
  NOT_ENOUGH_FUNDS = "NOT_ENOUGH_FUNDS",
  PAYER_LIMIT_REACHED = "PAYER_LIMIT_REACHED",
  PAYEE_NOT_ALLOWED_TO_RECEIVE = "PAYEE_NOT_ALLOWED_TO_RECEIVE",
  PAYMENT_NOT_APPROVED = "PAYMENT_NOT_APPROVED",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  APPROVAL_REJECTED = "APPROVAL_REJECTED",
  EXPIRED = "EXPIRED",
  TRANSACTION_CANCELED = "TRANSACTION_CANCELED",
  RESOURCE_ALREADY_EXIST = "RESOURCE_ALREADY_EXIST",
}

/**
 * Basic user information response
 */
export interface BasicUserInfo {
  given_name?: string;
  family_name?: string;
  birthdate?: string;
  locale?: string;
  gender?: string;
  status?: string;
}

/**
 * Biometric Consent (BC) authorization response
 */
export interface BcAuthorizeResponse {
  auth_req_id: string;
  interval: number;
  expires_in: number;
}

/**
 * OAuth2 token response
 */
export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
  refresh_token_expired_in?: number;
}

/**
 * Consent/KYC response with user information
 */
export interface ConsentKycResponse {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  locale?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: string;
  updated_at?: number;
  status?: string;
  birthdate?: string;
  credit_score?: string;
  active?: boolean;
  country_of_birth?: string;
  region_of_birth?: string;
  city_of_birth?: string;
  occupation?: string;
  employer_name?: string;
  identification_type?: string;
  identification_value?: string;
}

/**
 * Request to withdraw (Collections)
 */
export interface WithdrawalRequest {
  amount: string;
  currency: string;
  externalId?: string;
  payee: Party;
  payerMessage?: string;
  payeeNote?: string;
  callbackUrl?: string;
}

/**
 * Withdrawal result (Collections)
 */
export interface Withdrawal {
  amount: string;
  currency: string;
  financialTransactionId: string;
  externalId: string;
  payee: Party;
  payerMessage?: string;
  payeeNote?: string;
  status: TransactionStatus;
  reason?: FailureReason;
}

/**
 * Delivery notification request
 */
export interface DeliveryNotification {
  notificationMessage: string;
}

/**
 * Biometric Consent (BC) authorization request
 */
export interface BcAuthorizeRequest {
  login_hint: string;
  scope: string;
  access_type: "online" | "offline";
  consent_valid_in?: number;
  client_notification_token?: string;
  scope_instruction?: string;
}

/**
 * Deposit request (Disbursements v1_0)
 */
export interface DepositRequest {
  amount: string;
  currency: string;
  externalId?: string;
  payee: Party;
  payerMessage?: string;
  payeeNote?: string;
  callbackUrl?: string;
}

/**
 * Deposit result (Disbursements v1_0)
 */
export interface Deposit {
  amount: string;
  currency: string;
  financialTransactionId: string;
  externalId: string;
  payee: Party;
  payerMessage?: string;
  payeeNote?: string;
  status: TransactionStatus;
  reason?: FailureReason;
}

/**
 * Refund request (Disbursements v1_0)
 */
export interface RefundRequest {
  amount: string;
  currency: string;
  externalId?: string;
  payerMessage?: string;
  payeeNote?: string;
  referenceIdToRefund: string;
}

/**
 * Refund result (Disbursements v1_0)
 */
export interface Refund {
  amount: string;
  currency: string;
  financialTransactionId: string;
  externalId: string;
  payee: Party;
  payerMessage?: string;
  payeeNote?: string;
  status: TransactionStatus;
  reason?: FailureReason;
}

/**
 * Cash transfer request (Remittance)
 */
export interface CashTransferRequest {
  amount: string;
  currency: string;
  externalId?: string;
  payee: Party;
  originatingCountry?: string;
  originalAmount?: string;
  originalCurrency?: string;
  payerMessage?: string;
  payeeNote?: string;
  callbackUrl?: string;
}

/**
 * Cash transfer result (Remittance)
 */
export interface CashTransfer {
  amount: string;
  currency: string;
  financialTransactionId: string;
  externalId: string;
  payee: Party;
  payerMessage?: string;
  payeeNote?: string;
  status: TransactionStatus;
  reason?: FailureReason;
}
