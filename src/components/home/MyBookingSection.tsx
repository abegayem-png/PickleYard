import { useState } from 'react'
import { useMyBookings } from '../../hooks/useMyBookings'
import { store } from '../../lib/store'
import { getErrorMessage } from '../../lib/errors'
import { bookingStatusLabel, bookingStatusTone, paymentBadgeLabel, paymentBadgeTone } from '../../lib/paymentDisplay'
import { formatDateLong, formatTimeRange12h } from '../../lib/time'
import type { Booking } from '../../types'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'

const PAST_SHOWN_LIMIT = 5

export default function MyBookingSection() {
  const { loading, upcoming, past, rememberBooking } = useMyBookings()
  const [showPast, setShowPast] = useState(false)
  const [showFindForm, setShowFindForm] = useState(false)

  const total = upcoming.length + past.length
  const hasAny = total > 0

  if (loading) {
    return (
      <section className="px-4 sm:px-6">
        <div className="mx-auto max-w-xl">
          <div className="h-24 animate-pulse rounded-3xl bg-white/5" />
        </div>
      </section>
    )
  }

  return (
    <section id="my-booking" className="scroll-mt-20 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-xl">
        {hasAny ? (
          <>
            <h2 className="mb-4 text-center font-display text-2xl font-extrabold text-cream sm:text-3xl">
              {total > 1 ? 'My Bookings' : 'My Booking'}
            </h2>

            {upcoming.length === 0 ? (
              <p className="text-center text-sm text-cream-dim">No upcoming bookings.</p>
            ) : (
              <div className="space-y-4">
                {upcoming.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}

            {past.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowPast((v) => !v)}
                  className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-cream-dim hover:bg-white/10"
                >
                  {showPast ? 'Hide Past Bookings' : `Show Past Bookings (${Math.min(past.length, PAST_SHOWN_LIMIT)})`}
                </button>
                {showPast && (
                  <div className="mt-3 space-y-3 opacity-70">
                    {past.slice(0, PAST_SHOWN_LIMIT).map((booking) => (
                      <BookingCard key={booking.id} booking={booking} compact />
                    ))}
                  </div>
                )}
              </div>
            )}

            <a href="#book">
              <Button fullWidth size="lg" variant="secondary" className="mt-5">
                Book Another Slot
              </Button>
            </a>
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm text-cream-dim">
              Already booked a court?{' '}
              <button onClick={() => setShowFindForm((v) => !v)} className="font-semibold text-lime-500 underline underline-offset-2">
                Find My Booking
              </button>
            </p>
          </div>
        )}

        {hasAny && (
          <p className="mt-4 text-center text-xs text-cream-dim">
            Booked from another device?{' '}
            <button onClick={() => setShowFindForm((v) => !v)} className="font-semibold text-lime-500 underline underline-offset-2">
              Find My Booking
            </button>
          </p>
        )}

        {showFindForm && (
          <FindMyBookingForm
            onFound={(booking) => {
              rememberBooking(booking)
              setShowFindForm(false)
            }}
          />
        )}
      </div>
    </section>
  )
}

function BookingCard({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const statusLabel = bookingStatusLabel(booking)
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-extrabold text-lime-500">Booking #{booking.bookingReference}</p>
      </div>
      <p className="mt-1 font-display text-base font-bold text-cream">{formatDateLong(booking.bookingDate)}</p>
      <p className="text-sm text-cream-dim">
        {formatTimeRange12h(booking.startTime, booking.endTime)} · {booking.duration} Hour{booking.duration > 1 ? 's' : ''}
      </p>

      {!compact && (
        <>
          <div className="my-3 h-px bg-white/10" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={bookingStatusTone(statusLabel)}>{statusLabel}</Badge>
            <Badge tone={paymentBadgeTone(booking.paymentStatus)}>{paymentBadgeLabel(booking.paymentStatus, booking.paymentMethod)}</Badge>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-cream-dim">Total</span>
            <span className="font-display text-xl font-extrabold text-cream">₱{booking.totalAmount}</span>
          </div>
        </>
      )}

      {compact && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={bookingStatusTone(statusLabel)}>{statusLabel}</Badge>
        </div>
      )}
    </Card>
  )
}

function FindMyBookingForm({ onFound }: { onFound: (booking: Booking) => void }) {
  const [reference, setReference] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFind() {
    if (!reference.trim() || !mobile.trim()) {
      setError('Enter both your booking reference and mobile number.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await store.findBookingByReference(reference.trim(), mobile.trim())
      if (!result) {
        setError('No booking found. Check your reference number and mobile number.')
        return
      }
      onFound(result)
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mt-4 p-5">
      <p className="mb-3 font-display font-bold text-cream">Find My Booking</p>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Booking Reference</span>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value.toUpperCase())}
            placeholder="PKL-A4F82Q"
            className="h-12 w-full rounded-xl border border-white/10 bg-court-800 px-4 text-base uppercase text-cream placeholder:normal-case placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Mobile Number</span>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="09XX XXX XXXX"
            className="h-12 w-full rounded-xl border border-white/10 bg-court-800 px-4 text-base text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-400">{error}</p>}

      <Button fullWidth size="lg" className="mt-4" onClick={handleFind} disabled={loading}>
        {loading ? 'Searching…' : 'Find Booking'}
      </Button>
    </Card>
  )
}
