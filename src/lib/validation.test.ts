import { describe, expect, it } from "vitest";
import { consentsValid, hasValidPayout, isSellerReady, normaliseIndianPhone } from "./validation";

describe("phone", () => {
  it("normalises 10-digit Indian mobiles to +91", () => expect(normaliseIndianPhone("90119 67964")).toBe("+919011967964"));
  it("rejects numbers not starting 6-9", () => expect(normaliseIndianPhone("5011967964")).toBeNull());
});
describe("seller readiness", () => {
  it("allows verified phone + UPI", () => expect(isSellerReady(true, { upi: "shivam@okaxis" })).toBe(true));
  it("allows verified phone + bank + IFSC", () => expect(isSellerReady(true, { account: "123456789012", ifsc: "HDFC0001234" })).toBe(true));
  it("blocks unverified phone even with payout", () => expect(isSellerReady(false, { upi: "shivam@okaxis" })).toBe(false));
  it("blocks bank account without IFSC", () => expect(hasValidPayout({ account: "123456789012" })).toBe(false));
  it("blocks no payout", () => expect(isSellerReady(true, {})).toBe(false));
});
describe("consent", () => {
  it("requires terms and transactions", () => expect(consentsValid({ terms: true, transactions: false })).toBe(false));
  it("passes with required only", () => expect(consentsValid({ terms: true, transactions: true })).toBe(true));
});
