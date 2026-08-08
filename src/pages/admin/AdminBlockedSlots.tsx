import { useState } from 'react'
import { useAdminData } from '../../hooks/useAdminData'
import { useSettings } from '../../context/SettingsContext'
import MiniCalendar from '../../components/booking/MiniCalendar'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { getAllStartHours } from '../../lib/pricing'
import { formatDateLong, formatTime12h, hourToTime, todayISO } from '../../lib/time'

export default function AdminBlockedSlots() {
  const { settings } = useSettings()
  const data = useAdminData()

  const [date, setDate] = useState(todayISO())
  const [allDay, setAllDay] = useState(true)
  const [startHour, setStartHour] = useState(settings.openingTime)
  const [endHour, setEndHour] = useState(settings.closingTime)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const hourOptions = getAllStartHours(settings).map((h) => hourToTime(h)).concat(settings.closingTime)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await data.addBlockedSlot({
        date,
        startTime: allDay ? settings.openingTime : startHour,
        endTime: allDay ? settings.closingTime : endHour,
        reason: reason.trim() || 'Blocked by admin',
        allDay,
      })
      setReason('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-extrabold text-cream">Block Dates & Time Slots</h1>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="p-5">
          <MiniCalendar selected={date} onSelect={setDate} />

          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-lime-500" />
              <span className="text-sm font-semibold text-cream">Block the entire day</span>
            </label>

            {!allDay && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-cream-dim">Start Time</span>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream focus:border-lime-500/50 focus:outline-none"
                  >
                    {hourOptions.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {formatTime12h(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-cream-dim">End Time</span>
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream focus:border-lime-500/50 focus:outline-none"
                  >
                    {hourOptions.slice(1).map((t) => (
                      <option key={t} value={t}>
                        {formatTime12h(t)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-cream-dim">Reason (optional)</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Maintenance, private event…"
                className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
              />
            </label>

            <Button fullWidth onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Blocking…' : 'Block This Slot'}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-4 font-display font-bold text-cream">Blocked Slots</p>
          {data.blockedSlots.length === 0 ? (
            <p className="text-sm text-cream-dim">No blocked dates or slots yet.</p>
          ) : (
            <div className="space-y-2">
              {data.blockedSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-court-900/50 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-cream">{formatDateLong(slot.date)}</p>
                    <p className="text-xs text-cream-dim">
                      {slot.allDay ? 'All day' : `${formatTime12h(slot.startTime)} – ${formatTime12h(slot.endTime)}`} · {slot.reason}
                    </p>
                  </div>
                  <button
                    onClick={() => data.removeBlockedSlot(slot.id)}
                    className="shrink-0 rounded-lg bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-400/20"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
