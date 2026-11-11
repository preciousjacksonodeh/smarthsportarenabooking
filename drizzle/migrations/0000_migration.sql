-- Enums
create type public.app_role as enum ('admin');
create type public.session_slot as enum ('TUESDAY_5PM', 'THURSDAY_5PM', 'SATURDAY', 'SUNDAY');
create type public.payment_type as enum ('BANK_TRANSFER', 'CASH_AT_COURT');
create type public.payment_status as enum ('UNPAID', 'PENDING_BANK_TRANSFER', 'AWAITING_CASH', 'PAID');
create type public.checkin_status as enum ('NOT_CHECKED_IN', 'CHECKED_IN');

-- Profiles (admin display names)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users read own profile, admins read all" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Users read own roles, admins read all" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- New user: create profile; very first user becomes admin
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email
  );
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The single table every registration and payment lands in
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  session public.session_slot not null,
  session_date date not null,
  payment_type public.payment_type not null,
  payment_status public.payment_status not null default 'UNPAID',
  qr_reference text not null unique,
  checkin_code text not null unique,
  checkin_status public.checkin_status not null default 'NOT_CHECKED_IN',
  transfer_reported_at timestamptz,
  paid_at timestamptz,
  transfer_confirmed_by uuid,
  transfer_confirmed_by_name text,
  cash_recorded_by uuid,
  cash_recorded_by_name text,
  checked_in_at timestamptz,
  checked_in_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkin_code_six_digits check (checkin_code ~ '^[0-9]{6}$')
);
grant select on public.registrations to authenticated;
grant all on public.registrations to service_role;
alter table public.registrations enable row level security;

create policy "Admins read all registrations" on public.registrations
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create index registrations_session_date_idx on public.registrations (session_date, session);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger registrations_touch before update on public.registrations
  for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.registrations;

-- Helper: next date for a session (Lagos time, today counts)
create or replace function public.next_session_date(_session public.session_slot)
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  today date := (now() at time zone 'Africa/Lagos')::date;
  target int := case _session
    when 'TUESDAY_5PM' then 2
    when 'THURSDAY_5PM' then 4
    when 'SATURDAY' then 6
    when 'SUNDAY' then 0 end;
begin
  return today + ((target - extract(dow from today)::int + 7) % 7);
end;
$$;

-- Public: register a player
create or replace function public.register_player(
  _full_name text, _phone text, _session public.session_slot, _payment_type public.payment_type
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
begin
  if length(clean_name) < 2 or length(clean_name) > 100 then
    raise exception 'Please enter your full name.';
  end if;
  if length(regexp_replace(clean_phone, '[^0-9]', '', 'g')) < 7 or length(clean_phone) > 20 then
    raise exception 'Please enter a valid phone number.';
  end if;

  loop
    ref := 'CS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.registrations where qr_reference = ref);
  end loop;
  loop
    code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.registrations where checkin_code = code);
  end loop;

  insert into public.registrations (full_name, phone, session, session_date, payment_type, payment_status, qr_reference, checkin_code)
  values (
    clean_name, clean_phone, _session, public.next_session_date(_session), _payment_type,
    case when _payment_type = 'CASH_AT_COURT' then 'AWAITING_CASH'::public.payment_status else 'UNPAID'::public.payment_status end,
    ref, code
  );
  return ref;
end;
$$;

