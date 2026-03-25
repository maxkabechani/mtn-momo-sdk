# MTN MoMo Node SDK (@maxkabechani/mtn-momo-sdk)

TypeScript-first MTN Mobile Money client for Node.js. Fully compatible with the official MoMo API v1.0 and v2.0.

This SDK provides a type-safe, developer-friendly interface for integrating MTN Mobile Money into your applications. It supports **Collections**, **Disbursements**, **Remittance**, and **Sandbox User Provisioning**.

---

## Features

- **V1 & V2 Coexistence**: Use stable V1 endpoints by default or opt-in to V2 features (`depositV2`, `refundV2`, `requestToWithdrawV2`, `cashTransfer`).
- **Comprehensive Coverage**: Request-to-pay, transfers, deposits, refunds, withdrawals, BC Authorize, OAuth2 consent, delivery notifications, and more.
- **TypeScript First**: Full type definitions for all requests, responses, and errors.
- **Bun & Node.js**: Works with modern runtimes.

---

## Installation

```bash
npm install @maxkabechani/mtn-momo-sdk
# or
bun add @maxkabechani/mtn-momo-sdk
```

---

## Quick Start

### 1. Initialize the Client

```ts
import { create, Environment } from "@maxkabechani/mtn-momo-sdk";

const momo = create({
  callbackHost: "yourdomain.com",
  environment: Environment.SANDBOX, // or Environment.PRODUCTION
});
```

### 2. Provision Sandbox Credentials

Use the `Users` client to create sandbox API users, or use the CLI tool:

```ts
const users = momo.Users({ primaryKey: "YOUR_PRIMARY_KEY" });

const userId = await users.create("yourdomain.com");
const { apiKey } = await users.login(userId);
```

Or via CLI:

```bash
npx momo-sandbox --host yourdomain.com --primary-key YOUR_PRIMARY_KEY
```

### 3. Configure a Product

```ts
const collections = momo.Collections({
  primaryKey: "your_collections_primary_key",
  userId: userId,
  userSecret: apiKey,
});
```

---

## API Reference

### Common Types

```ts
// Party identifier
interface Party {
  partyIdType: "MSISDN" | "EMAIL" | "PARTY_CODE";
  partyId: string;
}

// Account balance
interface Balance {
  availableBalance: string;
  currency: string;
}

// Basic user info
interface BasicUserInfo {
  given_name: string;
  family_name: string;
  birthdate: string;
  locale: string;
  gender: string;
}

// OAuth2 consent KYC response
interface ConsentKycResponse {
  sub: string;
  name: string;
  phone_number: string;
  status: string;
  // ... additional KYC fields
}

// BC Authorize request
interface BcAuthorizeRequest {
  login_hint: string;                    // e.g. "ID:46733123454/MSISDN"
  scope: string;                         // e.g. "profile"
  access_type: "online" | "offline";
  consent_valid_in?: number;             // Consent validity in seconds
  client_notification_token?: string;    // Token for notifications
  scope_instruction?: string;            // Custom scope instructions
}

// BC Authorize response
interface BcAuthorizeResponse {
  auth_req_id: string;
  interval: number;
  expires_in: number;
}

// OAuth2 token request
interface OAuth2TokenRequest {
  grant_type: string;    // e.g. "urn:openid:params:grant-type:ciba"
  auth_req_id: string;   // From bcAuthorize response
}

// OAuth2 token response
interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
```

---

### Sandbox User Provisioning (`Users`)

Manage API users for the sandbox environment.

```ts
const users = momo.Users({ primaryKey: "YOUR_PRIMARY_KEY" });
```

#### `create(host: string): Promise<string>`

Creates a new sandbox API user.

- **Arguments**: `host` — Your callback host domain (e.g. `"yourdomain.com"`)
- **Returns**: The generated user ID (UUID)
- **Errors**: `ResourceAlreadyExistError` if user exists

```ts
const userId = await users.create("yourdomain.com");
```

#### `login(userId: string): Promise<Credentials>`

Generates an API key for an existing sandbox user.

- **Arguments**: `userId` — The UUID from `create()`
- **Returns**: `{ apiKey: string }`
- **Errors**: `ResourceNotFoundError` if user doesn't exist

```ts
const { apiKey } = await users.login(userId);
```

#### `getApiUser(referenceId: string): Promise<ApiUserInfo>`

Retrieves details of a sandbox API user.

