import type { PaymentRequest } from "./collections.js";
import {
  Environment,
  type CashTransferRequest,
  type DepositRequest,
  type GlobalConfig,
  type ProductConfig,
  type RefundRequest,
  type SubscriptionConfig,
  type UserConfig,
  type WithdrawalRequest,
} from "./common.js";
import type { TransferRequest } from "./disbursements.js";
import {
  pathUuid,
  requireUuidV4,
  validateCurrency,
  validateFinancialAmount,
  validateGlobalSecurityConfig,
  validateParty,
} from "./security.js";

function requireString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} is required`);
  }
}

export async function validateRequestToPay(
  request: PaymentRequest,
): Promise<void> {
  const { amount, currency, payer, referenceId } = request || {};
  validateFinancialAmount(amount);
  validateCurrency(currency);
  validateParty(payer, "payer");
  if (referenceId !== undefined) requireUuidV4(referenceId);
}

export async function validateWithdrawalRequest(
  request: WithdrawalRequest,
): Promise<void> {
  const { amount, currency, payee, referenceId } = request || {};
  validateFinancialAmount(amount);
  validateCurrency(currency);
  validateParty(payee, "payee");
  if (referenceId !== undefined) requireUuidV4(referenceId);
}

export async function validateDepositRequest(
  request: DepositRequest,
): Promise<void> {
  const { amount, currency, payee, referenceId } = request || {};
  validateFinancialAmount(amount);
  validateCurrency(currency);
  validateParty(payee, "payee");
  if (referenceId !== undefined) requireUuidV4(referenceId);
}

export async function validateRefundRequest(
  request: RefundRequest,
): Promise<void> {
  const { amount, currency, referenceIdToRefund, referenceId } = request || {};
  pathUuid(referenceIdToRefund, "referenceIdToRefund");
  validateFinancialAmount(amount);
  validateCurrency(currency);
  if (referenceId !== undefined) requireUuidV4(referenceId);
}

export async function validateTransfer(request: TransferRequest): Promise<void> {
  const { amount, currency, payee, referenceId } = request || {};
  validateFinancialAmount(amount);
  validateCurrency(currency);
  validateParty(payee, "payee");
  if (referenceId !== undefined) requireUuidV4(referenceId);
}

export async function validateCashTransferRequest(
  request: CashTransferRequest,
): Promise<void> {
  const { amount, currency, payee, referenceId } = request || {};
  validateFinancialAmount(amount);
  validateCurrency(currency);
  validateParty(payee, "payee");
  if (referenceId !== undefined) requireUuidV4(referenceId);

  if (request.originalAmount !== undefined) {
    validateFinancialAmount(request.originalAmount, "originalAmount");
  }
  if (request.originalCurrency !== undefined) {
    validateCurrency(request.originalCurrency);
  }
}

export function validateGlobalConfig(config: GlobalConfig): void {
  requireString(config?.callbackHost, "callbackHost");

  if (
    config.environment === Environment.PRODUCTION &&
    config.baseUrl === undefined
  ) {
    throw new TypeError("baseUrl is required if environment is not sandbox");
  }

  validateGlobalSecurityConfig(config);
}

export function validateProductConfig(config: ProductConfig): void {
  validateSubscriptionConfig(config);
  validateUserConfig(config);
}

export function validateSubscriptionConfig(config: SubscriptionConfig): void {
  requireString(config?.primaryKey, "primaryKey");
}

export function validateUserConfig(config: UserConfig): void {
  requireString(config?.userId, "userId");
  requireString(config?.userSecret, "userSecret");
  requireUuidV4(config.userId, "userId");
}
