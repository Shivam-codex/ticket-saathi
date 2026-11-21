import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { createGrievance, myGrievances } from "@/functions/trust.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/support")({
  loader: () => myGrievances(),
  head: () => ({ meta: [{ title: "Support & grievances — PassOn" },{ name: "description", content: "Contact PassOn support and track Grievance Officer tickets and deadlines." },{ property: "og:title", content: "Support & grievances — PassOn" },{ property: "og:description", content: "PassOn support and grievance tracking." },{ property: "og:type", content: "website" },{ name: "twitter:card", content: "summary" },{ name: "robots", content: "noindex" }] }),
  component: SupportPage,
});
function SupportPage() {
  const rows = Route.useLoaderData(); const router = useRouter(); const create = useServerFn(createGrievance); const [subject,setSubject] = useState(""); const [details,setDetails] = useState(""); const [busy,setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { await create({data:{subject,details}}); setSubject(""); setDetails(""); toast.success("Grievance submitted. We aim to respond within 72 hours."); await router.invalidate(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit"); } finally { setBusy(false); } };
  return <div className="mx-auto max-w-4xl px-4 py-8"><h1 className="flex items-center gap-2 text-3xl font-extrabold"><LifeBuoy className="h-7 w-7 text-primary" />Support & grievances</h1><p className="mt-2 text-muted-foreground">For ticket problems, open the order first. Use this form for account, policy or unresolved support concerns. The Grievance Officer response target is 72 hours.</p><div className="mt-6 grid gap-6 md:grid-cols-2"><form onSubmit={submit} className="rounded-3xl border bg-card p-5"><h2 className="font-bold">New grievance</h2><div className="mt-4"><Label htmlFor="subject">Subject</Label><Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} minLength={3} maxLength={160} required /></div><div className="mt-4"><Label htmlFor="details">What happened?</Label><Textarea id="details" value={details} onChange={e => setDetails(e.target.value)} minLength={10} maxLength={4000} required /></div><Button className="mt-4" disabled={busy}>Submit grievance</Button></form><div><h2 className="font-bold">Your tickets</h2><div className="mt-4 space-y-3">{rows.map(row => <article key={row.id} className="rounded-2xl border bg-card p-4"><div className="flex justify-between gap-3"><h3 className="font-semibold">{row.subject}</h3><span className="text-xs font-semibold">{row.status.replaceAll("_"," ")}</span></div><p className="mt-2 text-xs text-muted-foreground">Response due {new Date(row.due_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</p>{row.resolution_note && <p className="mt-2 rounded-xl bg-secondary p-3 text-sm">{row.resolution_note}</p>}</article>)}{!rows.length && <p className="text-sm text-muted-foreground">No grievance tickets.</p>}</div></div></div></div>;
}
