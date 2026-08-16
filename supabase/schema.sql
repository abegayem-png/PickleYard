-- 24/7 Pickleball Play — Supabase schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`) for a new project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  customer_name text not null,
  mobile_number text not null,
  email text not null default '',
  number_of_players integer not null default 2,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  duration integer not null,
  rate_breakdown jsonb not null default '[]',
  -- Pre-discount total. Kept alongside total_amount so "Normal Total / Discount /
  -- Final Total" can be shown verbatim in Admin > Bookings.
  normal_total numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null,
  promo_code text,
  discount_amount numeric(10, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  payment_method text not null default 'cash' check (payment_method in ('gcash', 'cash')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists bookings_date_idx on bookings (booking_date);
create index if not exists bookings_reference_idx on bookings (booking_reference);
create index if not exists bookings_promo_code_idx on bookings (promo_code);

-- Defensive guards in case `bookings` already existed from an earlier,
-- partial version of this script — safe no-ops if the columns are present.
alter table bookings add column if not exists normal_total numeric(10, 2);
alter table bookings add column if not exists promo_code text;
alter table bookings add column if not exists discount_amount numeric(10, 2) not null default 0;
update bookings set normal_total = total_amount where normal_total is null;
alter table bookings alter column normal_total set not null;
alter table bookings alter column normal_total set default 0;

-- Auto-generate a PKL-XXXXXX reference if the client doesn't supply one.
create or replace function generate_booking_reference() returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'PKL-';
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

create or replace function set_booking_reference() returns trigger as $$
begin
  if new.booking_reference is null or new.booking_reference = '' then
    new.booking_reference := generate_booking_reference();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_booking_reference on bookings;
create trigger trg_set_booking_reference
  before insert on bookings
  for each row execute function set_booking_reference();

-- ---------------------------------------------------------------------------
-- promo_codes
-- ---------------------------------------------------------------------------
create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  active boolean not null default true,
  daytime_rate numeric(10, 2) not null,
  nighttime_rate numeric(10, 2) not null,
  valid_from date not null default current_date,
  valid_until date,
  -- [] = every day of the week; otherwise a JSON array of 0 (Sun) .. 6 (Sat).
  valid_days jsonb not null default '[]',
  min_booking_hours integer,
  max_total_uses integer,
  max_uses_per_customer integer,
  show_banner boolean not null default false,
  banner_message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists promo_codes_code_idx on promo_codes (code);

-- Default/first promo code — safe to re-run, only inserted if it doesn't exist yet.
insert into promo_codes (code, active, daytime_rate, nighttime_rate, valid_from, show_banner, banner_message)
values (
  'PLAYMORE', true, 133, 155, current_date, true,
  'Use code PLAYMORE and play for only ₱133/hour daytime or ₱155/hour at night!'
)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Trusted, server-side pricing + promo validation.
--
-- IMPORTANT: this is the only place booking prices are computed. The app's
-- insert payload (rate_breakdown/total_amount/promo_code, etc.) is never
-- trusted — the trigger below always recalculates from settings/promo_codes
-- and overwrites whatever the client sent, so a customer editing the browser
-- request cannot manufacture their own discount.
-- ---------------------------------------------------------------------------

-- "6:00 PM" style label for hour `h` (0-23, wraps via modulo like the app's
-- own lib/time.ts) — deliberately hand-rolled instead of to_char() so the
-- output format is exact and doesn't depend on to_char's padding rules.
create or replace function pkl_hour_label(h integer) returns text
language sql immutable as $$
  select (case when (h % 24) % 12 = 0 then 12 else (h % 24) % 12 end)::text
    || ':00 ' || (case when (h % 24) >= 12 then 'PM' else 'AM' end);
$$;

create or replace function compute_booking_pricing(
  p_booking_date date,
  p_start_time time,
  p_duration integer,
  p_promo_code text default null,
  p_mobile_number text default null
)
returns table (
  valid boolean,
  reason text,
  promo_code_out text,
  daytime_rate numeric,
  nighttime_rate numeric,
  rate_breakdown jsonb,
  normal_total numeric,
  promo_total numeric,
  discount_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  promo record;
  h integer;
  start_hour integer;
  day_start integer;
  day_end integer;
  night_start integer;
  night_end integer;
  weekday integer;
  hour_rate numeric;
  hour_period text;
  label text;
  normal_breakdown jsonb := '[]'::jsonb;
  promo_breakdown jsonb := '[]'::jsonb;
  normal_sum numeric := 0;
  promo_sum numeric := 0;
  code_norm text;
  total_uses integer;
  customer_uses integer;
  promo_applies boolean := false;
begin
  if p_duration is null or p_duration < 1 or p_duration > 4 then
    return query select false, 'Invalid booking duration.', null::text, 0::numeric, 0::numeric, '[]'::jsonb, 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  select * into s from settings where id = 1;
  if not found then
    return query select false, 'Settings not configured.', null::text, 0::numeric, 0::numeric, '[]'::jsonb, 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  start_hour := extract(hour from p_start_time)::int;
  day_start := extract(hour from s.daytime_start)::int;
  day_end := extract(hour from s.daytime_end)::int;
  night_start := extract(hour from s.nighttime_start)::int;
  night_end := extract(hour from s.nighttime_end)::int;
  weekday := extract(dow from p_booking_date)::int;

  if p_promo_code is not null and length(trim(p_promo_code)) > 0 then
    code_norm := upper(trim(p_promo_code));
    select * into promo from promo_codes where code = code_norm;

    if not found then
      return query select false, 'Invalid or expired promo code.', code_norm, 0::numeric, 0::numeric, '[]'::jsonb, 0::numeric, 0::numeric, 0::numeric;
      return;
    end if;

    select count(*) into total_uses from bookings where promo_code = code_norm and status <> 'cancelled';
    select count(*) into customer_uses from bookings
      where promo_code = code_norm and status <> 'cancelled'
        and replace(replace(mobile_number, ' ', ''), '-', '') = replace(replace(coalesce(p_mobile_number, ''), ' ', ''), '-', '');

    if not promo.active
      or promo.valid_from > p_booking_date
      or (promo.valid_until is not null and promo.valid_until < p_booking_date)
      or (jsonb_array_length(promo.valid_days) > 0 and not (promo.valid_days @> to_jsonb(weekday)))
      or (promo.min_booking_hours is not null and p_duration < promo.min_booking_hours)
      or (promo.max_total_uses is not null and total_uses >= promo.max_total_uses)
      or (promo.max_uses_per_customer is not null and customer_uses >= promo.max_uses_per_customer)
    then
      return query select false, 'Invalid or expired promo code.', code_norm, 0::numeric, 0::numeric, '[]'::jsonb, 0::numeric, 0::numeric, 0::numeric;
      return;
    end if;

    promo_applies := true;
  end if;

  for h in start_hour .. (start_hour + p_duration - 1) loop
    label := pkl_hour_label(h) || ' - ' || pkl_hour_label(h + 1);

    if h >= day_start and h < day_end then
      hour_period := 'daytime';
      hour_rate := s.daytime_rate;
    elsif h >= night_start and h < night_end then
      hour_period := 'nighttime';
      hour_rate := s.nighttime_rate;
    elsif s.gap_enabled then
      hour_period := 'gap';
      hour_rate := s.gap_rate;
    else
      return query select false, 'That time is not available for booking.', code_norm, 0::numeric, 0::numeric, '[]'::jsonb, 0::numeric, 0::numeric, 0::numeric;
      return;
    end if;

    normal_breakdown := normal_breakdown || jsonb_build_object('hour', h % 24, 'label', label, 'rate', hour_rate, 'period', hour_period);
    normal_sum := normal_sum + hour_rate;

    if promo_applies and hour_period = 'daytime' then
      promo_breakdown := promo_breakdown || jsonb_build_object('hour', h % 24, 'label', label, 'rate', promo.daytime_rate, 'period', hour_period);
      promo_sum := promo_sum + promo.daytime_rate;
    elsif promo_applies and hour_period = 'nighttime' then
      promo_breakdown := promo_breakdown || jsonb_build_object('hour', h % 24, 'label', label, 'rate', promo.nighttime_rate, 'period', hour_period);
      promo_sum := promo_sum + promo.nighttime_rate;
    else
      promo_breakdown := promo_breakdown || jsonb_build_object('hour', h % 24, 'label', label, 'rate', hour_rate, 'period', hour_period);
      promo_sum := promo_sum + hour_rate;
    end if;
  end loop;

  if promo_applies then
    return query select true, null::text, code_norm, promo.daytime_rate, promo.nighttime_rate, promo_breakdown, normal_sum, promo_sum, (normal_sum - promo_sum);
  else
    return query select true, null::text, null::text, 0::numeric, 0::numeric, normal_breakdown, normal_sum, normal_sum, 0::numeric;
  end if;
end;
$$;

-- Internal helper only — not meant to be called directly by anon/authenticated.
-- The trigger and preview_promo_code() below can still call it internally
-- because both are themselves SECURITY DEFINER (they execute as the owner).
revoke all on function compute_booking_pricing(date, time, integer, text, text) from public;

create or replace function set_booking_pricing() returns trigger as $$
declare
  result record;
begin
  new.end_time := (new.start_time + (new.duration::text || ' hours')::interval)::time;

  select * into result
    from compute_booking_pricing(new.booking_date, new.start_time, new.duration, new.promo_code, new.mobile_number);

  if not result.valid then
    if new.promo_code is not null and length(trim(new.promo_code)) > 0 then
      raise exception 'Promo code is no longer valid. Please remove it and try again.';
    else
      raise exception '%', coalesce(result.reason, 'Selected time is not available for booking.');
    end if;
  end if;

  new.rate_breakdown := result.rate_breakdown;
  new.normal_total := result.normal_total;
  new.total_amount := result.promo_total;
  new.discount_amount := result.discount_amount;
  new.promo_code := result.promo_code_out;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_set_booking_pricing on bookings;
create trigger trg_set_booking_pricing
  before insert on bookings
  for each row execute function set_booking_pricing();

-- Anon-callable, read-only preview used by the "Apply" button on the booking
-- page — runs the exact same trusted logic as the insert trigger above, so
-- what the customer previews is what they'll actually be charged.
create or replace function preview_promo_code(
  p_code text,
  p_booking_date date,
  p_start_hour integer,
  p_duration integer,
  p_mobile_number text default ''
)
returns table (
  valid boolean,
  promo_code text,
  daytime_rate numeric,
  nighttime_rate numeric,
  rate_breakdown jsonb,
  normal_total numeric,
  promo_total numeric,
  discount_amount numeric
)
language sql
security definer
set search_path = public
as $$
  select valid, promo_code_out, daytime_rate, nighttime_rate, rate_breakdown, normal_total, promo_total, discount_amount
  from compute_booking_pricing(p_booking_date, (p_start_hour || ':00')::time, p_duration, p_code, p_mobile_number);
$$;

revoke all on function preview_promo_code(text, date, integer, integer, text) from public;
grant execute on function preview_promo_code(text, date, integer, integer, text) to anon, authenticated;

-- Narrow public view: only the one promo currently allowed to show its
-- banner, and only its banner-safe fields (never max uses, per-customer
-- limits, etc.) — this is what the homepage promo banner reads from.
create or replace view promo_banner as
  select code, banner_message, daytime_rate, nighttime_rate
  from promo_codes
  where active = true
    and show_banner = true
    and valid_from <= current_date
    and (valid_until is null or valid_until >= current_date)
  order by valid_from desc
  limit 1;

grant select on promo_banner to anon, authenticated;

-- ---------------------------------------------------------------------------
-- blocked_slots
-- ---------------------------------------------------------------------------
create table if not exists blocked_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null,
  end_time time not null,
  reason text not null default '',
  all_day boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists blocked_slots_date_idx on blocked_slots (date);

-- ---------------------------------------------------------------------------
-- settings (single row, id = 1)
-- ---------------------------------------------------------------------------
create table if not exists settings (
  id integer primary key default 1,
  business_name text not null default 'PickleYard Compostela',
  tagline text not null default 'Play More. Play Anytime.',
  daytime_rate numeric(10, 2) not null default 150,
  nighttime_rate numeric(10, 2) not null default 180,
  daytime_start time not null default '06:00',
  daytime_end time not null default '17:00',
  nighttime_start time not null default '18:00',
  nighttime_end time not null default '22:00',
  -- "24:00" is Postgres's documented end-of-day value for the `time` type;
  -- the app treats hour 24 as wrapping to 00:00 (see src/lib/time.ts).
  opening_time time not null default '00:00',
  closing_time time not null default '24:00',
  gap_enabled boolean not null default true,
  gap_rate numeric(10, 2) not null default 180,
  phone text not null default '+63 935 922 0897',
  facebook text not null default 'https://www.facebook.com/profile.php?id=61592997513033',
  messenger text not null default 'm.me/247pickleballplay',
  address text not null default 'Court address — set this in Admin Settings',
  maps_url text not null default '',
  gcash_number text not null default '09XX XXX XXXX',
  gcash_account_name text not null default 'Set in Admin Settings',
  gcash_qr_code_url text not null default '',
  open_play_enabled boolean not null default false,
  open_play_schedule_type text not null default 'specific' check (open_play_schedule_type in ('specific', 'recurring')),
  open_play_recurring_days jsonb not null default '[]',
  open_play_recurring_start_date date,
  open_play_recurring_end_date date,
  open_play_start_time time not null default '18:00',
  open_play_end_time time not null default '23:00',
  open_play_price numeric(10, 2) not null default 50,
  open_play_player_limit integer not null default 16,
  open_play_block_bookings boolean not null default true,
  constraint settings_singleton check (id = 1)
);

-- Defensive guards in case `settings` already existed from an earlier,
-- partial version of this script — safe no-ops if the columns are present.
alter table settings add column if not exists maps_url text not null default '';
alter table settings add column if not exists gcash_number text not null default '09XX XXX XXXX';
alter table settings add column if not exists gcash_account_name text not null default 'Set in Admin Settings';
alter table settings add column if not exists gcash_qr_code_url text not null default '';
alter table settings add column if not exists open_play_enabled boolean not null default false;
alter table settings add column if not exists open_play_schedule_type text not null default 'specific';
alter table settings add column if not exists open_play_recurring_days jsonb not null default '[]';
alter table settings add column if not exists open_play_recurring_start_date date;
alter table settings add column if not exists open_play_recurring_end_date date;
alter table settings add column if not exists open_play_start_time time not null default '18:00';
alter table settings add column if not exists open_play_end_time time not null default '23:00';
alter table settings add column if not exists open_play_price numeric(10, 2) not null default 50;
alter table settings add column if not exists open_play_player_limit integer not null default 16;
alter table settings add column if not exists open_play_block_bookings boolean not null default true;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'settings_open_play_schedule_type_check') then
    alter table settings add constraint settings_open_play_schedule_type_check
      check (open_play_schedule_type in ('specific', 'recurring'));
  end if;
end $$;

insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- open_play_sessions — each Open Play date/time is its own row, whether it
-- came from a single "specific date" or was generated from a recurring
-- weekly schedule. Editing/cancelling one session never touches another.
-- ---------------------------------------------------------------------------
create table if not exists open_play_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  start_time time not null,
  end_time time not null,
  price_per_player numeric(10, 2) not null,
  player_limit integer not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  source text not null default 'specific' check (source in ('specific', 'recurring')),
  created_at timestamptz not null default now()
);

create index if not exists open_play_sessions_date_idx on open_play_sessions (session_date);

-- ---------------------------------------------------------------------------
-- open_play_registrations — who joined which session. Contains customer PII
-- (name, mobile), so it is not publicly readable; see the public counts
-- view below for what the customer-facing page is allowed to see.
-- ---------------------------------------------------------------------------
create table if not exists open_play_registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references open_play_sessions (id) on delete cascade,
  player_name text not null,
  mobile_number text not null,
  created_at timestamptz not null default now()
);

create index if not exists open_play_registrations_session_idx on open_play_registrations (session_id);

-- Public, PII-free registration counts per session (customers need "8/16
-- registered" without being able to read other players' names/numbers).
create or replace view open_play_registration_counts as
  select session_id, count(*) as registered_count
  from open_play_registrations
  group by session_id;

-- ---------------------------------------------------------------------------
-- Public availability view — exposes only what's needed to compute open
-- slots (no customer PII) so the booking widget can query it as `anon`.
-- ---------------------------------------------------------------------------
create or replace view public_availability as
  select booking_date, start_time, end_time, status
  from bookings
  where status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- RPC: look up a single booking by reference + mobile number, for the
-- "View My Booking" page. Runs as SECURITY DEFINER so anon can call it
-- without being granted general SELECT on bookings.
-- ---------------------------------------------------------------------------
create or replace function get_booking_by_reference(p_reference text, p_mobile text)
returns setof bookings
language sql
security definer
set search_path = public
as $$
  select *
  from bookings
  where upper(booking_reference) = upper(trim(p_reference))
    and replace(replace(mobile_number, ' ', ''), '-', '') = replace(replace(trim(p_mobile), ' ', ''), '-', '');
$$;

revoke all on function get_booking_by_reference(text, text) from public;
grant execute on function get_booking_by_reference(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table bookings enable row level security;
alter table blocked_slots enable row level security;
alter table settings enable row level security;
alter table promo_codes enable row level security;

-- promo_codes: never publicly readable — customers only ever see promo
-- effects through the preview_promo_code RPC and the narrow promo_banner
-- view above, never the raw table (max uses, per-customer limits, etc. stay
-- internal). Only authenticated admins can read or manage the full table.
drop policy if exists "admins can view promo codes" on promo_codes;
create policy "admins can view promo codes" on promo_codes
  for select to authenticated
  using (true);

drop policy if exists "admins can manage promo codes" on promo_codes;
create policy "admins can manage promo codes" on promo_codes
  for all to authenticated
  using (true)
  with check (true);

-- bookings: customers can create bookings, but cannot read/update/delete
-- them directly (they use public_availability + the RPC above instead).
-- Only authenticated admins can read/manage the full table.
drop policy if exists "anon can create bookings" on bookings;
create policy "anon can create bookings" on bookings
  for insert to anon, authenticated
  with check (true);

drop policy if exists "admins can view bookings" on bookings;
create policy "admins can view bookings" on bookings
  for select to authenticated
  using (true);

drop policy if exists "admins can update bookings" on bookings;
create policy "admins can update bookings" on bookings
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists "admins can delete bookings" on bookings;
create policy "admins can delete bookings" on bookings
  for delete to authenticated
  using (true);

-- blocked_slots: publicly readable (needed for availability calculation),
-- only admins can manage them.
drop policy if exists "anyone can view blocked slots" on blocked_slots;
create policy "anyone can view blocked slots" on blocked_slots
  for select to anon, authenticated
  using (true);

drop policy if exists "admins can manage blocked slots" on blocked_slots;
create policy "admins can manage blocked slots" on blocked_slots
  for all to authenticated
  using (true)
  with check (true);

-- settings: publicly readable (rates, hours, contact info shown on the
-- website), only admins can insert/update. INSERT is required (in addition
-- to UPDATE) because Admin Settings saves via upsert, which creates the
-- id = 1 row on first save if the seed insert above never ran.
drop policy if exists "anyone can view settings" on settings;
create policy "anyone can view settings" on settings
  for select to anon, authenticated
  using (true);

drop policy if exists "admins can insert settings" on settings;
create policy "admins can insert settings" on settings
  for insert to authenticated
  with check (id = 1);

drop policy if exists "admins can update settings" on settings;
create policy "admins can update settings" on settings
  for update to authenticated
  using (true)
  with check (true);

grant select on public_availability to anon, authenticated;

-- open_play_sessions: publicly readable (no PII — customers need to see the
-- schedule), only admins can create/edit/cancel sessions.
alter table open_play_sessions enable row level security;

drop policy if exists "anyone can view open play sessions" on open_play_sessions;
create policy "anyone can view open play sessions" on open_play_sessions
  for select to anon, authenticated
  using (true);

drop policy if exists "admins can manage open play sessions" on open_play_sessions;
create policy "admins can manage open play sessions" on open_play_sessions
  for all to authenticated
  using (true)
  with check (true);

-- open_play_registrations: contains PII, so only admins can read the full
-- list (used by "View Players"). Anyone can register (customers joining
-- from the public site) or be manually added by an admin; only admins can
-- remove a registration.
alter table open_play_registrations enable row level security;

drop policy if exists "admins can view open play registrations" on open_play_registrations;
create policy "admins can view open play registrations" on open_play_registrations
  for select to authenticated
  using (true);

drop policy if exists "anyone can register for open play" on open_play_registrations;
create policy "anyone can register for open play" on open_play_registrations
  for insert to anon, authenticated
  with check (true);

drop policy if exists "admins can remove open play registrations" on open_play_registrations;
create policy "admins can remove open play registrations" on open_play_registrations
  for delete to authenticated
  using (true);

grant select on open_play_registration_counts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Base table grants
--
-- IMPORTANT: RLS policies only ever *restrict* access — Postgres still
-- requires the ordinary table-level GRANT before a role can touch a table at
-- all, RLS or not. Supabase projects usually pre-grant this automatically for
-- anon/authenticated on new tables, but that isn't guaranteed for every
-- project/table, and a missing grant fails with "permission denied" (or, for
-- INSERT, sometimes surfaces as a confusing RLS-violation error) even though
-- every policy above is correct. These grants mirror the policies exactly —
-- each one only *unlocks* what its matching policy already allows.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on bookings to authenticated;
grant insert on bookings to anon;

grant select, insert, update, delete on blocked_slots to authenticated;
grant select on blocked_slots to anon;

grant select, insert, update, delete on settings to authenticated;
grant select on settings to anon;

grant select, insert, update, delete on open_play_sessions to authenticated;
grant select on open_play_sessions to anon;

grant select, insert, delete on open_play_registrations to authenticated;
grant insert on open_play_registrations to anon;

grant select, insert, update, delete on promo_codes to authenticated;
-- promo_codes has no anon grant at all — never publicly readable/writable.

-- ---------------------------------------------------------------------------
-- Admin access
-- ---------------------------------------------------------------------------
-- Create your admin user under Supabase Dashboard → Authentication → Users
-- (email + password). Any authenticated user counts as an admin under the
-- policies above — for a multi-admin setup with different roles, extend
-- these policies with a dedicated `admins` table or custom claims.
