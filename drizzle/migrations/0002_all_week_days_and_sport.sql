-- Court now runs every day of the week.
alter type public.session_slot add value if not exists 'MONDAY' before 'TUESDAY_5PM';
alter type public.session_slot add value if not exists 'WEDNESDAY' after 'TUESDAY_5PM';
alter type public.session_slot add value if not exists 'FRIDAY' after 'THURSDAY_5PM';

create or replace function public.next_session_date(_session public.session_slot)
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  today date := (now() at time zone 'Africa/Lagos')::date;
  target int := case _session::text
    when 'SUNDAY' then 0
    when 'MONDAY' then 1
    when 'TUESDAY_5PM' then 2
    when 'WEDNESDAY' then 3
    when 'THURSDAY_5PM' then 4
    when 'FRIDAY' then 5
    when 'SATURDAY' then 6 end;
begin
  return today + ((target - extract(dow from today)::int + 7) % 7);
end;
$$;

-- Sport the player is booking.
create type public.sport_type as enum ('BASKETBALL', 'FOOTBALL');

alter table public.registrations
  add column sport public.sport_type not null default 'BASKETBALL';

comment on column public.registrations.sport is 'Chosen by the player at registration: basketball or football.';

drop function if exists public.register_player(text, text, public.session_slot, public.payment_type, public.membership_type, time);

create or replace function public.register_player(
  _full_name text,
  _phone text,
  _session public.session_slot,
  _payment_type public.payment_type,
  _membership public.membership_type,
  _play_time time,
  _sport public.sport_type
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text;
  code text;
  clean_name text := trim(coalesce(_full_name, ''));
  clean_phone text := regexp_replace(coalesce(_phone, ''), '[^0-9+]', '', 'g');
  price int := case when _membership = 'OLD_TIMER' then 1000 else 2000 end;
begin
  if length(clean_name) < 2 or length(clean_name) > 100 then
    raise exception 'Please enter your full name.';
  end if;
  if length(regexp_replace(clean_phone, '[^0-9]', '', 'g')) < 7 or length(clean_phone) > 20 then
    raise exception 'Please enter a valid phone number.';
  end if;
  if _play_time is null or _play_time < time '07:00' or _play_time > time '21:00' then
    raise exception 'Pick a playing time between 7:00 AM and 9:00 PM.';
  end if;
  if _sport is null then
    raise exception 'Pick basketball or football.';
  end if;

  loop
    ref := 'SA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.registrations where qr_reference = ref);
  end loop;
  loop
    code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.registrations where checkin_code = code);
  end loop;

  insert into public.registrations
    (full_name, phone, session, session_date, payment_type, payment_status,
     qr_reference, checkin_code, membership, play_time, amount_ngn, sport)
  values (
    clean_name, clean_phone, _session, public.next_session_date(_session), _payment_type,
    case when _payment_type = 'CASH_AT_COURT' then 'AWAITING_CASH'::public.payment_status else 'UNPAID'::public.payment_status end,
    ref, code, _membership, _play_time, price, _sport
  );
  return ref;
end;
$$;

drop function if exists public.get_ticket(text);

create or replace function public.get_ticket(_ref text)
returns table (
  full_name text, phone text, session public.session_slot, session_date date,
  payment_type public.payment_type, payment_status public.payment_status,
  qr_reference text, checkin_code text, checkin_status public.checkin_status,
  membership public.membership_type, play_time time, amount_ngn integer, sport public.sport_type,
  transfer_reported_at timestamptz, paid_at timestamptz, checked_in_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.full_name, r.phone, r.session, r.session_date, r.payment_type, r.payment_status,
         r.qr_reference, r.checkin_code, r.checkin_status, r.membership, r.play_time, r.amount_ngn, r.sport,
         r.transfer_reported_at, r.paid_at, r.checked_in_at, r.created_at
  from public.registrations r
  where r.qr_reference = upper(trim(_ref))
$$;

revoke execute on function public.register_player(text, text, public.session_slot, public.payment_type, public.membership_type, time, public.sport_type) from public;
revoke execute on function public.get_ticket(text) from public;
grant execute on function public.register_player(text, text, public.session_slot, public.payment_type, public.membership_type, time, public.sport_type) to anon, authenticated;
grant execute on function public.get_ticket(text) to anon, authenticated;