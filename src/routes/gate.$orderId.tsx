import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { readGatePass, type GatePass } from "@/lib/gate-pass";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/gate/$orderId")({
  head: () => ({ meta: [{ title: "Offline gate pass — PassOn" },{ name: "description", content: "Your prepared on-device PassOn ticket for event entry." },{ property: "og:title", content: "Offline gate pass — PassOn" },{ property: "og:description", content: "On-device ticket gate view." },{ property: "og:type", content: "website" },{ name: "twitter:card", content: "summary" },{ name: "robots", content: "noindex,noarchive" }] }),
  component: GatePage,
});
function GatePage() {
  const { orderId } = Route.useParams(); const [pass,setPass] = useState<GatePass | null>(null); const [url,setUrl] = useState(""); const [loading,setLoading] = useState(true);
  useEffect(() => { let active = true; void readGatePass(orderId).then(value => { if (!active) return; setPass(value); if (value) setUrl(URL.createObjectURL(value.ticket)); setLoading(false); }).catch(() => setLoading(false)); return () => { active = false; if (url) URL.revokeObjectURL(url); }; }, [orderId]);
  if (loading) return <main className="grid min-h-screen place-items-center bg-ink text-ink-foreground">Preparing your offline pass…</main>;
  if (!pass) return <main className="grid min-h-screen place-items-center bg-ink p-6 text-center text-ink-foreground"><div><WifiOff className="mx-auto h-10 w-10" /><h1 className="mt-4 text-2xl font-bold">Pass not prepared on this device</h1><p className="mt-2 opacity-80">Open your paid order online and choose “Prepare offline gate pass” first.</p><Button asChild variant="secondary" className="mt-5"><Link to="/orders">My orders</Link></Button></div></main>;
  return <main className="min-h-screen bg-ink px-4 py-5 text-ink-foreground"><div className="mx-auto max-w-lg"><div className="rounded-[2rem] bg-card p-6 text-card-foreground shadow-2xl"><p className="text-xs font-bold uppercase tracking-widest text-primary">PassOn · Offline gate pass</p><h1 className="mt-3 text-3xl font-extrabold">{pass.eventTitle}</h1><p className="mt-2 text-muted-foreground">{pass.section} {pass.seats && `· ${pass.seats}`} · {pass.quantity} ticket{pass.quantity > 1 ? "s" : ""}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(pass.startsAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"full",timeStyle:"short"})} IST</p><div className="mt-5 overflow-hidden rounded-2xl border bg-white p-3">{pass.mime === "application/pdf" ? <iframe src={url} title="Ticket PDF" className="h-[65vh] w-full" /> : <img src={url} alt="Your paid ticket" className="mx-auto max-h-[65vh] w-full object-contain" />}</div><p className="mt-4 text-center font-mono text-sm">#{pass.orderId.slice(0,8).toUpperCase()}</p></div><p className="mt-4 text-center text-sm opacity-80">Saved on this device {new Date(pass.savedAt).toLocaleString("en-IN")}. Turn up your screen brightness at the gate.</p></div></main>;
}
