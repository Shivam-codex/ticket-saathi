export const ORDER_STATUSES = ["pending", "payment_pending", "paid", "ticket_delivered", "completed", "disputed", "refunded", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["payment_pending", "cancelled"],
  payment_pending: ["paid", "cancelled"],
  paid: ["ticket_delivered", "disputed", "refunded"],
  ticket_delivered: ["completed", "disputed", "refunded"],
  completed: [],
  disputed: ["refunded", "completed"],
  refunded: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || transitions[from].includes(to);
}
