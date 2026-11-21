import { z } from "zod";
import type { CreateProviderOrderInput, PaymentProvider, ProviderPaymentStatus, ProviderRefund, ProviderPayout, VerifiedWebhook } from "./types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/razorpay";

function credentials() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["RAZORPAY_CONNECTION_KEY"];
  const keyId = process.env["RAZORPAY_CONNECTION_KEY_ID"];
  if (!lovableKey || !connectionKey || !keyId) throw new Error("Razorpay is not connected");
  return { lovableKey, connectionKey, keyId };
}

async function request(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const { lovableKey, connectionKey } = credentials();
  const response = await fetch(`${GATEWAY_URL}/${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connectionKey, "Content-Type": "application/json" },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Razorpay ${path} failed [${response.status}]: ${text}`);
    throw new Error(`Razorpay request failed [${response.status}]: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

const orderSchema = z.object({ id: z.string(), amount: z.number().int(), amount_paid: z.number().int().optional(), status: z.string(), currency: z.string().optional() });
const paymentListSchema = z.object({ items: z.array(z.object({ id: z.string(), status: z.string(), amount: z.number().int() })).catch([]) });

async function getStatus(providerOrderId: string): Promise<ProviderPaymentStatus> {
  let raw = orderSchema.parse(await request(`orders/${encodeURIComponent(providerOrderId)}`));
  const payments = paymentListSchema.parse(await request(`orders/${encodeURIComponent(providerOrderId)}/payments`));
  if (raw.status === "attempted") {
    const authorized = payments.items.find((p) => p.status === "authorized" && p.amount === raw.amount);
    if (authorized) {
      await request(`payments/${encodeURIComponent(authorized.id)}/capture`, { method: "POST", body: { amount: raw.amount, currency: "INR" } });
      raw = orderSchema.parse(await request(`orders/${encodeURIComponent(providerOrderId)}`));
    }
  }
  const paidPayment = payments.items.find((p) => ["captured", "authorized"].includes(p.status)) ?? payments.items[0] ?? null;
  return {
    providerOrderId: raw.id,
    providerPaymentId: paidPayment?.id ?? null,
    status: raw.status === "paid" ? "paid" : raw.status === "attempted" ? "attempted" : "created",
    amountPaise: raw.status === "paid" ? (raw.amount_paid ?? 0) : raw.amount,
  };
}

export const razorpayPaymentProvider: PaymentProvider = {
  async createOrder(input: CreateProviderOrderInput) {
    if (!input.sellerRouteAccountId) throw new Error("Razorpay Route linked account required; real checkout stays disabled until marketplace transfers are approved");
    const { keyId } = credentials();
    const body = {
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.orderId,
      notes: { orderId: input.orderId },
      transfers: [{ account: input.sellerRouteAccountId, amount: input.sellerAmountPaise, currency: "INR", on_hold: true }],
    };
    const result = orderSchema.parse(await request("orders", { method: "POST", body }));
    return { provider: "razorpay" as const, providerOrderId: result.id, amountPaise: result.amount, currency: "INR" as const, keyId };
  },

  async verifyWebhook({ rawBody, eventId }): Promise<VerifiedWebhook> {
    const payload = z.object({
      payload: z.object({
        payment: z.object({ entity: z.object({ id: z.string(), order_id: z.string() }).optional() }).optional(),
        order: z.object({ entity: z.object({ id: z.string() }).optional() }).optional(),
      }),
    }).parse(JSON.parse(rawBody));
    const providerOrderId = payload.payload.payment?.entity?.order_id ?? payload.payload.order?.entity?.id;
    if (!providerOrderId) throw new Error("Razorpay webhook has no order reference");
    // Connector mode intentionally leaves Razorpay's webhook Secret empty. Never trust the payload:
    // the provider read-back is the authenticity and amount check, and eventId supplies replay protection.
    const status = await getStatus(providerOrderId);
    return { eventId, ...status, verification: "provider_read_back" };
  },

  async refund({ orderId, paymentId, amountPaise }): Promise<ProviderRefund> {
    const existing = z.object({ items: z.array(z.object({ id: z.string(), amount: z.number().int(), status: z.string() })).catch([]) })
      .parse(await request(`payments/${encodeURIComponent(paymentId)}/refunds`));
    const found = existing.items.find((r) => r.amount === amountPaise && r.status !== "failed");
    if (found) return { providerRefundId: found.id, amountPaise: found.amount, status: found.status };
    const refund = z.object({ id: z.string(), amount: z.number().int(), status: z.string() }).parse(await request(`payments/${encodeURIComponent(paymentId)}/refund`, {
      method: "POST", body: { amount: amountPaise, reverse_all: true, notes: { orderId } },
    }));
    return { providerRefundId: refund.id, amountPaise: refund.amount, status: refund.status };
  },

  async payoutToSeller({ paymentId, amountPaise, sellerRouteAccountId, transferId }): Promise<ProviderPayout> {
    if (!sellerRouteAccountId) throw new Error("Razorpay Route linked account required for seller payout");
    let id = transferId;
    if (!id) {
      const transfers = z.object({ items: z.array(z.object({ id: z.string(), account: z.string(), amount: z.number().int(), on_hold: z.boolean().optional() })).catch([]) })
        .parse(await request(`payments/${encodeURIComponent(paymentId)}/transfers`));
      const transfer = transfers.items.find((t) => t.account === sellerRouteAccountId && t.amount === amountPaise);
      if (!transfer) throw new Error("No provider-held seller transfer found");
      if (transfer.on_hold === false) return { providerPayoutId: transfer.id, amountPaise: transfer.amount, status: "processed" };
      id = transfer.id;
    }
    const released = z.object({ id: z.string(), amount: z.number().int(), on_hold: z.boolean().optional() }).parse(await request(`transfers/${encodeURIComponent(id)}`, { method: "PATCH", body: { on_hold: false } }));
    return { providerPayoutId: released.id, amountPaise: released.amount, status: released.on_hold === false ? "processed" : "on_hold" };
  },

  getStatus,
};
