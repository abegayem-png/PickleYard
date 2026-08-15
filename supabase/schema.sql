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
  total_amount numeric(10, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  payment_method text not null default 'cash' check (payment_method in ('gcash', 'cash')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists bookings_date_idx on bookings (booking_date);
create index if not exists bookings_reference_idx on bookings (booking_reference);

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
-- Admin access
-- ---------------------------------------------------------------------------
-- Create your admin user under Supabase Dashboard → Authentication → Users
-- (email + password). Any authenticated user counts as an admin under the
-- policies above — for a multi-admin setup with different roles, extend
-- these policies with a dedicated `admins` table or custom claims.
