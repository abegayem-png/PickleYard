import { useCallback, useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { store } from '../lib/store'
import { getErrorMessage } from '../lib/errors'
import { formatTimeRange12h, rangesOverlap, timeToMinutes, todayISO } from '../lib/time'
import type { AvailabilityRow } from '../lib/store/types'
import type { BlockedSlot, JoinFreePlayResult, OpenPlaySession } from '../types'

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
  joinedCount: number
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
  const [bookings, allBlocked, openPlaySessions, counts] = await Promise.all([
    store.getAvailabilityForDate(date),
    store.listBlockedSlots(),
    openPlayBlockBookings ? store.getOpenPlaySessionsForDate(date) : Promise.resolve([] as OpenPlaySession[]),
    store.getFreePlaySlotCounts(date),
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
    const joinedCount = counts.find((c) => c.startTime === startTime && c.endTime === endTime)?.joinedCount ?? 0
    slots.push({ startTime, endTime, label: formatTimeRange12h(startTime, endTime), free: !booked, joinedCount })
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

  const refresh = useCallback(async () => {
    const todayDate = todayISO()
    const tomorrowDate = addDaysISO(todayDate, 1)
    const [t, tmr] = await Promise.all([
      loadFreePlayDay(todayDate, settings.openPlayBlockBookings, settings.openingTime, settings.closingTime),
      // Tomorrow's preview is only ever shown after today's window has ended —
      // fetched unconditionally here since it's cheap and keeps the hook simple.
      loadFreePlayDay(tomorrowDate, settings.openPlayBlockBookings, settings.openingTime, settings.closingTime),
    ])
    setToday(t)
    setTomorrow(tmr)
  }, [settings.openPlayBlockBookings, settings.openingTime, settings.closingTime])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refresh().finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, nowMinutes])

  const phase: FreePlayPhase = nowMinutes < FREE_PLAY_START_MIN ? 'before' : nowMinutes < FREE_PLAY_END_MIN ? 'during' : 'after'

  // During the window, only show slots that haven't fully elapsed yet.
  const visibleSlots =
    today && phase === 'during'
      ? today.slots.filter((s) => timeToMinutes(s.endTime) > nowMinutes)
      : today?.slots ?? []
  const anyFreeVisible = visibleSlots.some((s) => s.free)

  /** Joins a slot for the given date — the RPC (or its demo-mode equivalent)
   *  re-validates the slot is still actually free and re-checks for a
   *  duplicate name server-side, so this never trusts what's currently on
   *  screen. Refreshes on success so the shown count/availability stays
   *  accurate immediately, without waiting for the next 60s tick. */
  const joinSlot = useCallback(
    async (playDate: string, startTime: string, endTime: string, participantName: string): Promise<JoinFreePlayResult> => {
      try {
        const result = await store.joinFreePlay({ participantName, playDate, startTime, endTime })
        if (result.success) await refresh()
        return result
      } catch (err) {
        return { success: false, reason: getErrorMessage(err, 'Could not join Free Play. Please try again.'), participantId: null, joinedCount: 0 }
      }
    },
    [refresh],
  )

  return { loading, phase, today, tomorrow, visibleSlots, anyFreeVisible, joinSlot }
}
