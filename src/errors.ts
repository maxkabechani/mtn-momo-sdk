import type { AxiosError } from "axios";
import type { Payment } from "./collections";
import type { Deposit, Refund, Withdrawal } from "./common";
import { FailureReason } from "./common";
import type { Transfer } from "./disbursements";

interface ErrorBody {
  code: FailureReason;
  message: string;
}

export class MtnMoMoError extends Error {
  public transaction?: Payment | Transfer;

  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ApprovalRejectedError extends MtnMoMoError {
  public override name = "ApprovalRejectedError";
}

export class ExpiredError extends MtnMoMoError {
  public override name = "ExpiredError";
}

export class InternalProcessingError extends MtnMoMoError {
  public override name = "InternalProcessingError";
}

export class InvalidCallbackUrlHostError extends MtnMoMoError {
  public override name = "InvalidCallbackUrlHostError";
}

export class InvalidCurrencyError extends MtnMoMoError {
  public override name = "InvalidCurrencyError";
}

export class NotAllowedTargetEnvironmentError extends MtnMoMoError {
  public override name = "NotAllowedTargetEnvironmentError";
}

export class NotAllowedError extends MtnMoMoError {
  public override name = "NotAllowedError";
}

export class NotEnoughFundsError extends MtnMoMoError {
  public override name = "NotEnoughFundsError";
}

export class PayeeNotFoundError extends MtnMoMoError {
  public override name = "PayeeNotFoundError";
}

export class PayeeNotAllowedToReceiveError extends MtnMoMoError {
  public override name = "PayeeNotAllowedToReceiveError";
}

export class PayerLimitReachedError extends MtnMoMoError {
  public override name = "PayerLimitReachedError";
}

export class PayerNotFoundError extends MtnMoMoError {
  public override name = "PayerNotFoundError";
}

export class PaymentNotApprovedError extends MtnMoMoError {
  public override name = "PaymentNotApprovedError";
}

export class ResourceAlreadyExistError extends MtnMoMoError {
  public override name = "ResourceAlreadyExistError";
}

export class ResourceNotFoundError extends MtnMoMoError {
  public override name = "ResourceNotFoundError";
}

export class ServiceUnavailableError extends MtnMoMoError {
  public override name = "ServiceUnavailableError";
}

export class TransactionCancelledError extends MtnMoMoError {
  public override name = "TransactionCancelledError";
}

export class UnspecifiedError extends MtnMoMoError {
  public override name = "UnspecifiedError";
}

export function handleError(error: AxiosError): Error {
  if (!error.response) {
    return error;
  }

  const { code, message } = (error.response.data || {}) as Partial<ErrorBody>;

  return getError(code, message);
}

export function getError(code?: FailureReason, message?: string) {
  if (code === FailureReason.APPROVAL_REJECTED) {
    return new ApprovalRejectedError(message);
  }

  if (code === FailureReason.EXPIRED) {
    return new ExpiredError(message);
  }

  if (code === FailureReason.INTERNAL_PROCESSING_ERROR) {
    return new InternalProcessingError(message);
  }

  if (code === FailureReason.INVALID_CALLBACK_URL_HOST) {
    return new InvalidCallbackUrlHostError(message);
  }

  if (code === FailureReason.INVALID_CURRENCY) {
    return new InvalidCurrencyError(message);
  }

  if (code === FailureReason.NOT_ALLOWED) {
    return new NotAllowedError(message);
  }

  if (code === FailureReason.NOT_ALLOWED_TARGET_ENVIRONMENT) {
    return new NotAllowedTargetEnvironmentError(message);
  }

  if (code === FailureReason.NOT_ENOUGH_FUNDS) {
    return new NotEnoughFundsError(message);
  }

  if (code === FailureReason.PAYEE_NOT_FOUND) {
    return new PayeeNotFoundError(message);
  }

  if (code === FailureReason.PAYEE_NOT_ALLOWED_TO_RECEIVE) {
    return new PayeeNotAllowedToReceiveError(message);
  }

  if (code === FailureReason.PAYER_LIMIT_REACHED) {
    return new PayerLimitReachedError(message);
  }

  if (code === FailureReason.PAYER_NOT_FOUND) {
    return new PayerNotFoundError(message);
  }

  if (code === FailureReason.PAYMENT_NOT_APPROVED) {
    return new PaymentNotApprovedError(message);
  }

  if (code === FailureReason.RESOURCE_ALREADY_EXIST) {
    return new ResourceAlreadyExistError(message);
  }

  if (code === FailureReason.RESOURCE_NOT_FOUND) {
    return new ResourceNotFoundError(message);
  }

  if (code === FailureReason.SERVICE_UNAVAILABLE) {
    return new ServiceUnavailableError(message);
  }

  if (code === FailureReason.TRANSACTION_CANCELED) {
    return new TransactionCancelledError(message);
  }

  return new UnspecifiedError(message);
}

export function getTransactionError(
  transaction: Payment | Transfer | Withdrawal | Deposit | Refund,
) {
  const error: MtnMoMoError = getError(transaction.reason as FailureReason);
  error.transaction = transaction as Payment | Transfer;

  return error;
}
