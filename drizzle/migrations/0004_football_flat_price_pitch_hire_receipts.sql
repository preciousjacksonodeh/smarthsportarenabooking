alter table public.registrations add column hire_hours smallint;
alter table public.registrations add constraint registrations_hire_hours_check check (hire_hours is null or hire_hours in (1, 2));
comment on column public.registrations.hire_hours is 'Null = pay per player. 1 or 2 = whole football pitch hired for that many hours at a flat price.';

drop function if exists public.register_player(text, text, public.session_slot, public.payment_type, public.membership_type, time, public.sport_type, jsonb);

create or replace function public.register_player(
  _full_name text,
  _phone text,
  _session public.session_slot,
  _payment_type public.payment_type,
  _membership public.membership_type,
  _play_time time,
  _sport public.sport_type,
  _guests jsonb default '[]'::jsonb,
  _hire_hours integer default null
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
  price int;
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
  if _membership is null then
    raise exception 'Say whether you are an old timer or a new member.';
  end if;

  if _hire_hours is not null then
    if _hire_hours not in (1, 2) then
      raise exception 'Pitch hire is for 1 or 2 hours.';
    end if;
    if _sport <> 'FOOTBALL' then
      raise exception 'Pitch hire is for football only.';
    end if;
    if _hire_hours = 2 and _play_time > time '20:00' then
      raise exception 'A 2-hour hire must start by 8:00 PM — the court closes at 10:00 PM.';
    end if;
    price := case when _hire_hours = 1 then 20000 else 35000 end;
  else
    price := case when _sport = 'FOOTBALL' then 2000
                  when _membership = 'OLD_TIMER' then 1000 else 2000 end;
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
    if _hire_hours is null then
      price := price + case when _sport = 'FOOTBALL' then 2000
                            when g_membership = 'OLD_TIMER' then 1000 else 2000 end;
    end if;
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
     qr_reference, checkin_code, membership, play_time, amount_ngn, sport, guests, hire_hours)
  values (
    clean_name, clean_phone, _session, public.next_session_date(_session), _payment_type,
    case when _payment_type = 'CASH_AT_COURT' then 'AWAITING_CASH'::public.payment_status else 'UNPAID'::public.payment_status end,
    ref, code, _membership, _play_time, price, _sport, clean_guests, _hire_hours::smallint
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
  guests jsonb, hire_hours smallint, received_by_name text,
  transfer_reported_at timestamptz, paid_at timestamptz, checked_in_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.full_name, r.phone, r.session, r.session_date, r.payment_type, r.payment_status,
         r.qr_reference, r.checkin_code, r.checkin_status, r.membership, r.play_time, r.amount_ngn, r.sport,
         r.guests, r.hire_hours, coalesce(r.cash_recorded_by_name, r.transfer_confirmed_by_name),
         r.transfer_reported_at, r.paid_at, r.checked_in_at, r.created_at
  from public.registrations r
  where r.qr_reference = upper(trim(_ref))
$$;

revoke execute on function public.register_player(text, text, public.session_slot, public.payment_type, public.membership_type, time, public.sport_type, jsonb, integer) from public;
revoke execute on function public.get_ticket(text) from public;
grant execute on function public.register_player(text, text, public.session_slot, public.payment_type, public.membership_type, time, public.sport_type, jsonb, integer) to anon, authenticated;
grant execute on function public.get_ticket(text) to anon, authenticated;