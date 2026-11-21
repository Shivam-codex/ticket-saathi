import { describe, expect, it } from "vitest";
import { mockPaymentsAllowed } from "./provider.server";

describe("mock payment launch gate", () => {
  it("allows mock payments outside production", () => {
    expect(mockPaymentsAllowed({ NODE_ENV: "development" })).toBe(true);
  });
  it("blocks mock payments in production by default", () => {
    expect(mockPaymentsAllowed({ NODE_ENV: "production" })).toBe(false);
  });
  it("requires an explicit production override", () => {
    expect(mockPaymentsAllowed({ NODE_ENV: "production", ALLOW_MOCK_PAYMENTS: "true" })).toBe(true);
  });
});
