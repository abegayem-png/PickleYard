import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'
import { store } from '../../lib/store'
import { calculatePrice, getAvailableDurations, getAvailableStartHours } from '../../lib/pricing'
import type { BlockedSlotLike } from '../../lib/pricing'
import { formatTime12h, hourToTime, minutesToTime, todayISO } from '../../lib/time'
import MiniCalendar from '../../components/booking/MiniCalendar'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import type { AvailabilityRow } from '../../lib/store'
import type { BookingInput, PaymentMethod } from '../../types'

export default function AdminManualBooking() {
  const { settings } = useSettings()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayISO())
  const [startHour, setStartHour] = useState<number | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [email, setEmail] = useState('')
  const [numberOfPlayers, setNumberOfPlayers] = useState(2)
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [autoConfirm, setAutoConfirm] = useState(true)

  const [rows, setRows] = useState<AvailabilityRow[]>([])
  const [blocked, setBlocked] = useState<BlockedSlotLike[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setStartHour(null)
    setDuration(null)
    Promise.all([store.getAvailabilityForDate(date), store.listBlockedSlots()]).then(([r, b]) => {
      setRows(r)
      setBlocked(
        b
          .filter((s) => s.date === date)
          .map((s) => ({
            date: s.date,
            startTime: s.allDay ? settings.openingTime : s.startTime,
            endTime: s.allDay ? settings.closingTime : s.endTime,
            allDay: s.allDay,
          })),
      )
    })
  }, [date, settings.openingTime, settings.closingTime])

  const availableStartHours = useMemo(
    () => getAvailableStartHours(date, settings, rows, blocked),
    [date, settings, rows, blocked],
  )
  const availableDurations = useMemo(
    () => (startHour === null ? [] : getAvailableDurations(startHour, date, settings, rows, blocked)),
    [startHour, date, settings, rows, blocked],
  )
  const price = useMemo(
    () => (startHour === null || !duration ? null : calculatePrice(startHour, duration, settings)),
    [startHour, duration, settings],
  )

  async function handleSubmit() {
    setError(null)
    if (startHour === null || !duration || !price?.valid) {
      setError('Select a date, start time, and duration.')
      return
    }
    if (!customerName.trim() || !mobileNumber.trim()) {
      setError('Customer name and mobile number are required.')
      return
    }
    setSubmitting(true)
    try {
      const input: BookingInput = {
        customerName: customerName.trim(),
        mobileNumber: mobileNumber.trim(),
        email: email.trim(),
        numberOfPlayers,
        bookingDate: date,
        startTime: hourToTime(startHour),
        endTime: minutesToTime((startHour + duration) * 60),
        duration,
        rateBreakdown: price.breakdown,
        totalAmount: price.total,
        notes: notes.trim() || undefined,
        paymentMethod,
      }
      const booking = await store.createBooking(input)
      if (autoConfirm) await store.updateBookingStatus(booking.id, 'confirmed')
      navigate('/admin/bookings')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 font-display text-2xl font-extrabold text-cream">Create Manual Booking</h1>

      <Card className="p-5">
        <p className="mb-2 text-sm font-semibold text-cream-dim">Date</p>
        <MiniCalendar selected={date} onSelect={setDate} />

        <p className="mb-2 mt-5 text-sm font-semibold text-cream-dim">Start Time</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {availableStartHours.map((h) => (
            <button
              key={h}
              onClick={() => {
                setStartHour(h)
                setDuration(null)
              }}
              className={`rounded-xl border px-2 py-2.5 text-sm font-bold ${
                startHour === h ? 'border-lime-500 bg-lime-500/10 text-lime-400' : 'border-white/10 bg-court-800 text-cream hover:bg-court-700'
              }`}
            >
              {formatTime12h(hourToTime(h))}
            </button>
          ))}
          {availableStartHours.length === 0 && <p className="col-span-full text-sm text-cream-dim">No slots available on this date.</p>}
        </div>

        {startHour !== null && (
          <>
            <p className="mb-2 mt-5 text-sm font-semibold text-cream-dim">Duration</p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((d) => (
                <button
                  key={d}
                  disabled={!availableDurations.includes(d)}
                  onClick={() => setDuration(d)}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-30 ${
                    duration === d ? 'border-lime-500 bg-lime-500/10 text-lime-400' : 'border-white/10 bg-court-800 text-cream hover:bg-court-700'
                  }`}
                >
                  {d}h
                </button>
              ))}
            </div>
          </>
        )}

        {price?.valid && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-lime-500/10 px-4 py-3">
            <span className="text-sm font-semibold text-cream-dim">Total</span>
            <span className="font-display text-xl font-extrabold text-lime-500">₱{price.total}</span>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <TextField label="Customer Name" value={customerName} onChange={setCustomerName} />
          <TextField label="Mobile Number" value={mobileNumber} onChange={setMobileNumber} />
          <TextField label="Email (optional)" value={email} onChange={setEmail} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Number of Players</span>
            <input
              type="number"
              min={1}
              max={8}
              value={numberOfPlayers}
              onChange={(e) => setNumberOfPlayers(Number(e.target.value))}
              className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream focus:border-lime-500/50 focus:outline-none"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-white/10 bg-court-800 px-3 py-2 text-sm text-cream focus:border-lime-500/50 focus:outline-none"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-cream-dim">Payment Method</span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream focus:border-lime-500/50 focus:outline-none"
            >
              <option value="cash">Cash at Court</option>
              <option value="gcash">GCash</option>
            </select>
          </label>
          <label className="mt-6 flex items-center gap-2">
            <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} className="h-4 w-4 accent-lime-500" />
            <span className="text-sm font-semibold text-cream">Confirm immediately</span>
          </label>
        </div>

        {error && <p className="mt-4 text-sm font-medium text-red-400">{error}</p>}

        <Button fullWidth size="lg" className="mt-6" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Booking'}
        </Button>
      </Card>
    </div>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-cream-dim">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream focus:border-lime-500/50 focus:outline-none"
      />
    </label>
  )
}
