import { useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { formatDateLong, formatTimeRange12h } from '../../lib/time'
import type { Booking } from '../../types'

interface BookingRowProps {
  booking: Booking
  onApprove: (id: string) => Promise<void>
  onCancel: (id: string) => Promise<void>
  onMarkPaid: (id: string) => Promise<void>
  onMarkUnpaid: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function BookingRow({ booking, onApprove, onCancel, onMarkPaid, onMarkUnpaid, onDelete }: BookingRowProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-4">
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setExpanded((v) => !v)}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-bold text-lime-500">{booking.bookingReference}</span>
            <Badge tone={booking.status}>{booking.status}</Badge>
            <Badge tone={booking.paymentStatus}>{booking.paymentStatus}</Badge>
          </div>
          <p className="mt-1 truncate font-semibold text-cream">{booking.customerName}</p>
          <p className="text-sm text-cream-dim">
            {formatDateLong(booking.bookingDate)} · {formatTimeRange12h(booking.startTime, booking.endTime)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-extrabold text-cream">₱{booking.totalAmount}</p>
          <p className="text-xs text-cream-dim">{expanded ? 'Hide' : 'Details'}</p>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Mobile" value={booking.mobileNumber} />
            <Info label="Email" value={booking.email || '—'} />
            <Info label="Players" value={String(booking.numberOfPlayers)} />
            <Info label="Payment Method" value={booking.paymentMethod === 'gcash' ? 'GCash' : 'Cash'} />
            <Info label="Duration" value={`${booking.duration}h`} />
            <Info label="Booked On" value={new Date(booking.createdAt).toLocaleString()} />
          </div>

          <div className="mt-3 rounded-lg bg-white/5 p-3 text-sm">
            <Info label="Promo Code" value={booking.promoCode ?? 'None'} />
            {booking.promoCode && (
              <div className="mt-2 grid grid-cols-3 gap-3">
                <Info label="Normal Total" value={`₱${booking.normalTotal}`} />
                <Info label="Discount" value={`₱${booking.discountAmount}`} />
                <Info label="Final Total" value={`₱${booking.totalAmount}`} />
              </div>
            )}
          </div>

          {booking.notes && (
            <p className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-cream-dim">
              <span className="font-semibold text-cream">Notes: </span>
              {booking.notes}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {booking.status === 'pending' && (
              <Button size="md" disabled={busy !== null} onClick={() => run('approve', () => onApprove(booking.id))}>
                {busy === 'approve' ? 'Approving…' : 'Approve'}
              </Button>
            )}
            {booking.paymentStatus === 'unpaid' ? (
              <Button
                size="md"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => run('paid', () => onMarkPaid(booking.id))}
              >
                {busy === 'paid' ? 'Updating…' : 'Mark as Paid'}
              </Button>
            ) : (
              <Button
                size="md"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => run('unpaid', () => onMarkUnpaid(booking.id))}
              >
                Mark as Unpaid
              </Button>
            )}
            {booking.status !== 'cancelled' && (
              <Button size="md" variant="danger" disabled={busy !== null} onClick={() => run('cancel', () => onCancel(booking.id))}>
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel Booking'}
              </Button>
            )}
            <Button
              size="md"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => {
                if (confirm('Permanently delete this booking? This cannot be undone.')) run('delete', () => onDelete(booking.id))
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-cream-dim">{label}</p>
      <p className="text-cream">{value}</p>
    </div>
  )
}
