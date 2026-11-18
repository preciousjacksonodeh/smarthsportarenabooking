# Ticket privacy + admin-approved passes

Combines two asks: (1) the QR pass only appears after an admin approves the payment, with the receipt visible to admins in the app; (2) the public pass lookup stops exposing phone numbers, check-in codes, guest names and staff/audit details.

## What players and admins will see

- **Before approval:** the pass shows the booking, amount and payment steps, plus the booking reference (needed as transfer narration). No QR code, no 6-digit code. Message: "Waiting for an admin to approve your payment."
- **After approval (transfer confirmed or cash recorded):** QR code and 6-digit code appear (page already refreshes every 15 s). Receipt link appears.
- **After check-in:** "You're checked in"; the code is no longer returned.
- **Public pass and receipt:** payer shown as first name + last initial (e.g. "Precious O."), group shown as "Group of 3" (no guest names), no phone, no "received by" staff name.
- **Admins (signed in):** the same receipt page additionally shows full name, phone, every player's name and who received the money. New **Receipts** tab on the dashboard lists every paid booking (date paid, payer, amount, method, received by, "Open receipt"). After "Confirm transfer" / "Record cash" the success message offers "View receipt".

## Current state (verified)

- `get_ticket(text)` is SECURITY DEFINER, executable by anon + authenticated; returns phone, checkin_code, guests (names), received_by_name, transfer_reported_at, checked_in_at, created_at, etc.
- Frontend callers: `src/routes/ticket.$ref.tsx` (line 36) and `src/routes/receipt.$ref.tsx` (line 26). No AI/server code calls it.
- Live grants: anon also has EXECUTE on every admin RPC (`admin_check_in`, `admin_confirm_transfer`, `admin_record_cash`, `admin_set_admin`, `require_admin_name`). They are guarded inside by `require_admin_name()`, so not exploitable, but unnecessary.
- Latest migration: `0005_player_help_chat`.

## Migration plan (forward-only, two steps)

**Step A — `0006_public_ticket_privacy` (this build)**
1. Create `public.get_public_ticket(_ref text)` (new name, so no return-type replacement), SECURITY DEFINER, `stable`, `search_path = public`. Returns one row:
   `qr_reference, holder_name (first name + last initial), sport, session, session_date, play_time, membership, hire_hours, guest_count, amount_ngn, payment_type, payment_status, checkin_status, paid_at, checkin_code`
   - `checkin_code` is NULL unless `payment_status = 'PAID' and checkin_status = 'NOT_CHECKED_IN'` (server-side enforcement of "approve before pass").
   - `paid_at` NULL unless PAID.
   - Not returned: phone, guest names, received_by, transfer_reported_at, checked_in_at, created_at, ids.
2. `revoke all on function public.get_public_ticket(text) from public, anon, authenticated;` then `grant execute ... to anon, authenticated;`
3. Tighten (no new permissions): `revoke execute on function` each `admin_*` RPC and `require_admin_name()` `from public, anon;` keep `authenticated` (their internal admin check stays the gate). `admin_check_in` remains the only check-in path.
4. `comment on function public.get_ticket(text) is 'DEPRECATED: replaced by get_public_ticket';` — left executable for now so the published site keeps working until republished.

**Step B — `0007_revoke_legacy_get_ticket` (after you republish)**
- `revoke execute on function public.get_ticket(text) from public, anon, authenticated;` (function kept, not dropped). Grant stays for `service_role` only.

## Frontend changes

- `src/routes/ticket.$ref.tsx`: switch query to `get_public_ticket`; remove phone line; show "Group of N" instead of names; render QR + code only when `passView` says so; replace unpaid states with the approval message; `checked_in_at` text becomes plain "You're checked in". Admin panel unchanged (already reads full row via admin-only table access).
- `src/routes/receipt.$ref.tsx`: switch to `get_public_ticket`; public view without phone/names/received-by; when `me.isAdmin`, also load the full row from the registrations table (admin read policy) and show phone, all names, received-by. Share button sends the receipt number and amount as text, not the link (the link is also the pass link, so forwarding it would let someone else see a live QR).
- `src/routes/_authenticated/admin.tsx`: add **Receipts** tab (paid rows ordered by paid date, link to receipt).
- `src/components/courtside/use-admin-actions.ts`: success toasts for confirm/record get a "View receipt" action (needs the ref passed in).
- New `src/lib/public-ticket.ts`: `passView(ticket)` returns `{ showQr, showCode, showReceipt, state }`; used by both pages.
- `src/integrations/supabase/types.ts`: regenerated automatically by the migration, not hand-edited.
- `AGENTS.md`: add rule "Public pass/receipt reads use `get_public_ticket` only (no phone, guest names, staff names; code only when paid and not checked in); full rows are admin-only."
- `roadmap.md`: add this task (could not edit during planning).

## report_transfer_sent / change_payment_type review (no permission changes)

- Both take only the booking reference (10 random hex chars, ~1 trillion combinations; not practically guessable, but no rate limit).
- Neither returns data, and both refuse PAID bookings, so they cannot mark anyone paid or reveal details. Error text is identical for "missing" and "already paid", so no existence oracle.
- Residual risk: anyone holding a reference (e.g. a forwarded link) can flag "I've sent the transfer" falsely, or switch payment method, which resets a pending transfer to unpaid and clears the "sent" time. Impact is nuisance only; admins still approve manually. Mitigated by the Share change above. Possible later hardening (not in this change): stop `change_payment_type` from resetting a pending transfer.

## Compatibility risks

- One backend serves preview and published site: the published site keeps calling `get_ticket` until republished, hence step B waits. If step B ran first, live passes and receipts would show "not found".
- Players with unpaid bookings who previously saw a QR will now see "waiting for approval" — intended.
- Existing paid + checked-in bookings: no code shown (already checked in) — intended.
- Admin receipt extras depend on the existing admin read policy on registrations; no new policy.
- Anon losing EXECUTE on admin RPCs: browser only calls them when signed in as admin, so no breakage.

## Test plan

- **Unit (vitest, new `src/lib/public-ticket.test.ts`):** unpaid / awaiting cash / pending transfer → no QR, no code; paid + not checked in → QR and code; paid + checked in → no code; receipt only when paid.
- **Existing tests:** run `admin-actions`, `club`, `bookings-digest`, routing tests.
- **Database checks (read-only):** `has_function_privilege` — anon can execute `get_public_ticket`, cannot execute any `admin_*`; after step B, cannot execute `get_ticket`. Call `get_public_ticket` via the public API with the publishable key for the existing unpaid "AI Test Player" booking: no phone/guest-name fields, `checkin_code` null.
- **Browser (no new data):** unpaid test booking pass shows approval message and no QR; an existing paid booking's receipt shows no phone when signed out, and phone + names + received-by when signed in as admin; Receipts tab lists paid bookings. The "paid but not yet checked in" screen is covered by unit tests only, unless you allow a temporary test booking.
