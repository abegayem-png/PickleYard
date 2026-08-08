import type { CustomerInfo } from '../../../hooks/useBookingFlow'
import type { PriceResult } from '../../../lib/pricing'
import { formatDateLong, formatTime12h, hourToTime } from '../../../lib/time'
import Button from '../../ui/Button'
import Card from '../../ui/Card'
import StepHeader from '../StepHeader'

interface SummaryStepProps {
  date: string
  startHour: number
  endTime: string
  duration: number
  price: PriceResult
  customer: CustomerInfo
  submitting: boolean
  submitError: string | null
  onConfirm: () => void
  onBack: () => void
}

export default function SummaryStep({
  date,
  startHour,
  endTime,
  duration,
  price,
  customer,
  submitting,
  submitError,
  onConfirm,
  onBack,
}: SummaryStepProps) {
  const uniqueRates = Array.from(new Set(price.breakdown.map((b) => b.rate)))
  const isMixedRate = uniqueRates.length > 1

  return (
    <div>
      <StepHeader title="Booking Summary" subtitle="Review your details before confirming." stepNumber={5} totalSteps={5} onBack={onBack} />

      <Card className="p-5">
        <p className="font-display text-lg font-extrabold text-cream">{formatDateLong(date)}</p>
        <p className="mt-0.5 text-cream-dim">
          {formatTime12h(hourToTime(startHour))} – {formatTime12h(endTime)}
        </p>

        <div className="my-4 h-px bg-white/10" />

        <div className="space-y-2 text-sm">
          <Row label="Duration" value={`${duration} Hour${duration > 1 ? 's' : ''}`} />
          {isMixedRate ? (
            price.breakdown.map((b, i) => (
              <Row key={i} label={b.label} value={`₱${b.rate}/hour`} />
            ))
          ) : (
            <Row
              label={price.breakdown[0]?.period === 'nighttime' ? 'Night Rate' : 'Daytime Rate'}
              value={`₱${uniqueRates[0]}/hour`}
            />
          )}
        </div>

        <div className="my-4 h-px bg-white/10" />

        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-cream">TOTAL</span>
          <span className="font-display text-3xl font-extrabold text-lime-500">₱{price.total}</span>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <p className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-cream-dim">Customer Details</p>
        <div className="space-y-1.5 text-sm">
          <Row label="Name" value={customer.customerName} />
          <Row label="Mobile" value={customer.mobileNumber} />
          {customer.email && <Row label="Email" value={customer.email} />}
          <Row label="Players" value={String(customer.numberOfPlayers)} />
          <Row label="Payment" value={customer.paymentMethod === 'gcash' ? 'GCash' : 'Cash at Court'} />
          {customer.notes && <Row label="Notes" value={customer.notes} />}
        </div>
      </Card>

      {submitError && (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {submitError}
        </div>
      )}

      <Button fullWidth size="lg" className="mt-6" onClick={onConfirm} disabled={submitting}>
        {submitting ? 'Confirming…' : 'Confirm Booking'}
      </Button>
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
