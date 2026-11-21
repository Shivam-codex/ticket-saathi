import { Badge } from "@/components/ui/badge";
import { useI18n, type TKey } from "@/lib/i18n";
import type { OrderStatus } from "@/lib/order-state";

export function OrderStatusBadge({ status }: { status: OrderStatus | "delivered" }) {
  const { t } = useI18n();
  const variant = ["paid", "ticket_delivered", "completed"].includes(status) ? "default" : ["cancelled", "refunded", "disputed"].includes(status) ? "destructive" : "secondary";
  return <Badge variant={variant}>{t(`order.status.${status}` as TKey)}</Badge>;
}
