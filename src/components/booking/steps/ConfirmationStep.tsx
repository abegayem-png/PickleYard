import { useNavigate } from 'react-router-dom'
import { useSettings } from '../../../context/SettingsContext'
import { formatDateLong, formatTime12h, formatTimeRange12h } from '../../../lib/time'
import type { Booking } from '../../../types'
import Button from '../../ui/Button'
import Card from '../../ui/Card'

export default function ConfirmationStep({ booking, onBookAnother }: { booking: Booking; onBookAnother: () => void }) {
  const { settings } = useSettings()
  const navigate = useNavigate()

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-lime-500/15 text-4xl">✅</div>
      <h3 className="font-display text-2xl font-extrabold text-cream">BOOKING REQUEST RECEIVED!</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm text-cream-dim">
        Your court has been reserved pending confirmation.
      </p>

      <Card className="mt-6 p-5 text-left">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-cream-dim">Booking Reference</p>
        <p className="text-center font-display text-2xl font-extrabold text-lime-500">{booking.bookingReference}</p>

        <div className="my-4 h-px bg-white/10" />

        <div className="space-y-2 text-sm">
          <Row label="Date" value={formatDateLong(booking.bookingDate)} />
          <Row label="Time" value={formatTimeRange12h(booking.startTime, booking.endTime)} />
          <Row label="Total Amount" value={`₱${booking.totalAmount}`} />
          <Row label="Customer Name" value={booking.customerName} />
        </div>
      </Card>

      {booking.paymentMethod === 'gcash' && (
        <Card className="mt-4 p-5 text-left">
          <p className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-lime-500">GCash Payment Instructions</p>
          <div className="space-y-1.5 text-sm">
            <Row label="GCash Number" value={settings.gcashNumber} />
            <Row label="Account Name" value={settings.gcashAccountName} />
          </div>
          <p className="mt-3 text-xs text-cream-dim">
            Please send ₱{booking.totalAmount} and keep your reference number. Your booking will be marked paid once confirmed by the court staff.
          </p>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <Button
          fullWidth
          size="lg"
          variant="secondary"
          onClick={() =>
            navigate('/my-booking', { state: { reference: booking.bookingReference, mobile: booking.mobileNumber } })
          }
        >
          View My Booking
        </Button>
        <Button fullWidth size="lg" onClick={onBookAnother}>
          Book Another Schedule
        </Button>
      </div>

      <p className="mt-4 text-xs text-cream-dim">
        Court hours: {formatTime12h(settings.openingTime)} – {formatTime12h(settings.closingTime)}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-cream-dim">{label}</span>
      <span className="text-right font-medium text-cream">{value}</span>
    </div>
  )
}
