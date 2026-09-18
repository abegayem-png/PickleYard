import { useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { useOpenPlaySessions } from '../../hooks/useOpenPlaySessions'
import { useOpenPlayRoster } from '../../hooks/useOpenPlayRoster'
import { getMyOpenPlayRegistrationId, saveMyOpenPlayRegistration } from '../../lib/myOpenPlayRegistrations'
import { formatDateShort, formatTime12h, todayISO } from '../../lib/time'
import { getErrorMessage } from '../../lib/errors'
import type { OpenPlaySessionWithCount, RegisterOpenPlayResult } from '../../types'
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
  addRegistration: (sessionId: string, name: string, mobile: string, facebookName?: string) => Promise<RegisterOpenPlayResult>
}) {
  const { settings } = useSettings()
  const roster = useOpenPlayRoster(session.id)
  const [joining, setJoining] = useState(false)
  const [showPlayers, setShowPlayers] = useState(false)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [facebookName, setFacebookName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<RegisterOpenPlayResult | null>(null)

  const spotsLeft = Math.max(0, session.playerLimit - session.registeredCount)
  const myRegistrationId = getMyOpenPlayRegistrationId(session.id)
  const alreadyJoined = Boolean(outcome?.success) || myRegistrationId !== null
  const myStatus = outcome?.status ?? roster.roster.find((r) => r.registrationId === myRegistrationId)?.status ?? null

  async function handleJoin() {
    if (!name.trim() || !mobile.trim()) {
      setError('Enter your name and mobile number.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await addRegistration(session.id, name.trim(), mobile.trim(), facebookName.trim())
      if (!result.success) {
        setError(result.reason || 'Could not join — please try again.')
        return
      }
      if (result.registrationId) saveMyOpenPlayRegistration(session.id, result.registrationId)
      setOutcome(result)
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
          <button
            type="button"
            onClick={() => setShowPlayers(true)}
            className="font-display text-xl font-extrabold text-cream underline decoration-lime-500/40 decoration-2 underline-offset-4 hover:text-lime-400"
          >
            {session.registeredCount} / {session.playerLimit}
          </button>
          <p className="text-xs text-cream-dim">Players Joined</p>
          {session.waitlistedCount > 0 && <p className="mt-0.5 text-xs font-semibold text-amber-300">{session.waitlistedCount} waiting</p>}
        </div>
      </div>

      {settings.openPlayShowPlayerList && !roster.loading && roster.joined.length > 0 && (
        <RosterPreview joined={roster.joined} onViewAll={() => setShowPlayers(true)} />
      )}

      <div className="my-3 h-px bg-white/10" />

      <button
        type="button"
        onClick={() => setShowPlayers(true)}
        className="mb-3 w-full rounded-xl bg-white/5 py-2.5 text-sm font-bold text-cream hover:bg-white/10"
      >
        View Players
      </button>

      {alreadyJoined && !joining ? (
        <p className="text-center text-sm font-semibold text-lime-500">
          {myStatus === 'waitlisted'
            ? "✓ You're on the waitlist! We'll notify you if a spot opens."
            : "✓ You're registered for this session!"}
        </p>
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
          <input
            type="text"
            value={facebookName}
            onChange={(e) => setFacebookName(e.target.value)}
            placeholder="Facebook Name (optional)"
            className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
          />
          {error && <p className="text-xs font-medium text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button size="md" fullWidth onClick={handleJoin} disabled={submitting}>
              {submitting ? 'Joining…' : spotsLeft > 0 ? 'Confirm Spot' : 'Join Waitlist'}
            </Button>
            <Button size="md" variant="ghost" onClick={() => setJoining(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-3 text-center text-xs text-cream-dim">
            {spotsLeft > 0 ? `${spotsLeft} slot${spotsLeft === 1 ? '' : 's'} remaining` : 'Session full — join the waitlist'}
          </p>
          <Button fullWidth onClick={() => setJoining(true)}>
            {spotsLeft > 0 ? 'Join Open Play' : 'Join Waitlist'}
          </Button>
        </>
      )}

      {showPlayers && (
        <WhosPlayingModal
          session={session}
          onClose={() => setShowPlayers(false)}
          onRequestJoin={() => {
            setShowPlayers(false)
            setJoining(true)
          }}
        />
      )}
    </Card>
  )
}

function RosterPreview({ joined, onViewAll }: { joined: { displayName: string }[]; onViewAll: () => void }) {
  const shown = joined.slice(0, 3)
  const extra = joined.length - shown.length
  return (
    <button
      type="button"
      onClick={onViewAll}
      className="mt-2 block w-full truncate text-left text-xs text-cream-dim hover:text-cream"
    >
      {shown.map((p) => p.displayName).join(', ')}
      {extra > 0 && ` +${extra} more`}
    </button>
  )
}

function WhosPlayingModal({
  session,
  onClose,
  onRequestJoin,
}: {
  session: OpenPlaySessionWithCount
  onClose: () => void
  onRequestJoin: () => void
}) {
  const { settings } = useSettings()
  const roster = useOpenPlayRoster(session.id)
  const myRegistrationId = getMyOpenPlayRegistrationId(session.id)
  const alreadyJoined = myRegistrationId !== null
  const spotsLeft = Math.max(0, session.playerLimit - session.registeredCount)

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-court-900 p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:max-w-sm sm:rounded-3xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-cream">Who's Playing</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-cream hover:bg-white/10">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-cream-dim">
          {session.registeredCount} of {session.playerLimit} Players
        </p>

        {roster.loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ) : !settings.openPlayShowPlayerList ? (
          <p className="rounded-xl bg-white/5 p-4 text-center text-sm text-cream-dim">
            The player list is currently private — only the joined/waitlisted counts are shown.
          </p>
        ) : roster.joined.length === 0 ? (
          <p className="text-sm text-cream-dim">No one has joined yet — be the first!</p>
        ) : (
          <div className="space-y-1.5">
            {roster.joined.map((p, i) => (
              <p key={p.registrationId} className="text-sm text-cream">
                <span className="text-lime-500">✓</span> {i + 1}. {p.displayName}
                {p.registrationId === myRegistrationId && <span className="ml-1 font-bold text-lime-400">— YOU</span>}
              </p>
            ))}
          </div>
        )}

        {settings.openPlayShowPlayerList && roster.waitlisted.length > 0 && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="font-display text-xs font-extrabold uppercase tracking-widest text-amber-300">Waitlist</p>
            <p className="mb-2 text-xs text-cream-dim">{roster.waitlisted.length} Players Waiting</p>
            <div className="space-y-1">
              {roster.waitlisted.map((p, i) => (
                <p key={p.registrationId} className="text-sm text-cream-dim">
                  {i + 1}. {p.displayName}
                  {p.registrationId === myRegistrationId && <span className="ml-1 font-bold text-lime-400">— YOU</span>}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-white/10 pt-4 text-center">
          <p className="mb-3 font-display text-sm font-bold text-cream">
            {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left` : 'Session full'}
          </p>
          {!alreadyJoined && (
            <Button fullWidth size="lg" onClick={onRequestJoin}>
              {spotsLeft > 0 ? 'Join Open Play' : 'Join Waitlist'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
