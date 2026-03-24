# MTN MoMo Node SDK (mtn-momo-sdk)

TypeScript-first MTN Mobile Money client for Node.js. Fully compatible with official MoMo API v1.0 and v2.0.

This SDK provides a type-safe, developer-friendly interface for integrating MTN Mobile Money into your applications. It supports **Collections**, **Disbursements**, and **Remittance** products.

---

## Features

- **Coexistence of V1 & V2**: Use stable V1 endpoints by default or opt-in to latest V2 features (e.g., `depositV2`).
- **Comprehensive Coverage**: Supporting everything from simple transfers to biometric consent (BC Authorize).
- **TypeScript First**: Full type definitions for all requests and responses.
- **Bun & Node.js**: Optimized for modern runtimes.

---

## Installation

```bash
npm install mtn-momo-sdk
# or
bun add mtn-momo-sdk
```

---

## Quick Start (Sandbox)

### 1. Initialize the Client
```ts
import { create, Environment } from "mtn-momo-sdk";

const momo = create({
  callbackHost: "yourdomain.com", // Used for callback validation
  environment: Environment.SANDBOX,
});
```

### 2. Configure a Product
Each product (Collections, Disbursements, Remittance) is initialized separately:

```ts
const collections = momo.Collections({
  primaryKey: "your_collections_primary_key",
  userId: "your_user_id",
  userSecret: "your_user_secret",
});
```

### 3. Generate Sandbox Credentials
If you don't have a `userId` and `userSecret` yet, you can generate them using our CLI tool:

```bash
npx momo-sandbox --host yourdomain.com --primary-key YOUR_PRIMARY_KEY
```

---

## API Reference

### Collections
Manage incoming payments and withdrawals.

#### `requestToPay(request: PaymentRequest)`
Requests a payment from a consumer.
- **Arguments**:
  - `amount`: `string` (e.g., "100.00")
  - `currency`: `string` (e.g., "EUR")
  - `externalId`: `string` (Optional, for reconciliation)
  - `payer`: `{ partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE', partyId: string }`
  - `payerMessage`: `string` (Optional, shown in payer history)
  - `payeeNote`: `string` (Optional, shown in your history)
  - `callbackUrl`: `string` (Optional, overrides global callback host)

#### `getTransaction(referenceId: string)`
Retrieves status of a payment request. Returns a `Payment` object with `status` (`PENDING`, `SUCCESSFUL`, `FAILED`).

#### `getBalance()`
Returns `{ availableBalance: string, currency: string }`.

#### `requestToWithdrawV2(request: WithdrawalRequest)`
Initiates a withdrawal from a payer account using V2 specs.

---

### Disbursements
Manage payouts, deposits, and refunds.

#### `transfer(request: TransferRequest)`
Transfers money from your account to a payee.
- **Arguments**:
  - `amount`, `currency`, `externalId`: Same as Collections.
  - `payee`: `{ partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE', partyId: string }`
  - `payerMessage`, `payeeNote`, `callbackUrl`: Same as Collections.

#### `depositV2(request: DepositRequest)`
Deposits money into a payee account using V2 specs.

#### `refundV2(request: RefundRequest)`
Refunds a previous transaction.
- **Arguments**:
  - `amount`, `currency`, `externalId`, `payerMessage`, `payeeNote`
  - `referenceIdToRefund`: `string` (The original transaction ID)

---

### Remittance
Manage cross-border transfers.

#### `transfer(request: CashTransferRequest)`
- **Additional Arguments**:
  - `originatingCountry`: `string` (ISO code)
  - `originalAmount`: `string`
  - `originalCurrency`: `string`

---

## Going Live (Production)

Transitioning from Sandbox to Production requires a few changes:

1. **Environment Flag**:
   Change `Environment.SANDBOX` to `Environment.PRODUCTION`.
   ```ts
   const momo = create({
     callbackHost: "production-api.yoursite.com",
     environment: Environment.PRODUCTION,
   });
   ```

2. **Production Credentials**:
   - Get your **Primary Key** from the [MTN MoMo Developer Portal](https://momodeveloper.mtn.com/).
   - Obtain your production **User ID** and **User Secret** through the official onboarding process in your specific region.

3. **Endpoints**:
   The SDK handles the URL switch automatically when `Environment.PRODUCTION` is set.

---

## Environment Variables

For security, it is highly recommended to store your credentials in environment variables (e.g., using `dotenv`):

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

Usage in your application:

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

We use [Bun](https://bun.sh) for efficient development.

```bash
bun install
bun run test         # Run unit tests
bun run build        # Build for production (ESM/CJS)
```

## License
ISC
