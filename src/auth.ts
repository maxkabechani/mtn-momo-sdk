import type { AxiosInstance } from "axios";

import { createClient } from "./client";

import type { AccessToken, Config, UserConfig } from "./common";

export type TokenRefresher = () => Promise<string>;

export interface AuthorizerOptions {
  grant_type?: string;
  refresh_token?: string;
}

export type Authorizer = (
  config: Config,
  options?: AuthorizerOptions,
  client?: AxiosInstance,
) => Promise<AccessToken & { refresh_token?: string; refresh_token_expired_in?: number }>;

interface OAuthCredentials {
  accessToken: string;
  expires: number;
  refreshToken?: string;
  refreshExpires?: number;
}

export function createTokenRefresher(
  authorize: Authorizer,
  config: Config,
): TokenRefresher {
  let credentials: OAuthCredentials;
  return () => {
    if (isExpired(credentials)) {
      const isRefreshTokenValid = credentials?.refreshToken && !isRefreshExpired(credentials);
      
      const options: AuthorizerOptions = isRefreshTokenValid 
        ? { grant_type: 'refresh_token', refresh_token: credentials.refreshToken }
        : { grant_type: 'client_credentials' };

      return authorize(config, options)
        .then((tokenData) => {
          const { access_token, expires_in, refresh_token, refresh_token_expired_in } = tokenData;
          const expires: number = Date.now() + expires_in * 1000 - 60000;
          
          let refreshExpires: number | undefined;
          if (refresh_token_expired_in) {
            refreshExpires = Date.now() + refresh_token_expired_in * 1000 - 60000;
          }

          return {
            accessToken: access_token,
            expires,
            refreshToken: refresh_token,
            refreshExpires,
          };
        })
        .then((freshCredentials) => {
          credentials = freshCredentials;
          return credentials.accessToken;
        });
    }

    return Promise.resolve(credentials.accessToken);
  };
}

function isRefreshExpired(credentials: OAuthCredentials): boolean {
  if (!credentials || !credentials.refreshExpires) {
    return true;
  }
  return Date.now() > credentials.refreshExpires;
}

export const authorizeCollections: Authorizer = function (
  config: Config,
  options?: AuthorizerOptions,
  client: AxiosInstance = createClient(config),
): Promise<any> {
  const basicAuthToken: string = createBasicAuthToken(config);
  return client
    .post("/collection/token/", null, {
      headers: {
        Authorization: `Basic ${basicAuthToken}`,
      },
    })
    .then((response) => response.data);
};

export const authorizeDisbursements: Authorizer = function (
  config: Config,
  options?: AuthorizerOptions,
  client: AxiosInstance = createClient(config),
): Promise<any> {
  const basicAuthToken: string = createBasicAuthToken(config);
  return client
    .post("/disbursement/token/", null, {
      headers: {
        Authorization: `Basic ${basicAuthToken}`,
      },
    })
    .then((response) => response.data);
};

export const authorizeRemittance: Authorizer = function (
  config: Config,
  options?: AuthorizerOptions,
  client: AxiosInstance = createClient(config),
): Promise<any> {
  const basicAuthToken: string = createBasicAuthToken(config);
  return client
    .post("/remittance/token/", null, {
      headers: {
        Authorization: `Basic ${basicAuthToken}`,
      },
    })
    .then((response) => response.data);
};

export function createBasicAuthToken(config: UserConfig): string {
  return Buffer.from(`${config.userId}:${config.userSecret}`).toString(
    "base64",
  );
}

function isExpired(credentials: OAuthCredentials): boolean {
  if (!credentials || !credentials.expires) {
    return true;
  }

  return Date.now() > credentials.expires;
}
