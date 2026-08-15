import type { CustomerInfo } from '../../../hooks/useBookingFlow'
import type { PriceResult } from '../../../lib/pricing'
import { formatDateLong, formatTime12h, hourToTime } from '../../../lib/time'
import type { PromoPreview } from '../../../types'
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
  promoInput: string
  setPromoInput: (v: string) => void
  appliedPromo: PromoPreview | null
  promoChecking: boolean
  promoError: string | null
  onApplyPromo: () => void
  onRemovePromo: () => void
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
  promoInput,
  setPromoInput,
  appliedPromo,
  promoChecking,
  promoError,
  onApplyPromo,
  onRemovePromo,
}: SummaryStepProps) {
  const hasPromo = appliedPromo?.valid ?? false
  const effectiveBreakdown = hasPromo && appliedPromo ? appliedPromo.rateBreakdown : price.breakdown
  const effectiveTotal = hasPromo && appliedPromo ? appliedPromo.promoTotal : price.total
  const uniqueRates = Array.from(new Set(effectiveBreakdown.map((b) => b.rate)))
  const isMixedRate = uniqueRates.length > 1
  const normalUniqueRates = Array.from(new Set(price.breakdown.map((b) => b.rate)))

  return (
    <div>
      <StepHeader title="Booking Summary" subtitle="Review your details before confirming." stepNumber={5} totalSteps={5} onBack={onBack} />

      <Card className="p-5">
        <p className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-cream-dim">Have a promo code?</p>
        {hasPromo && appliedPromo ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-lime-500/10 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-lime-400">Promo code applied: {appliedPromo.code}</p>
              {appliedPromo.discountAmount > 0 && (
                <p className="text-xs text-cream-dim">You saved ₱{appliedPromo.discountAmount}</p>
              )}
            </div>
            <button onClick={onRemovePromo} className="shrink-0 text-xs font-semibold text-cream-dim underline hover:text-cream">
              Remove
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="PLAYMORE"
                className="h-12 flex-1 min-w-0 rounded-xl border border-white/10 bg-court-800 px-4 text-base uppercase text-cream placeholder:normal-case placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
              />
              <Button size="lg" variant="secondary" onClick={onApplyPromo} disabled={promoChecking || !promoInput.trim()}>
                {promoChecking ? 'Checking…' : 'Apply'}
              </Button>
            </div>
            {promoError && <p className="mt-2 text-sm font-medium text-red-400">{promoError}</p>}
          </>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <p className="font-display text-lg font-extrabold text-cream">{formatDateLong(date)}</p>
        <p className="mt-0.5 text-cream-dim">
          {formatTime12h(hourToTime(startHour))} – {formatTime12h(endTime)}
        </p>

        <div className="my-4 h-px bg-white/10" />

        <div className="space-y-2 text-sm">
          <Row label="Duration" value={`${duration} Hour${duration > 1 ? 's' : ''}`} />
          {isMixedRate ? (
            effectiveBreakdown.map((b, i) => <Row key={i} label={b.label} value={`₱${b.rate}/hour`} />)
          ) : hasPromo && appliedPromo ? (
            <>
              <Row label="Normal Rate" value={`₱${normalUniqueRates[0]}/hour`} />
              <Row label="Promo Code" value={appliedPromo.code} />
              <Row label="Promo Rate" value={`₱${uniqueRates[0]}/hour`} />
            </>
          ) : (
            <Row
              label={effectiveBreakdown[0]?.period === 'nighttime' ? 'Night Rate' : 'Daytime Rate'}
              value={`₱${uniqueRates[0]}/hour`}
            />
          )}
        </div>

        <div className="my-4 h-px bg-white/10" />

        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-cream">TOTAL</span>
          <span className="font-display text-3xl font-extrabold text-lime-500">₱{effectiveTotal}</span>
        </div>
        {hasPromo && appliedPromo && appliedPromo.discountAmount > 0 && (
          <p className="mt-2 text-right text-sm font-semibold text-lime-400">You saved: ₱{appliedPromo.discountAmount}</p>
        )}
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