- **Arguments**: `referenceId` — The user ID
- **Returns**: `{ providerCallbackHost: string, targetEnvironment: string }`
- **Errors**: `ResourceNotFoundError` if user doesn't exist

```ts
const userInfo = await users.getApiUser(userId);
```

---

### Collections

Manage incoming payments, withdrawals, and account information.

```ts
const collections = momo.Collections({
  primaryKey: "YOUR_COLLECTIONS_KEY",
  userId: "YOUR_USER_ID",
  userSecret: "YOUR_USER_SECRET",
});
```

#### `requestToPay(request: PaymentRequest): Promise<string>`

Requests a payment from a consumer (payer).

- **Arguments**:

  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `amount` | `string` | ✅ | Amount to collect (e.g. `"500"`) |
  | `currency` | `string` | ✅ | ISO 4217 currency code (e.g. `"EUR"`) |
  | `payer` | `Party` | ✅ | The party being charged |
  | `externalId` | `string` | ❌ | Your internal reference for reconciliation |
  | `payerMessage` | `string` | ❌ | Message shown in payer's transaction history |
  | `payeeNote` | `string` | ❌ | Note shown in your transaction history |
  | `callbackUrl` | `string` | ❌ | Override the global callback URL |

- **Returns**: `string` — The reference ID (UUID) for tracking the transaction
- **Errors**: Validation errors for missing/invalid fields

```ts
const referenceId = await collections.requestToPay({
  amount: "500",
  currency: "EUR",
  externalId: "order-123",
  payer: { partyIdType: "MSISDN", partyId: "46733123454" },
  payerMessage: "Payment for order #123",
  payeeNote: "Order 123",
});
```

#### `getTransaction(referenceId: string): Promise<Payment>`

Retrieves the status and details of a payment request.

- **Arguments**: `referenceId` — The UUID returned by `requestToPay()`
- **Returns**:

  | Field | Type | Description |
  |-------|------|-------------|
  | `financialTransactionId` | `string` | MoMo transaction ID |
  | `externalId` | `string` | Your external reference |
  | `amount` | `string` | Transaction amount |
  | `currency` | `string` | Currency code |
  | `payer` | `Party` | The payer's details |
  | `status` | `"PENDING" \| "SUCCESSFUL" \| "FAILED"` | Payment status |
  | `reason` | `FailureReason` | Failure reason (if `FAILED`) |

- **Errors**: Rejects with a typed error if the transaction has `FAILED` status (e.g. `PayerNotFoundError`, `NotEnoughFundsError`)

```ts
const payment = await collections.getTransaction(referenceId);
console.log(payment.status); // "SUCCESSFUL"
```

#### `requestToWithdraw(request: WithdrawalRequest): Promise<string>`

Initiates a withdrawal from a payer account (V1).

- **Arguments**:

  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `amount` | `string` | ✅ | Amount to withdraw |
  | `currency` | `string` | ✅ | ISO 4217 currency code |
  | `payee` | `Party` | ✅ | The party receiving the withdrawal |
  | `externalId` | `string` | ❌ | Your internal reference |
  | `payerMessage` | `string` | ❌ | Message for payer |
  | `payeeNote` | `string` | ❌ | Note for payee |
  | `callbackUrl` | `string` | ❌ | Override callback URL |

- **Returns**: `string` — The reference ID (UUID)
- **Errors**: Validation errors for missing/invalid fields

#### `requestToWithdrawV2(request: WithdrawalRequest): Promise<string>`

Same as `requestToWithdraw` but uses the V2 endpoint.

#### `getWithdrawal(referenceId: string): Promise<Withdrawal>`

Retrieves the status of a withdrawal request.

- **Arguments**: `referenceId` — The UUID from `requestToWithdraw()`
- **Returns**: Withdrawal details with `status` field
- **Errors**: Rejects with a typed error if the withdrawal has `FAILED` status

#### `sendDeliveryNotification(referenceId: string, notification: DeliveryNotification): Promise<void>`

Sends a delivery notification for a completed payment.

- **Arguments**:

  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `referenceId` | `string` | ✅ | The payment reference ID |
  | `notification.notificationMessage` | `string` | ✅ | Notification text (max 160 chars) |
  | `notification.language` | `string` | ❌ | ISO 639-1/639-3 language code |

- **Returns**: `void`

```ts
await collections.sendDeliveryNotification(referenceId, {
  notificationMessage: "Your payment has been received!",
  language: "en",
});
```

#### `getBalance(): Promise<Balance>`

Returns the account balance.

