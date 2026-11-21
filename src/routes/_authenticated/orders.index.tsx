import { createFileRoute, Link } from "@tanstack/react-router";
import { myOrders } from "@/functions/orders.functions";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/event-filters";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/orders/")({
  loader: () => myOrders(),
  head: () => ({ meta: [{ title: "My orders — PassOn" }, { name: "description", content: "Track your PassOn ticket purchases, sales, payments and delivery." }, { property: "og:title", content: "My orders — PassOn" }, { property: "og:description", content: "Track ticket orders and delivery." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const rows = Route.useLoaderData();
  const { t } = useI18n();
  const { user } = Route.useRouteContext();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">{t("orders.title")}</h1>
      <ul className="mt-6 space-y-3">
        {rows.map((order) => {
          const buying = order.buyer_id === user?.id;
          return <li key={order.id}><Link to="/orders/$orderId" params={{ orderId: order.id }} className="block rounded-3xl border bg-card p-5 transition-colors hover:border-primary">
            <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{order.listings?.events?.title}</p><p className="text-sm text-muted-foreground">{[order.listings?.section, order.listings?.seat_info].filter(Boolean).join(" · ")} · ×{order.quantity}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</p></div><OrderStatusBadge status={order.status} /></div>
            <div className="mt-3 flex justify-between text-sm"><span>{buying ? t("orders.purchase") : t("orders.sale")}</span><b>{formatINR(Number(buying ? order.total_paise : order.seller_net_paise))}</b></div>
          </Link></li>;
        })}
        {!rows.length && <li className="rounded-3xl border border-dashed p-8 text-center"><p className="text-muted-foreground">{t("orders.empty")}</p><Button asChild className="mt-4"><Link to="/events">{t("hero.cta.buy")}</Link></Button></li>}
      </ul>
    </div>
  );
}
