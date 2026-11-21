import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { WalletCards } from "lucide-react";
import { toast } from "sonner";
import { saveGatePass } from "@/lib/gate-pass";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function GatePassActions({ order, ticket }: { order: { id: string; quantity: number; listings?: { section: string | null; seat_info: string | null; events?: { title: string; starts_at: string } | null } | null }; ticket: { url: string; mime: string } }) {
  const { t } = useI18n(); const navigate = useNavigate(); const [busy,setBusy] = useState(false);
  const prepare = async () => {
    setBusy(true);
    try {
      const response = await fetch(ticket.url); if (!response.ok) throw new Error("ticket");
      const event = order.listings?.events;
      await saveGatePass({ orderId: order.id, eventTitle: event?.title ?? "PassOn", section: order.listings?.section ?? "", seats: order.listings?.seat_info ?? "", startsAt: event?.starts_at ?? "", quantity: order.quantity, mime: ticket.mime, ticket: await response.blob(), savedAt: new Date().toISOString() });
      await navigate({ to: "/gate/$orderId", params: { orderId: order.id } });
    } catch { toast.error(t("gate.prepareFailed")); }
    finally { setBusy(false); }
  };
  return <Button variant="outline" className="mt-3 w-full" disabled={busy} onClick={prepare}><WalletCards className="h-4 w-4" />{busy ? t("gate.preparing") : t("gate.prepare")}</Button>;
}
