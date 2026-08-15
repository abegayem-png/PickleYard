import type { OpenPlaySession, OpenPlaySessionInput, Settings } from '../types'
import { dateToISO, todayISO } from './time'

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Monday-first display order, mapped to JS weekday indices (0=Sun..6=Sat). */
export const DISPLAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]

/** How far ahead to materialize an open-ended ("no end date") recurring schedule. */
const RECURRING_HORIZON_DAYS = 120

/**
 * Returns every YYYY-MM-DD date matching one of `weekdays` (0=Sun..6=Sat)
 * between `startDate` and `endDate` inclusive.
 */
export function generateRecurringDates(startDate: string, endDate: string, weekdays: number[]): string[] {
  if (!startDate || weekdays.length === 0) return []
  const days = new Set(weekdays)
  const dates: string[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (end < start) return []
  const cursor = new Date(start)
  while (cursor <= end) {
    if (days.has(cursor.getDay())) dates.push(dateToISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/** Resolves the effective end date for a recurring schedule that may have no end date set. */
export function resolveRecurringEndDate(settings: Settings): string {
  if (settings.openPlayRecurringEndDate) return settings.openPlayRecurringEndDate
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + RECURRING_HORIZON_DAYS)
  return dateToISO(horizon)
}

/** Builds the OpenPlaySessionInput rows a recurring schedule should have, given current settings. */
export function buildRecurringSessionInputs(settings: Settings): OpenPlaySessionInput[] {
  const startDate = settings.openPlayRecurringStartDate || todayISO()
  const endDate = resolveRecurringEndDate(settings)
  const dates = generateRecurringDates(startDate, endDate, settings.openPlayRecurringDays)
  return dates.map((sessionDate) => ({
    sessionDate,
    startTime: settings.openPlayStartTime,
    endTime: settings.openPlayEndTime,
    pricePerPlayer: settings.openPlayPrice,
    playerLimit: settings.openPlayPlayerLimit,
    source: 'recurring' as const,
  }))
}

/** Filters out dates that already have a non-cancelled session, so regenerating is idempotent. */
export function withoutExistingDates(
  inputs: OpenPlaySessionInput[],
  existing: OpenPlaySession[],
): OpenPlaySessionInput[] {
  const taken = new Set(existing.filter((s) => s.status === 'scheduled').map((s) => s.sessionDate))
  return inputs.filter((i) => !taken.has(i.sessionDate))
}
