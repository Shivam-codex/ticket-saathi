import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/" });
  },
  component: () => (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold"><span className="rounded-full bg-ink px-3 py-1 text-ink-foreground">Admin</span><Link to="/admin" className="[&.active]:text-primary">Overview</Link><Link to="/admin/events" className="[&.active]:text-primary">Events</Link><Link to="/admin/reviews" className="[&.active]:text-primary">Ticket reviews</Link><Link to="/admin/disputes" className="[&.active]:text-primary">Disputes</Link><Link to="/admin/reports" className="[&.active]:text-primary">Takedowns</Link><Link to="/admin/users" className="[&.active]:text-primary">Users</Link><Link to="/admin/grievances" className="[&.active]:text-primary">Grievances</Link><Link to="/admin/rules" className="[&.active]:text-primary">Fees & rules</Link><Link to="/admin/reconciliation" className="[&.active]:text-primary">Ledger</Link></nav>
      <Outlet />
    </div>
  ),
});
