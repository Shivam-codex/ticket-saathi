import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { hasValidPayout } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/sell")({
  head: () => ({ meta: [{ title: "Sell a ticket — PassOn" }, { name: "description", content: "Resell your ticket at or below face value." }, { property: "og:title", content: "Sell a ticket — PassOn" }, { property: "og:description", content: "Resell your ticket at or below face value." }] }),
  component: Sell,
});

function Sell() {
  const { t } = useI18n();
  const { user } = Route.useRouteContext();
  const phoneOk = !!user.phone_confirmed_at;
  const [payoutOk, setPayoutOk] = useState(false);
  const [isSeller, setIsSeller] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("payout_upi_id, payout_bank_account, payout_bank_ifsc").eq("id", user.id).maybeSingle().then(({ data }) => {
      setPayoutOk(hasValidPayout({ upi: data?.payout_upi_id ?? undefined, account: data?.payout_bank_account ?? undefined, ifsc: data?.payout_bank_ifsc ?? undefined }));
    });
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => setIsSeller(!!data?.some((r) => r.role === "seller")));
  }, [user.id]);

  const activate = async () => {
    const { error } = await supabase.rpc("become_seller");
    if (error) { toast.error(error.message); return; }
    setIsSeller(true); toast.success("Seller account activated");
  };

  const Step = ({ ok, label }: { ok: boolean; label: string }) => (
    <li className="flex items-center gap-3">{ok ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}<span className={ok ? "" : "text-muted-foreground"}>{label}</span></li>
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-3xl font-extrabold">{isSeller ? t("sell.ready") : t("sell.gate")}</h1>
      <ul className="mt-6 space-y-3 rounded-3xl border bg-card p-6">
        <Step ok={phoneOk} label="Verify your mobile number" />
        <Step ok={payoutOk} label="Add a UPI ID or bank account for payouts" />
        <Step ok={isSeller} label="Activate your seller account" />
      </ul>
      <div className="mt-6 flex gap-3">
        {(!phoneOk || !payoutOk) && <Button asChild><Link to="/settings">Go to Settings</Link></Button>}
        {phoneOk && payoutOk && !isSeller && <Button onClick={activate}>Activate seller account</Button>}
      </div>
      {isSeller && <p className="mt-6 rounded-2xl bg-secondary p-4 text-sm">Listing tickets arrives in the next phase. By listing, you warrant each ticket is genuine and transferable.</p>}
    </div>
  );
}