- **Returns**: `{ availableBalance: string, currency: string }`

#### `getBalanceInCurrency(currency: string): Promise<Balance>`

Returns the account balance in a specific currency.

- **Arguments**: `currency` — ISO 4217 currency code (e.g. `"EUR"`)
- **Returns**: `{ availableBalance: string, currency: string }`

#### `isPayerActive(partyId: string, partyIdType?: PartyIdType): Promise<boolean>`

Checks if an account holder is active and can receive payments.

- **Arguments**: `partyId` — The party identifier, `partyIdType` — defaults to `"MSISDN"`
- **Returns**: `true` if active, `false` if not found

#### `getBasicUserInfo(partyIdType: PartyIdType, partyId: string): Promise<BasicUserInfo>`

Retrieves basic user information for an account holder.

- **Returns**: `{ given_name, family_name, birthdate, locale, gender }`

#### `bcAuthorize(request: BcAuthorizeRequest): Promise<BcAuthorizeResponse>`

Initiates a Biometric Consent (BC) authorization flow.

- **Arguments**: See `BcAuthorizeRequest` in Common Types above
- **Returns**: `{ auth_req_id: string, interval: number, expires_in: number }`

```ts
const authResult = await collections.bcAuthorize({
  login_hint: "ID:46733123454/MSISDN",
  scope: "profile",
  access_type: "online",
});
```

#### `getUserInfoWithConsent(): Promise<ConsentKycResponse>`

Retrieves user information with KYC consent (requires prior OAuth2 authorization).

- **Returns**: User info including `sub`, `name`, `phone_number`, `status`

#### `getOAuth2Token(request: OAuth2TokenRequest): Promise<OAuth2TokenResponse>`

Creates an OAuth2 token for consent-based access.

- **Arguments**: `{ grant_type: string, auth_req_id: string }`
- **Returns**: `{ access_token: string, token_type: string, expires_in: number }`

```ts
const token = await collections.getOAuth2Token({
  grant_type: "urn:openid:params:grant-type:ciba",
  auth_req_id: authResult.auth_req_id,
});
```

---

### Disbursements

Manage payouts, deposits, and refunds.

```ts
const disbursements = momo.Disbursements({
  primaryKey: "YOUR_DISBURSEMENTS_KEY",
  userId: "YOUR_USER_ID",
  userSecret: "YOUR_USER_SECRET",
});
```

#### `transfer(request: TransferRequest): Promise<string>`

Transfers money from your account to a payee.

- **Arguments**:

  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `amount` | `string` | ✅ | Amount to transfer |
  | `currency` | `string` | ✅ | ISO 4217 currency code |
  | `payee` | `Party` | ✅ | The party receiving the transfer |
  | `externalId` | `string` | ❌ | Your internal reference |
  | `payerMessage` | `string` | ❌ | Message for payer |
  | `payeeNote` | `string` | ❌ | Note for payee |
  | `callbackUrl` | `string` | ❌ | Override callback URL |

- **Returns**: `string` — The reference ID (UUID)

```ts
const referenceId = await disbursements.transfer({
  amount: "250",
  currency: "EUR",
  externalId: "payout-456",
  payee: { partyIdType: "MSISDN", partyId: "46733123454" },
  payerMessage: "Salary payment",
  payeeNote: "March salary",
});
```

#### `getTransaction(referenceId: string): Promise<Transfer>`

Retrieves the status and details of a transfer.

- **Returns**: Transfer details with `status` (`PENDING`, `SUCCESSFUL`, `FAILED`)
- **Errors**: Rejects with a typed error if the transfer has `FAILED` status

#### `deposit(request: DepositRequest): Promise<string>`

Deposits money into a payee account (V1).

- **Arguments**:

  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `amount` | `string` | ✅ | Amount to deposit |
  | `currency` | `string` | ✅ | ISO 4217 currency code |
  | `payee` | `Party` | ✅ | The party receiving the deposit |
  | `externalId` | `string` | ❌ | Your internal reference |
  | `payerMessage` | `string` | ❌ | Message for payer |
  | `payeeNote` | `string` | ❌ | Note for payee |
  | `callbackUrl` | `string` | ❌ | Override callback URL |

- **Returns**: `string` — The reference ID (UUID)

#### `depositV2(request: DepositRequest): Promise<string>`

Same as `deposit` but uses the V2 endpoint.

#### `getDeposit(referenceId: string): Promise<Deposit>`

Retrieves the status of a deposit.

