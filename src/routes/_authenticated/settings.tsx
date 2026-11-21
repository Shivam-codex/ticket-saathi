import type React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ConsentFields } from "@/components/ConsentFields";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { bankAccountSchema, ifscSchema, normaliseIndianPhone, OPTIONAL_CONSENTS, POLICY_VERSION, upiSchema, type ConsentPurpose } from "@/lib/validation";
import { deleteMyAccount, exportMyData } from "@/functions/privacy.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — PassOn" }, { name: "description", content: "Manage your PassOn profile, payouts and privacy." }, { property: "og:title", content: "Settings — PassOn" }, { property: "og:description", content: "Manage your PassOn profile, payouts and privacy." }] }),
  component: Settings,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border bg-card p-6"><h2 className="mb-4 text-xl font-bold">{title}</h2>{children}</section>;
}

function Settings() {
  const { t } = useI18n();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phoneVerified, setPhoneVerified] = useState(!!user.phone_confirmed_at);
  const [phone, setPhone] = useState("");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [upi, setUpi] = useState("");
  const [paymentUpi, setPaymentUpi] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [holder, setHolder] = useState("");
  const [consents, setConsents] = useState<Partial<Record<ConsentPurpose, boolean>>>({});

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setName(data.full_name ?? ""); setUpi(data.payout_upi_id ?? ""); setAccount(data.payout_bank_account ?? "");
      setPaymentUpi(data.saved_upi_id ?? "");
      setIfsc(data.payout_bank_ifsc ?? ""); setHolder(data.payout_account_holder ?? "");
    });
    supabase.from("consents").select("purpose, granted, created_at").eq("user_id", user.id).order("created_at", { ascending: true }).then(({ data }) => {
      const latest: Partial<Record<ConsentPurpose, boolean>> = {};
      (data ?? []).forEach((r) => { latest[r.purpose as ConsentPurpose] = r.granted; });
      setConsents(latest);
    });
  }, [user.id]);

  const saveName = async () => {
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
    error ? toast.error("Could not save") : toast.success("Saved");
  };

  const sendPhoneOtp = async () => {
    const e164 = normaliseIndianPhone(phone);
    if (!e164) { toast.error("Enter a valid 10-digit Indian mobile number"); return; }
    const { error } = await supabase.auth.updateUser({ phone: e164 });
    if (error) { toast.error(error.message); return; }
    setPendingPhone(e164); toast.success("OTP sent");
  };
  const verifyPhone = async () => {
    if (!pendingPhone) return;
    const { error } = await supabase.auth.verifyOtp({ phone: pendingPhone, token: otp, type: "phone_change" });
    if (error) { toast.error(error.message); return; }
    setPhoneVerified(true); setPendingPhone(null); toast.success("Phone verified");
  };

  const savePayout = async () => {
    const upiOk = upi ? upiSchema.safeParse(upi) : null;
    if (upiOk && !upiOk.success) { toast.error(upiOk.error.issues[0]?.message ?? "Invalid UPI"); return; }
    if (account || ifsc) {
      const a = bankAccountSchema.safeParse(account); const i = ifscSchema.safeParse(ifsc);
      if (!a.success) { toast.error(a.error.issues[0]?.message ?? "Invalid account"); return; }
      if (!i.success) { toast.error(i.error.issues[0]?.message ?? "Invalid IFSC"); return; }
    }
    if (!upi && !account) { toast.error("Add a UPI ID or bank account"); return; }
    const { error } = await supabase.from("profiles").update({
      payout_upi_id: upi.trim() || null, payout_bank_account: account.trim() || null,
      payout_bank_ifsc: ifsc.trim().toUpperCase() || null, payout_account_holder: holder.trim() || null,
    }).eq("id", user.id);
    error ? toast.error("Could not save") : toast.success("Payout details saved");
  };

  const savePaymentPreference = async () => {
    if (paymentUpi && !upiSchema.safeParse(paymentUpi).success) { toast.error("Enter a valid UPI ID"); return; }
    const { error } = await supabase.from("profiles").update({ saved_upi_id: paymentUpi.trim() || null, preferred_payment_method: "upi" }).eq("id", user.id);
    error ? toast.error("Could not save") : toast.success("Saved");
  };

  const toggleConsent = async (p: ConsentPurpose, v: boolean) => {
    setConsents((c) => ({ ...c, [p]: v }));
    const { error } = await supabase.from("consents").insert({ user_id: user.id, purpose: p, granted: v, policy_version: POLICY_VERSION, user_agent: navigator.userAgent.slice(0, 300) });
    error ? toast.error("Could not update consent") : toast.success(v ? "Consent given" : "Consent withdrawn");
  };

  const download = async () => {
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `passon-my-data-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error("Could not prepare your data"); }
  };

  const signOut = async () => {
    await queryClient.cancelQueries(); queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const del = async () => {
    const res = await deleteMyAccount();
    if (!res.ok) { toast.error(res.reason); return; }
    toast.success("Your account has been deleted");
    await signOut();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
      <div className="flex items-center justify-between"><h1 className="text-3xl font-extrabold">{t("settings.title")}</h1><Button variant="ghost" onClick={signOut}>{t("auth.signout")}</Button></div>

      <Section title={t("settings.profile")}>
        <Label htmlFor="n">{t("onb.name")}</Label>
        <div className="mt-2 flex gap-2"><Input id="n" value={name} onChange={(e) => setName(e.target.value)} /><Button onClick={saveName}>{t("settings.save")}</Button></div>
        {user.email && <p className="mt-3 text-sm text-muted-foreground">Email: {user.email}</p>}
      </Section>

      <Section title={t("settings.phone")}>
        {phoneVerified ? (
          <p className="flex items-center gap-2 text-success"><CheckCircle2 className="h-5 w-5" /> Verified {user.phone ? `+${user.phone}` : ""}</p>
        ) : !pendingPhone ? (
          <div className="flex gap-2"><Input inputMode="numeric" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} /><Button onClick={sendPhoneOtp}>{t("auth.sendOtp")}</Button></div>
        ) : (
          <div className="space-y-3">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}><InputOTPGroup>{[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup></InputOTP>
            <Button onClick={verifyPhone} disabled={otp.length !== 6}>{t("auth.verify")}</Button>
          </div>
        )}
      </Section>

      <Section title={t("settings.payout")}>
        <div className="grid gap-3">
          <div><Label htmlFor="upi">UPI ID</Label><Input id="upi" placeholder="name@okaxis" value={upi} onChange={(e) => setUpi(e.target.value)} /></div>
          <p className="text-center text-xs uppercase text-muted-foreground">or bank account</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="acc">Account number</Label><Input id="acc" inputMode="numeric" value={account} onChange={(e) => setAccount(e.target.value)} /></div>
            <div><Label htmlFor="ifsc">IFSC</Label><Input id="ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value)} /></div>
          </div>
          <div><Label htmlFor="holder">Account holder name</Label><Input id="holder" value={holder} onChange={(e) => setHolder(e.target.value)} /></div>
          <Button onClick={savePayout}>{t("settings.save")}</Button>
        </div>
      </Section>

      <Section title={t("settings.payments")}>
        <Label htmlFor="payment-upi">{t("checkout.savedUpi")}</Label>
        <div className="mt-2 flex gap-2"><Input id="payment-upi" placeholder="name@okaxis" value={paymentUpi} onChange={(e) => setPaymentUpi(e.target.value)} /><Button onClick={savePaymentPreference}>{t("settings.save")}</Button></div>
        <p className="mt-2 text-sm text-muted-foreground">{t("settings.payments.d")}</p>
      </Section>

      <Section title={t("settings.privacy")}>
        <ConsentFields value={consents} onChange={toggleConsent} showRequired={false} />
        <p className="mt-2 text-xs text-muted-foreground">Required consents (terms, transactions) can only be withdrawn by deleting your account. Policy version {POLICY_VERSION}.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="outline" onClick={download}>{t("settings.download")}</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive">{t("settings.delete")}</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your PassOn account?</AlertDialogTitle>
                <AlertDialogDescription>Your profile, listings and consent history are removed permanently. Records of completed orders are kept without your name, as tax law requires. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={del}>Delete permanently</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>
    </div>
  );
}
