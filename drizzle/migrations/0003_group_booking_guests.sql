-- Group bookings: one payer, extra players listed by name on the same row/pass.
alter table public.registrations
  add column guests jsonb not null default '[]'::jsonb;

comment on column public.registrations.guests is 'Extra players paid for by this booker: [{"name": text, "membership": membership_type}]. One pass checks in the whole group.';

drop function if exists public.register_player(text, text, public.session_slot, public.payment_type, public.membership_type, time, public.sport_type);

create or replace function public.register_player(
  _full_name text,
  _phone text,
  _session public.session_slot,
  _payment_type public.payment_type,
  _membership public.membership_type,
  _play_time time,
  _sport public.sport_type,
  _guests jsonb default '[]'::jsonb
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
  g jsonb;
  g_name text;
  g_membership public.membership_type;
  clean_guests jsonb := '[]'::jsonb;
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

  if _guests is null then
    _guests := '[]'::jsonb;
  end if;
  if jsonb_typeof(_guests) <> 'array' then
    raise exception 'Invalid list of extra players.';
  end if;
  if jsonb_array_length(_guests) > 9 then
    raise exception 'You can pay for up to 9 extra players per booking.';
  end if;

  for g in select * from jsonb_array_elements(_guests) loop
    g_name := trim(coalesce(g->>'name', ''));
    if length(g_name) < 2 or length(g_name) > 100 then
      raise exception 'Please enter the full name of every extra player.';
    end if;
    begin
      g_membership := (g->>'membership')::public.membership_type;
    exception when others then
      raise exception 'Say whether each extra player is an old timer or a new member.';
    end;
    if g_membership is null then
      raise exception 'Say whether each extra player is an old timer or a new member.';
    end if;
    price := price + case when g_membership = 'OLD_TIMER' then 1000 else 2000 end;
    clean_guests := clean_guests || jsonb_build_array(jsonb_build_object('name', g_name, 'membership', g_membership));
  end loop;

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
     qr_reference, checkin_code, membership, play_time, amount_ngn, sport, guests)
  values (
    clean_name, clean_phone, _session, public.next_session_date(_session), _payment_type,
    case when _payment_type = 'CASH_AT_COURT' then 'AWAITING_CASH'::public.payment_status else 'UNPAID'::public.payment_status end,
    ref, code, _membership, _play_time, price, _sport, clean_guests
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
  guests jsonb,
  transfer_reported_at timestamptz, paid_at timestamptz, checked_in_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.full_name, r.phone, r.session, r.session_date, r.payment_type, r.payment_status,
         r.qr_reference, r.checkin_code, r.checkin_status, r.membership, r.play_time, r.amount_ngn, r.sport,
         r.guests,
         r.transfer_reported_at, r.paid_at, r.checked_in_at, r.created_at
  from public.registrations r
  where r.qr_reference = upper(trim(_ref))
$$;

create or replace function public.admin_check_in(_lookup text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_name text := public.require_admin_name();
  key text := upper(regexp_replace(coalesce(_lookup, ''), '\s', '', 'g'));
  r public.registrations%rowtype;
begin
  select * into r from public.registrations
   where checkin_code = key or qr_reference = key
   limit 1;
  if not found then
    return json_build_object('result', 'not_found');
  end if;
  if r.payment_status <> 'PAID' then
    return json_build_object('result', 'not_paid', 'id', r.id, 'full_name', r.full_name,
      'payment_status', r.payment_status, 'session', r.session, 'play_time', r.play_time,
      'party_size', 1 + jsonb_array_length(r.guests));
  end if;
  if r.checkin_status = 'CHECKED_IN' then
    return json_build_object('result', 'already', 'id', r.id, 'full_name', r.full_name,
      'checked_in_at', r.checked_in_at, 'session', r.session, 'play_time', r.play_time,
      'party_size', 1 + jsonb_array_length(r.guests));
  end if;
  update public.registrations
     set checkin_status = 'CHECKED_IN', checked_in_at = now(), checked_in_by_name = admin_name
   where id = r.id;
  return json_build_object('result', 'checked_in', 'id', r.id, 'full_name', r.full_name,
    'session', r.session, 'play_time', r.play_time, 'amount_ngn', r.amount_ngn,
    'party_size', 1 + jsonb_array_length(r.guests));
end;
$$;

revoke execute on function public.register_player(text, text, public.session_slot, public.payment_type, public.membership_type, time, public.sport_type, jsonb) from public;
revoke execute on function public.get_ticket(text) from public;
grant execute on function public.register_player(text, text, public.session_slot, public.payment_type, public.membership_type, time, public.sport_type, jsonb) to anon, authenticated;
grant execute on function public.get_ticket(text) to anon, authenticated;