- **Errors**: Rejects with a typed error if the deposit has `FAILED` status

#### `refund(request: RefundRequest): Promise<string>`

Refunds a previous transaction (V1).

- **Arguments**:

  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `referenceIdToRefund` | `string` | ✅ | UUID of the original transaction to refund |
  | `amount` | `string` | ✅ | Amount to refund |
  | `currency` | `string` | ✅ | ISO 4217 currency code |
  | `externalId` | `string` | ❌ | Your internal reference |
  | `payerMessage` | `string` | ❌ | Message for payer |
  | `payeeNote` | `string` | ❌ | Note for payee |
  | `callbackUrl` | `string` | ❌ | Override callback URL |

- **Returns**: `string` — The refund reference ID (UUID)

```ts
const refundId = await disbursements.refund({
  referenceIdToRefund: originalTransactionId,
  amount: "50",
  currency: "EUR",
  externalId: "refund-789",
  payerMessage: "Refund for damaged goods",
  payeeNote: "Partial refund",
});
```

#### `refundV2(request: RefundRequest): Promise<string>`

Same as `refund` but uses the V2 endpoint.

#### `getRefund(referenceId: string): Promise<Refund>`

Retrieves the status of a refund.

- **Errors**: Rejects with a typed error if the refund has `FAILED` status

#### `getBalance(): Promise<Balance>`

Returns the account balance.

#### `getBalanceInCurrency(currency: string): Promise<Balance>`

Returns the account balance in a specific currency.

#### `isPayerActive(partyId: string, partyIdType?: PartyIdType): Promise<boolean>`

Checks if an account holder is active.

#### `getBasicUserInfo(partyIdType: PartyIdType, partyId: string): Promise<BasicUserInfo>`

Retrieves basic user information for an account holder.

#### `bcAuthorize(request: BcAuthorizeRequest): Promise<BcAuthorizeResponse>`

Initiates a BC authorization flow. Uses **Basic Auth** for this endpoint.

#### `getUserInfoWithConsent(): Promise<ConsentKycResponse>`

Retrieves user info with KYC consent (requires prior OAuth2 authorization).

#### `getOAuth2Token(request: OAuth2TokenRequest): Promise<OAuth2TokenResponse>`

Creates an OAuth2 token for consent-based access.

---

### Remittance

Manage cross-border money transfers.

```ts
const remittance = momo.Remittance({
  primaryKey: "YOUR_REMITTANCE_KEY",
  userId: "YOUR_USER_ID",
  userSecret: "YOUR_USER_SECRET",
});
```

#### `transfer(request: CashTransferRequest): Promise<string>`

Sends money cross-border to a beneficiary (V1).

- **Arguments**:

  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `amount` | `string` | ✅ | Amount to transfer |
  | `currency` | `string` | ✅ | ISO 4217 currency code |
  | `payee` | `Party` | ✅ | The beneficiary |
  | `externalId` | `string` | ❌ | Your internal reference |
  | `originatingCountry` | `string` | ❌ | ISO country code of sender |
  | `originalAmount` | `string` | ❌ | Original amount before conversion |
  | `originalCurrency` | `string` | ❌ | Original currency before conversion |
  | `payerMessage` | `string` | ❌ | Message for payer |
  | `payeeNote` | `string` | ❌ | Note for payee |
  | `callbackUrl` | `string` | ❌ | Override callback URL |

- **Returns**: `string` — The reference ID (UUID)

```ts
const referenceId = await remittance.transfer({
  amount: "150",
  currency: "EUR",
  externalId: "remit-001",
  payee: { partyIdType: "MSISDN", partyId: "46733123454" },
  payerMessage: "Family support",
  payeeNote: "Monthly remittance",
});
```

#### `getTransaction(referenceId: string): Promise<CashTransfer>`

Retrieves the status and details of a transfer.

- **Returns**: Transfer details with `status` (`PENDING`, `SUCCESSFUL`, `FAILED`)
- **Errors**: Rejects with a typed error if the transfer has `FAILED` status

#### `cashTransfer(request: CashTransferRequest): Promise<string>`

Sends a cross-border cash transfer using the **V2** endpoint.

- **Arguments**: Same as `transfer()` above
- **Returns**: `string` — The reference ID (UUID)

```ts
const refId = await remittance.cashTransfer({
  amount: "75",
  currency: "EUR",
  payee: { partyIdType: "MSISDN", partyId: "46733123454" },
});
```

#### `getCashTransfer(referenceId: string): Promise<CashTransfer>`

