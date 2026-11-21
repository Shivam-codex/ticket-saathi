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
