import { AssertionError } from "assert";
import { expect } from "vitest";

import * as momo from "../src";

describe("MomoClient", function () {
  describe("#create", function () {
    describe("when there is no callback host", function () {
      it("throws an error", function () {
        expect(momo.create.bind(null, {})).toThrow(AssertionError);
      });
    });

    describe("when there is a callback host", function () {
      it("throws doesn't throw  an error", function () {
        expect(
          momo.create.bind(null, { callbackHost: "example.com" }),
        ).not.toThrow();
      });

      it("returns a creator for Collections client", function () {
        expect(momo.create({ callbackHost: "example.com" })).toHaveProperty(
          "Collections",
        );
        expect(
          typeof momo.create({ callbackHost: "example.com" }).Collections,
        ).toBe("function");
      });

      it("returns a creator for Disbursements client", function () {
        expect(momo.create({ callbackHost: "example.com" })).toHaveProperty(
          "Disbursements",
        );
        expect(
          typeof momo.create({ callbackHost: "example.com" }).Disbursements,
        ).toBe("function");
      });
    });
  });
});
