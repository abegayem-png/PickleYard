import { useEffect, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { useOpenPlaySessions } from '../../hooks/useOpenPlaySessions'
import { formatDateLong, formatTime12h, todayISO } from '../../lib/time'
import type { OpenPlayRegistration, OpenPlaySessionWithCount } from '../../types'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { DateField, NumberField, TimeField } from '../../components/admin/SettingsFields'

export default function AdminOpenPlay() {
  const { settings } = useSettings()
  const openPlay = useOpenPlaySessions()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Keep a recurring schedule topped up whenever an admin visits this page.
  useEffect(() => {
    if (settings.openPlayScheduleType === 'recurring') {
      openPlay.syncRecurringSessions(settings)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.openPlayScheduleType, settings.openPlayRecurringDays.join(','), settings.openPlayRecurringStartDate, settings.openPlayRecurringEndDate])

  const upcoming = openPlay.sessions
    .filter((s) => s.status === 'scheduled' && s.sessionDate >= todayISO())
    .sort((a, b) => (a.sessionDate === b.sessionDate ? a.startTime.localeCompare(b.startTime) : a.sessionDate.localeCompare(b.sessionDate)))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-cream">Open Play</h1>
          <p className="text-sm text-cream-dim">
            {settings.openPlayEnabled ? 'Visible to customers' : 'Hidden from customers (Open Play is off)'} ·{' '}
            {settings.openPlayBlockBookings ? 'Blocks regular bookings' : 'Does not block regular bookings'}
          </p>
        </div>
        <Button size="md" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Close' : '+ New Session'}
        </Button>
      </div>

      {creating && <CreateSessionCard onCreate={openPlay.createSpecificSession} onDone={() => setCreating(false)} />}

      {openPlay.loading ? (
        <p className="text-cream-dim">Loading…</p>
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-cream-dim">No upcoming Open Play sessions. Create one above, or set a schedule in Settings.</p>
      ) : (
        <div className="space-y-3">
          {upcoming.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              expanded={expandedId === s.id}
              onToggle={() => setExpandedId((id) => (id === s.id ? null : s.id))}
              onUpdate={openPlay.updateSession}
              onCancel={openPlay.cancelSession}
              listRegistrations={openPlay.listRegistrations}
              addRegistration={openPlay.addRegistration}
              removeRegistration={openPlay.removeRegistration}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CreateSessionCard({
  onCreate,
  onDone,
}: {
  onCreate: (input: {
    sessionDate: string
    startTime: string
    endTime: string
    pricePerPlayer: number
    playerLimit: number
    source: 'specific'
  }) => Promise<void>
  onDone: () => void
}) {
  const { settings } = useSettings()
  const [form, setForm] = useState({
    sessionDate: '',
    startTime: settings.openPlayStartTime,
    endTime: settings.openPlayEndTime,
    pricePerPlayer: settings.openPlayPrice,
    playerLimit: settings.openPlayPlayerLimit,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!form.sessionDate) {
      setError('Choose a date.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onCreate({ ...form, source: 'specific' })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-4 p-5">
      <p className="mb-4 font-display font-bold text-cream">New Open Play Session</p>
      <div className="grid grid-cols-2 gap-4">
        <DateField label="Date" value={form.sessionDate} onChange={(v) => setForm((f) => ({ ...f, sessionDate: v }))} min={todayISO()} />
        <div />
        <TimeField label="Start Time" value={form.startTime} onChange={(v) => setForm((f) => ({ ...f, startTime: v }))} />
        <TimeField label="End Time" value={form.endTime} onChange={(v) => setForm((f) => ({ ...f, endTime: v }))} />
        <NumberField label="Price per Player (₱)" value={form.pricePerPlayer} onChange={(v) => setForm((f) => ({ ...f, pricePerPlayer: v }))} />
        <NumberField label="Player Limit" value={form.playerLimit} onChange={(v) => setForm((f) => ({ ...f, playerLimit: v }))} />
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <Button size="md" className="mt-4" onClick={handleCreate} disabled={busy}>
        {busy ? 'Creating…' : 'Create Session'}
      </Button>
    </Card>
  )
}

function SessionCard({
  session,
  expanded,
  onToggle,
  onUpdate,
  onCancel,
  listRegistrations,
  addRegistration,
  removeRegistration,
}: {
  session: OpenPlaySessionWithCount
  expanded: boolean
  onToggle: () => void
  onUpdate: (id: string, patch: Partial<{ sessionDate: string; startTime: string; endTime: string; pricePerPlayer: number; playerLimit: number }>) => Promise<void>
  onCancel: (id: string) => Promise<void>
  listRegistrations: (sessionId: string) => Promise<OpenPlayRegistration[]>
  addRegistration: (sessionId: string, name: string, mobile: string) => Promise<void>
  removeRegistration: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [edit, setEdit] = useState({
    sessionDate: session.sessionDate,
    startTime: session.startTime,
    endTime: session.endTime,
    pricePerPlayer: session.pricePerPlayer,
    playerLimit: session.playerLimit,
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const isFull = session.registeredCount >= session.playerLimit

  async function handleSaveEdit() {
    setSavingEdit(true)
    try {
      await onUpdate(session.id, edit)
      setEditing(false)
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display font-bold text-cream">{formatDateLong(session.sessionDate)}</p>
            <Badge tone="cream">{session.source === 'recurring' ? 'Recurring' : 'Specific'}</Badge>
            {isFull && <Badge tone="blocked">OPEN PLAY FULL</Badge>}
          </div>
          <p className="mt-1 text-sm text-cream-dim">
            {formatTime12h(session.startTime)} – {formatTime12h(session.endTime)} · ₱{session.pricePerPlayer}/player
          </p>
          <p className="mt-1 font-display text-lg font-extrabold text-lime-500">
            {session.registeredCount} / {session.playerLimit} Players
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button onClick={onToggle} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-cream hover:bg-white/10">
            {expanded ? 'Hide Players' : 'View Players'}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-cream hover:bg-white/10"
          >
            Edit
          </button>
          <button
            onClick={() => onCancel(session.id)}
            className="rounded-lg bg-red-400/10 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-400/20"
          >
            Cancel Session
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
          <DateField label="Date" value={edit.sessionDate} onChange={(v) => setEdit((e) => ({ ...e, sessionDate: v }))} />
          <div />
          <TimeField label="Start" value={edit.startTime} onChange={(v) => setEdit((e) => ({ ...e, startTime: v }))} />
          <TimeField label="End" value={edit.endTime} onChange={(v) => setEdit((e) => ({ ...e, endTime: v }))} />
          <NumberField label="Price (₱)" value={edit.pricePerPlayer} onChange={(v) => setEdit((e) => ({ ...e, pricePerPlayer: v }))} />
          <NumberField label="Player Limit" value={edit.playerLimit} onChange={(v) => setEdit((e) => ({ ...e, playerLimit: v }))} />
          <Button size="md" className="col-span-2" onClick={handleSaveEdit} disabled={savingEdit}>
            {savingEdit ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}

      {expanded && (
        <PlayersPanel
          sessionId={session.id}
          listRegistrations={listRegistrations}
          addRegistration={addRegistration}
          removeRegistration={removeRegistration}
        />
      )}
    </Card>
  )
}

function PlayersPanel({
  sessionId,
  listRegistrations,
  addRegistration,
  removeRegistration,
}: {
  sessionId: string
  listRegistrations: (sessionId: string) => Promise<OpenPlayRegistration[]>
  addRegistration: (sessionId: string, name: string, mobile: string) => Promise<void>
  removeRegistration: (id: string) => Promise<void>
}) {
  const [players, setPlayers] = useState<OpenPlayRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      setPlayers(await listRegistrations(sessionId))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function handleAdd() {
    if (!name.trim() || !mobile.trim()) {
      setError('Enter both a name and mobile number.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await addRegistration(sessionId, name.trim(), mobile.trim())
      setName('')
      setMobile('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add player.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    await removeRegistration(id)
    await refresh()
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-cream-dim">Registered Players</p>
      {loading ? (
        <p className="text-sm text-cream-dim">Loading…</p>
      ) : players.length === 0 ? (
        <p className="text-sm text-cream-dim">No one has joined yet.</p>
      ) : (
        <div className="space-y-2">
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-court-900/50 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-cream">{p.playerName}</p>
                <p className="text-xs text-cream-dim">{p.mobileNumber}</p>
              </div>
              <button
                onClick={() => handleRemove(p.id)}
                className="rounded-lg bg-red-400/10 px-2.5 py-1 text-xs font-bold text-red-300 hover:bg-red-400/20"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          className="h-10 flex-1 rounded-lg border border-white/10 bg-court-800 px-3 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
        />
        <input
          type="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="Mobile number"
          className="h-10 flex-1 rounded-lg border border-white/10 bg-court-800 px-3 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={busy}
          className="h-10 shrink-0 rounded-lg bg-lime-500 px-4 text-sm font-bold text-court-950 disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add Player'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}
