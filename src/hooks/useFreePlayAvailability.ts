import { useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { store } from '../lib/store'
import { formatTimeRange12h, rangesOverlap, timeToMinutes, todayISO } from '../lib/time'
import type { AvailabilityRow } from '../lib/store/types'
import type { BlockedSlot, OpenPlaySession } from '../types'

/** Free Play runs 2 PM - 5 PM: three fixed one-hour blocks. */
const FREE_PLAY_START_HOUR = 14
const FREE_PLAY_END_HOUR = 17
const FREE_PLAY_START_MIN = FREE_PLAY_START_HOUR * 60
const FREE_PLAY_END_MIN = FREE_PLAY_END_HOUR * 60

export interface FreePlaySlot {
  startTime: string
  endTime: string
  label: string
  free: boolean
}

export type FreePlayPhase = 'before' | 'during' | 'after'

export interface FreePlayDay {
  date: string
  slots: FreePlaySlot[]
  anyFree: boolean
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Same "is this range already taken" check the booking widget uses when
 *  re-validating right before submit (bookings + blocked slots + Open Play,
 *  when Open Play is configured to block regular bookings) — reimplemented
 *  narrowly here rather than imported, since this only ever needs a yes/no
 *  per fixed hour block, not the full available-start-hours computation. */
function isRangeBooked(
  startMin: number,
  endMin: number,
  bookings: AvailabilityRow[],
  blockedForDate: Array<{ startMin: number; endMin: number }>,
  openPlaySessions: OpenPlaySession[],
): boolean {
  const bookingConflict = bookings.some(
    (r) => r.status !== 'cancelled' && rangesOverlap(startMin, endMin, timeToMinutes(r.startTime), timeToMinutes(r.endTime)),
  )
  if (bookingConflict) return true

  const blockedConflict = blockedForDate.some((b) => rangesOverlap(startMin, endMin, b.startMin, b.endMin))
  if (blockedConflict) return true

  return openPlaySessions.some((s) => rangesOverlap(startMin, endMin, timeToMinutes(s.startTime), timeToMinutes(s.endTime)))
}

async function loadFreePlayDay(
  date: string,
  openPlayBlockBookings: boolean,
  openingTime: string,
  closingTime: string,
): Promise<FreePlayDay> {
  const [bookings, allBlocked, openPlaySessions] = await Promise.all([
    store.getAvailabilityForDate(date),
    store.listBlockedSlots(),
    openPlayBlockBookings ? store.getOpenPlaySessionsForDate(date) : Promise.resolve([] as OpenPlaySession[]),
  ])

  const blockedForDate = (allBlocked as BlockedSlot[])
    .filter((b) => b.date === date)
    .map((b) => ({
      startMin: timeToMinutes(b.allDay ? openingTime : b.startTime),
      endMin: timeToMinutes(b.allDay ? closingTime : b.endTime),
    }))

  const slots: FreePlaySlot[] = []
  for (let hour = FREE_PLAY_START_HOUR; hour < FREE_PLAY_END_HOUR; hour++) {
    const startTime = `${String(hour).padStart(2, '0')}:00`
    const endTime = `${String(hour + 1).padStart(2, '0')}:00`
    const booked = isRangeBooked(hour * 60, (hour + 1) * 60, bookings, blockedForDate, openPlaySessions)
    slots.push({ startTime, endTime, label: formatTimeRange12h(startTime, endTime), free: !booked })
  }

  return { date, slots, anyFree: slots.some((s) => s.free) }
}

/** Drives the public "Free Play" homepage section: automatically computes
 *  today's 2 PM-5 PM availability from the existing bookings/blocked-slots/
 *  Open Play data — never creates or modifies any booking, purely a read. */
export function useFreePlayAvailability() {
  const { settings } = useSettings()
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState<FreePlayDay | null>(null)
  const [tomorrow, setTomorrow] = useState<FreePlayDay | null>(null)
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  // Keep "now" fresh so the section transitions between before/during/after
  // phases (and drops elapsed slots during the window) without a page reload.
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const todayDate = todayISO()
    const tomorrowDate = addDaysISO(todayDate, 1)

    Promise.all([
      loadFreePlayDay(todayDate, settings.openPlayBlockBookings, settings.openingTime, settings.closingTime),
      // Tomorrow's preview is only ever shown after today's window has ended —
      // fetched unconditionally here since it's cheap and keeps the hook simple.
      loadFreePlayDay(tomorrowDate, settings.openPlayBlockBookings, settings.openingTime, settings.closingTime),
    ])
      .then(([t, tmr]) => {
        if (cancelled) return
        setToday(t)
        setTomorrow(tmr)
      })
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [settings.openPlayBlockBookings, settings.openingTime, settings.closingTime, nowMinutes])

  const phase: FreePlayPhase = nowMinutes < FREE_PLAY_START_MIN ? 'before' : nowMinutes < FREE_PLAY_END_MIN ? 'during' : 'after'

  // During the window, only show slots that haven't fully elapsed yet.
  const visibleSlots =
    today && phase === 'during'
      ? today.slots.filter((s) => timeToMinutes(s.endTime) > nowMinutes)
      : today?.slots ?? []
  const anyFreeVisible = visibleSlots.some((s) => s.free)

  return { loading, phase, today, tomorrow, visibleSlots, anyFreeVisible }
}
