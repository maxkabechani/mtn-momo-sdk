import { expect, vi } from "vitest";

import {
  authorizeCollections,
  authorizeDisbursements,
  createBasicAuthToken,
  createTokenRefresher,
} from "../src/auth";
import { createMock } from "./mock";

import type { AccessToken, Config } from "../src/common";
import { Environment } from "../src/common";

describe("Auth", function () {
  const config: Config = {
    environment: Environment.SANDBOX,
    baseUrl: "test",
    primaryKey: "key",
    userId: "id",
    userSecret: "secret",
  };

  describe("getTokenRefresher", function () {
    describe("when the access token is not expired", function () {
      it("doesn't call the authorizer for a new access token", async function () {
        const authorizer = vi.fn().mockResolvedValue({
          access_token: "token",
          token_type: "string",
          expires_in: 3600,
        } as AccessToken);
        const refresh = createTokenRefresher(authorizer, config);
        await expect(refresh().then(() => refresh())).resolves.toBeDefined();
        expect(authorizer).toHaveBeenCalledTimes(1);
      });
    });

    describe("when the access token expires", function () {
      it("calls the authorizer again for a new access token", async function () {
        const authorizer = vi.fn().mockResolvedValue({
          access_token: "token",
          token_type: "string",
          expires_in: -3600,
        } as AccessToken);
        const refresh = createTokenRefresher(authorizer, config);
        await expect(refresh().then(() => refresh())).resolves.toBeDefined();
        expect(authorizer).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("authorizeCollections", function () {
    it("makes the correct request", async function () {
      const [mockClient, mockAdapter] = createMock();
      await expect(
        authorizeCollections(config, undefined, mockClient),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]?.url).toBe("/collection/token/");
      expect(mockAdapter.history.post[0]?.headers?.Authorization).toBe(
        "Basic " + Buffer.from("id:secret").toString("base64"),
      );
    });
  });

  describe("authorizeDisbursements", function () {
    it("makes the correct request", async function () {
      const [mockClient, mockAdapter] = createMock();
      await expect(
        authorizeDisbursements(config, undefined, mockClient),
      ).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]?.url).toBe("/disbursement/token/");
      expect(mockAdapter.history.post[0]?.headers?.Authorization).toBe(
        "Basic " + Buffer.from("id:secret").toString("base64"),
      );
    });
  });

  describe("createBasicAuthToken", function () {
    it("encodes id and secret in base64", function () {
      expect(
        createBasicAuthToken({
          userId: "id",
          userSecret: "secret",
        }),
      ).toBe(Buffer.from("id:secret").toString("base64"));
    });
  });
});
