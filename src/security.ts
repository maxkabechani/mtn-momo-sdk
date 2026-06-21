import { v4 as uuid } from "uuid";

import { Environment, PartyIdType } from "./common.js";
import type { GlobalConfig, Party } from "./common.js";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const CURRENCY = /^[A-Z]{3}$/;
const MSISDN = /^\+?[0-9]{5,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const FORBIDDEN_PATH_CHARACTER = /[\/\\?#]/;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
export const MAX_TIMEOUT_MS = 120_000;
export const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

export interface FinancialOperationOptions {
  /**
   * Stable MTN resource identifier for this logical financial operation.
   *
   * Production callers that may retry must generate and persist this value
   * before the first request, then reuse it for every retry.
   */
  referenceId?: string;
}

export function generateReferenceId(): string {
  return uuid();
}

export function requireUuidV4(value: unknown, name = "referenceId"): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} is required`);
  }
  if (!UUID_V4.test(value)) {
    throw new TypeError(`${name} must be a valid uuid v4`);
  }
  return value;
}

export function resolveReferenceId(referenceId?: string): string {
  return referenceId === undefined
    ? generateReferenceId()
    : requireUuidV4(referenceId);
}

export function pathUuid(value: unknown, name = "referenceId"): string {
  return encodeURIComponent(requireUuidV4(value, name));
}

export function pathCurrency(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("currency is required");
  }
  if (!CURRENCY.test(value)) {
    throw new TypeError("currency must be a 3-letter uppercase ISO 4217 code");
  }
  return value;
}

export function pathPartyType(value: unknown): PartyIdType {
  if (
    value !== PartyIdType.MSISDN &&
    value !== PartyIdType.EMAIL &&
    value !== PartyIdType.PARTY_CODE
  ) {
    throw new TypeError("partyIdType must be MSISDN, EMAIL, or PARTY_CODE");
  }
  return value;
}

export function pathPartyId(type: PartyIdType, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("partyId is required");
  }

  if (type === PartyIdType.MSISDN && !MSISDN.test(value)) {
    throw new TypeError("MSISDN partyId must contain 5 to 15 digits");
  }
  if (type === PartyIdType.EMAIL && !EMAIL.test(value)) {
    throw new TypeError("EMAIL partyId must be a valid email address");
  }
  if (type === PartyIdType.PARTY_CODE) {
    requireUuidV4(value, "PARTY_CODE partyId");
  }

  return encodeStrictPathSegment(value, "partyId");
}

export function validateParty(party: Party | undefined, name: string): void {
  if (!party) {
    throw new TypeError(`${name} is required`);
  }
  if (typeof party.partyId !== "string" || party.partyId.length === 0) {
    throw new TypeError(`${name}.partyId is required`);
  }
  if (!party.partyIdType) {
    throw new TypeError(`${name}.partyIdType is required`);
  }
  const type = pathPartyType(party.partyIdType);
  pathPartyId(type, party.partyId);
}

export function encodeStrictPathSegment(
  value: unknown,
  name: string,
): string {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "bigint"
  ) {
    throw new TypeError(`${name} must be a supported primitive`);
  }

  const segment = String(value);
  if (!segment) {
    throw new TypeError(`${name} is required`);
  }
  if (CONTROL_CHARACTER.test(segment)) {
    throw new TypeError(`${name} contains control characters`);
  }
  if (
    segment === "." ||
    segment === ".." ||
    FORBIDDEN_PATH_CHARACTER.test(segment) ||
    ENCODED_PATH_SEPARATOR.test(segment)
  ) {
    throw new TypeError(`${name} contains unsafe path characters`);
  }

  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    throw new TypeError(`${name} contains invalid percent encoding`);
  }
  if (
    decoded === "." ||
    decoded === ".." ||
    FORBIDDEN_PATH_CHARACTER.test(decoded) ||
    CONTROL_CHARACTER.test(decoded)
  ) {
    throw new TypeError(`${name} contains unsafe path characters`);
  }

  return encodeURIComponent(segment);
}

export function validateFinancialAmount(
  amount: unknown,
  name = "amount",
): asserts amount is string {
  if (typeof amount !== "string" || amount.length === 0) {
    throw new TypeError(`${name} is required`);
  }
  if (!POSITIVE_DECIMAL.test(amount)) {
    throw new TypeError(`${name} must be a number`);
  }
  if (/^0+(?:\.0+)?$/.test(amount)) {
    throw new TypeError(`${name} must be greater than zero`);
  }
}

export function validateCurrency(
  currency: unknown,
): asserts currency is string {
  pathCurrency(currency);
}

export function validateAccessToken(
  token: unknown,
  name = "consentToken",
): asserts token is string {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    /\s/.test(token) ||
    CONTROL_CHARACTER.test(token)
  ) {
    throw new TypeError(`${name} must be a non-empty bearer token`);
  }
}

export function normalizeBaseUrl(
  baseUrl: string,
  environment: Environment,
): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new TypeError("baseUrl must be a valid absolute URL");
  }

  if (url.username || url.password) {
    throw new TypeError("baseUrl must not contain embedded credentials");
  }
  if (url.search || url.hash) {
    throw new TypeError("baseUrl must not contain a query string or fragment");
  }

  const loopback =
    url.hostname === "127.0.0.1" ||
    url.hostname === "localhost" ||
    url.hostname === "::1" ||
    url.hostname === "[::1]";
  const testLoopback =
    environment === Environment.SANDBOX &&
    process.env.NODE_ENV === "test" &&
    loopback &&
    url.protocol === "http:";

  if (url.protocol !== "https:" && !testLoopback) {
    const scope =
      environment === Environment.PRODUCTION ? "production " : "";
    throw new TypeError(`${scope}baseUrl must use https`);
  }

  return url.toString().replace(/\/+$/, "");
}

export function validateGlobalSecurityConfig(config: GlobalConfig): void {
  const environment = config.environment ?? Environment.SANDBOX;
  if (
    environment !== Environment.SANDBOX &&
    environment !== Environment.PRODUCTION
  ) {
    throw new TypeError("environment must be sandbox or production");
  }
  const baseUrl =
    config.baseUrl ?? "https://sandbox.momodeveloper.mtn.com";
  normalizeBaseUrl(baseUrl, environment);

  if (
    config.timeoutMs !== undefined &&
    (!Number.isInteger(config.timeoutMs) ||
      config.timeoutMs <= 0 ||
      config.timeoutMs > MAX_TIMEOUT_MS)
  ) {
    throw new TypeError(
      `timeoutMs must be an integer between 1 and ${MAX_TIMEOUT_MS}`,
    );
  }

  if (
    config.maxResponseBytes !== undefined &&
    (!Number.isInteger(config.maxResponseBytes) ||
      config.maxResponseBytes < 1024 ||
      config.maxResponseBytes > MAX_RESPONSE_BYTES)
  ) {
    throw new TypeError(
      `maxResponseBytes must be an integer between 1024 and ${MAX_RESPONSE_BYTES}`,
    );
  }
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(Basic|Bearer)\s+\S+/gi, "$1 [redacted]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "[redacted]",
    )
    .replace(/\+?\d{7,15}/g, "[redacted]");
}

const SAFE_PATH_PARTS = new Set([
  "",
  "collection",
  "disbursement",
  "remittance",
  "v1_0",
  "v2_0",
  "oauth2",
  "token",
  "requesttopay",
  "requesttowithdraw",
  "transfer",
  "cashtransfer",
  "deposit",
  "refund",
  "account",
  "balance",
  "accountholder",
  "active",
  "basicuserinfo",
  "userinfo",
  "bc-authorize",
  "deliverynotification",
  "apiuser",
  "apikey",
]);

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname
      .split("/")
      .map((part) => (SAFE_PATH_PARTS.has(part) ? part : "[redacted]"))
      .join("/");
    return url.toString();
  } catch {
    return "[invalid-url]";
  }
}
