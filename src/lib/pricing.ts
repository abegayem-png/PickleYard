import type { Booking, BlockedSlot, HourRate, Settings } from '../types'
import { formatTime12h, hourToTime, rangesOverlap, timeToHour } from './time'

export type BookingLike = Pick<Booking, 'bookingDate' | 'startTime' | 'endTime' | 'status'>
export type BlockedSlotLike = Pick<BlockedSlot, 'date' | 'startTime' | 'endTime' | 'allDay'>

/**
 * Determines the rate + period for a single 1-hour segment starting at `hour` (24h int).
 * Returns null if the hour falls in the gap between daytime and nighttime and the
 * admin has not enabled gap bookings.
 */
export function getHourRate(hour: number, settings: Settings): HourRate | null {
  const dayStart = timeToHour(settings.daytimeStart)
  const dayEnd = timeToHour(settings.daytimeEnd)
  const nightStart = timeToHour(settings.nighttimeStart)
  const nightEnd = timeToHour(settings.nighttimeEnd)

  const label = `${formatTime12h(hourToTime(hour))} - ${formatTime12h(hourToTime(hour + 1))}`

  if (hour >= dayStart && hour < dayEnd) {
    return { hour, label, rate: settings.daytimeRate, period: 'daytime' }
  }
  if (hour >= nightStart && hour < nightEnd) {
    return { hour, label, rate: settings.nighttimeRate, period: 'nighttime' }
  }
  // Gap period (e.g. 5 PM - 6 PM) — only bookable if admin enabled it.
  if (settings.gapEnabled) {
    return { hour, label, rate: settings.gapRate, period: 'gap' }
  }
  return null
}

export interface PriceResult {
  valid: boolean
  breakdown: HourRate[]
  total: number
  reason?: string
}

/** Calculates price for a booking spanning [startHour, startHour + duration). */
export function calculatePrice(startHour: number, duration: number, settings: Settings): PriceResult {
  const breakdown: HourRate[] = []
  for (let h = startHour; h < startHour + duration; h++) {
    const hourRate = getHourRate(h, settings)
    if (!hourRate) {
      return {
        valid: false,
        breakdown: [],
        total: 0,
        reason: `${formatTime12h(hourToTime(h))} - ${formatTime12h(hourToTime(h + 1))} is not currently available for booking.`,
      }
    }
    breakdown.push(hourRate)
  }
  const total = breakdown.reduce((sum, b) => sum + b.rate, 0)
  return { valid: true, breakdown, total }
}

/** All candidate 1-hour start slots between opening and closing time. */
export function getAllStartHours(settings: Settings): number[] {
  const open = timeToHour(settings.openingTime)
  const close = timeToHour(settings.closingTime)
  const hours: number[] = []
  for (let h = open; h < close; h++) hours.push(h)
  return hours
}

/**
 * Returns start hours (for 1-hour slots) on `date` that are:
 * - within operating hours & priced (daytime/nighttime, or gap if enabled)
 * - not already booked (pending/confirmed, not cancelled)
 * - not blocked by admin
 */
export function getAvailableStartHours(
  date: string,
  settings: Settings,
  existingBookings: BookingLike[],
  blockedSlots: BlockedSlotLike[],
): number[] {
  const close = timeToHour(settings.closingTime)
  const dayBookings = existingBookings.filter((b) => b.bookingDate === date && b.status !== 'cancelled')
  const dayBlocked = blockedSlots.filter((b) => b.date === date)

  return getAllStartHours(settings).filter((h) => {
    if (h + 1 > close) return false
    if (!getHourRate(h, settings)) return false

    const slotStartMin = h * 60
    const slotEndMin = (h + 1) * 60

    const overlapsBooking = dayBookings.some((b) => {
      const bStart = timeToHour(b.startTime) * 60
      const bEnd = timeToHour(b.endTime) * 60
      return rangesOverlap(slotStartMin, slotEndMin, bStart, bEnd)
    })
    if (overlapsBooking) return false

    const overlapsBlocked = dayBlocked.some((b) => {
      const bStart = timeToHour(b.startTime) * 60
      const bEnd = timeToHour(b.endTime) * 60
      return rangesOverlap(slotStartMin, slotEndMin, bStart, bEnd)
    })
    if (overlapsBlocked) return false

    return true
  })
}

/** Given a chosen start hour, returns the durations (1-4h) that are fully bookable. */
export function getAvailableDurations(
  startHour: number,
  date: string,
  settings: Settings,
  existingBookings: BookingLike[],
  blockedSlots: BlockedSlotLike[],
  maxDuration = 4,
): number[] {
  const close = timeToHour(settings.closingTime)
  const dayBookings = existingBookings.filter((b) => b.bookingDate === date && b.status !== 'cancelled')
  const dayBlocked = blockedSlots.filter((b) => b.date === date)

  const durations: number[] = []
  for (let d = 1; d <= maxDuration; d++) {
    const endHour = startHour + d
    if (endHour > close) break

    const price = calculatePrice(startHour, d, settings)
    if (!price.valid) break

    const startMin = startHour * 60
    const endMin = endHour * 60

    const overlapsBooking = dayBookings.some((b) => {
      const bStart = timeToHour(b.startTime) * 60
      const bEnd = timeToHour(b.endTime) * 60
      return rangesOverlap(startMin, endMin, bStart, bEnd)
    })
    if (overlapsBooking) break

    const overlapsBlocked = dayBlocked.some((b) => {
      const bStart = timeToHour(b.startTime) * 60
      const bEnd = timeToHour(b.endTime) * 60
      return rangesOverlap(startMin, endMin, bStart, bEnd)
    })
    if (overlapsBlocked) break

    durations.push(d)
  }
  return durations
}

export function generateBookingReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `PKL-${code}`
}
