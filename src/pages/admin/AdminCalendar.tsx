import { useMemo, useState } from 'react'
import { useAdminData } from '../../hooks/useAdminData'
import { useSettings } from '../../context/SettingsContext'
import MiniCalendar from '../../components/booking/MiniCalendar'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import { getAllStartHours } from '../../lib/pricing'
import { formatDateLong, formatTime12h, hourToTime, timeToHour, todayISO } from '../../lib/time'
import type { SlotStatus } from '../../types'

const STATUS_LABEL: Record<SlotStatus, string> = {
  available: 'Available',
  pending: 'Pending',
  confirmed: 'Confirmed',
  paid: 'Paid',
  blocked: 'Blocked',
  past: 'Past',
}

const STATUS_TONE: Record<SlotStatus, 'cream' | 'pending' | 'confirmed' | 'paid' | 'blocked'> = {
  available: 'cream',
  pending: 'pending',
  confirmed: 'confirmed',
  paid: 'paid',
  blocked: 'blocked',
  past: 'cream',
}

export default function AdminCalendar() {
  const { settings } = useSettings()
  const data = useAdminData()
  const [selectedDate, setSelectedDate] = useState(todayISO())

  const markedDates = useMemo(() => {
    const set = new Set<string>()
    data.blockedSlots.forEach((b) => set.add(b.date))
    return set
  }, [data.blockedSlots])

  const daySchedule = useMemo(() => {
    const dayBookings = data.bookings.filter((b) => b.bookingDate === selectedDate && b.status !== 'cancelled')
    const dayBlocked = data.blockedSlots.filter((b) => b.date === selectedDate)

    return getAllStartHours(settings).map((h) => {
      const slotStart = h * 60
      const slotEnd = (h + 1) * 60

      const blocked = dayBlocked.find((b) => {
        const bStart = timeToHour(b.allDay ? settings.openingTime : b.startTime) * 60
        const bEnd = timeToHour(b.allDay ? settings.closingTime : b.endTime) * 60
        return slotStart < bEnd && bStart < slotEnd
      })
      if (blocked) {
        return { hour: h, status: 'blocked' as SlotStatus, detail: blocked.reason || 'Blocked by admin' }
      }

      const booking = dayBookings.find((b) => {
        const bStart = timeToHour(b.startTime) * 60
        const bEnd = timeToHour(b.endTime) * 60
        return slotStart < bEnd && bStart < slotEnd
      })
      if (booking) {
        const status: SlotStatus = booking.paymentStatus === 'paid' ? 'paid' : booking.status === 'confirmed' ? 'confirmed' : 'pending'
        return { hour: h, status, detail: `${booking.customerName} · ${booking.bookingReference}` }
      }

      return { hour: h, status: 'available' as SlotStatus, detail: null }
    })
  }, [selectedDate, data.bookings, data.blockedSlots, settings])

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-extrabold text-cream">Booking Calendar</h1>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="p-5">
          <MiniCalendar selected={selectedDate} onSelect={setSelectedDate} minDateISO="2000-01-01" markedDates={markedDates} />
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <LegendDot tone="pending" label="Pending" />
            <LegendDot tone="confirmed" label="Confirmed" />
            <LegendDot tone="paid" label="Paid" />
            <LegendDot tone="blocked" label="Blocked" />
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-4 font-display font-bold text-cream">{formatDateLong(selectedDate)}</p>
          <div className="space-y-2">
            {daySchedule.map((slot) => (
              <div
                key={slot.hour}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-court-900/50 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-cream">
                    {formatTime12h(hourToTime(slot.hour))} – {formatTime12h(hourToTime(slot.hour + 1))}
                  </p>
                  {slot.detail && <p className="text-xs text-cream-dim">{slot.detail}</p>}
                </div>
                <Badge tone={STATUS_TONE[slot.status]}>{STATUS_LABEL[slot.status]}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function LegendDot({ tone, label }: { tone: 'pending' | 'confirmed' | 'paid' | 'blocked'; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-cream-dim">
      <Badge tone={tone}>{label}</Badge>
    </span>
  )
}
