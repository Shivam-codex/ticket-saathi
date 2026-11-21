import { Link } from "@tanstack/react-router";
import { Home, PlusCircle, ReceiptText, Search, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BottomNav() {
  const { t } = useI18n();
  const items = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/events", icon: Search, label: t("nav.search") },
    { to: "/sell", icon: PlusCircle, label: t("nav.sell") },
    { to: "/orders", icon: ReceiptText, label: t("nav.orders") },
    { to: "/settings", icon: User, label: t("nav.account") },
  ] as const;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map(({ to, icon: Icon, label }) => (
          <li key={to}>
            <Link to={to} activeOptions={{ exact: to === "/" }} className="flex flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground [&.active]:text-primary [&.active]:font-semibold">
              <Icon className="h-5 w-5" aria-hidden />{label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
