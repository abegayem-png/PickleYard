import { useState } from 'react'
import { useFreePlayParticipants } from '../../hooks/useFreePlayParticipants'
import { formatDateLong, formatTimeRange12h, todayISO } from '../../lib/time'
import type { FreePlayParticipant } from '../../types'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { DateField } from '../../components/admin/SettingsFields'

/** Same fixed 2 PM-5 PM blocks the public Free Play section shows. */
const FREE_PLAY_SLOTS: Array<{ startTime: string; endTime: string }> = [
  { startTime: '14:00', endTime: '15:00' },
  { startTime: '15:00', endTime: '16:00' },
  { startTime: '16:00', endTime: '17:00' },
]

export default function AdminFreePlay() {
  const [date, setDate] = useState(todayISO())
  const { participants, loading, removeParticipant, clearSlot } = useFreePlayParticipants(date)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-extrabold text-cream">Free Play Participants</h1>
        <p className="text-sm text-cream-dim">Who joined the free 2 PM–5 PM court window — no bookings are created here.</p>
      </div>

      <Card className="mb-4 p-4">
        <div className="max-w-xs">
          <DateField label="Date" value={date} onChange={setDate} />
        </div>
      </Card>

      <p className="mb-3 font-display text-lg font-bold text-cream">{formatDateLong(date)}</p>

      {loading ? (
        <p className="text-cream-dim">Loading…</p>
      ) : (
        <div className="space-y-4">
          {FREE_PLAY_SLOTS.map((slot) => (
            <SlotPanel
              key={slot.startTime}
              startTime={slot.startTime}
              endTime={slot.endTime}
              participants={participants.filter((p) => p.startTime === slot.startTime && p.endTime === slot.endTime)}
              onRemove={removeParticipant}
              onClear={() => clearSlot(slot.startTime, slot.endTime)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SlotPanel({
  startTime,
  endTime,
  participants,
  onRemove,
  onClear,
}: {
  startTime: string
  endTime: string
  participants: FreePlayParticipant[]
  onRemove: (id: string) => Promise<void>
  onClear: () => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)

  async function handleRemove(id: string) {
    setBusy(id)
    try {
      await onRemove(id)
    } finally {
      setBusy(null)
    }
  }

  async function handleClear() {
    if (!confirm(`Clear all ${participants.length} participant(s) for ${formatTimeRange12h(startTime, endTime)}?`)) return
    setBusy('__clear__')
    try {
      await onClear()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display font-bold text-cream">{formatTimeRange12h(startTime, endTime)}</p>
        {participants.length > 0 && (
          <Button size="md" variant="danger" onClick={handleClear} disabled={busy !== null}>
            {busy === '__clear__' ? 'Clearing…' : 'Clear Slot'}
          </Button>
        )}
      </div>

      {participants.length === 0 ? (
        <p className="mt-2 text-sm text-cream-dim">No participants yet</p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-court-900/50 px-3 py-2">
                <span className="text-sm font-semibold text-cream">{p.participantName}</span>
                <button
                  onClick={() => handleRemove(p.id)}
                  disabled={busy !== null}
                  className="rounded-lg bg-red-400/10 px-2.5 py-1 text-xs font-bold text-red-300 hover:bg-red-400/20 disabled:opacity-50"
                >
                  {busy === p.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-cream-dim">
            {participants.length} {participants.length === 1 ? 'player' : 'players'}
          </p>
        </>
      )}
    </Card>
  )
}
