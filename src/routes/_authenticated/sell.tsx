import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Circle, FileUp, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { hasValidPayout } from "@/lib/validation";
import { formatINR } from "@/lib/event-filters";
import { FairHint } from "@/components/listings/FairHint";
import { TurnstileField } from "@/components/security/TurnstileField";
import { trackMarketplaceEvent } from "@/lib/observability";
import { createListing, getSellEvent, listSellableEvents, quoteListing, verifyListing } from "@/functions/listings.functions";

export const Route = createFileRoute("/_authenticated/sell")({
  head: () => ({ meta: [
    { title: "Sell a ticket — PassOn" },
    { name: "description", content: "List your movie, match or concert ticket at or below face value. Verified, safe and simple." },
    { property: "og:title", content: "Sell a ticket — PassOn" },
    { property: "og:description", content: "List your ticket at or below face value. Verified, safe and simple." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Sell,
});

function Sell() {
  const { t } = useI18n();
  const { user } = Route.useRouteContext();
  const phoneOk = !!user.phone_confirmed_at;
  const [payoutOk, setPayoutOk] = useState(false);
  const [isSeller, setIsSeller] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("payout_upi_id, payout_bank_account, payout_bank_ifsc").eq("id", user.id).maybeSingle().then(({ data }) => {
      setPayoutOk(hasValidPayout({ upi: data?.payout_upi_id ?? undefined, account: data?.payout_bank_account ?? undefined, ifsc: data?.payout_bank_ifsc ?? undefined }));
    });
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => setIsSeller(!!data?.some((r) => r.role === "seller")));
  }, [user.id]);

  const activate = async () => {
    const { error } = await supabase.rpc("become_seller");
    if (error) { toast.error(error.message); return; }
    setIsSeller(true); toast.success(t("sell.activated"));
  };

  if (isSeller === null) return <div className="mx-auto max-w-lg px-4 py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (isSeller && phoneOk && payoutOk) return <Wizard />;

  const Step = ({ ok, label }: { ok: boolean; label: string }) => (
    <li className="flex items-center gap-3">{ok ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}<span className={ok ? "" : "text-muted-foreground"}>{label}</span></li>
  );
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-3xl font-extrabold">{t("sell.gate")}</h1>
      <ul className="mt-6 space-y-3 rounded-3xl border bg-card p-6">
        <Step ok={phoneOk} label={t("sell.step.phone")} />
        <Step ok={payoutOk} label={t("sell.step.payout")} />
        <Step ok={!!isSeller} label={t("sell.step.activate")} />
      </ul>
      <div className="mt-6 flex gap-3">
        {(!phoneOk || !payoutOk) && <Button asChild><Link to="/settings">{t("sell.goSettings")}</Link></Button>}
        {phoneOk && payoutOk && !isSeller && <Button onClick={activate}>{t("sell.step.activate")}</Button>}
      </div>
    </div>
  );
}

type Ev = Awaited<ReturnType<typeof listSellableEvents>>[number];
type Quote = Awaited<ReturnType<typeof quoteListing>>;
const toPaise = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0; };

