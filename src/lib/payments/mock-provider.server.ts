import { createHash } from "node:crypto";
import type { PaymentProvider } from "./types";

export const mockPaymentProvider: PaymentProvider = {
  async createOrder(input) {
    if (!input.sellerRouteAccountId) throw new Error("Mock seller route account required");
    return { provider: "mock", providerOrderId: `mock_order_${input.orderId}`, amountPaise: input.amountPaise, currency: "INR", keyId: null };
  },
  async verifyWebhook({ rawBody, eventId }) {
    const body = JSON.parse(rawBody) as { providerOrderId?: string; amountPaise?: number; providerPaymentId?: string };
    if (!body.providerOrderId || !body.amountPaise) throw new Error("Invalid mock webhook");
    return { eventId, providerOrderId: body.providerOrderId, providerPaymentId: body.providerPaymentId ?? `mock_pay_${createHash("sha256").update(eventId).digest("hex").slice(0, 24)}`, status: "paid", amountPaise: body.amountPaise, verification: "provider_read_back" };
  },
  async refund({ orderId, amountPaise }) {
    return { providerRefundId: `mock_refund_${orderId}`, amountPaise, status: "processed" };
  },
  async payoutToSeller({ orderId, amountPaise }) {
    return { providerPayoutId: `mock_payout_${orderId}`, amountPaise, status: "processed" };
  },
  async getStatus(providerOrderId) {
    return { providerOrderId, providerPaymentId: `mock_pay_${providerOrderId}`, status: "paid", amountPaise: 0 };
  },
};
