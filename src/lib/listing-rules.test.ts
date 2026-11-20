import { describe, it, expect } from "vitest";
import { evaluateListing, resolveCap, fairPriceHint, type ResaleRule, type RuleEvent } from "./listing-rules.server";

const now = new Date("2026-11-21T10:00:00Z");
const event: RuleEvent = { id: "e1", starts_at: "2026-11-25T14:00:00Z", is_resellable: true, resale_max_percent: null, state_code: "MH", max_tier_paise: 250000 };
const global: ResaleRule = { scope: "global", state_code: null, event_id: null, resale_allowed: true, max_price_bps_of_face: 10000, priority: 0 };
const base = { now, event, rules: [global], sellerVerified: true, facePaise: 120000, pricePaise: 120000, quantity: 2 };
const codes = (r: ReturnType<typeof evaluateListing>) => r.reasons.map((x) => x.code);

describe("rules engine", () => {
  it("accepts a price equal to face value by default", () => {
    const r = evaluateListing(base);
    expect(r.ok).toBe(true);
    expect(r.capPaise).toBe(120000);
  });
  it("rejects a price above face value by default", () => {
    expect(codes(evaluateListing({ ...base, pricePaise: 120001 }))).toEqual(["PRICE_ABOVE_CAP"]);
  });
  it("rejects non-resellable events", () => {
    expect(codes(evaluateListing({ ...base, event: { ...event, is_resellable: false } }))).toContain("EVENT_NOT_RESELLABLE");
  });
  it("rejects events that already started", () => {
    expect(codes(evaluateListing({ ...base, event: { ...event, starts_at: "2026-11-21T10:00:00Z" } }))).toContain("EVENT_STARTED");
  });
  it("rejects unverified sellers", () => {
    expect(codes(evaluateListing({ ...base, sellerVerified: false }))).toContain("SELLER_NOT_VERIFIED");
  });
  it("event override can raise the cap (120%)", () => {
    const r = evaluateListing({ ...base, event: { ...event, resale_max_percent: 120 }, pricePaise: 144000 });
    expect(r.ok).toBe(true);
    expect(r.capPaise).toBe(144000);
  });
  it("event rule can lower the cap (80%)", () => {
    const rules = [global, { ...global, scope: "event" as const, event_id: "e1", max_price_bps_of_face: 8000 }];
    expect(codes(evaluateListing({ ...base, rules, pricePaise: 96001 }))).toEqual(["PRICE_ABOVE_CAP"]);
    expect(evaluateListing({ ...base, rules, pricePaise: 96000 }).ok).toBe(true);
  });
  it("state cap is a ceiling the event cannot exceed", () => {
    const rules = [global, { ...global, scope: "state" as const, state_code: "MH", max_price_bps_of_face: 10000 }];
    const cap = resolveCap({ ...event, resale_max_percent: 150 }, rules);
    expect(cap).toMatchObject({ capBps: 10000, source: "state" });
  });
  it("state that bans resale blocks the listing", () => {
    const rules = [global, { ...global, scope: "state" as const, state_code: "MH", resale_allowed: false }];
    expect(codes(evaluateListing({ ...base, rules }))).toContain("STATE_RESALE_BANNED");
  });
  it("other states' rules do not apply", () => {
    const rules = [global, { ...global, scope: "state" as const, state_code: "KA", resale_allowed: false }];
    expect(evaluateListing({ ...base, rules }).ok).toBe(true);
  });
  it("rejects claimed face value above the event's top tier", () => {
    expect(codes(evaluateListing({ ...base, facePaise: 300000, pricePaise: 100000 }))).toContain("FACE_ABOVE_TIER");
  });
  it("rejects zero / fractional amounts and bad quantity", () => {
    expect(codes(evaluateListing({ ...base, pricePaise: 0 }))).toContain("INVALID_AMOUNT");
    expect(codes(evaluateListing({ ...base, pricePaise: 100.5 }))).toContain("INVALID_AMOUNT");
    expect(codes(evaluateListing({ ...base, quantity: 11 }))).toContain("INVALID_QUANTITY");
  });
  it("cap math floors to whole paise", () => {
    const r = evaluateListing({ ...base, facePaise: 99999, pricePaise: 1, event: { ...event, resale_max_percent: 90 } });
    expect(r.capPaise).toBe(89999);
  });
});

describe("fair price hint", () => {
  const comps = [100000, 110000, 90000, 105000].map((p) => ({ price_paise: p, section: null }));
  it("unknown with fewer than 2 comps", () => expect(fairPriceHint(100000, comps.slice(0, 1)).level).toBe("unknown"));
  it("fair near the median", () => expect(fairPriceHint(102000, comps)).toMatchObject({ level: "fair", medianPaise: 102500 }));
  it("high when >25% above", () => expect(fairPriceHint(130000, comps).level).toBe("high"));
  it("low when >40% below", () => expect(fairPriceHint(60000, comps).level).toBe("low"));
});
