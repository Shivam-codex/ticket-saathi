import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { payoutReleaseDecision, shouldAutoRefundUndelivered } from "@/lib/payout-rules";
import { getPaymentProvider } from "./provider.server";
import type { PaymentProviderName } from "./types";

export async function confirmRazorpayOrder(orderId: string, actorId?: string) {
  const { data: initial, error } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error || !initial) throw new Error("Order not found");
  if (["paid", "ticket_delivered", "completed", "disputed", "refunded"].includes(initial.status)) return initial;
  if (initial.payment_provider !== "razorpay" || !initial.provider_order_ref) throw new Error("Razorpay order has not been created");
  const actor = actorId ?? initial.buyer_id;
  if (!actor) throw new Error("Order buyer is missing");

  const provider = getPaymentProvider("razorpay");
  const status = await provider.getStatus(initial.provider_order_ref);
  if (status.status !== "paid") return initial;
  if (status.amountPaise !== Number(initial.total_paise) || !status.providerPaymentId) throw new Error("Razorpay paid amount does not match the order");

  const expired = initial.status === "cancelled" || !initial.hold_expires_at || new Date(initial.hold_expires_at).getTime() <= Date.now();
  if (expired && initial.status === "payment_pending") {
    await supabaseAdmin.rpc("release_checkout_order", { p_order_id: initial.id, p_actor_id: actor, p_reason: "Reservation expired before provider confirmation" });
  }
  if (!expired) {
    const paid = await supabaseAdmin.rpc("record_order_payment", { p_order_id: initial.id, p_payment_ref: status.providerPaymentId, p_actor_id: actor, p_delivery_hours: 24 });
    if (paid.error) throw new Error("Could not record verified payment");
    return paid.data;
  }

  const refund = await provider.refund({ orderId: initial.id, paymentId: status.providerPaymentId, amountPaise: Number(initial.total_paise) });
  const refunded = await supabaseAdmin.rpc("record_late_refunded_payment", { p_order_id: initial.id, p_payment_ref: status.providerPaymentId, p_refund_ref: refund.providerRefundId, p_actor_id: actor });
  if (refunded.error) throw new Error("Late payment was refunded; order reconciliation needs attention");
  return refunded.data;
}

export async function refundOrder(orderId: string, actorId: string, note: string) {
  const { data: order } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("Order not found");
  if (order.status === "refunded") return order;
  if (!["paid", "ticket_delivered", "disputed"].includes(order.status) || !order.payment_ref) throw new Error("This order cannot be refunded");
  const providerName = order.payment_provider === "razorpay" ? "razorpay" : "mock";
  const claimed = await supabaseAdmin.rpc("claim_payment_operation", { p_order_id: orderId, p_operation: "refund", p_provider: providerName });
  if (claimed.error) throw new Error("Could not start refund");
  if (!claimed.data) return order;
  try {
    const refund = await getPaymentProvider(providerName).refund({ orderId, paymentId: order.payment_ref, amountPaise: Number(order.total_paise) });
    const recorded = await supabaseAdmin.rpc("record_order_refund", { p_order_id: orderId, p_refund_ref: refund.providerRefundId, p_actor_id: actorId, p_note: note });
    if (recorded.error) throw new Error("Provider refunded; ledger reconciliation needs attention");
    return recorded.data;
  } catch (error) {
    await supabaseAdmin.rpc("fail_payment_operation", { p_order_id: orderId, p_operation: "refund", p_error: error instanceof Error ? error.message : "Refund failed" });
    throw error;
  }
}

async function releasePayout(payoutId: string) {
  const claimed = await supabaseAdmin.rpc("claim_payout", { p_payout_id: payoutId });
  if (claimed.error) throw new Error("Could not claim seller payout");
  const payout = claimed.data;
  if (!payout?.id || !payout.order_id) return false;
  try {
    const [{ data: order }, { data: seller }] = await Promise.all([
      supabaseAdmin.from("orders").select("id, payment_ref").eq("id", payout.order_id).single(),
      supabaseAdmin.from("profiles").select("razorpay_route_account_id").eq("id", payout.seller_id ?? "").maybeSingle(),
    ]);
    if (!order?.payment_ref) throw new Error("Provider payment reference missing");
    const providerName: PaymentProviderName = payout.provider === "razorpay" ? "razorpay" : "mock";
    const released = await getPaymentProvider(providerName).payoutToSeller({
      orderId: payout.order_id,
      paymentId: order.payment_ref,
      amountPaise: Number(payout.amount_paise),
      sellerRouteAccountId: seller?.razorpay_route_account_id ?? null,
      transferId: null,
    });
    const completed = await supabaseAdmin.rpc("complete_payout", { p_payout_id: payout.id, p_provider_ref: released.providerPayoutId });
    if (completed.error) throw new Error("Provider payout released; ledger reconciliation needs attention");
    return true;
  } catch (error) {
    await supabaseAdmin.rpc("fail_payout", { p_payout_id: payout.id, p_error: error instanceof Error ? error.message : "Payout failed" });
    throw error;
  }
}

export async function releasePayoutForOrder(orderId: string) {
  const { data: payout } = await supabaseAdmin.from("payouts").select("id, status").eq("order_id", orderId).maybeSingle();
  if (!payout || payout.status === "paid") return false;
  return releasePayout(payout.id);
}

export async function processPaymentMaintenance() {
  const now = new Date();
  const [{ data: dueOrders }, { data: payouts }] = await Promise.all([
    supabaseAdmin.from("orders").select("id, buyer_id, status, delivery_due_at, disputes(status)").eq("status", "paid").lte("delivery_due_at", now.toISOString()).limit(20),
    supabaseAdmin.from("payouts").select("id, order_id, status, orders(id, status, entry_confirmed_at, disputes(status), listings(events(ends_at)))").in("status", ["scheduled", "on_hold"]).limit(100),
  ]);
  let refunds = 0;
  let released = 0;
  const errors: string[] = [];
  for (const order of dueOrders ?? []) {
    const openDispute = (order.disputes ?? []).some((d) => ["open", "reviewing"].includes(d.status));
    if (!shouldAutoRefundUndelivered({ now, orderStatus: order.status, deliveryDueAt: order.delivery_due_at, hasOpenDispute: openDispute })) continue;
    try { if (order.buyer_id) { await refundOrder(order.id, order.buyer_id, "Automatic refund: ticket not delivered within 24 hours"); refunds += 1; } }
    catch (error) { errors.push(error instanceof Error ? error.message : "Refund failed"); }
  }
  for (const payout of payouts ?? []) {
    const order = payout.orders;
    if (!order) continue;
    const openDispute = (order.disputes ?? []).some((d) => ["open", "reviewing"].includes(d.status));
    const decision = payoutReleaseDecision({ now, entryConfirmedAt: order.entry_confirmed_at, eventEndsAt: order.listings?.events?.ends_at ?? null, orderStatus: order.status, hasOpenDispute: openDispute });
    if (!decision.eligible) continue;
    try { if (await releasePayout(payout.id)) released += 1; }
    catch (error) { errors.push(error instanceof Error ? error.message : "Payout failed"); }
  }
  return { refunds, released, errors };
}