-- Public: read one ticket by its secret reference
create or replace function public.get_ticket(_ref text)
returns table (
  full_name text, phone text, session public.session_slot, session_date date,
  payment_type public.payment_type, payment_status public.payment_status,
  qr_reference text, checkin_code text, checkin_status public.checkin_status,
  transfer_reported_at timestamptz, paid_at timestamptz, checked_in_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.full_name, r.phone, r.session, r.session_date, r.payment_type, r.payment_status,
         r.qr_reference, r.checkin_code, r.checkin_status, r.transfer_reported_at, r.paid_at,
         r.checked_in_at, r.created_at
  from public.registrations r
  where r.qr_reference = upper(trim(_ref))
$$;

-- Public: player says they've sent the bank transfer
create or replace function public.report_transfer_sent(_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.registrations
     set payment_status = 'PENDING_BANK_TRANSFER', transfer_reported_at = now()
   where qr_reference = upper(trim(_ref))
     and payment_type = 'BANK_TRANSFER'
     and payment_status = 'UNPAID';
  if not found then
    raise exception 'This ticket cannot be updated.';
  end if;
end;
$$;

-- Public: switch payment type before paying
create or replace function public.change_payment_type(_ref text, _payment_type public.payment_type)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.registrations
     set payment_type = _payment_type,
         payment_status = case when _payment_type = 'CASH_AT_COURT' then 'AWAITING_CASH'::public.payment_status else 'UNPAID'::public.payment_status end,
         transfer_reported_at = null
   where qr_reference = upper(trim(_ref))
     and payment_status <> 'PAID';
  if not found then
    raise exception 'This ticket is already paid.';
  end if;
end;
$$;

-- Admin helpers
create or replace function public.require_admin_name()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare n text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admins only.';
  end if;
  select display_name into n from public.profiles where id = auth.uid();
  return coalesce(n, 'Admin');
end;
$$;

create or replace function public.admin_confirm_transfer(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare admin_name text := public.require_admin_name();
begin
  update public.registrations
     set payment_status = 'PAID', paid_at = now(),
         transfer_confirmed_by = auth.uid(), transfer_confirmed_by_name = admin_name
   where id = _id and payment_type = 'BANK_TRANSFER' and payment_status <> 'PAID';
  if not found then raise exception 'This transfer cannot be confirmed.'; end if;
end;
$$;

create or replace function public.admin_record_cash(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare admin_name text := public.require_admin_name();
begin
  update public.registrations
     set payment_type = 'CASH_AT_COURT', payment_status = 'PAID', paid_at = now(),
         cash_recorded_by = auth.uid(), cash_recorded_by_name = admin_name
   where id = _id and payment_status <> 'PAID';
  if not found then raise exception 'This player has already paid.'; end if;
end;
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
    return json_build_object('result', 'not_paid', 'id', r.id, 'full_name', r.full_name, 'payment_status', r.payment_status, 'session', r.session);
  end if;
  if r.checkin_status = 'CHECKED_IN' then
    return json_build_object('result', 'already', 'id', r.id, 'full_name', r.full_name, 'checked_in_at', r.checked_in_at, 'session', r.session);
  end if;
  update public.registrations
     set checkin_status = 'CHECKED_IN', checked_in_at = now(), checked_in_by_name = admin_name
   where id = r.id;
  return json_build_object('result', 'checked_in', 'id', r.id, 'full_name', r.full_name, 'session', r.session);
end;
$$;

create or replace function public.admin_set_admin(_user_id uuid, _make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin_name();
  if _make_admin then
    insert into public.user_roles (user_id, role) values (_user_id, 'admin') on conflict do nothing;
  else
    if (select count(*) from public.user_roles where role = 'admin') <= 1 then
      raise exception 'You need at least one admin.';
    end if;
    delete from public.user_roles where user_id = _user_id and role = 'admin';
  end if;
end;
$$;

revoke execute on function public.register_player(text, text, public.session_slot, public.payment_type) from public;
revoke execute on function public.get_ticket(text) from public;
revoke execute on function public.report_transfer_sent(text) from public;
revoke execute on function public.change_payment_type(text, public.payment_type) from public;
revoke execute on function public.admin_confirm_transfer(uuid) from public;
revoke execute on function public.admin_record_cash(uuid) from public;
revoke execute on function public.admin_check_in(text) from public;
revoke execute on function public.admin_set_admin(uuid, boolean) from public;
revoke execute on function public.require_admin_name() from public;

grant execute on function public.register_player(text, text, public.session_slot, public.payment_type) to anon, authenticated;
grant execute on function public.get_ticket(text) to anon, authenticated;
grant execute on function public.report_transfer_sent(text) to anon, authenticated;
grant execute on function public.change_payment_type(text, public.payment_type) to anon, authenticated;
grant execute on function public.admin_confirm_transfer(uuid) to authenticated;
grant execute on function public.admin_record_cash(uuid) to authenticated;
grant execute on function public.admin_check_in(text) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.require_admin_name() to authenticated;
