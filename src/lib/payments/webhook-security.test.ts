import { describe, expect, it } from "vitest";
import { verifyRazorpayWebhookSignature } from "./webhook-security.server";

describe("Razorpay webhook authentication", () => {
  it("accepts the provider HMAC over the exact raw body", async () => {
    expect(await verifyRazorpayWebhookSignature('{"event":"payment.captured"}', "f962b4cdc1d54bae85fda03948777b50bcfaa8f2c73369cf66577802120415ee", "test-secret")).toBe(true);
  });
  it("rejects altered bodies and missing configuration", async () => {
    expect(await verifyRazorpayWebhookSignature("altered", "f962b4cdc1d54bae85fda03948777b50bcfaa8f2c73369cf66577802120415ee", "test-secret")).toBe(false);
    expect(await verifyRazorpayWebhookSignature("body", null, undefined)).toBe(false);
  });
});
