import { useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { useOpenPlaySessions } from '../../hooks/useOpenPlaySessions'
import { formatDateShort, formatTime12h, todayISO } from '../../lib/time'
import { getErrorMessage } from '../../lib/errors'
import type { OpenPlaySessionWithCount } from '../../types'
import Button from '../ui/Button'
import Card from '../ui/Card'

export default function OpenPlaySection() {
  const { settings } = useSettings()
  const openPlay = useOpenPlaySessions()

  if (!settings.openPlayEnabled) return null

  const upcoming = openPlay.sessions
    .filter((s) => s.status === 'scheduled' && s.sessionDate >= todayISO())
    .sort((a, b) => (a.sessionDate === b.sessionDate ? a.startTime.localeCompare(b.startTime) : a.sessionDate.localeCompare(b.sessionDate)))

  return (
    <section id="open-play" className="scroll-mt-20 bg-court-900/50 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-cream sm:text-4xl">Open Play</h2>
          <p className="mt-2 font-display text-lg font-bold text-lime-500">₱{settings.openPlayPrice} Per Player</p>
        </div>

        {openPlay.loading ? (
          <div className="mt-8 h-32 animate-pulse rounded-2xl bg-white/5" />
        ) : upcoming.length === 0 ? (
          <p className="mt-8 text-center text-sm text-cream-dim">No Open Play sessions scheduled right now — check back soon!</p>
        ) : (
          <div className="mt-8 space-y-4">
            {upcoming.length > 1 && (
              <p className="text-center text-xs font-bold uppercase tracking-widest text-cream-dim">Upcoming Open Play</p>
            )}
            {upcoming.map((session) => (
              <OpenPlayCard key={session.id} session={session} addRegistration={openPlay.addRegistration} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function OpenPlayCard({
  session,
  addRegistration,
}: {
  session: OpenPlaySessionWithCount
  addRegistration: (sessionId: string, name: string, mobile: string) => Promise<void>
}) {
  const [joining, setJoining] = useState(false)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  const slotsRemaining = Math.max(0, session.playerLimit - session.registeredCount)
  const isFull = slotsRemaining === 0

  async function handleJoin() {
    if (!name.trim() || !mobile.trim()) {
      setError('Enter your name and mobile number.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await addRegistration(session.id, name.trim(), mobile.trim())
      setJoined(true)
      setJoining(false)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not join — please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-extrabold text-cream">{formatDateShort(session.sessionDate)}</p>
          <p className="text-sm text-cream-dim">
            {formatTime12h(session.startTime)} – {formatTime12h(session.endTime)}
          </p>
          <p className="mt-1 text-xs font-semibold text-lime-500">₱{session.pricePerPlayer} per player</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-extrabold text-cream">
            {session.registeredCount} / {session.playerLimit}
          </p>
          <p className="text-xs text-cream-dim">Players Registered</p>
        </div>
      </div>

      <div className="my-3 h-px bg-white/10" />

      {joined ? (
        <p className="text-center text-sm font-semibold text-lime-500">✓ You're registered for this session!</p>
      ) : isFull ? (
        <div className="rounded-xl bg-red-400/10 py-3 text-center font-display text-sm font-extrabold uppercase tracking-wide text-red-300">
          Open Play Full
        </div>
      ) : joining ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="h-11 rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
            />
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Mobile Number"
              className="h-11 rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
            />
          </div>
          {error && <p className="text-xs font-medium text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button size="md" fullWidth onClick={handleJoin} disabled={submitting}>
              {submitting ? 'Joining…' : 'Confirm Spot'}
            </Button>
            <Button size="md" variant="ghost" onClick={() => setJoining(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-3 text-center text-xs text-cream-dim">{slotsRemaining} slot{slotsRemaining === 1 ? '' : 's'} remaining</p>
          <Button fullWidth onClick={() => setJoining(true)}>
            Join Open Play
          </Button>
        </>
      )}
    </Card>
  )
}
