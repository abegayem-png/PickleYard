# 24/7 Pickleball Play — Booking Website

A mobile-first booking website for a pickleball court business. Customers can check
rates, pick a date/time, and submit a booking request in under a minute. Includes a
password-protected admin dashboard for managing bookings, pricing, hours, and content.

**Stack:** React + TypeScript + Tailwind CSS v4 + React Router + Supabase (optional).

## Getting started

```bash
npm install
npm run dev
```

The app works immediately with **no setup** — if Supabase credentials aren't
configured, it automatically falls back to a `localStorage`-backed data store, so the
full booking + admin flow is testable out of the box.

- Site: http://localhost:5173
- Admin: http://localhost:5173/admin/login (default password in demo mode: `admin123`
  — change it under Admin → Settings)

## Connecting Supabase (recommended for production)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) — it creates the
   `bookings`, `blocked_slots`, and `settings` tables, a public availability view, a
   booking-lookup RPC, and Row Level Security policies.
3. Under **Authentication → Users**, create an admin user (email + password). Any
   authenticated user is treated as an admin by the RLS policies.
4. Copy `.env.example` to `.env` and fill in your project URL and anon key:
   ```bash
   cp .env.example .env
   ```
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxx
   ```
5. Restart the dev server. The admin login screen will now ask for an email
   (Supabase Auth) instead of the demo password.

Once real bookings exist, update the rates, hours, contact info, and location from
**Admin → Settings** — nothing about pricing or hours is hardcoded in the UI.

## Project structure

```
src/
  types.ts                  Domain types + default settings
  lib/
    time.ts                 Date/time formatting helpers
    pricing.ts               Hourly rate engine + slot availability logic
    supabaseClient.ts        Supabase client (no-op if unconfigured)
    store/                   Data access layer
      types.ts               DataStore interface
      localStore.ts           localStorage-backed implementation (demo/dev)
      supabaseStore.ts        Supabase-backed implementation (production)
  context/
    SettingsContext.tsx      Business settings (rates, hours, contact, etc.)
    AdminAuthContext.tsx     Admin session (Supabase Auth or demo password)
  hooks/
    useBookingFlow.ts        Multi-step booking wizard state machine
    useAdminData.ts          Admin bookings/blocked-slots data + actions
  components/
    ui/                      Button, Card, Badge primitives
    layout/                  Header, Footer, sticky mobile "Book Now" bar
    booking/                 Booking widget + calendar + step components
    home/                    Homepage sections
    admin/                   Admin-only components (e.g. BookingRow)
  pages/                     Route-level pages, including pages/admin/*
supabase/
  schema.sql                 Tables, view, RPC, and RLS policies
```

## Pricing logic

Rates are computed hour-by-hour from **Admin → Settings**:

- Hours inside `daytimeStart`–`daytimeEnd` bill at the daytime rate.
- Hours inside `nighttimeStart`–`nighttimeEnd` bill at the night rate.
- Any gap between the two (e.g. 5–6 PM if daytime ends at 5 and night starts at 6) is
  **not bookable** unless the admin turns on "Allow bookings during the gap" and sets a
  gap rate. A multi-hour booking that would cross a disabled gap hour is rejected the
  same way.
- A booking that spans daytime and night hours is billed per hour at each hour's rate
  (see the summary step's per-hour breakdown for mixed-rate bookings).

See `src/lib/pricing.ts` for the implementation.

## Notes on the admin password (demo mode)

When Supabase isn't configured, the admin dashboard is protected by a single shared
password stored in Settings (client-side check only — adequate for a quick demo, not a
production secret). Connecting Supabase switches admin login to real Supabase Auth,
with Row Level Security enforcing that only authenticated admins can read/write
bookings, settings, and blocked slots server-side.

## Deploying to Vercel

1. Push this project to a GitHub repo.
2. Import it in [Vercel](https://vercel.com/new).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the
   Vercel project settings (Production + Preview).
4. Deploy — Vercel auto-detects the Vite build (`npm run build`, output `dist/`).
