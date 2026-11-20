/**
 * Server-only listing rules engine + fair-price hint.
 * Money in integer paise, percentages in basis points (10000 = 100% of face value).
 */

export type RuleScope = "global" | "state" | "event";
export type ResaleRule = {
  scope: RuleScope;
  state_code: string | null;
  event_id: string | null;
  resale_allowed: boolean;
  max_price_bps_of_face: number;
  priority: number;
};

export type RuleEvent = {
  id: string;
  starts_at: string;
  is_resellable: boolean;
  /** Admin override on the event form, in percent of face value (e.g. 120). */
  resale_max_percent: number | null;
  state_code: string | null;
  /** Highest face-value tier for the event, if tiers exist. */
  max_tier_paise: number | null;
};

export type ListingRuleInput = {
  now: Date;
  event: RuleEvent;
  rules: ResaleRule[];
  sellerVerified: boolean;
  facePaise: number;
  pricePaise: number;
  quantity: number;
};

export type RejectCode =
  | "SELLER_NOT_VERIFIED"
  | "EVENT_NOT_RESELLABLE"
  | "EVENT_STARTED"
  | "STATE_RESALE_BANNED"
  | "PRICE_ABOVE_CAP"
  | "FACE_ABOVE_TIER"
  | "INVALID_AMOUNT"
  | "INVALID_QUANTITY";

export type RuleReason = { code: RejectCode; message: string };

export type CapResult = { allowed: boolean; capBps: number; source: string };

const DEFAULT_CAP_BPS = 10000;
export const MAX_PRICE_PAISE = 10_000_000_00; // ₹1 crore sanity limit

function pickBest(rules: ResaleRule[]): ResaleRule | undefined {
  return [...rules].sort((a, b) => b.priority - a.priority)[0];
}

/**
 * Cap resolution:
 *  - start from the highest-priority global rule (default 100% of face value)
 *  - an event rule, or the event's own resale_max_percent, replaces it (can go lower or higher)
 *  - a state rule for the venue's state is a ceiling the event cannot exceed;
 *    if the state disallows resale, listing is blocked.
 */
export function resolveCap(event: RuleEvent, rules: ResaleRule[]): CapResult {
  const global = pickBest(rules.filter((r) => r.scope === "global"));
  const state = event.state_code ? pickBest(rules.filter((r) => r.scope === "state" && r.state_code?.toUpperCase() === event.state_code!.toUpperCase())) : undefined;
  const evRule = pickBest(rules.filter((r) => r.scope === "event" && r.event_id === event.id));

  let capBps = global?.max_price_bps_of_face ?? DEFAULT_CAP_BPS;
  let source = global ? "global" : "default";
  let allowed = global?.resale_allowed ?? true;

  if (event.resale_max_percent != null) { capBps = event.resale_max_percent * 100; source = "event"; }
  if (evRule) { capBps = evRule.max_price_bps_of_face; source = "event"; allowed = evRule.resale_allowed && allowed; }
  if (state) {
    if (!state.resale_allowed) return { allowed: false, capBps: 0, source: "state" };
    if (state.max_price_bps_of_face < capBps) { capBps = state.max_price_bps_of_face; source = "state"; }
  }
  return { allowed, capBps: Math.max(0, Math.round(capBps)), source };
}

export function capPaise(facePaise: number, capBps: number): number {
  return Math.floor((facePaise * capBps) / 10000);
}

export function evaluateListing(input: ListingRuleInput): { ok: boolean; reasons: RuleReason[]; capPaise: number | null; capBps: number; capSource: string } {
  const reasons: RuleReason[] = [];
  const { event } = input;
  const cap = resolveCap(event, input.rules);

  if (!input.sellerVerified) reasons.push({ code: "SELLER_NOT_VERIFIED", message: "Verify your mobile number and add payout details before listing." });
  if (!event.is_resellable) reasons.push({ code: "EVENT_NOT_RESELLABLE", message: "The organiser does not allow tickets for this event to be transferred." });
  if (new Date(event.starts_at).getTime() <= input.now.getTime()) reasons.push({ code: "EVENT_STARTED", message: "This event has already started." });
  if (!cap.allowed) reasons.push({ code: "STATE_RESALE_BANNED", message: `Ticket resale is not permitted for events in ${event.state_code ?? "this state"}.` });
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) reasons.push({ code: "INVALID_QUANTITY", message: "Quantity must be between 1 and 10." });

  const amountsOk = [input.facePaise, input.pricePaise].every((v) => Number.isInteger(v) && v > 0 && v <= MAX_PRICE_PAISE);
  if (!amountsOk) {
    reasons.push({ code: "INVALID_AMOUNT", message: "Enter valid amounts greater than ₹0." });
    return { ok: false, reasons, capPaise: null, capBps: cap.capBps, capSource: cap.source };
  }

  if (event.max_tier_paise != null && input.facePaise > event.max_tier_paise) {
    reasons.push({ code: "FACE_ABOVE_TIER", message: `The price you paid can't exceed the highest ticket price for this event (₹${(event.max_tier_paise / 100).toLocaleString("en-IN")}).` });
  }
  const maxPrice = capPaise(input.facePaise, cap.capBps);
  if (cap.allowed && input.pricePaise > maxPrice) {
    reasons.push({ code: "PRICE_ABOVE_CAP", message: `Asking price is above the allowed maximum of ₹${(maxPrice / 100).toLocaleString("en-IN")} per ticket (${cap.capBps / 100}% of what you paid).` });
  }
  return { ok: reasons.length === 0, reasons, capPaise: cap.allowed ? maxPrice : null, capBps: cap.capBps, capSource: cap.source };
}

/* ---------- fair price hint ---------- */

export type FairPriceHint =
  | { level: "unknown"; samples: number }
  | { level: "fair" | "high" | "low"; samples: number; medianPaise: number; diffPct: number };

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

/** Compare asking price to similar recent listings. Prefers same-section comps when there are at least 3. */
export function fairPriceHint(pricePaise: number, comps: { price_paise: number; section: string | null }[], section?: string | null): FairPriceHint {
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const same = section ? comps.filter((c) => norm(c.section) === norm(section)) : [];
  const pool = (same.length >= 3 ? same : comps).map((c) => c.price_paise).filter((p) => p > 0);
  if (pool.length < 2) return { level: "unknown", samples: pool.length };
  const med = median(pool);
  const diffPct = Math.round(((pricePaise - med) / med) * 100);
  const level = diffPct > 25 ? "high" : diffPct < -40 ? "low" : "fair";
  return { level, samples: pool.length, medianPaise: med, diffPct };
}
