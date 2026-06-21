import { HttpClient, createHttpClient } from "./httpClient.js";
import type { InternalRequestConfig } from "./httpClient.js";

import { handleError } from "./errors.js";

import type { TokenRefresher } from "./auth.js";
import {
  Environment,
  type GlobalConfig,
  type SubscriptionConfig,
} from "./common.js";
import {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_TIMEOUT_MS,
  normalizeBaseUrl,
} from "./security.js";

export function createClient(
  config: SubscriptionConfig & GlobalConfig,
  client: HttpClient = createHttpClient(),
): HttpClient {
  if (config.baseUrl) {
    client.defaults.baseURL = normalizeBaseUrl(
      config.baseUrl,
      config.environment ?? Environment.SANDBOX,
    );
  }
  client.defaults.timeout = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  client.defaults.maxResponseBytes =
    config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  client.defaults.headers.common["Ocp-Apim-Subscription-Key"] =
    config.primaryKey;
  client.defaults.headers.common["X-Target-Environment"] =
    config.environment || "sandbox";

  return withErrorHandling(client);
}

export function createAuthClient(
  refresh: TokenRefresher,
  client: HttpClient,
): HttpClient {
  client.interceptors.request.use(
    async (request: InternalRequestConfig) => {
      request.headers = request.headers || {};
      const hasExplicitAuthorization = Object.keys(request.headers).some(
        (name) => name.toLowerCase() === "authorization",
      );
      if (!hasExplicitAuthorization) {
        const accessToken = await refresh();
        request.headers["Authorization"] = `Bearer ${accessToken}`;
      }

      return request;
    },
  );

  return client;
}

export function withErrorHandling(client: HttpClient): HttpClient {
  client.interceptors.response.use(
    (response) => response,
    (error) =>
      Promise.reject(
        handleError(
          error instanceof Error ? error : new Error(String(error)),
        ),
      ),
  );

  return client;
}
