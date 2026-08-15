import type { PromoCode } from '../types'

export interface PromoEligibility {
  valid: boolean
  /** Internal reason, for logging/debugging only — never shown to the customer. */
  reason: string | null
}

const GENERIC_INVALID_MESSAGE = 'Invalid or expired promo code.'

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase()
}

/**
 * Checks whether `promo` may be applied to a booking on `bookingDate` for `duration`
 * hours, given how many times it's already been used overall and by this customer.
 * This is the single source of truth for promo eligibility in demo (local) mode —
 * mirrors the Postgres function used in production so behavior matches either way.
 */
export function checkPromoEligibility(
  promo: PromoCode,
  bookingDate: string,
  duration: number,
  totalUsesSoFar: number,
  customerUsesSoFar: number,
): PromoEligibility {
  if (!promo.active) return { valid: false, reason: 'inactive' }
  if (promo.validFrom && bookingDate < promo.validFrom) return { valid: false, reason: 'before valid_from' }
  if (promo.validUntil && bookingDate > promo.validUntil) return { valid: false, reason: 'after valid_until' }
  if (promo.validDays.length > 0) {
    const weekday = new Date(bookingDate + 'T00:00:00').getDay()
    if (!promo.validDays.includes(weekday)) return { valid: false, reason: 'wrong weekday' }
  }
  if (promo.minBookingHours !== null && duration < promo.minBookingHours) {
    return { valid: false, reason: 'below min booking hours' }
  }
  if (promo.maxTotalUses !== null && totalUsesSoFar >= promo.maxTotalUses) {
    return { valid: false, reason: 'max total uses reached' }
  }
  if (promo.maxUsesPerCustomer !== null && customerUsesSoFar >= promo.maxUsesPerCustomer) {
    return { valid: false, reason: 'max per-customer uses reached' }
  }
  return { valid: true, reason: null }
}

export { GENERIC_INVALID_MESSAGE }
