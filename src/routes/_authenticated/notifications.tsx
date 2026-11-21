import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Mail, MessageCircle } from "lucide-react";
import { markNotificationRead, myNotifications } from "@/functions/trust.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  loader: () => myNotifications(),
  head: () => ({ meta: [{ title: "Notifications — PassOn" },{ name: "description", content: "Listing, sale, payout, price alert and dispute updates from PassOn." },{ property: "og:title", content: "Notifications — PassOn" },{ property: "og:description", content: "Your PassOn ticket alerts and updates." },{ property: "og:type", content: "website" },{ name: "twitter:card", content: "summary" },{ name: "robots", content: "noindex" }] }),
  component: NotificationsPage,
});
function NotificationsPage() {
  const rows = Route.useLoaderData(); const router = useRouter(); const read = useServerFn(markNotificationRead);
  const open = async (id: string) => { await read({data:{id}}); await router.invalidate(); };
  return <div className="mx-auto max-w-3xl px-4 py-8"><h1 className="flex items-center gap-2 text-3xl font-extrabold"><Bell className="h-7 w-7 text-primary" />Notifications</h1><p className="mt-1 text-sm text-muted-foreground">Free one-tap sharing opens your own WhatsApp or email app.</p><div className="mt-6 space-y-3">{rows.map(n => { const text = `${n.title}\n${n.body ?? ""}\n${n.link ? `${window.location.origin}${n.link}` : ""}`; return <article key={n.id} className={`rounded-2xl border bg-card p-5 ${n.read_at ? "opacity-70" : ""}`}><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{n.title}</h2>{n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}<p className="mt-2 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</p></div>{!n.read_at && <Button variant="ghost" size="sm" onClick={() => open(n.id)}>Mark read</Button>}</div><div className="mt-4 flex flex-wrap gap-2">{n.link && <Button asChild size="sm"><Link to={n.link as "/orders"}>Open</Link></Button>}<Button asChild size="sm" variant="outline"><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a></Button><Button asChild size="sm" variant="outline"><a href={`mailto:?subject=${encodeURIComponent(n.title)}&body=${encodeURIComponent(text)}`}><Mail className="h-4 w-4" />Email</a></Button></div></article>; })}{!rows.length && <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">No notifications yet.</p>}</div></div>;
}
