import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { adminListEvents, adminUpsertEvent } from "@/functions/events.functions";
import { CATEGORIES, formatINR, imageUrl } from "@/lib/event-filters";
import { INDIAN_STATES } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const adminQuery = queryOptions({ queryKey: ["admin", "events"], queryFn: () => adminListEvents() });

export const Route = createFileRoute("/_authenticated/admin/events")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminQuery),
  head: () => ({ meta: [{ title: "Manage events — PassOn admin" }, { name: "description", content: "Create and edit events." }, { property: "og:title", content: "Manage events — PassOn admin" }, { property: "og:description", content: "Create and edit events." }, { name: "robots", content: "noindex" }] }),
  errorComponent: ({ error }) => <p className="text-destructive">{error instanceof Error ? error.message : "Something went wrong"}</p>,
  component: AdminEvents,
});

type AdminData = Awaited<ReturnType<typeof adminListEvents>>;
type Ev = AdminData["events"][number];
type Tier = { name: string; rupees: string };
type Form = {
  id?: string; title: string; category: (typeof CATEGORIES)[number]; venue_id: string; newVenue: { name: string; city: string; state_code: string };
  organizer: string; description: string; date: string; time: string; endDate: string; endTime: string; image_url: string; tiers: Tier[]; is_resellable: boolean; resale_max_percent: string;
};
const NEW = "__new";
const empty = (): Form => ({ title: "", category: "sports", venue_id: "", newVenue: { name: "", city: "", state_code: "MH" }, organizer: "", description: "", date: "", time: "19:30", endDate: "", endTime: "22:30", image_url: "", tiers: [{ name: "General", rupees: "" }], is_resellable: true, resale_max_percent: "" });

function toForm(e: Ev): Form {
  const ist = new Date(new Date(e.starts_at).getTime() + 330 * 60_000).toISOString();
  const endIst = e.ends_at ? new Date(new Date(e.ends_at).getTime() + 330 * 60_000).toISOString() : null;
  const tiers = (Array.isArray(e.face_value_tiers) ? e.face_value_tiers : []) as { name: string; price_paise: number }[];
  return { id: e.id, title: e.title, category: e.category === "other" ? "sports" : e.category, venue_id: e.venue_id, newVenue: { name: "", city: "", state_code: "MH" }, organizer: e.organizer ?? "", description: e.description ?? "",
    date: ist.slice(0, 10), time: ist.slice(11, 16), endDate: endIst?.slice(0, 10) ?? "", endTime: endIst?.slice(11, 16) ?? "22:30", image_url: e.image_url ?? "", tiers: tiers.map((t) => ({ name: t.name, rupees: String(t.price_paise / 100) })),
    is_resellable: e.is_resellable, resale_max_percent: e.resale_max_percent == null ? "" : String(e.resale_max_percent) };
}

