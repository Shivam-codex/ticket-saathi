import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { reportOrderProblem } from "@/functions/orders.functions";
import { getOrderDispute, respondToDispute, uploadDisputeEvidence } from "@/functions/trust.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { trackMarketplaceEvent } from "@/lib/observability";

export function DisputePanel({ orderId, userId, isBuyer, canRaise, canRespond }: { orderId: string; userId: string; isBuyer: boolean; canRaise: boolean; canRespond: boolean }) {
  const { t } = useI18n();
  const getDispute = useServerFn(getOrderDispute);
  const createDispute = useServerFn(reportOrderProblem);
  const attachEvidence = useServerFn(uploadDisputeEvidence);
  const respond = useServerFn(respondToDispute);
  const [dispute, setDispute] = useState<Awaited<ReturnType<typeof getOrderDispute>>>(null);
  const [reason, setReason] = useState("");
  const [response, setResponse] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setDispute(await getDispute({ data: { order_id: orderId } })), [getDispute, orderId]);
  useEffect(() => { void load().catch(() => undefined); }, [load]);
  const submit = async () => {
    setBusy(true);
    try {
      const created = await createDispute({ data: { order_id: orderId, category: "invalid_ticket", reason } });
      trackMarketplaceEvent("dispute_opened", { order_id: orderId, dispute_id: created.disputeId, category: "invalid_ticket" });
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error(t("dispute.fileSize"));
        const mime = ["application/pdf","image/png","image/jpeg","image/webp"].includes(file.type) ? file.type as "application/pdf" | "image/png" | "image/jpeg" | "image/webp" : null;
        if (!mime) throw new Error(t("dispute.fileType"));
        const path = `${created.disputeId}/${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9._-]/gi,"_")}`;
        const uploaded = await supabase.storage.from("dispute-evidence").upload(path, file, { contentType: mime });
        if (uploaded.error) throw new Error(t("dispute.uploadFailed"));
        await attachEvidence({ data: { dispute_id: created.disputeId, file_path: path, file_mime: mime } });
      }
      toast.success(t("dispute.saved")); setReason(""); setFile(null); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : t("dispute.uploadFailed")); }
    finally { setBusy(false); }
  };
  const saveResponse = async () => {
    if (!dispute) return;
    setBusy(true);
    try { await respond({ data: { dispute_id: dispute.id, response } }); toast.success(t("dispute.responseSaved")); setResponse(""); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : t("dispute.uploadFailed")); }
    finally { setBusy(false); }
  };
  if (!dispute && !canRaise) return null;
  return <section className="rounded-3xl border bg-card p-6"><h2 className="flex items-center gap-2 text-xl font-bold"><ShieldAlert className="h-5 w-5 text-primary" />{t("dispute.title")}</h2>
    {!dispute && canRaise && <div className="mt-4 space-y-3"><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={t("dispute.placeholder")} maxLength={2000} /><div><Label htmlFor="evidence" className="flex items-center gap-2"><Paperclip className="h-4 w-4" />{t("dispute.evidence")}</Label><input id="evidence" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="mt-2 text-sm" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div><p className="text-xs text-muted-foreground">{t("dispute.window")}</p><Button disabled={busy || reason.trim().length < 5} variant="destructive" onClick={submit}>{t("dispute.submit")}</Button></div>}
    {dispute && <div className="mt-4 space-y-4 text-sm"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-secondary px-3 py-1 font-semibold">{dispute.status.replaceAll("_"," ")}</span><span className="text-muted-foreground">{dispute.category.replaceAll("_"," ")}</span></div><p>{dispute.reason}</p>{dispute.evidence_deadline_at && <p className="text-xs text-muted-foreground">{t("dispute.evidenceUntil")}: {new Date(dispute.evidence_deadline_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</p>}{dispute.evidence.length > 0 && <div className="flex flex-wrap gap-2">{dispute.evidence.map((item,index) => <a key={item.path} href={item.url} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-2 text-primary underline">{t("dispute.evidence")} {index+1}</a>)}</div>}{dispute.seller_response && <div className="rounded-2xl bg-secondary p-4"><b>{t("dispute.sellerResponse")}</b><p className="mt-1">{dispute.seller_response}</p></div>}{dispute.resolution_note && <div className="rounded-2xl border p-4"><b>{t("dispute.decision")}</b><p className="mt-1">{dispute.resolution_note}</p></div>}{canRespond && ["open","reviewing"].includes(dispute.status) && <div><Label htmlFor="seller-response">{t("dispute.respond")}</Label><Textarea id="seller-response" value={response} onChange={e => setResponse(e.target.value)} maxLength={3000} /><Button className="mt-3" disabled={busy || response.trim().length < 5} onClick={saveResponse}>{t("dispute.respondSubmit")}</Button></div>}</div>}
  </section>;
}
