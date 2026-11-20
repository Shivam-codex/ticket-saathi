import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConsentFields } from "@/components/ConsentFields";
import { supabase } from "@/integrations/supabase/client";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { consentsValid, INDIAN_STATES, OPTIONAL_CONSENTS, POLICY_VERSION, REQUIRED_CONSENTS, type ConsentPurpose } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Complete your profile — PassOn" }, { name: "description", content: "Finish setting up your PassOn account." }, { property: "og:title", content: "Complete your profile — PassOn" }, { property: "og:description", content: "Finish setting up your PassOn account." }] }),
  component: Onboarding,
});

function Onboarding() {
  const { t, lang, setLang } = useI18n();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [name, setName] = useState((user.user_metadata?.["full_name"] as string | undefined) ?? "");
  const [state, setState] = useState("");
  const [pref, setPref] = useState<Lang>(lang);
  const [consents, setConsents] = useState<Partial<Record<ConsentPurpose, boolean>>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) { toast.error("Enter your full name"); return; }
    if (!state) { toast.error("Select your state"); return; }
    if (!consentsValid(consents)) { toast.error("Please accept the two required consents to continue"); return; }
    setBusy(true);
    const rows = [...REQUIRED_CONSENTS, ...OPTIONAL_CONSENTS].map((purpose) => ({
      user_id: user.id, purpose, granted: !!consents[purpose], policy_version: POLICY_VERSION, user_agent: navigator.userAgent.slice(0, 300),
    }));
    const c = await supabase.from("consents").insert(rows);
    const p = c.error ? c : await supabase.from("profiles").update({ full_name: name.trim(), state_code: state, preferred_lang: pref, profile_completed: true }).eq("id", user.id);
    setBusy(false);
    if (p.error) { toast.error("Could not save. Please try again."); return; }
    setLang(pref);
    toast.success("Welcome to PassOn!");
    navigate({ to: "/settings" });
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-3xl font-extrabold">{t("onb.title")}</h1>
      <div className="mt-6 space-y-5 rounded-3xl border bg-card p-6">
        <div className="space-y-2"><Label htmlFor="name">{t("onb.name")}</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2">
          <Label>{t("onb.state")}</Label>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
            <SelectContent>{INDIAN_STATES.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Resale rules differ by state, so we use this to apply the right price limits.</p>
        </div>
        <div className="space-y-2">
          <Label>{t("onb.lang")}</Label>
          <Select value={pref} onValueChange={(v) => setPref(v as Lang)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("onb.consent")}</Label>
          <ConsentFields value={consents} onChange={(p, v) => setConsents((c) => ({ ...c, [p]: v }))} />
          <p className="text-xs text-muted-foreground">You can change optional choices any time in Settings.</p>
        </div>
        <Button className="h-11 w-full" disabled={busy} onClick={save}>{t("onb.save")}</Button>
      </div>
    </div>
  );
}