function AdminEvents() {
  const { data } = useSuspenseQuery(adminQuery);
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));

  const upload = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) { toast.error("Banner must be under 3 MB"); return; }
    const path = `${crypto.randomUUID()}.${file.name.split(".").pop() ?? "jpg"}`;
    const { error } = await supabase.storage.from("event-banners").upload(path, file, { contentType: file.type });
    if (error) { toast.error("Upload failed"); return; }
    const { data: s } = await supabase.storage.from("event-banners").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (s?.signedUrl) { up({ image_url: s.signedUrl }); toast.success("Banner uploaded"); }
  };

  const save = async () => {
    if (!form) return;
    if (!form.date || !form.time) { toast.error("Set date and time"); return; }
    const tiers = form.tiers.filter((t) => t.name.trim() && Number(t.rupees) > 0).map((t) => ({ name: t.name.trim(), price_paise: Math.round(Number(t.rupees) * 100) }));
    if (!tiers.length) { toast.error("Add at least one face-value tier"); return; }
    setBusy(true);
    try {
      await adminUpsertEvent({ data: {
        ...(form.id ? { id: form.id } : {}), title: form.title, category: form.category,
        ...(form.venue_id && form.venue_id !== NEW ? { venue_id: form.venue_id } : { new_venue: form.newVenue }),
        ...(form.organizer ? { organizer: form.organizer } : {}), ...(form.description ? { description: form.description } : {}),
        starts_at: `${form.date}T${form.time}:00+05:30`, ends_at: form.endDate ? `${form.endDate}T${form.endTime}:00+05:30` : null, ...(form.image_url ? { image_url: form.image_url } : {}),
        face_value_tiers: tiers, is_resellable: form.is_resellable,
        resale_max_percent: form.resale_max_percent === "" ? null : Number(form.resale_max_percent),
      } });
      toast.success("Event saved"); setForm(null);
      qc.invalidateQueries({ queryKey: ["admin", "events"] }); qc.invalidateQueries({ queryKey: ["events"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-3xl font-extrabold">Events</h1><Button onClick={() => setForm(empty())}><Plus className="h-4 w-4" />New event</Button></div>
      <ul className="mt-6 divide-y rounded-2xl border bg-card">
        {data.events.map((e) => (
          <li key={e.id} className="flex items-center gap-4 p-3">
            {e.image_url ? <img src={imageUrl(e.image_url, 120, 68)} alt="" width={96} height={54} loading="lazy" className="h-14 w-24 rounded-lg object-cover" /> : <div className="h-14 w-24 rounded-lg bg-muted" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{e.title}</p>
              <p className="text-sm text-muted-foreground">{new Date(e.starts_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} · {e.venues?.name}, {e.venues?.city}{!e.is_resellable && " · transfer off"}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label={`Edit ${e.title}`} onClick={() => setForm(toForm(e))}><Pencil className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{form?.id ? "Edit event" : "New event"}</SheetTitle></SheetHeader>
          {form && (
            <div className="grid gap-4 p-4">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => up({ title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => up({ category: v as Form["category"] })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Organiser</Label><Input value={form.organizer} onChange={(e) => up({ organizer: e.target.value })} /></div>
              </div>
              <div><Label>Venue</Label>
                <Select value={form.venue_id || NEW} onValueChange={(v) => up({ venue_id: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NEW}>+ Add new venue</SelectItem>{data.venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}, {v.city}</SelectItem>)}</SelectContent></Select></div>
              {(!form.venue_id || form.venue_id === NEW) && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-secondary p-3">
                  <Input placeholder="Venue name" value={form.newVenue.name} onChange={(e) => up({ newVenue: { ...form.newVenue, name: e.target.value } })} />
                  <Input placeholder="City" value={form.newVenue.city} onChange={(e) => up({ newVenue: { ...form.newVenue, city: e.target.value } })} />
                  <Select value={form.newVenue.state_code} onValueChange={(v) => up({ newVenue: { ...form.newVenue, state_code: v } })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INDIAN_STATES.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent></Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => up({ date: e.target.value })} /></div>
                <div><Label>Time (IST)</Label><Input type="time" value={form.time} onChange={(e) => up({ time: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>End date (optional)</Label><Input type="date" value={form.endDate} onChange={(e) => up({ endDate: e.target.value })} /></div>
                <div><Label>End time (IST)</Label><Input type="time" value={form.endTime} onChange={(e) => up({ endTime: e.target.value })} /></div>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">Automatic payout releases 24 hours after this end time if there is no dispute. Without it, only buyer-confirmed entry releases payout.</p>
              <div><Label>Banner</Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <Input className="mt-2" placeholder="…or paste an image URL" value={form.image_url} onChange={(e) => up({ image_url: e.target.value })} />
                {form.image_url && <img src={imageUrl(form.image_url, 480, 200)} alt="" className="mt-2 h-28 w-full rounded-lg object-cover" />}
              </div>
              <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => up({ description: e.target.value })} /></div>
              <div>
                <Label>Face-value tiers (₹)</Label>
                <div className="mt-2 space-y-2">
                  {form.tiers.map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <Input placeholder="Tier name" value={t.name} onChange={(e) => up({ tiers: form.tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                      <Input placeholder="₹" inputMode="decimal" className="w-32" value={t.rupees} onChange={(e) => up({ tiers: form.tiers.map((x, j) => (j === i ? { ...x, rupees: e.target.value } : x)) })} />
                      <Button variant="ghost" size="icon" aria-label="Remove tier" onClick={() => up({ tiers: form.tiers.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => up({ tiers: [...form.tiers, { name: "", rupees: "" }] })}><Plus className="h-4 w-4" />Add tier</Button>
                </div>
                {form.tiers.some((t) => Number(t.rupees) > 0) && <p className="mt-1 text-xs text-muted-foreground">Lowest: {formatINR(Math.min(...form.tiers.filter((t) => Number(t.rupees) > 0).map((t) => Number(t.rupees) * 100)))}</p>}
              </div>
              <label className="flex items-center justify-between rounded-xl border p-3"><span><span className="font-medium">Transfer allowed</span><br /><span className="text-xs text-muted-foreground">Off = organiser blocks resale; listing is disabled.</span></span>
                <Switch checked={form.is_resellable} onCheckedChange={(v) => up({ is_resellable: v })} /></label>
              <div><Label>Resale max % of face value (optional override)</Label>
                <Input inputMode="numeric" placeholder="Default (state/global rules, usually 100)" value={form.resale_max_percent} onChange={(e) => up({ resale_max_percent: e.target.value.replace(/\D/g, "") })} /></div>
              <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save event"}</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
