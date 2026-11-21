export type ReconciliationOrder = {
  id: string;
  status: string;
  total_paise: number;
  seller_net_paise: number;
  tcs_paise: number;
  tds_paise: number;
};
export type ReconciliationEntry = { order_id: string | null; transaction_group: string; account: string; direction: string; amount_paise: number; entry_type: string };
export type ReconciliationPayout = { order_id: string | null; status: string; amount_paise: number };

export function reconcileOrder(order: ReconciliationOrder, entries: ReconciliationEntry[], payout: ReconciliationPayout | null) {
  const issues: string[] = [];
  const groups = new Map<string, { debits: bigint; credits: bigint }>();
  for (const entry of entries) {
    const group = groups.get(entry.transaction_group) ?? { debits: 0n, credits: 0n };
    if (entry.direction === "debit") group.debits += BigInt(entry.amount_paise);
    else group.credits += BigInt(entry.amount_paise);
    groups.set(entry.transaction_group, group);
  }
  for (const [group, totals] of groups) {
    if (totals.debits !== totals.credits) issues.push(`Unbalanced transaction group ${group.slice(0, 8)}`);
  }
  const requires = (type: string, account: string, direction: string, amount: number) => {
    if (!entries.some((e) => e.entry_type === type && e.account === account && e.direction === direction && e.amount_paise === amount)) {
      issues.push(`Missing ${type} entry for ${amount} paise`);
    }
  };
  if (["paid", "ticket_delivered", "completed", "disputed", "refunded"].includes(order.status)) {
    requires("payment_provider", "provider_settlement", "debit", order.total_paise);
  }
  if (order.status === "refunded") requires("refund_provider", "provider_settlement", "credit", order.total_paise);
  if (payout?.status === "paid") requires("payout_provider", "provider_settlement", "credit", payout.amount_paise);
  if (!groups.size && ["paid", "ticket_delivered", "completed", "disputed", "refunded"].includes(order.status)) issues.push("No payment ledger entries");
  return { orderId: order.id, status: issues.length ? "attention" as const : "balanced" as const, issues, expectedPayoutPaise: order.seller_net_paise - order.tcs_paise - order.tds_paise, actualPayoutPaise: payout?.status === "paid" ? payout.amount_paise : 0 };
}
