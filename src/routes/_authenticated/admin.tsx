import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/" });
  },
  component: () => (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex gap-4 text-sm font-semibold"><span className="rounded-full bg-ink px-3 py-1 text-ink-foreground">Admin</span><Link to="/admin/events" className="[&.active]:text-primary">Events</Link><Link to="/admin/reviews" className="[&.active]:text-primary">Ticket reviews</Link></nav>
      <Outlet />
    </div>
  ),
});
