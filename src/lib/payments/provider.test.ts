import { describe, expect, it } from "vitest";
import { mockPaymentsAllowed } from "./provider.server";

describe("mock payment launch gate", () => {
  it("blocks mock payments by default outside production", () => {
    expect(mockPaymentsAllowed({ NODE_ENV: "development", APP_ENV: "development" })).toBe(false);
  });
  it("allows mock payments only with an explicit test opt-in", () => {
    expect(mockPaymentsAllowed({ NODE_ENV: "development", APP_ENV: "test", ALLOW_MOCK_PAYMENTS: "true" })).toBe(true);
  });
  it("always blocks mock payments in a production runtime", () => {
    expect(mockPaymentsAllowed({ NODE_ENV: "production", APP_ENV: "test", ALLOW_MOCK_PAYMENTS: "true" })).toBe(false);
  });
  it("always blocks mock payments in a production environment", () => {
    expect(mockPaymentsAllowed({ NODE_ENV: "development", APP_ENV: "production", ALLOW_MOCK_PAYMENTS: "true" })).toBe(false);
  });
});
