import { useEffect, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { useOpenPlaySessions } from '../../hooks/useOpenPlaySessions'
import { WEEKDAY_LABELS } from '../../lib/openPlay'
import { formatDateLong, formatTime12h, todayISO } from '../../lib/time'
import type { OpenPlayScheduleType, Settings } from '../../types'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { DateField, NumberField, TimeField } from './SettingsFields'

// Displayed Monday-first per the admin's request, stored as JS weekday indices (0=Sun..6=Sat).
const DISPLAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]

type OpenPlayFormFields = Pick<
  Settings,
  | 'openPlayEnabled'
  | 'openPlayBlockBookings'
  | 'openPlayScheduleType'
  | 'openPlayRecurringDays'
  | 'openPlayRecurringStartDate'
  | 'openPlayRecurringEndDate'
  | 'openPlayStartTime'
  | 'openPlayEndTime'
  | 'openPlayPrice'
  | 'openPlayPlayerLimit'
>

export default function OpenPlaySettingsPanel() {
  const { settings, updateSettings } = useSettings()
  const openPlay = useOpenPlaySessions()

  const [form, setForm] = useState<OpenPlayFormFields>(settings)
  const [saving, setSaving] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [newDate, setNewDate] = useState('')

  useEffect(() => setForm(settings), [settings])

  function set<K extends keyof OpenPlayFormFields>(key: K, value: OpenPlayFormFields[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save(section: string, patch: Partial<Settings>, then?: (updated: Settings) => Promise<void>) {
    setSaving(section)
    setSavedMsg(null)
    setErrorMsg(null)
    try {
      await updateSettings(patch)
      if (then) await then({ ...settings, ...patch })
      setSavedMsg('Settings saved successfully.')
      setTimeout(() => setSavedMsg(null), 3000)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Failed to save "${section}":`, err)
      setErrorMsg(err instanceof Error ? `Couldn't save "${section}": ${err.message}` : `Couldn't save "${section}".`)
    } finally {
      setSaving(null)
    }
  }

  function toggleWeekday(day: number) {
    const days = form.openPlayRecurringDays.includes(day)
      ? form.openPlayRecurringDays.filter((d) => d !== day)
      : [...form.openPlayRecurringDays, day].sort()
    set('openPlayRecurringDays', days)
  }

  async function addSpecificDate() {
    if (!newDate) return
    setErrorMsg(null)
    try {
      await openPlay.createSpecificSession({
        sessionDate: newDate,
        startTime: settings.openPlayStartTime,
        endTime: settings.openPlayEndTime,
        pricePerPlayer: settings.openPlayPrice,
        playerLimit: settings.openPlayPlayerLimit,
        source: 'specific',
      })
      setNewDate('')
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to add Open Play date:', err)
      setErrorMsg(err instanceof Error ? err.message : "Couldn't add that date.")
    }
  }

  const specificSessions = openPlay.sessions
    .filter((s) => s.status === 'scheduled' && s.source === 'specific')
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))

  const recurringSessions = openPlay.sessions
    .filter((s) => s.status === 'scheduled' && s.source === 'recurring')
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-extrabold text-cream">Open Play Settings</h2>
        {savedMsg && <span className="text-sm font-semibold text-lime-500">✓ {savedMsg}</span>}
      </div>
      {errorMsg && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{errorMsg}</div>
      )}

      <div className="space-y-6">
        {/* Visibility + booking-conflict toggles */}
        <Card className="p-5">
          <p className="mb-4 font-display font-bold text-cream">Visibility</p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.openPlayEnabled}
              onChange={(e) => set('openPlayEnabled', e.target.checked)}
              className="h-4 w-4 accent-lime-500"
            />
            <span className="text-sm font-semibold text-cream">Show Open Play</span>
          </label>
          <p className="mt-1 text-xs text-cream-dim">
            {form.openPlayEnabled
              ? 'Customers see upcoming Open Play sessions and can join.'
              : 'Open Play is hidden from customers and no new registrations are accepted.'}
          </p>

          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.openPlayBlockBookings}
              onChange={(e) => set('openPlayBlockBookings', e.target.checked)}
              className="h-4 w-4 accent-lime-500"
            />
            <span className="text-sm font-semibold text-cream">Block regular court bookings during Open Play</span>
          </label>
          <p className="mt-1 text-xs text-cream-dim">
            When on, the hours of each scheduled Open Play session are automatically unavailable for regular court
            bookings on that date only — other dates are unaffected.
          </p>

          <Button
            size="md"
            className="mt-5"
            onClick={() => save('Visibility', { openPlayEnabled: form.openPlayEnabled, openPlayBlockBookings: form.openPlayBlockBookings })}
            disabled={saving !== null}
          >
            {saving === 'Visibility' ? 'Saving…' : 'Save'}
          </Button>
        </Card>

        {/* Time, price, player limit defaults */}
        <Card className="p-5">
          <p className="mb-4 font-display font-bold text-cream">Time, Price &amp; Player Limit</p>
          <div className="grid grid-cols-2 gap-4">
            <TimeField label="Start Time" value={form.openPlayStartTime} onChange={(v) => set('openPlayStartTime', v)} />
            <TimeField label="End Time" value={form.openPlayEndTime} onChange={(v) => set('openPlayEndTime', v)} />
            <NumberField label="Price per Player (₱)" value={form.openPlayPrice} onChange={(v) => set('openPlayPrice', v)} />
            <NumberField label="Player Limit" value={form.openPlayPlayerLimit} onChange={(v) => set('openPlayPlayerLimit', v)} />
          </div>
          <p className="mt-3 text-xs text-cream-dim">
            These are the defaults used for newly created sessions. Editing an existing session (in the Open Play
            dashboard) only changes that one date.
          </p>
          <Button
            size="md"
            className="mt-5"
            onClick={() =>
              save('Time, Price & Player Limit', {
                openPlayStartTime: form.openPlayStartTime,
                openPlayEndTime: form.openPlayEndTime,
                openPlayPrice: form.openPlayPrice,
                openPlayPlayerLimit: form.openPlayPlayerLimit,
              })
            }
            disabled={saving !== null}
          >
            {saving === 'Time, Price & Player Limit' ? 'Saving…' : 'Save'}
          </Button>
        </Card>

        {/* Schedule type + specific/recurring configuration */}
        <Card className="p-5">
          <p className="mb-4 font-display font-bold text-cream">Open Play Schedule Type</p>
          <div className="grid grid-cols-2 gap-3">
            <ScheduleTypeButton
              label="Specific Date"
              active={form.openPlayScheduleType === 'specific'}
              onClick={() => set('openPlayScheduleType', 'specific' as OpenPlayScheduleType)}
            />
            <ScheduleTypeButton
              label="Recurring Days"
              active={form.openPlayScheduleType === 'recurring'}
              onClick={() => set('openPlayScheduleType', 'recurring' as OpenPlayScheduleType)}
            />
          </div>

          {form.openPlayScheduleType === 'specific' ? (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-cream-dim">Add an Open Play date</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <DateField label="" value={newDate} onChange={setNewDate} min={todayISO()} />
                <Button size="md" className="sm:self-end" onClick={addSpecificDate} disabled={!newDate}>
                  Add Open Play Date
                </Button>
              </div>

              <div className="mt-5 space-y-2">
                {specificSessions.length === 0 ? (
                  <p className="text-sm text-cream-dim">No Open Play dates scheduled yet.</p>
                ) : (
                  specificSessions.map((s) => (
                    <SessionRow key={s.id} session={s} onUpdate={openPlay.updateSession} onCancel={openPlay.cancelSession} />
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-cream-dim">Open Play every:</p>
              <div className="flex flex-wrap gap-2">
                {DISPLAY_WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      form.openPlayRecurringDays.includes(day)
                        ? 'border-lime-500 bg-lime-500/10 text-lime-400'
                        : 'border-white/10 bg-court-800 text-cream hover:bg-court-700'
                    }`}
                  >
                    {WEEKDAY_LABELS[day]}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <DateField
                  label="Start Date"
                  value={form.openPlayRecurringStartDate}
                  onChange={(v) => set('openPlayRecurringStartDate', v)}
                  min={todayISO()}
                />
                <DateField
                  label="End Date (optional)"
                  value={form.openPlayRecurringEndDate}
                  onChange={(v) => set('openPlayRecurringEndDate', v)}
                  min={form.openPlayRecurringStartDate || todayISO()}
                />
              </div>
              <p className="mt-2 text-xs text-cream-dim">
                Leave End Date blank to keep repeating until you turn Open Play off or change the schedule.
              </p>

              <Button
                size="md"
                className="mt-4"
                disabled={saving !== null || form.openPlayRecurringDays.length === 0 || !form.openPlayRecurringStartDate}
                onClick={() =>
                  save(
                    'Recurring schedule',
                    {
                      openPlayScheduleType: 'recurring',
                      openPlayRecurringDays: form.openPlayRecurringDays,
                      openPlayRecurringStartDate: form.openPlayRecurringStartDate,
                      openPlayRecurringEndDate: form.openPlayRecurringEndDate,
                    },
                    (updated) => openPlay.syncRecurringSessions(updated),
                  )
                }
              >
                {saving === 'Recurring schedule' ? 'Saving…' : 'Save Recurring Schedule'}
              </Button>

              <div className="mt-5 space-y-2">
                {recurringSessions.length === 0 ? (
                  <p className="text-sm text-cream-dim">
                    No recurring sessions generated yet — save the schedule above to create them.
                  </p>
                ) : (
                  recurringSessions
                    .slice(0, 8)
                    .map((s) => <SessionRow key={s.id} session={s} onUpdate={openPlay.updateSession} onCancel={openPlay.cancelSession} />)
                )}
                {recurringSessions.length > 8 && (
                  <p className="text-xs text-cream-dim">
                    +{recurringSessions.length - 8} more upcoming — manage the full list in the Open Play dashboard tab.
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function ScheduleTypeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-xl border font-display font-bold transition ${
        active ? 'border-lime-500 bg-lime-500/10 text-lime-400' : 'border-white/10 bg-court-800 text-cream hover:bg-court-700'
      }`}
    >
      {label}
    </button>
  )
}

function SessionRow({
  session,
  onUpdate,
  onCancel,
}: {
  session: { id: string; sessionDate: string; startTime: string; endTime: string; pricePerPlayer: number; playerLimit: number; registeredCount: number }
  onUpdate: (id: string, patch: Partial<{ sessionDate: string; startTime: string; endTime: string; pricePerPlayer: number; playerLimit: number }>) => Promise<void>
  onCancel: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [edit, setEdit] = useState({
    sessionDate: session.sessionDate,
    startTime: session.startTime,
    endTime: session.endTime,
    pricePerPlayer: session.pricePerPlayer,
    playerLimit: session.playerLimit,
  })
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    setBusy(true)
    try {
      await onUpdate(session.id, edit)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/5 bg-court-900/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-cream">{formatDateLong(session.sessionDate)}</p>
          <p className="text-xs text-cream-dim">
            {formatTime12h(session.startTime)} – {formatTime12h(session.endTime)} · ₱{session.pricePerPlayer}/player ·{' '}
            {session.registeredCount}/{session.playerLimit} registered
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-cream hover:bg-white/10"
          >
            {editing ? 'Close' : 'Edit'}
          </button>
          <button
            onClick={() => onCancel(session.id)}
            className="rounded-lg bg-red-400/10 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-400/20"
          >
            Cancel
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
          <DateField label="Date" value={edit.sessionDate} onChange={(v) => setEdit((e) => ({ ...e, sessionDate: v }))} />
          <div />
          <TimeField label="Start" value={edit.startTime} onChange={(v) => setEdit((e) => ({ ...e, startTime: v }))} />
          <TimeField label="End" value={edit.endTime} onChange={(v) => setEdit((e) => ({ ...e, endTime: v }))} />
          <NumberField label="Price (₱)" value={edit.pricePerPlayer} onChange={(v) => setEdit((e) => ({ ...e, pricePerPlayer: v }))} />
          <NumberField label="Player Limit" value={edit.playerLimit} onChange={(v) => setEdit((e) => ({ ...e, playerLimit: v }))} />
          <Button size="md" className="col-span-2" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  )
}

