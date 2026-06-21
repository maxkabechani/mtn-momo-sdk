import type { HttpClient } from "../src/httpClient";
import type { FetchMockAdapter } from "./mock";
import { expect } from "vitest";

import Users from "../src/users";
import { createMock, VALID_REFERENCE_ID } from "./mock";

describe("Users", function () {
  let users: Users;
  let mockAdapter: FetchMockAdapter;
  let mockClient: HttpClient;

  beforeEach(() => {
    [mockClient, mockAdapter] = createMock();
    users = new Users(mockClient);
  });

  describe("create", function () {
    it("makes the correct request", async function () {
      await expect(users.create("host")).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]?.url).toBe("/v1_0/apiuser");
      expect(mockAdapter.history.post[0]?.data).toBe(
        JSON.stringify({ providerCallbackHost: "host" }),
      );
      expect(mockAdapter.history.post[0]?.headers?.["X-Reference-Id"]).toBeTypeOf(
        "string",
      );
    });
  });

  describe("login", function () {
    it("makes the correct request", async function () {
      await expect(users.login(VALID_REFERENCE_ID)).resolves.toBeDefined();
      expect(mockAdapter.history.post).toHaveLength(1);
      expect(mockAdapter.history.post[0]!.url).toBe(
        `/v1_0/apiuser/${VALID_REFERENCE_ID}/apikey`,
      );
    });
  });

  describe("getApiUser", function () {
    it("makes the correct request", async function () {
      await expect(users.getApiUser(VALID_REFERENCE_ID)).resolves.toBeDefined();
      expect(mockAdapter.history.get).toHaveLength(1);
      expect(mockAdapter.history.get[0]!.url).toBe(
        `/v1_0/apiuser/${VALID_REFERENCE_ID}`,
      );
    });
  });
});
