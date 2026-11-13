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

## Project rules
- All player registrations and payments (transfer and cash) live in the single `public.registrations` table; writes go only through SECURITY DEFINER RPCs (register_player, report_transfer_sent, change_payment_type, admin_*) so status transitions and "recorded by" names are enforced server-side, never by direct table updates from the browser.
- Admin rights come from `public.user_roles` (`has_role`); the first account ever created becomes admin, later admins are granted from the dashboard Staff tab.
- Club name, price and bank details live in `src/lib/club.ts`; UI never hardcodes them.
- The amount charged is computed server-side in `register_player` (sport, membership, guests, optional `hire_hours` flat pitch hire) and stored on the row; the browser never sends a price. `bookingTotal` in `src/lib/club.ts` mirrors it and is tested.
- Admin button availability is decided by `availableActions` in `src/lib/admin-actions.ts` (tested), mirroring the RPC checks.
- Group bookings are one `registrations` row: extra players live in its `guests` jsonb ([{name, membership}]), `register_player` validates them and adds their prices to `amount_ngn`, and one pass/check-in admits the whole group — keeps one payment per row.
