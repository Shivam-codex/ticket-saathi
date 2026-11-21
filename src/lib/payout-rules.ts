export type ReleaseInput = {
  now: Date;
  entryConfirmedAt: string | null;
  eventEndsAt: string | null;
  orderStatus: string;
  hasOpenDispute: boolean;
};

export type ReleaseDecision =
  | { eligible: true; reason: "entry_confirmed" | "event_end_grace_elapsed" }
  | { eligible: false; reason: "disputed" | "not_delivered" | "waiting_for_entry_or_grace" | "missing_event_end" | "refunded" };

export function payoutReleaseDecision(input: ReleaseInput): ReleaseDecision {
  if (input.hasOpenDispute || input.orderStatus === "disputed") return { eligible: false, reason: "disputed" };
  if (input.orderStatus === "refunded") return { eligible: false, reason: "refunded" };
  if (!['ticket_delivered', 'completed'].includes(input.orderStatus)) return { eligible: false, reason: "not_delivered" };
  if (input.entryConfirmedAt) return { eligible: true, reason: "entry_confirmed" };
  if (!input.eventEndsAt) return { eligible: false, reason: "missing_event_end" };
  const releaseAt = new Date(input.eventEndsAt).getTime() + 24 * 60 * 60 * 1000;
  return input.now.getTime() >= releaseAt
    ? { eligible: true, reason: "event_end_grace_elapsed" }
    : { eligible: false, reason: "waiting_for_entry_or_grace" };
}

export function shouldAutoRefundUndelivered(input: { now: Date; orderStatus: string; deliveryDueAt: string | null; hasOpenDispute: boolean }): boolean {
  return input.orderStatus === "paid" && !input.hasOpenDispute && !!input.deliveryDueAt && new Date(input.deliveryDueAt).getTime() <= input.now.getTime();
}
