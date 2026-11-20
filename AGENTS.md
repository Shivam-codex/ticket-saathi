<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Architecture rules
- Framework is TanStack Start (not Next.js); pages live in `src/routes/`, server logic in `createServerFn` under `src/functions/*.functions.ts` (a `server/` folder is blocked from client imports) — platform constraint.
- All money/fee/GST/price-cap math lives only in a server-only pricing module (e.g. `src/lib/pricing.server.ts`) with unit tests; client only displays server quotes — prevents tampering.
- Amounts are integer paise (`bigint`), percentages are basis points (`*_bps`) — no float rounding errors.
- Seller eligibility is enforced in the database (`is_seller_ready`, `become_seller`, listings insert policy), the UI only mirrors it — RLS is the source of truth.
- Orders, ledger, payouts and audit logs are written only by server code with the admin client — users can read their own but never write.
- Consents are append-only rows per purpose; the latest row per purpose is the current choice — keeps a full audit trail.
- UI strings go through `src/lib/i18n.tsx` (en/hi/mr) — every new key needs all three languages.
