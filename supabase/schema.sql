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
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'verified', 'rejected')),
  payment_method text not null default 'cash' check (payment_method in ('gcash', 'cash')),
  -- Private Storage object path (production) or data URL (demo mode) of the
  -- customer's uploaded GCash screenshot — never a public URL. Resolved to a
  -- viewable image only for authenticated admins, via a signed URL.
  payment_proof_url text,
  payment_verified_at timestamptz,
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

-- GCash manual payment verification (screenshot upload + admin review).
-- payment_status gains 'pending'/'rejected' alongside the original
-- 'unpaid'/'paid' — existing 'paid' rows are remapped to 'verified' (same
-- meaning, new name) before the constraint is tightened, so no existing
-- booking's payment state is lost or reinterpreted.
alter table bookings add column if not exists payment_proof_url text;
alter table bookings add column if not exists payment_verified_at timestamptz;
update bookings set payment_status = 'verified' where payment_status = 'paid';
alter table bookings drop constraint if exists bookings_payment_status_check;
alter table bookings add constraint bookings_payment_status_check
  check (payment_status in ('unpaid', 'pending', 'verified', 'rejected'));

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

-- ---------------------------------------------------------------------------
-- create_booking — the only way any client (customer or admin) creates a
-- booking. SECURITY DEFINER so it can insert into `bookings` and return the
-- new row without the caller needing any direct table grant: `anon` gets no
-- SELECT on `bookings` (customers must never read other people's bookings),
-- and `.insert().select()` from the client would otherwise fail because
-- returning the inserted row requires read access under RLS. Routing
-- creation through one function is also a single, auditable place to enforce
-- validation instead of trusting whatever a direct table insert contained.
-- Pricing/promo fields are intentionally not parameters — the
-- trg_set_booking_pricing trigger above computes them authoritatively.
-- ---------------------------------------------------------------------------
create or replace function create_booking(
  p_customer_name text,
  p_mobile_number text,
  p_email text,
  p_number_of_players integer,
  p_booking_date date,
  p_start_time time,
  p_duration integer,
  p_notes text,
  p_payment_method text,
  p_promo_code text
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  new_booking bookings;
begin
  insert into bookings (
    customer_name, mobile_number, email, number_of_players,
    booking_date, start_time, end_time, duration,
    notes, payment_method, promo_code,
    rate_breakdown, total_amount
  ) values (
    p_customer_name, p_mobile_number, p_email, p_number_of_players,
    p_booking_date, p_start_time, p_start_time, p_duration,
    p_notes, p_payment_method, p_promo_code,
    '[]'::jsonb, 0
  )
  returning * into new_booking;

  return new_booking;
end;
$$;

revoke all on function create_booking(text, text, text, integer, date, time, integer, text, text, text) from public;
grant execute on function create_booking(text, text, text, integer, date, time, integer, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- GCash manual payment: submit / verify / reject.
-- submit_booking_payment_proof is the only way a customer attaches a payment
-- screenshot to their own booking — SECURITY DEFINER so it can update
-- `bookings` without anon needing any direct grant. Ownership is proven by
-- knowing both the booking id and its mobile number, the same pairing
-- get_booking_by_reference already relies on, so a guessed/enumerated id
-- alone isn't enough.
-- ---------------------------------------------------------------------------
create or replace function submit_booking_payment_proof(
  p_booking_id uuid,
  p_mobile_number text,
  p_proof_path text
)
returns table (success boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  b bookings;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found then
    return query select false, 'Booking not found.';
    return;
  end if;
  if replace(replace(b.mobile_number, ' ', ''), '-', '') <> replace(replace(trim(p_mobile_number), ' ', ''), '-', '') then
    return query select false, 'Booking not found.';
    return;
  end if;
  if b.payment_method <> 'gcash' then
    return query select false, 'This booking does not use GCash payment.';
    return;
  end if;
  if b.payment_status = 'verified' then
    return query select false, 'This booking has already been paid and verified.';
    return;
  end if;
  if p_proof_path is null or length(trim(p_proof_path)) = 0 then
    return query select false, 'Please upload a payment screenshot.';
    return;
  end if;

  update bookings
  set payment_status = 'pending', payment_proof_url = p_proof_path, payment_verified_at = null
  where id = p_booking_id;

  return query select true, null::text;
end;
$$;

revoke all on function submit_booking_payment_proof(uuid, text, text) from public;
grant execute on function submit_booking_payment_proof(uuid, text, text) to anon, authenticated;

-- Admin-only: authenticated already has full UPDATE on bookings via the
-- "admins can update bookings" RLS policy below, so these run as the caller
-- (no SECURITY DEFINER needed) — they just bundle "verify payment" + "confirm
-- the booking if it was still pending" into one atomic statement.
create or replace function verify_booking_payment(p_booking_id uuid)
returns bookings
language plpgsql
set search_path = public
as $$
declare
  b bookings;
begin
  update bookings
  set payment_status = 'verified',
      payment_verified_at = now(),
      status = case when status = 'pending' then 'confirmed' else status end
  where id = p_booking_id
  returning * into b;
  if not found then
    raise exception 'Booking not found.';
  end if;
  return b;
end;
$$;

revoke all on function verify_booking_payment(uuid) from public;
grant execute on function verify_booking_payment(uuid) to authenticated;

create or replace function reject_booking_payment(p_booking_id uuid)
returns bookings
language plpgsql
set search_path = public
as $$
declare
  b bookings;
begin
  update bookings
  set payment_status = 'rejected', payment_verified_at = null
  where id = p_booking_id
  returning * into b;
  if not found then
    raise exception 'Booking not found.';
  end if;
  return b;
end;
$$;

revoke all on function reject_booking_payment(uuid) from public;
grant execute on function reject_booking_payment(uuid) to authenticated;

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
  facebook_name text,
  created_at timestamptz not null default now()
);

-- Defensive guard in case this table already existed from an earlier,
-- partial version of this script — safe no-op if the column is present.
alter table open_play_registrations add column if not exists facebook_name text;

create index if not exists open_play_registrations_session_idx on open_play_registrations (session_id);

-- Public, PII-free registration counts per session (customers need "8/16
-- registered" without being able to read other players' names/numbers).
create or replace view open_play_registration_counts as
  select session_id, count(*) as registered_count
  from open_play_registrations
  group by session_id;

-- ---------------------------------------------------------------------------
-- register_open_play — the only way any client (customer or admin) joins an
-- Open Play session. SECURITY DEFINER so it can insert into
-- open_play_registrations without the caller needing SELECT on that table
-- (which holds player name/mobile/Facebook name — no customer should ever
-- read another customer's). Locks the session row for the duration of the
-- check-then-insert so two simultaneous joins can't both slip in over the
-- player limit. Returns only non-sensitive fields — never the roster.
-- ---------------------------------------------------------------------------
create or replace function register_open_play(
  p_session_id uuid,
  p_player_name text,
  p_mobile_number text,
  p_facebook_name text
)
returns table (
  success boolean,
  reason text,
  registration_id uuid,
  registered_count integer,
  remaining_slots integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  sess record;
  current_count integer;
  new_id uuid;
begin
  select * into sess from open_play_sessions where id = p_session_id for update;

  if not found then
    return query select false, 'This Open Play session could not be found.', null::uuid, 0, 0;
    return;
  end if;

  if sess.status <> 'scheduled' then
    return query select false, 'This Open Play session is no longer open for registration.', null::uuid, 0, 0;
    return;
  end if;

  if p_player_name is null or length(trim(p_player_name)) = 0
     or p_mobile_number is null or length(trim(p_mobile_number)) = 0 then
    return query select false, 'Name and mobile number are required.', null::uuid, 0, 0;
    return;
  end if;

  select count(*) into current_count from open_play_registrations where session_id = p_session_id;

  if current_count >= sess.player_limit then
    return query select false, 'This session is full.', null::uuid, current_count, 0;
    return;
  end if;

  insert into open_play_registrations (session_id, player_name, mobile_number, facebook_name)
  values (p_session_id, trim(p_player_name), trim(p_mobile_number), nullif(trim(coalesce(p_facebook_name, '')), ''))
  returning id into new_id;

  current_count := current_count + 1;

  return query select true, null::text, new_id, current_count, greatest(sess.player_limit - current_count, 0);
end;
$$;

revoke all on function register_open_play(uuid, text, text, text) from public;
grant execute on function register_open_play(uuid, text, text, text) to anon, authenticated;

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

-- bookings: nobody gets a direct INSERT policy — all creation (customer and
-- admin alike) goes through the create_booking() SECURITY DEFINER function
-- above, which bypasses RLS internally instead of needing one. Customers
-- cannot read/update/delete rows directly either (they use
-- public_availability + get_booking_by_reference() instead). Only
-- authenticated admins can read/manage the full table.
drop policy if exists "anon can create bookings" on bookings;

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
-- list (used by "View Players"). Nobody gets a direct INSERT policy —
-- joining (customer or admin-added) goes through register_open_play()
-- above, which bypasses RLS internally instead of needing one. Only admins
-- can remove a registration.
alter table open_play_registrations enable row level security;

drop policy if exists "admins can view open play registrations" on open_play_registrations;
create policy "admins can view open play registrations" on open_play_registrations
  for select to authenticated
  using (true);

drop policy if exists "anyone can register for open play" on open_play_registrations;

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
-- No INSERT grant for anon or authenticated: all booking creation goes
-- through create_booking(), a SECURITY DEFINER function that inserts
-- internally regardless of the caller's own table grants.
grant select, update, delete on bookings to authenticated;

grant select, insert, update, delete on blocked_slots to authenticated;
grant select on blocked_slots to anon;

grant select, insert, update, delete on settings to authenticated;
grant select on settings to anon;

grant select, insert, update, delete on open_play_sessions to authenticated;
grant select on open_play_sessions to anon;

-- No INSERT grant for anon or authenticated: all Open Play registration
-- goes through register_open_play(), which inserts internally regardless
-- of the caller's own table grants.
grant select, delete on open_play_registrations to authenticated;

grant select, insert, update, delete on promo_codes to authenticated;
-- promo_codes has no anon grant at all — never publicly readable/writable.

-- ---------------------------------------------------------------------------
-- mini_mart_items — a separate, self-contained product menu (food/snacks/
-- drinks/court essentials) for the public /mini-mart page. No relation to
-- bookings/Open Play/promo codes: no shared tables, no shared policies. No
-- customer PII is ever stored here (orders aren't persisted — customers just
-- show their phone to staff), so this table is safe to read publicly in full.
-- ---------------------------------------------------------------------------
create table if not exists mini_mart_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null,
  category text not null check (category in ('food', 'snacks', 'drinks', 'court_essentials')),
  image_url text not null default '',
  is_available boolean not null default true,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Defensive guard in case this table already existed from an earlier,
-- partial version of this script — safe no-op if the column is present.
alter table mini_mart_items add column if not exists stock_quantity integer not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mini_mart_items_stock_quantity_check') then
    alter table mini_mart_items add constraint mini_mart_items_stock_quantity_check check (stock_quantity >= 0);
  end if;
end $$;

create index if not exists mini_mart_items_category_idx on mini_mart_items (category);

create or replace function touch_mini_mart_item_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_mini_mart_item on mini_mart_items;
create trigger trg_touch_mini_mart_item
  before update on mini_mart_items
  for each row execute function touch_mini_mart_item_updated_at();

alter table mini_mart_items enable row level security;

-- Publicly readable (including sold-out items, so the page can show them
-- faded rather than hiding them) — only admins can add/edit/delete.
drop policy if exists "anyone can view mini mart items" on mini_mart_items;
create policy "anyone can view mini mart items" on mini_mart_items
  for select to anon, authenticated
  using (true);

drop policy if exists "admins can manage mini mart items" on mini_mart_items;
create policy "admins can manage mini mart items" on mini_mart_items
  for all to authenticated
  using (true)
  with check (true);

grant select on mini_mart_items to anon;
grant select, insert, update, delete on mini_mart_items to authenticated;

-- Atomic relative stock adjustment for the admin's quick +1/+5/-1/-5
-- buttons — updates `stock_quantity + p_delta` directly on the row rather
-- than the client reading a value and writing it back, so it can't clobber
-- a concurrent change (e.g. a customer order landing between the admin's
-- last fetch and their click). Clamped at 0. Admin-only.
create or replace function adjust_mini_mart_stock(p_item_id uuid, p_delta integer)
returns integer
language sql
security definer
set search_path = public
as $$
  update mini_mart_items
  set stock_quantity = greatest(0, stock_quantity + p_delta)
  where id = p_item_id
  returning stock_quantity;
$$;

revoke all on function adjust_mini_mart_stock(uuid, integer) from public;
grant execute on function adjust_mini_mart_stock(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for product photos. Public read (photos are shown on the
-- public menu), admin-only write. Scoped entirely to this one bucket, so it
-- can't affect any other Storage bucket this project may have.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('mini-mart-images', 'mini-mart-images', true)
on conflict (id) do nothing;

drop policy if exists "public can view mini mart images" on storage.objects;
create policy "public can view mini mart images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'mini-mart-images');

drop policy if exists "admins can manage mini mart images" on storage.objects;
create policy "admins can manage mini mart images" on storage.objects
  for all to authenticated
  using (bucket_id = 'mini-mart-images')
  with check (bucket_id = 'mini-mart-images');

-- ---------------------------------------------------------------------------
-- Storage bucket for the admin's GCash QR code. Public read (every customer
-- needs to see it to pay), admin-only write — same shape as mini-mart-images.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-settings', 'payment-settings', true)
on conflict (id) do nothing;

drop policy if exists "public can view payment settings images" on storage.objects;
create policy "public can view payment settings images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'payment-settings');

drop policy if exists "admins can manage payment settings images" on storage.objects;
create policy "admins can manage payment settings images" on storage.objects
  for all to authenticated
  using (bucket_id = 'payment-settings')
  with check (bucket_id = 'payment-settings');

-- ---------------------------------------------------------------------------
-- Storage bucket for customer-uploaded GCash payment screenshots. PRIVATE —
-- unlike the two buckets above, nobody gets a public-read policy here: a
-- payment screenshot can contain personal info, so only an authenticated
-- admin may read it back (via a signed URL, itself gated by the SELECT
-- policy below). Anon can INSERT (customers have no login) but never SELECT,
-- UPDATE, or DELETE — so even someone holding another customer's object path
-- can't read or tamper with it, only the admin dashboard can.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "anyone can upload payment proofs" on storage.objects;
create policy "anyone can upload payment proofs" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'payment-proofs');

drop policy if exists "admins can view payment proofs" on storage.objects;
create policy "admins can view payment proofs" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs');

drop policy if exists "admins can delete payment proofs" on storage.objects;
create policy "admins can delete payment proofs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs');

-- ---------------------------------------------------------------------------
-- mini_mart_orders / mini_mart_order_items — customer orders placed without
-- login. Contains customer PII (name), so — same pattern as bookings/Open
-- Play — anon gets no direct SELECT/INSERT: all customer interaction goes
-- through place_mini_mart_order()/get_mini_mart_order_status() below.
-- ---------------------------------------------------------------------------
create sequence if not exists mini_mart_order_number_seq start 1000;

create table if not exists mini_mart_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  -- Nullable and unused by the app going forward (checkout no longer asks
  -- for it) — kept only so any existing rows/data aren't lost.
  court_location text,
  notes text,
  status text not null default 'new' check (status in ('awaiting_payment', 'new', 'preparing', 'ready', 'completed', 'cancelled')),
  total numeric(10, 2) not null,
  payment_method text not null default 'cash' check (payment_method in ('gcash', 'cash')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'verified', 'rejected')),
  payment_proof_url text,
  payment_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Defensive guards in case `mini_mart_orders` already existed from an
-- earlier, partial version of this script.
alter table mini_mart_orders add column if not exists payment_method text not null default 'cash';
alter table mini_mart_orders add column if not exists payment_status text not null default 'unpaid';
alter table mini_mart_orders add column if not exists payment_proof_url text;
alter table mini_mart_orders add column if not exists payment_verified_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mini_mart_orders_payment_method_check') then
    alter table mini_mart_orders add constraint mini_mart_orders_payment_method_check
      check (payment_method in ('gcash', 'cash'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mini_mart_orders_payment_status_check') then
    alter table mini_mart_orders add constraint mini_mart_orders_payment_status_check
      check (payment_status in ('unpaid', 'pending', 'verified', 'rejected'));
  end if;
end $$;
alter table mini_mart_orders drop constraint if exists mini_mart_orders_status_check;
alter table mini_mart_orders add constraint mini_mart_orders_status_check
  check (status in ('awaiting_payment', 'new', 'preparing', 'ready', 'completed', 'cancelled'));

create index if not exists mini_mart_orders_status_idx on mini_mart_orders (status);
create index if not exists mini_mart_orders_created_at_idx on mini_mart_orders (created_at desc);

create or replace function set_mini_mart_order_number() returns trigger as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'PY-' || nextval('mini_mart_order_number_seq');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_mini_mart_order_number on mini_mart_orders;
create trigger trg_set_mini_mart_order_number
  before insert on mini_mart_orders
  for each row execute function set_mini_mart_order_number();

create or replace function touch_mini_mart_order_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_mini_mart_order on mini_mart_orders;
create trigger trg_touch_mini_mart_order
  before update on mini_mart_orders
  for each row execute function touch_mini_mart_order_updated_at();

create table if not exists mini_mart_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references mini_mart_orders (id) on delete cascade,
  item_id uuid references mini_mart_items (id) on delete set null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  subtotal numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists mini_mart_order_items_order_idx on mini_mart_order_items (order_id);

-- Returns an order's items to stock exactly once, the moment its status
-- actually transitions into 'cancelled'. The WHEN clause is what guarantees
-- "only once": it only fires on the transition itself, not if the order is
-- already cancelled (updating some other field, or a repeat cancel attempt)
-- and not if it was already 'completed' (no cancel path exists for that in
-- the app, but this guards the database itself rather than trusting the
-- client not to try).
create or replace function restore_mini_mart_order_stock() returns trigger as $$
begin
  update mini_mart_items m
  set stock_quantity = m.stock_quantity + oi.quantity
  from mini_mart_order_items oi
  where oi.order_id = new.id
    and oi.item_id = m.id;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_restore_mini_mart_order_stock on mini_mart_orders;
create trigger trg_restore_mini_mart_order_stock
  after update on mini_mart_orders
  for each row
  when (old.status is distinct from 'cancelled' and old.status is distinct from 'completed' and new.status = 'cancelled')
  execute function restore_mini_mart_order_stock();

-- ---------------------------------------------------------------------------
-- place_mini_mart_order — the only way a customer places an order.
-- SECURITY DEFINER so it can insert the order + line items without the
-- caller needing any direct table privilege. Prices are looked up from
-- mini_mart_items here, never trusted from the client, so a tampered
-- request can't produce a discounted or free order — same principle as
-- create_booking's pricing trigger. Stock is checked and deducted here too,
-- with each product row locked (FOR UPDATE) during validation so two
-- concurrent orders can't both buy the last unit — the second transaction
-- blocks on the lock until the first commits or rolls back, then re-reads
-- the up-to-date stock_quantity. Stock is only deducted after the order
-- itself has been inserted, inside the same transaction as everything else.
-- p_items shape: [{"item_id": "<uuid>", "quantity": 2}, ...]
--
-- Checkout no longer collects Court/Location, and now takes a payment
-- method, so this function's signature keeps changing shape. Postgres treats
-- a different argument list as a different function, so every prior version
-- is dropped explicitly rather than left behind as a second, unused way to
-- place an order.
-- ---------------------------------------------------------------------------
drop function if exists place_mini_mart_order(text, text, text, jsonb);
drop function if exists place_mini_mart_order(text, text, jsonb);

create or replace function place_mini_mart_order(
  p_customer_name text,
  p_notes text,
  p_items jsonb,
  p_payment_method text default 'cash'
)
returns table (
  success boolean,
  reason text,
  order_id uuid,
  order_number text,
  total numeric,
  status text,
  payment_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_order_id uuid;
  new_order_number text;
  computed_total numeric := 0;
  line jsonb;
  prod record;
  qty integer;
  line_subtotal numeric;
  initial_status text;
begin
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    return query select false, 'Customer name is required.', null::uuid, null::text, 0::numeric, null::text, null::text;
    return;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return query select false, 'Your cart is empty.', null::uuid, null::text, 0::numeric, null::text, null::text;
    return;
  end if;
  if p_payment_method not in ('gcash', 'cash') then
    return query select false, 'Invalid payment method.', null::uuid, null::text, 0::numeric, null::text, null::text;
    return;
  end if;

  -- Validate every line (availability + stock) and compute the authoritative
  -- total *before* inserting anything, so a bad line can't leave a partial
  -- order behind. FOR UPDATE locks each product row for the rest of this
  -- transaction.
  for line in select * from jsonb_array_elements(p_items) loop
    qty := (line->>'quantity')::integer;
    if qty is null or qty <= 0 then
      return query select false, 'Invalid item quantity.', null::uuid, null::text, 0::numeric, null::text, null::text;
      return;
    end if;

    select * into prod from mini_mart_items where id = (line->>'item_id')::uuid for update;
    if not found then
      return query select false, 'One of the items in your cart is no longer available.', null::uuid, null::text, 0::numeric, null::text, null::text;
      return;
    end if;
    if not prod.is_available then
      return query select false, format('%s is sold out.', prod.name), null::uuid, null::text, 0::numeric, null::text, null::text;
      return;
    end if;
    if prod.stock_quantity < qty then
      return query select false, format('Only %s %s left in stock.', prod.stock_quantity, prod.name), null::uuid, null::text, 0::numeric, null::text, null::text;
      return;
    end if;

    computed_total := computed_total + (prod.price * qty);
  end loop;

  -- GCash orders start life as 'awaiting_payment' — they still reserve their
  -- stock immediately below (same as a booking reserves its time slot before
  -- payment is verified) but can't proceed to 'preparing' until an admin
  -- verifies the payment. Cash orders are unaffected: 'new', same as before.
  initial_status := case when p_payment_method = 'gcash' then 'awaiting_payment' else 'new' end;

  insert into mini_mart_orders (customer_name, notes, status, total, payment_method)
  values (trim(p_customer_name), nullif(trim(coalesce(p_notes, '')), ''), initial_status, computed_total, p_payment_method)
  returning id, order_number into new_order_id, new_order_number;

  -- Only now, after the order itself exists, insert its line items and
  -- deduct stock — still inside the same transaction as the checks above.
  for line in select * from jsonb_array_elements(p_items) loop
    qty := (line->>'quantity')::integer;
    select * into prod from mini_mart_items where id = (line->>'item_id')::uuid;
    line_subtotal := prod.price * qty;
    insert into mini_mart_order_items (order_id, item_id, item_name, quantity, unit_price, subtotal)
    values (new_order_id, prod.id, prod.name, qty, prod.price, line_subtotal);

    update mini_mart_items set stock_quantity = stock_quantity - qty where id = prod.id;
  end loop;

  return query select true, null::text, new_order_id, new_order_number, computed_total, initial_status, 'unpaid'::text;
end;
$$;

revoke all on function place_mini_mart_order(text, text, jsonb, text) from public;
grant execute on function place_mini_mart_order(text, text, jsonb, text) to anon, authenticated;

-- Narrow, PII-free status lookup for "View Order Status" — a customer who
-- already has their own order number can check it, but this never returns
-- customer_name/notes/payment_proof_url, and there's no way to list orders.
-- payment_method/payment_status aren't PII, so they're safe to include here —
-- the customer needs them to know whether to show the GCash upload UI again.
create or replace function get_mini_mart_order_status(p_order_number text)
returns table (order_number text, status text, total numeric, payment_method text, payment_status text)
language sql
security definer
set search_path = public
as $$
  select order_number, status, total, payment_method, payment_status
  from mini_mart_orders where order_number = trim(p_order_number);
$$;

revoke all on function get_mini_mart_order_status(text) from public;
grant execute on function get_mini_mart_order_status(text) to anon, authenticated;

-- submit_mini_mart_payment_proof: same ownership model as
-- get_mini_mart_order_status — knowledge of the order number alone is
-- sufficient, since that's already the established bearer key for narrow,
-- non-PII actions on a customer's own just-placed order.
create or replace function submit_mini_mart_payment_proof(
  p_order_number text,
  p_proof_path text
)
returns table (success boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  o mini_mart_orders;
begin
  select * into o from mini_mart_orders where order_number = trim(p_order_number) for update;
  if not found then
    return query select false, 'Order not found.';
    return;
  end if;
  if o.payment_method <> 'gcash' then
    return query select false, 'This order does not use GCash payment.';
    return;
  end if;
  if o.payment_status = 'verified' then
    return query select false, 'This order has already been paid and verified.';
    return;
  end if;
  if p_proof_path is null or length(trim(p_proof_path)) = 0 then
    return query select false, 'Please upload a payment screenshot.';
    return;
  end if;

  update mini_mart_orders
  set payment_status = 'pending', payment_proof_url = p_proof_path, payment_verified_at = null
  where id = o.id;

  return query select true, null::text;
end;
$$;

revoke all on function submit_mini_mart_payment_proof(text, text) from public;
grant execute on function submit_mini_mart_payment_proof(text, text) to anon, authenticated;

-- Admin-only: authenticated already has full UPDATE on mini_mart_orders via
-- the "admins can update mini mart orders" RLS policy below, so these run as
-- the caller (no SECURITY DEFINER needed) — bundling "verify payment" +
-- "let the order proceed to PREPARING" (by lifting it out of
-- awaiting_payment back into the normal 'new' flow) into one statement.
create or replace function verify_mini_mart_payment(p_order_id uuid)
returns mini_mart_orders
language plpgsql
set search_path = public
as $$
declare
  o mini_mart_orders;
begin
  update mini_mart_orders
  set payment_status = 'verified',
      payment_verified_at = now(),
      status = case when status = 'awaiting_payment' then 'new' else status end
  where id = p_order_id
  returning * into o;
  if not found then
    raise exception 'Order not found.';
  end if;
  return o;
end;
$$;

revoke all on function verify_mini_mart_payment(uuid) from public;
grant execute on function verify_mini_mart_payment(uuid) to authenticated;

create or replace function reject_mini_mart_payment(p_order_id uuid)
returns mini_mart_orders
language plpgsql
set search_path = public
as $$
declare
  o mini_mart_orders;
begin
  update mini_mart_orders
  set payment_status = 'rejected', payment_verified_at = null
  where id = p_order_id
  returning * into o;
  if not found then
    raise exception 'Order not found.';
  end if;
  return o;
end;
$$;

revoke all on function reject_mini_mart_payment(uuid) from public;
grant execute on function reject_mini_mart_payment(uuid) to authenticated;

alter table mini_mart_orders enable row level security;
alter table mini_mart_order_items enable row level security;

-- No SELECT/INSERT policy for anon at all on either table — every customer
-- interaction goes through the two SECURITY DEFINER functions above.
drop policy if exists "admins can view mini mart orders" on mini_mart_orders;
create policy "admins can view mini mart orders" on mini_mart_orders
  for select to authenticated
  using (true);

drop policy if exists "admins can update mini mart orders" on mini_mart_orders;
create policy "admins can update mini mart orders" on mini_mart_orders
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists "admins can view mini mart order items" on mini_mart_order_items;
create policy "admins can view mini mart order items" on mini_mart_order_items
  for select to authenticated
  using (true);

grant select, update on mini_mart_orders to authenticated;
grant select on mini_mart_order_items to authenticated;
-- Deliberately no grants at all for anon on these two tables.

-- Realtime: let the admin dashboard receive new/updated orders live.
-- Idempotent — `alter publication ... add table` errors if run twice, so
-- this only adds it if it isn't already a member.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mini_mart_orders'
  ) then
    alter publication supabase_realtime add table mini_mart_orders;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Admin access
-- ---------------------------------------------------------------------------
-- Create your admin user under Supabase Dashboard → Authentication → Users
-- (email + password). Any authenticated user counts as an admin under the
-- policies above — for a multi-admin setup with different roles, extend
-- these policies with a dedicated `admins` table or custom claims.
