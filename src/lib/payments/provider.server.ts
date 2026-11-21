import type { PaymentProvider, PaymentProviderName } from "./types";
import { mockPaymentProvider } from "./mock-provider.server";
import { razorpayPaymentProvider } from "./razorpay.server";

export function getPaymentProvider(name: PaymentProviderName): PaymentProvider {
  return name === "razorpay" ? razorpayPaymentProvider : mockPaymentProvider;
}

export function mockPaymentsAllowed(env: Record<string, string | undefined>): boolean {
  return env["NODE_ENV"] !== "production" || env["ALLOW_MOCK_PAYMENTS"] === "true";
}

export function assertMockPaymentsAllowed() {
  if (!mockPaymentsAllowed(process.env)) throw new Error("Mock payments are disabled in production");
}

export function configuredPaymentProvider(): PaymentProviderName {
  if (process.env["PAYMENT_PROVIDER"] === "razorpay") return "razorpay";
  assertMockPaymentsAllowed();
  return "mock";
}
