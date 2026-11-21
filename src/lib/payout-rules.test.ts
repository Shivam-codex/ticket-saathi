import { describe, expect, it } from "vitest";
import { payoutReleaseDecision, shouldAutoRefundUndelivered } from "./payout-rules";

const base = { orderStatus: "ticket_delivered", hasOpenDispute: false, entryConfirmedAt: null, eventEndsAt: "2026-11-21T18:00:00.000Z" };

describe("seller payout release", () => {
  it("releases immediately when the buyer confirms entry", () => {
    expect(payoutReleaseDecision({ ...base, now: new Date("2026-11-21T10:00:00Z"), entryConfirmedAt: "2026-11-21T10:00:00Z" })).toEqual({ eligible: true, reason: "entry_confirmed" });
  });
  it("releases exactly 24 hours after the event ends", () => {
    expect(payoutReleaseDecision({ ...base, now: new Date("2026-11-22T17:59:59.999Z") })).toEqual({ eligible: false, reason: "waiting_for_entry_or_grace" });
    expect(payoutReleaseDecision({ ...base, now: new Date("2026-11-22T18:00:00.000Z") })).toEqual({ eligible: true, reason: "event_end_grace_elapsed" });
  });
  it("never releases while a dispute is open", () => {
    expect(payoutReleaseDecision({ ...base, now: new Date("2026-11-23T18:00:00Z"), hasOpenDispute: true }).eligible).toBe(false);
  });
  it("never releases an undelivered order even after the grace period", () => {
    expect(payoutReleaseDecision({ ...base, now: new Date("2026-11-23T18:00:00Z"), orderStatus: "paid" })).toEqual({ eligible: false, reason: "not_delivered" });
  });
  it("blocks time-based release when the event end is missing", () => {
    expect(payoutReleaseDecision({ ...base, now: new Date("2026-12-01T18:00:00Z"), eventEndsAt: null })).toEqual({ eligible: false, reason: "missing_event_end" });
  });
});

describe("automatic undelivered-ticket refund", () => {
  it("refunds a paid order at its 24-hour delivery deadline", () => {
    expect(shouldAutoRefundUndelivered({ now: new Date("2026-11-22T10:00:00Z"), orderStatus: "paid", deliveryDueAt: "2026-11-22T10:00:00Z", hasOpenDispute: false })).toBe(true);
  });
  it("does not refund delivered, early or disputed orders", () => {
    expect(shouldAutoRefundUndelivered({ now: new Date("2026-11-22T10:00:00Z"), orderStatus: "ticket_delivered", deliveryDueAt: "2026-11-22T10:00:00Z", hasOpenDispute: false })).toBe(false);
    expect(shouldAutoRefundUndelivered({ now: new Date("2026-11-22T09:59:59Z"), orderStatus: "paid", deliveryDueAt: "2026-11-22T10:00:00Z", hasOpenDispute: false })).toBe(false);
    expect(shouldAutoRefundUndelivered({ now: new Date("2026-11-22T10:00:00Z"), orderStatus: "paid", deliveryDueAt: "2026-11-22T10:00:00Z", hasOpenDispute: true })).toBe(false);
  });
});
