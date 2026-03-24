import { FailureReason } from "../src/common";
import {
  ApprovalRejectedError,
  ExpiredError,
  getError,
  InternalProcessingError,
  InvalidCallbackUrlHostError,
  InvalidCurrencyError,
  NotAllowedError,
  NotAllowedTargetEnvironmentError,
  NotEnoughFundsError,
  PayeeNotAllowedToReceiveError,
  PayeeNotFoundError,
  PayerLimitReachedError,
  PayerNotFoundError,
  PaymentNotApprovedError,
  ResourceAlreadyExistError,
  ResourceNotFoundError,
  ServiceUnavailableError,
  TransactionCancelledError,
  UnspecifiedError,
} from "../src/errors";
import { expect } from "vitest";

describe("Errors", function () {
  describe("getError", function () {
    describe("when there is no error code", function () {
      it("returns unspecified error", function () {
        expect(getError()).toBeInstanceOf(UnspecifiedError);
      });
    });

    describe("when there is an error code", function () {
      it("returns the correct error", function () {
        expect(
          getError(FailureReason.APPROVAL_REJECTED, "test message"),
        ).toBeInstanceOf(ApprovalRejectedError);
        expect(
          getError(FailureReason.APPROVAL_REJECTED, "test message"),
        ).toHaveProperty("message", "test message");

        expect(getError(FailureReason.EXPIRED, "test message")).toBeInstanceOf(
          ExpiredError,
        );
        expect(getError(FailureReason.EXPIRED, "test message")).toHaveProperty(
          "message",
          "test message",
        );

        expect(
          getError(FailureReason.INTERNAL_PROCESSING_ERROR, "test message"),
        ).toBeInstanceOf(InternalProcessingError);
        expect(
          getError(FailureReason.INTERNAL_PROCESSING_ERROR, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.INVALID_CALLBACK_URL_HOST, "test message"),
        ).toBeInstanceOf(InvalidCallbackUrlHostError);
        expect(
          getError(FailureReason.INVALID_CALLBACK_URL_HOST, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.INVALID_CURRENCY, "test message"),
        ).toBeInstanceOf(InvalidCurrencyError);
        expect(
          getError(FailureReason.INVALID_CURRENCY, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.NOT_ALLOWED, "test message"),
        ).toBeInstanceOf(NotAllowedError);
        expect(
          getError(FailureReason.NOT_ALLOWED, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(
            FailureReason.NOT_ALLOWED_TARGET_ENVIRONMENT,
            "test message",
          ),
        ).toBeInstanceOf(NotAllowedTargetEnvironmentError);
        expect(
          getError(
            FailureReason.NOT_ALLOWED_TARGET_ENVIRONMENT,
            "test message",
          ),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.NOT_ENOUGH_FUNDS, "test message"),
        ).toBeInstanceOf(NotEnoughFundsError);
        expect(
          getError(FailureReason.NOT_ENOUGH_FUNDS, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.PAYEE_NOT_ALLOWED_TO_RECEIVE, "test message"),
        ).toBeInstanceOf(PayeeNotAllowedToReceiveError);
        expect(
          getError(FailureReason.PAYEE_NOT_ALLOWED_TO_RECEIVE, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.PAYEE_NOT_FOUND, "test message"),
        ).toBeInstanceOf(PayeeNotFoundError);
        expect(
          getError(FailureReason.PAYEE_NOT_FOUND, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.PAYER_LIMIT_REACHED, "test message"),
        ).toBeInstanceOf(PayerLimitReachedError);
        expect(
          getError(FailureReason.PAYER_LIMIT_REACHED, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.PAYER_NOT_FOUND, "test message"),
        ).toBeInstanceOf(PayerNotFoundError);
        expect(
          getError(FailureReason.PAYER_NOT_FOUND, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.PAYMENT_NOT_APPROVED, "test message"),
        ).toBeInstanceOf(PaymentNotApprovedError);
        expect(
          getError(FailureReason.PAYMENT_NOT_APPROVED, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.RESOURCE_ALREADY_EXIST, "test message"),
        ).toBeInstanceOf(ResourceAlreadyExistError);
        expect(
          getError(FailureReason.RESOURCE_ALREADY_EXIST, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.RESOURCE_NOT_FOUND, "test message"),
        ).toBeInstanceOf(ResourceNotFoundError);
        expect(
          getError(FailureReason.RESOURCE_NOT_FOUND, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.SERVICE_UNAVAILABLE, "test message"),
        ).toBeInstanceOf(ServiceUnavailableError);
        expect(
          getError(FailureReason.SERVICE_UNAVAILABLE, "test message"),
        ).toHaveProperty("message", "test message");

        expect(
          getError(FailureReason.TRANSACTION_CANCELED, "test message"),
        ).toBeInstanceOf(TransactionCancelledError);
        expect(
          getError(FailureReason.TRANSACTION_CANCELED, "test message"),
        ).toHaveProperty("message", "test message");
      });
    });
  });
});
