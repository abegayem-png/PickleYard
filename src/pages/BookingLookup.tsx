import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { store } from '../lib/store'
import { formatDateLong, formatTimeRange12h } from '../lib/time'
import type { Booking } from '../types'

const STATUS_TONE = { pending: 'pending', confirmed: 'confirmed', cancelled: 'cancelled' } as const
const PAYMENT_TONE = { unpaid: 'unpaid', paid: 'paid' } as const

export default function BookingLookup() {
  const location = useLocation()
  const navState = location.state as { reference?: string; mobile?: string } | null

  const [reference, setReference] = useState(navState?.reference ?? '')
  const [mobile, setMobile] = useState(navState?.mobile ?? '')
  const [booking, setBooking] = useState<Booking | null>(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(refOverride?: string, mobileOverride?: string) {
    const ref = refOverride ?? reference
    const mob = mobileOverride ?? mobile
    if (!ref.trim() || !mob.trim()) {
      setError('Enter both your booking reference and mobile number.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await store.findBookingByReference(ref.trim(), mob.trim())
      setBooking(result)
      setSearched(true)
      if (!result) setError('No booking found. Check your reference number and mobile number.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (navState?.reference && navState?.mobile) {
      handleSearch(navState.reference, navState.mobile)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-extrabold text-cream">View My Booking</h1>
          <p className="mt-2 text-cream-dim">Enter your reference and mobile number to check your status.</p>
        </div>

        <Card className="p-5">
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
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Mobile Number</span>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="h-12 w-full rounded-xl border border-white/10 bg-court-800 px-4 text-base text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
            />
          </label>

          {error && <p className="mt-3 text-sm font-medium text-red-400">{error}</p>}

          <Button fullWidth size="lg" className="mt-5" onClick={() => handleSearch()} disabled={loading}>
            {loading ? 'Searching…' : 'Find My Booking'}
          </Button>
        </Card>

        {searched && booking && (
          <Card className="mt-5 p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-extrabold text-lime-500">{booking.bookingReference}</p>
              <div className="flex gap-2">
                <Badge tone={STATUS_TONE[booking.status]}>{booking.status}</Badge>
                <Badge tone={PAYMENT_TONE[booking.paymentStatus]}>{booking.paymentStatus}</Badge>
              </div>
            </div>
            <div className="my-4 h-px bg-white/10" />
            <div className="space-y-2 text-sm">
              <Row label="Date" value={formatDateLong(booking.bookingDate)} />
              <Row label="Time" value={formatTimeRange12h(booking.startTime, booking.endTime)} />
              <Row label="Duration" value={`${booking.duration} Hour${booking.duration > 1 ? 's' : ''}`} />
              <Row label="Total Amount" value={`₱${booking.totalAmount}`} />
              <Row label="Customer Name" value={booking.customerName} />
              <Row label="Players" value={String(booking.numberOfPlayers)} />
              <Row label="Payment Method" value={booking.paymentMethod === 'gcash' ? 'GCash' : 'Cash at Court'} />
            </div>
          </Card>
        )}
      </div>
    </Layout>
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
