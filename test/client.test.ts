import { expect, vi } from "vitest";

import { createAuthClient, createClient } from "../src/client";
import { createMock } from "./mock";

import type { Config } from "../src/common";
import { Environment } from "../src/common";

describe("Client", function () {
  const config: Config = {
    environment: Environment.SANDBOX,
    baseUrl: "test",
    primaryKey: "key",
    userId: "id",
    userSecret: "secret",
  };

  describe("createClient", function () {
    it("creates an axios instance with the right default headers", function () {
      const [mockClient] = createMock();
      const client = createClient(config, mockClient);
      expect(client.defaults.headers.common).toHaveProperty(
        "Ocp-Apim-Subscription-Key",
        "key",
      );
      expect(client.defaults.headers.common).toHaveProperty(
        "X-Target-Environment",
        "sandbox",
      );
    });

    it("makes requests with the right headers", async function () {
      const [mockClient, mockAdapter] = createMock();
      const client = createClient(config, mockClient);
      await expect(client.get("/test")).resolves.toBeDefined();
      expect(mockAdapter.history.get[0]?.headers).toHaveProperty(
        "Ocp-Apim-Subscription-Key",
        "key",
      );
      expect(mockAdapter.history.get[0]?.headers).toHaveProperty(
        "X-Target-Environment",
        "sandbox",
      );
    });
  });

  describe("createAuthClient", function () {
    it("makes requests with the right headers", async function () {
      const [mockClient, mockAdapter] = createMock();
      const refresher = vi.fn().mockResolvedValue("token");
      const client = createAuthClient(refresher, mockClient);
      await expect(client.get("/test")).resolves.toBeDefined();
      expect(mockAdapter.history.get[0]?.headers).toHaveProperty(
        "Authorization",
        "Bearer token",
      );
      expect(refresher).toHaveBeenCalledTimes(1);
    });
  });
});
