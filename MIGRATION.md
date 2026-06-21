# Migrating to 1.0.0

## Financial references

Generate and persist a UUIDv4 before every new financial operation:

```ts
const referenceId = generateReferenceId();
await persist(referenceId);

await collections.requestToPay({
  referenceId,
  amount: "10.00",
  currency: "EUR",
  payer,
});
```

Reuse that exact `referenceId` after a timeout, connection reset, or other
ambiguous failure. Do not reuse it for a genuinely new operation.

The optional field is available on request-to-pay, withdrawals, transfers,
deposits, refunds, and remittance cash transfers.

## Production configuration

Production now requires an explicit HTTPS base URL:

```ts
create({
  callbackHost: "payments.example.com",
  environment: Environment.PRODUCTION,
  baseUrl: "https://approved-mtn-host.example",
});
```

Embedded URL credentials, HTTP, unsupported protocols, queries, and fragments
are rejected.

## Consent APIs

Pass the returned consent access token explicitly:

```ts
const token = await collections.getOAuth2Token(request);
const user = await collections.getUserInfoWithConsent(token.access_token);
```

Consent tokens are not cached globally or shared between customers.

## Errors

Public request errors no longer contain raw request headers or payloads.
`error.config` is now only:

```ts
{
  method: string;
  url: string;      // redacted
  timeout: number;
}
```

Stop reading `error.config.headers`, `Authorization`, or subscription keys.

## Runtime validation

- Amounts must be positive decimal strings.
- Amount strings are preserved exactly; currency-specific precision and scale
  remain subject to the applicable MTN product contract.
- MTN references and API-user IDs must be UUIDv4.
- Currency path parameters must be uppercase three-letter codes.
- Party identifiers and types are validated and safely encoded.
- Production sandbox-user provisioning is rejected.

## Runtime support

Node.js 20.19+ and Bun are supported. Both ESM import and CommonJS require are
verified against the packed artifact.
