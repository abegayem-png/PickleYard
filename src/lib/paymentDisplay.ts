import type { PaymentMethod, PaymentStatus } from '../types'

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
