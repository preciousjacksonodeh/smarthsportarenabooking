create function public.get_public_ticket(_ref text)
returns table(
  qr_reference text,
  holder_name text,
  sport public.sport_type,
  session public.session_slot,
  session_date date,
  play_time time without time zone,
  membership public.membership_type,
  hire_hours smallint,
  guest_count integer,
  amount_ngn integer,
  payment_type public.payment_type,
  payment_status public.payment_status,
  checkin_status public.checkin_status,
  paid_at timestamp with time zone,
  checkin_code text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.qr_reference,
         case when r.full_name ~ '\s'
              then split_part(r.full_name, ' ', 1) || ' ' || upper(left(regexp_replace(r.full_name, '^.*\s', ''), 1)) || '.'
              else r.full_name end,
         r.sport, r.session, r.session_date, r.play_time, r.membership, r.hire_hours,
         jsonb_array_length(r.guests), r.amount_ngn, r.payment_type, r.payment_status, r.checkin_status,
         case when r.payment_status = 'PAID' then r.paid_at end,
         case when r.payment_status = 'PAID' and r.checkin_status = 'NOT_CHECKED_IN' then r.checkin_code end
  from public.registrations r
  where r.qr_reference = upper(trim(_ref))
$$;

revoke all on function public.get_public_ticket(text) from public, anon, authenticated;
grant execute on function public.get_public_ticket(text) to anon, authenticated, service_role;

revoke execute on function public.admin_check_in(text) from public, anon;
revoke execute on function public.admin_confirm_transfer(uuid) from public, anon;
revoke execute on function public.admin_record_cash(uuid) from public, anon;
revoke execute on function public.admin_set_admin(uuid, boolean) from public, anon;
revoke execute on function public.require_admin_name() from public, anon;
grant execute on function public.admin_check_in(text) to authenticated, service_role;
grant execute on function public.admin_confirm_transfer(uuid) to authenticated, service_role;
grant execute on function public.admin_record_cash(uuid) to authenticated, service_role;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated, service_role;
grant execute on function public.require_admin_name() to authenticated, service_role;

comment on function public.get_ticket(text) is 'DEPRECATED: replaced by get_public_ticket (no phone, guest names or staff names). Execute to be revoked once the republished app no longer calls it.';