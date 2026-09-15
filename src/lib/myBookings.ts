import { todayISO } from './time'

const KEY = 'pkl_my_bookings'
const MAX_ENTRIES = 25
/** Entries whose booking date is this many days in the past are dropped
 *  automatically, so the device's saved list doesn't grow forever and old
 *  bookings don't linger indefinitely — "disappear after a reasonable
 *  period" rather than requiring the customer to clean anything up. */
const PAST_RETENTION_DAYS = 60

export interface SavedBookingRef {
  reference: string
  /** The booking's access_token — the actual security key used to re-fetch
   *  full details from Supabase. Never the mobile number: this file never
   *  persists that, even though it's needed once, transiently, for a manual
   *  "Find My Booking" lookup. */
  accessToken: string
  /** Kept locally only so old entries can be pruned without a network
   *  round trip — never trusted as the actual booking date for display. */
  bookingDate: string
  savedAt: string
}

function read(): SavedBookingRef[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(list: SavedBookingRef[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage unavailable (private browsing, quota, etc.) — the "My Booking"
    // section simply won't persist across visits; nothing else depends on this.
  }
}

const CHANGE_EVENT = 'pkl:my-bookings-changed'

function notifyChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Lets any mounted "My Booking" UI react immediately when a booking is
 *  saved/removed elsewhere on the page (e.g. the booking widget just
 *  created one) — a plain window event rather than React context, since
 *  the booking widget and the My Booking section are unrelated siblings on
 *  the homepage with no other state in common. Returns an unsubscribe fn. */
export function onMyBookingsChanged(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

function cutoffDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - PAST_RETENTION_DAYS)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function listSavedBookingRefs(): SavedBookingRef[] {
  return read()
}

/** Saves (or refreshes) one booking's local identifier — called right after
 *  a successful booking, and after a successful manual "Find My Booking"
 *  lookup, so a device that finds a booking once auto-restores it from then
 *  on too. De-dupes by reference, prunes anything past the retention
 *  window, and caps the list so it can't grow without bound. */
export function saveBookingRef(entry: { reference: string; accessToken: string; bookingDate: string }) {
  const list = read().filter((e) => e.reference !== entry.reference)
  list.unshift({ ...entry, savedAt: new Date().toISOString() })
  const cutoff = cutoffDate()
  write(list.filter((e) => e.bookingDate >= cutoff).slice(0, MAX_ENTRIES))
  notifyChanged()
}

export function removeSavedBookingRef(reference: string) {
  write(read().filter((e) => e.reference !== reference))
  notifyChanged()
}

export function isUpcoming(bookingDate: string): boolean {
  return bookingDate >= todayISO()
}
