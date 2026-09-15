import { useCallback, useEffect, useState } from 'react'
import { store } from '../lib/store'
import { listSavedBookingRefs, onMyBookingsChanged, removeSavedBookingRef, saveBookingRef } from '../lib/myBookings'
import { todayISO } from '../lib/time'
import type { Booking } from '../types'

/** Drives the persistent "My Booking" homepage section. Only a reference +
 *  access token ever lives in localStorage (see lib/myBookings.ts) — every
 *  render re-fetches the actual booking data fresh from Supabase, so an
 *  admin status/payment change is reflected the next time the customer
 *  opens the site, without the browser ever caching stale details. */
export function useMyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const refs = listSavedBookingRefs()
    if (refs.length === 0) {
      setBookings([])
      return
    }
    const results = await Promise.all(
      refs.map(async (ref) => {
        try {
          return await store.getBookingByToken(ref.accessToken)
        } catch {
          return null
        }
      }),
    )
    // A ref whose booking can no longer be found (deleted, or a stale/
    // corrupted entry) is pruned from local storage rather than kept around
    // forever failing silently on every future visit.
    results.forEach((booking, i) => {
      if (!booking) removeSavedBookingRef(refs[i].reference)
    })
    setBookings(results.filter((b): b is Booking => b !== null))
  }, [])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  // Picks up a booking saved by another component on the same page (e.g.
  // the booking widget completing a fresh booking) without a full reload.
  useEffect(() => onMyBookingsChanged(() => refresh()), [refresh])

  /** Call after a successful booking creation or manual "Find My Booking"
   *  lookup — persists the identifier and adds the full booking (already in
   *  hand, no extra fetch needed) straight into the visible list. */
  const rememberBooking = useCallback((booking: Booking) => {
    saveBookingRef({ reference: booking.bookingReference, accessToken: booking.accessToken, bookingDate: booking.bookingDate })
    setBookings((prev) => [booking, ...prev.filter((b) => b.bookingReference !== booking.bookingReference)])
  }, [])

  const today = todayISO()
  const upcoming = bookings
    .filter((b) => b.bookingDate >= today)
    .sort((a, b) => (a.bookingDate === b.bookingDate ? a.startTime.localeCompare(b.startTime) : a.bookingDate.localeCompare(b.bookingDate)))
  const past = bookings
    .filter((b) => b.bookingDate < today)
    .sort((a, b) => (a.bookingDate === b.bookingDate ? b.startTime.localeCompare(a.startTime) : b.bookingDate.localeCompare(a.bookingDate)))

  return { loading, upcoming, past, refresh, rememberBooking }
}