function Wizard() {
  const { t } = useI18n();
  const { user } = Route.useRouteContext();
  const listFn = useServerFn(listSellableEvents);
  const eventFn = useServerFn(getSellEvent);
  const quoteFn = useServerFn(quoteListing);
  const createFn = useServerFn(createListing);
  const verifyFn = useServerFn(verifyListing);

  const [step, setStep] = useState(1);
  const [q, setQ] = useState("");
  const [events, setEvents] = useState<Ev[]>([]);
  const [event, setEvent] = useState<Awaited<ReturnType<typeof getSellEvent>>>(null);
  const [section, setSection] = useState("");
  const [seat, setSeat] = useState("");
  const [qty, setQty] = useState(1);
  const [file, setFile] = useState<{ path: string; mime: "application/pdf" | "image/png" | "image/jpeg" | "image/webp"; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [face, setFace] = useState("");
  const [price, setPrice] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [warranty, setWarranty] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const turnstileConfigured = !!import.meta.env["VITE_TURNSTILE_SITE_KEY"];
  const [submitting, setSubmitting] = useState(false);
  const [rejected, setRejected] = useState<{ message: string }[] | null>(null);
  const [result, setResult] = useState<{ decision: string; score: number | null; reason: string | null } | null>(null);

  useEffect(() => {
    const h = setTimeout(() => { listFn({ data: { q: q || undefined } }).then(setEvents).catch(() => setEvents([])); }, 250);
    return () => clearTimeout(h);
  }, [q, listFn]);

  const facePaise = toPaise(face), pricePaise = toPaise(price);
  useEffect(() => {
    if (!event || !facePaise || !pricePaise) { setQuote(null); return; }
    const h = setTimeout(() => {
      quoteFn({ data: { event_id: event.id, section: section || undefined, quantity: qty, face_value_paise: facePaise, price_paise: pricePaise } }).then(setQuote).catch(() => setQuote(null));
    }, 350);
    return () => clearTimeout(h);
  }, [event, section, qty, facePaise, pricePaise, quoteFn]);

  const pickEvent = async (e: Ev) => {
    if (!e.is_resellable) return;
    const full = await eventFn({ data: { id: e.id } });
    setEvent(full); setSection(""); setStep(2);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
    const mime = allowed.find((m) => m === f.type);
    if (!mime) { toast.error(t("sell.upload.type")); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error(t("sell.upload.size")); return; }
    setUploading(true);
    const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1];
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("ticket-proofs").upload(path, f, { contentType: mime, upsert: false });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setFile({ path, mime, name: f.name });
  };

  const submit = async () => {
    if (!event || !file) return;
    setSubmitting(true); setRejected(null);
    try {
      const res = await createFn({ data: { event_id: event.id, section: section || undefined, seat_info: seat || undefined, quantity: qty, face_value_paise: facePaise, price_paise: pricePaise, file_path: file.path, file_mime: file.mime, warranty: true, invite_code: inviteCode || undefined, turnstile_token: turnstileToken } });
      if (!res.ok) { setRejected(res.reasons); return; }
      trackMarketplaceEvent("listing_created", { listing_id: res.id, event_id: event.id, quantity: qty });
      setStep(5);
      const v = await verifyFn({ data: { id: res.id } });
      setResult({ decision: v.decision, score: v.score, reason: v.reason });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally { setSubmitting(false); }
  };

  const steps = [t("sell.s1"), t("sell.s2"), t("sell.s3"), t("sell.s4")];
  const canNext2 = qty >= 1 && qty <= 10;
  const blocked = quote && !quote.ok;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="flex items-center justify-between gap-3"><h1 className="text-3xl font-extrabold">{t("sell.title")}</h1><Link to="/my-listings" className="text-sm font-semibold text-primary">{t("sell.myListings")}</Link></div>
      {step <= 4 && (
        <ol className="mt-4 flex gap-2 text-xs font-semibold">
          {steps.map((s, i) => <li key={s} className={`flex-1 rounded-full px-2 py-1 text-center ${i + 1 <= step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}. {s}</li>)}
        </ol>
      )}

      {step === 1 && (
        <section className="mt-6 space-y-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("sell.searchEvent")} aria-label={t("sell.searchEvent")} />
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => pickEvent(e)} disabled={!e.is_resellable} className="w-full rounded-2xl border bg-card p-4 text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60">
                  <div className="font-bold">{e.title}</div>
                  <div className="text-sm text-muted-foreground">{e.venue_name}, {e.city} · {new Date(e.starts_at!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</div>
                  {!e.is_resellable && <div className="mt-1 text-xs font-semibold text-destructive">{t("sell.notResellable")}</div>}
                </button>
              </li>
            ))}
            {!events.length && <li className="text-sm text-muted-foreground">{t("sell.noEvents")}</li>}
          </ul>
        </section>
      )}

      {step === 2 && event && (
        <section className="mt-6 space-y-4 rounded-3xl border bg-card p-5">
          <p className="font-bold">{event.title}</p>
          <div className="space-y-1.5">
            <Label htmlFor="section">{t("sell.section")}</Label>
            {event.face_value_tiers.length > 0 ? (
              <select id="section" value={section} onChange={(e) => setSection(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3">
                <option value="">—</option>
                {event.face_value_tiers.map((tier) => <option key={tier.name} value={tier.name}>{tier.name} ({formatINR(tier.price_paise)})</option>)}
              </select>
            ) : <Input id="section" value={section} onChange={(e) => setSection(e.target.value)} maxLength={80} />}
          </div>
          <div className="space-y-1.5"><Label htmlFor="seat">{t("sell.seat")}</Label><Input id="seat" value={seat} onChange={(e) => setSeat(e.target.value)} maxLength={120} placeholder="Row F, Seats 11–12" /></div>
          <div className="space-y-1.5"><Label htmlFor="qty">{t("sell.qty")}</Label><Input id="qty" type="number" min={1} max={10} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} /></div>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(1)}>{t("sell.back")}</Button><Button disabled={!canNext2} onClick={() => { const tier = event.face_value_tiers.find((x) => x.name === section); if (tier && !face) setFace(String(tier.price_paise / 100)); setStep(3); }}>{t("sell.next")}</Button></div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-6 space-y-4 rounded-3xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{t("sell.upload.help")}</p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center hover:border-primary">
            {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <FileUp className="h-8 w-8 text-primary" />}
            <span className="font-semibold">{file ? file.name : t("sell.upload.cta")}</span>
            <span className="text-xs text-muted-foreground">PDF, PNG, JPG, WebP · max 5 MB</span>
            <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> {t("sell.upload.private")}</p>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(2)}>{t("sell.back")}</Button><Button disabled={!file || uploading} onClick={() => setStep(4)}>{t("sell.next")}</Button></div>
        </section>
      )}

      {step === 4 && event && (
        <section className="mt-6 space-y-4 rounded-3xl border bg-card p-5">
          <div className="space-y-1.5"><Label htmlFor="face">{t("sell.face")}</Label><Input id="face" inputMode="decimal" value={face} onChange={(e) => setFace(e.target.value.replace(/[^\d.]/g, ""))} placeholder="₹" /></div>
          <div className="space-y-1.5">
            <Label htmlFor="price">{t("sell.price")}</Label>
            <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="₹" />
            {quote?.capPaise != null && <p className="text-xs text-muted-foreground">{t("sell.maxAllowed")}: <b>{formatINR(quote.capPaise)}</b></p>}
          </div>
          {quote && <FairHint quote={quote} />}
          {(blocked || rejected) && (
            <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-bold text-destructive">{t("sell.cantList")}</p>
              <ul className="mt-1 list-disc pl-5">{(rejected ?? quote?.reasons ?? []).map((r) => <li key={r.message}>{r.message}</li>)}</ul>
            </div>
          )}
          <div><Label htmlFor="invite-code">{t("launch.invite")}</Label><Input id="invite-code" autoComplete="off" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="PASSON-BETA-2026" /><p className="mt-1 text-xs text-muted-foreground">{t("launch.inviteHelp")}</p></div>
          <TurnstileField action="listing" onToken={setTurnstileToken} />
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={warranty} onCheckedChange={(v) => setWarranty(v === true)} className="mt-0.5" /><span>{t("sell.warranty")}</span></label>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(3)}>{t("sell.back")}</Button>
            <Button disabled={!warranty || !facePaise || !pricePaise || !!blocked || submitting || (turnstileConfigured && !turnstileToken)} onClick={submit}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("sell.submit")}</Button></div>
        </section>
      )}

      {step === 5 && (
        <section className="mt-8 rounded-3xl border bg-card p-6 text-center">
          {!result ? (<><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /><p className="mt-3 font-bold">{t("sell.verifying")}</p><p className="text-sm text-muted-foreground">{t("sell.verifying.d")}</p></>) : (
            <>
              {result.decision === "approved" && <><CheckCircle2 className="mx-auto h-10 w-10 text-success" /><p className="mt-3 text-xl font-bold">{t("sell.live")}</p></>}
              {result.decision === "review" && <><ShieldCheck className="mx-auto h-10 w-10 text-primary" /><p className="mt-3 text-xl font-bold">{t("sell.review")}</p><p className="text-sm text-muted-foreground">{t("sell.review.d")}</p></>}
              {result.decision === "rejected" && <><AlertTriangle className="mx-auto h-10 w-10 text-destructive" /><p className="mt-3 text-xl font-bold">{t("sell.rejected")}</p><p className="text-sm text-muted-foreground">{result.reason}</p></>}
              {result.score != null && <p className="mt-2 text-xs text-muted-foreground">{t("sell.trust")}: {result.score}/100</p>}
              <Button asChild className="mt-5"><Link to="/my-listings">{t("sell.myListings")}</Link></Button>
            </>
          )}
        </section>
      )}
    </div>
  );
}

