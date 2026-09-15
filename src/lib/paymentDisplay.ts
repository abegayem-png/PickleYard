import { isPastDate } from './time'
import type { BookingStatus, PaymentMethod, PaymentStatus } from '../types'

/** Badge tone for a payment status — reuses the existing paid/unpaid/pending
 *  tones plus 'rejected' rather than introducing new colors per status. */
export function paymentBadgeTone(status: PaymentStatus): 'unpaid' | 'pending' | 'paid' | 'rejected' {
  if (status === 'verified') return 'paid'
  if (status === 'rejected') return 'rejected'
  if (status === 'pending') return 'pending'
  return 'unpaid'
}

/** GCash-aware label: an unpaid GCash booking/order reads as "awaiting payment"
 *  rather than a plain "unpaid", matching how it's described to customers. */
export function paymentBadgeLabel(status: PaymentStatus, method: PaymentMethod): string {
  if (method === 'gcash' && status === 'unpaid') return 'awaiting payment'
  return status
}

/** Customer-facing booking status label — purely a display derivation, never
 *  a stored value: BookingStatus itself stays 'pending' | 'confirmed' |
 *  'cancelled' everywhere else in the app (admin, calendar, filters). Here
 *  it additionally distinguishes a still-unpaid GCash booking as "awaiting
 *  payment", and a confirmed booking whose date has already passed as
 *  "completed", matching how the "My Booking" section describes them. */
export function bookingStatusLabel(booking: {
  status: BookingStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  bookingDate: string
}): string {
  if (booking.status === 'cancelled') return 'cancelled'
  if (booking.status === 'pending' && booking.paymentMethod === 'gcash' && booking.paymentStatus !== 'verified') {
    return 'awaiting payment'
  }
  if (booking.status === 'confirmed' && isPastDate(booking.bookingDate)) return 'completed'
  return booking.status
}

export function bookingStatusTone(label: string): 'pending' | 'confirmed' | 'cancelled' | 'paid' {
  if (label === 'cancelled') return 'cancelled'
  if (label === 'completed') return 'paid'
  if (label === 'confirmed') return 'confirmed'
  return 'pending' // 'pending' and 'awaiting payment' both read as amber/in-progress
}
