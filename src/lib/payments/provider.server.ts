import type { PaymentProvider, PaymentProviderName } from "./types";
import { mockPaymentProvider } from "./mock-provider.server";
import { razorpayPaymentProvider } from "./razorpay.server";

export function getPaymentProvider(name: PaymentProviderName): PaymentProvider {
  return name === "razorpay" ? razorpayPaymentProvider : mockPaymentProvider;
}

export function configuredPaymentProvider(): PaymentProviderName {
  return process.env["PAYMENT_PROVIDER"] === "razorpay" ? "razorpay" : "mock";
}
