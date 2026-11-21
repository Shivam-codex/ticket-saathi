import { describe, expect, it } from "vitest";
import { reconcileOrder, type ReconciliationEntry } from "./reconciliation.server";

const order = { id: "order-1", status: "refunded", total_paise: 105_900, seller_net_paise: 94_100, tcs_paise: 0, tds_paise: 0 };
const paymentGroup = "11111111-1111-1111-1111-111111111111";
const refundGroup = "22222222-2222-2222-2222-222222222222";
const payment: ReconciliationEntry[] = [
  { order_id: order.id, transaction_group: paymentGroup, account: "provider_settlement", direction: "debit", amount_paise: 105_900, entry_type: "payment_provider" },
  { order_id: order.id, transaction_group: paymentGroup, account: "seller", direction: "credit", amount_paise: 100_000, entry_type: "ticket_price" },
  { order_id: order.id, transaction_group: paymentGroup, account: "platform_fee", direction: "credit", amount_paise: 5_000, entry_type: "buyer_fee" },
  { order_id: order.id, transaction_group: paymentGroup, account: "gst_payable", direction: "credit", amount_paise: 900, entry_type: "buyer_gst" },
  { order_id: order.id, transaction_group: paymentGroup, account: "seller", direction: "debit", amount_paise: 5_900, entry_type: "seller_fee" },
  { order_id: order.id, transaction_group: paymentGroup, account: "platform_fee", direction: "credit", amount_paise: 5_900, entry_type: "seller_fee" },
];
const refund: ReconciliationEntry[] = [
  { order_id: order.id, transaction_group: refundGroup, account: "seller", direction: "debit", amount_paise: 94_100, entry_type: "refund_seller" },
  { order_id: order.id, transaction_group: refundGroup, account: "platform_fee", direction: "debit", amount_paise: 10_000, entry_type: "refund_buyer_fee" },
  { order_id: order.id, transaction_group: refundGroup, account: "gst_payable", direction: "debit", amount_paise: 1_800, entry_type: "refund_gst" },
  { order_id: order.id, transaction_group: refundGroup, account: "provider_settlement", direction: "credit", amount_paise: 105_900, entry_type: "refund_provider" },
];

describe("reconciliation", () => {
  it("accepts balanced payment and full-refund entries", () => {
    expect(reconcileOrder(order, [...payment, ...refund], null).status).toBe("balanced");
  });
  it("flags a missing or unbalanced refund", () => {
    const result = reconcileOrder(order, [...payment, ...refund.slice(0, 3)], null);
    expect(result.status).toBe("attention");
    expect(result.issues.join(" ")).toContain("Unbalanced");
    expect(result.issues.join(" ")).toContain("Missing refund_provider");
  });
  it("requires the provider payout entry after release", () => {
    const paidOrder = { ...order, status: "completed" };
    const result = reconcileOrder(paidOrder, payment, { order_id: order.id, status: "paid", amount_paise: 94_100 });
    expect(result.status).toBe("attention");
    expect(result.issues.join(" ")).toContain("Missing payout_provider");
  });
});