Retrieves the status of a V2 cash transfer.

- **Errors**: Rejects with a typed error if the transfer has `FAILED` status

#### `getBalance(): Promise<Balance>`

Returns the account balance.

#### `getBalanceInCurrency(currency: string): Promise<Balance>`

Returns the account balance in a specific currency.

#### `isPayerActive(partyId: string, partyIdType?: PartyIdType): Promise<boolean>`

Checks if a beneficiary is active and can receive transfers.

#### `getBasicUserInfo(partyId: string): Promise<BasicUserInfo>`

Retrieves basic user information. Remittance uses `MSISDN` by default.

#### `bcAuthorize(request: BcAuthorizeRequest): Promise<BcAuthorizeResponse>`

Initiates a BC authorization flow. Uses **Basic Auth** for this endpoint.

#### `getUserInfoWithConsent(): Promise<ConsentKycResponse>`

Retrieves user info with KYC consent (requires prior OAuth2 authorization).

#### `getOAuth2Token(request: OAuth2TokenRequest): Promise<OAuth2TokenResponse>`

Creates an OAuth2 token for consent-based access.

---

## Error Handling

All API errors are mapped to typed error classes that extend `MtnMoMoError`. You can catch specific errors:

```ts
import { PayerNotFoundError, NotEnoughFundsError } from "@maxkabechani/mtn-momo-sdk";

try {
  await collections.requestToPay({ ... });
} catch (error) {
  if (error instanceof PayerNotFoundError) {
    console.error("The payer MSISDN was not found");
  } else if (error instanceof NotEnoughFundsError) {
    console.error("Insufficient funds");
  }
}
```

### Error Types

| Error Class | When It Occurs |
|-------------|---------------|
| `ApprovalRejectedError` | The user rejected the payment approval |
| `ExpiredError` | The transaction has expired |
| `InternalProcessingError` | An internal error occurred on the MoMo platform |
| `InvalidCallbackUrlHostError` | The callback URL host is invalid |
| `InvalidCurrencyError` | The specified currency is not supported |
| `NotAllowedTargetEnvironmentError` | Operation not allowed in the target environment |
| `NotAllowedError` | The operation is not allowed |
| `NotEnoughFundsError` | The payer has insufficient funds |
| `PayeeNotFoundError` | The payee account was not found |
| `PayeeNotAllowedToReceiveError` | The payee is not allowed to receive funds |
| `PayerLimitReachedError` | The payer has reached their transaction limit |
| `PayerNotFoundError` | The payer account was not found |
| `PaymentNotApprovedError` | The payment was not approved |
| `ResourceAlreadyExistError` | The resource already exists (e.g. duplicate transaction) |
| `ResourceNotFoundError` | The requested resource was not found |
| `ServiceUnavailableError` | The service is temporarily unavailable |
| `TransactionCancelledError` | The transaction was cancelled |
| `UnspecifiedError` | An unspecified error occurred |

---

## Going Live (Production)

1. **Change the environment**:

   ```ts
   const momo = create({
     callbackHost: "production-api.yoursite.com",
     environment: Environment.PRODUCTION,
   });
   ```

2. **Use production credentials** from the [MTN MoMo Developer Portal](https://momodeveloper.mtn.com/).

3. **Endpoints**: The SDK handles the URL switch automatically.

---

## Environment Variables

Store credentials securely using environment variables:

```bash
# Collections
COLLECTIONS_PRIMARY_KEY=your_key
COLLECTIONS_USER_ID=your_id
COLLECTIONS_USER_SECRET=your_secret

# Disbursements
DISBURSEMENTS_PRIMARY_KEY=your_key
DISBURSEMENTS_USER_ID=your_id
DISBURSEMENTS_USER_SECRET=your_secret

# Remittance
REMITTANCE_PRIMARY_KEY=your_key
REMITTANCE_USER_ID=your_id
REMITTANCE_USER_SECRET=your_secret
```

```ts
import "dotenv/config";

const collections = momo.Collections({
  primaryKey: process.env.COLLECTIONS_PRIMARY_KEY!,
  userId: process.env.COLLECTIONS_USER_ID!,
  userSecret: process.env.COLLECTIONS_USER_SECRET!,
});
```

---

## Development & Testing

```bash
bun install
bun run test         # Run all tests (unit + integration)
bun run test:coverage # Run tests with coverage
bun run typecheck    # Type check
bun run build        # Build for production (ESM + CJS)
```

## License

ISC
