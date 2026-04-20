import { HttpClient, createHttpClient } from "./httpClient";
import type { InternalRequestConfig } from "./httpClient";

import { handleError } from "./errors";

import type { TokenRefresher } from "./auth";
import type { GlobalConfig, SubscriptionConfig } from "./common";

export function createClient(
  config: SubscriptionConfig & GlobalConfig,
  client: HttpClient = createHttpClient(),
): HttpClient {
  if (config.baseUrl) {
    client.defaults.baseURL = config.baseUrl;
  }
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
      const accessToken = await refresh();
      request.headers = request.headers || {};
      request.headers["Authorization"] = `Bearer ${accessToken}`;

      return request;
    },
  );

  return client;
}

export function withErrorHandling(client: HttpClient): HttpClient {
  client.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(handleError(error)),
  );

  return client;
}
