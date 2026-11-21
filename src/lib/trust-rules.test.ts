import { describe, expect, it } from "vitest";
import { canRaiseDispute, newSellerCanList, shouldAutoHideListing, waitlistMatches } from "./trust-rules";
import { calculateOrderQuote } from "./pricing.server";

describe("Phase 6 trust rules", () => {
  const start = new Date("2026-12-01T13:30:00.000Z");
  it("opens disputes at event start and closes them exactly after 48 hours", () => {
    expect(canRaiseDispute(start, new Date(start.getTime()-1))).toBe(false);
    expect(canRaiseDispute(start, start)).toBe(true);
    expect(canRaiseDispute(start, new Date(start.getTime()+48*3_600_000))).toBe(true);
    expect(canRaiseDispute(start, new Date(start.getTime()+48*3_600_000+1))).toBe(false);
  });
  it("auto-hides on the third report, not the second", () => { expect(shouldAutoHideListing(2)).toBe(false); expect(shouldAutoHideListing(3)).toBe(true); });
  it("limits new sellers to five listings per day", () => {
    const created = new Date("2026-11-01T00:00:00Z"); const now = new Date("2026-11-20T00:00:00Z");
    expect(newSellerCanList(created,4,now)).toBe(true); expect(newSellerCanList(created,5,now)).toBe(false);
  });
  it("does not limit an established seller by the new-seller rule", () => { expect(newSellerCanList("2026-01-01T00:00:00Z",20,new Date("2026-11-20T00:00:00Z"))).toBe(true); });
  it("matches waitlist price and quantity, including adjacent groups up to six", () => { expect(waitlistMatches(100_000,100_000,6,6)).toBe(true); expect(waitlistMatches(100_001,100_000,6,6)).toBe(false); expect(waitlistMatches(100_000,100_000,5,6)).toBe(false); });
  it("prices six group tickets but rejects a seventh", () => {
    const config = { buyerFeeBps:500,sellerFeeBps:500,gstBps:1800 };
    expect(calculateOrderQuote(100_000,6,config).buyerTotalPaise).toBe(635_400);
    expect(() => calculateOrderQuote(100_000,7,config)).toThrow("Group checkout is limited to 6 tickets");
  });
});
