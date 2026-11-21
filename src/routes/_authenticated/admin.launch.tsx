import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { adminCreateInvite, adminSetInviteActive, adminSetLaunchSettings, adminSetStateListings, getAdminLaunch } from "@/functions/launch.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/launch")({
  loader: () => getAdminLaunch(),
  head: () => ({ meta: [{ title: "Soft launch controls — PassOn admin" }, { name: "description", content: "Manage invites and marketplace launch safety switches." }, { property: "og:title", content: "Soft launch controls — PassOn admin" }, { property: "og:description", content: "Manage invites and launch safety switches." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: LaunchAdmin,
});

function LaunchAdmin() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [enabled, setEnabled] = useState(data.settings?.soft_launch_enabled ?? true);
  const [inviteRequired, setInviteRequired] = useState(data.settings?.invite_required ?? true);
  const [maxUses, setMaxUses] = useState(100);
  const [stateCode, setStateCode] = useState("MH");
  const [busy, setBusy] = useState(false);
  const refresh = async () => { setBusy(false); await router.invalidate(); };
  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); toast.success(message); await refresh(); }
    catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Could not save"); }
  };
  const createInvite = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const result = await adminCreateInvite({ data: { max_uses: maxUses } });
      toast.success(`Invite created: ${result.code}`);
    }, "Invite created");
  };
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-extrabold">Soft launch</h1><p className="mt-1 text-sm text-muted-foreground">Invite-only purchases and listings, with immediate event and state kill switches. Initial invite: <code>PASSON-BETA-2026</code>.</p></div>
    <section className="rounded-3xl border bg-card p-5">
      <h2 className="font-bold">Access mode</h2>
      <label className="mt-4 flex items-center justify-between gap-4"><span>Soft launch enabled</span><Switch checked={enabled} onCheckedChange={setEnabled} /></label>
      <label className="mt-4 flex items-center justify-between gap-4"><span>Require an invite for new buyers and sellers</span><Switch checked={inviteRequired} onCheckedChange={setInviteRequired} /></label>
      <Button className="mt-5" disabled={busy} onClick={() => run(() => adminSetLaunchSettings({ data: { soft_launch_enabled: enabled, invite_required: inviteRequired } }), "Launch settings saved")}>Save access mode</Button>
    </section>
    <section className="rounded-3xl border bg-card p-5">
      <h2 className="font-bold">Invite codes</h2>
      <form onSubmit={createInvite} className="mt-4 flex items-end gap-3"><div><Label htmlFor="max-uses">Maximum uses</Label><Input id="max-uses" type="number" min={1} max={100000} value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))} /></div><Button disabled={busy}>Create invite</Button></form>
      <ul className="mt-5 divide-y text-sm">{data.invites.map((invite) => <li key={invite.id} className="flex flex-wrap items-center gap-3 py-3"><code className="font-bold">{invite.code}</code><span className="text-muted-foreground">{invite.use_count}/{invite.max_uses} used</span><span className={invite.active ? "text-success" : "text-destructive"}>{invite.active ? "Active" : "Disabled"}</span><Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => adminSetInviteActive({ data: { id: invite.id, active: !invite.active } }), "Invite updated")}>{invite.active ? "Disable" : "Enable"}</Button></li>)}</ul>
    </section>
    <section className="rounded-3xl border bg-card p-5">
      <h2 className="font-bold">State listing kill switch</h2>
      <p className="mt-1 text-sm text-muted-foreground">Disabling a state blocks new listings and checkout for its events. Existing orders remain available.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3"><div><Label htmlFor="state-code">State code</Label><Input id="state-code" maxLength={2} value={stateCode} onChange={(event) => setStateCode(event.target.value.toUpperCase())} /></div><Button variant="outline" disabled={busy} onClick={() => run(() => adminSetStateListings({ data: { state_code: stateCode, listings_enabled: true } }), "Listings enabled")}>Enable listings</Button><Button variant="destructive" disabled={busy} onClick={() => run(() => adminSetStateListings({ data: { state_code: stateCode, listings_enabled: false } }), "Listings disabled")}>Disable listings</Button></div>
      <ul className="mt-4 text-sm">{data.states.map((state) => <li key={state.state_code} className="py-1">{state.state_code}: <b>{state.listings_enabled ? "enabled" : "disabled"}</b></li>)}</ul>
    </section>
  </div>;
}
