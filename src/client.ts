import axios, { AxiosHeaders } from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";

import { handleError } from "./errors";

import type { TokenRefresher } from "./auth";
import type { GlobalConfig, SubscriptionConfig } from "./common";

export function createClient(
  config: SubscriptionConfig & GlobalConfig,
  client: AxiosInstance = axios.create(),
): AxiosInstance {
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
  client: AxiosInstance,
): AxiosInstance {
  client.interceptors.request.use(
    async (request: InternalAxiosRequestConfig) => {
      const accessToken = await refresh();
      const headers =
        request.headers instanceof AxiosHeaders
          ? request.headers
          : AxiosHeaders.from(request.headers);

      headers.set("Authorization", `Bearer ${accessToken}`);
      request.headers = headers;

      return request;
    },
  );

  return client;
}

export function withErrorHandling(client: AxiosInstance): AxiosInstance {
  client.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(handleError(error)),
  );

  return client;
}
