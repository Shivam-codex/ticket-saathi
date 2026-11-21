export type PaymentProviderName = "mock" | "razorpay";

export type PaymentSession = {
  provider: "mock";
  reference: string;
  method: "upi";
  intentUrl: string;
  qrPayload: string;
  amountPaise: number;
};

export type PaymentAdapter = {
  createUpiSession(input: { orderId: string; amountPaise: number; buyerUpiId: string | null }): PaymentSession;
  completeMockPayment(reference: string): { providerRef: string; paidAt: string };
};

export type CreateProviderOrderInput = {
  orderId: string;
  amountPaise: number;
  sellerAmountPaise: number;
  sellerRouteAccountId: string | null;
  buyerName: string;
  buyerPhone: string;
};

export type ProviderOrder = {
  provider: PaymentProviderName;
  providerOrderId: string;
  amountPaise: number;
  currency: "INR";
  keyId: string | null;
};

export type ProviderPaymentStatus = {
  providerOrderId: string;
  providerPaymentId: string | null;
  status: "created" | "attempted" | "paid";
  amountPaise: number;
};

export type VerifiedWebhook = {
  eventId: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  status: "created" | "attempted" | "paid";
  amountPaise: number;
  verification: "provider_read_back";
};

export type ProviderRefund = { providerRefundId: string; amountPaise: number; status: string };
export type ProviderPayout = { providerPayoutId: string; amountPaise: number; status: string };

/** Implemented only by server modules. Real sellers use provider-hosted splits/transfers. */
export interface PaymentProvider {
  createOrder(input: CreateProviderOrderInput): Promise<ProviderOrder>;
  verifyWebhook(input: { rawBody: string; eventId: string }): Promise<VerifiedWebhook>;
  refund(input: { orderId: string; paymentId: string; amountPaise: number }): Promise<ProviderRefund>;
  payoutToSeller(input: { orderId: string; paymentId: string; amountPaise: number; sellerRouteAccountId: string | null; transferId: string | null }): Promise<ProviderPayout>;
  getStatus(providerOrderId: string): Promise<ProviderPaymentStatus>;
}
