import type { PaymentAdapter, PaymentSession } from "./types";

export const mockPaymentAdapter: PaymentAdapter = {
  createUpiSession({ orderId, amountPaise, buyerUpiId }): PaymentSession {
    const reference = `mock_${crypto.randomUUID().replaceAll("-", "")}`;
    const params = new URLSearchParams({ order: orderId, ref: reference, amount: String(amountPaise) });
    if (buyerUpiId) params.set("pa", buyerUpiId);
    const payload = `passon-mock://upi/pay?${params.toString()}`;
    return { provider: "mock", reference, method: "upi", intentUrl: payload, qrPayload: payload, amountPaise };
  },
  completeMockPayment(reference) {
    return { providerRef: `mock_pay_${reference.replace(/^mock_/, "")}`, paidAt: new Date().toISOString() };
  },
};
