import { useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { useOpenPlaySessions } from '../../hooks/useOpenPlaySessions'
import { useOpenPlayRoster } from '../../hooks/useOpenPlayRoster'
import { useOpenPlayChat } from '../../hooks/useOpenPlayChat'
import { getMyOpenPlayRegistrationId, saveMyOpenPlayRegistration } from '../../lib/myOpenPlayRegistrations'
import { formatDateLong, formatDateShort, formatTime12h, formatTimeRange12h, todayISO } from '../../lib/time'
import { getErrorMessage, logError } from '../../lib/errors'
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
              <OpenPlayCard
                key={session.id}
                session={session}
                addRegistration={openPlay.addRegistration}
                addPlayer={openPlay.addPlayer}
              />
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
  addPlayer,
}: {
  session: OpenPlaySessionWithCount
  addRegistration: (sessionId: string, name: string, mobile: string, facebookName?: string) => Promise<RegisterOpenPlayResult>
  addPlayer: (sessionId: string, participantId: string, playerName: string) => Promise<RegisterOpenPlayResult>
}) {
  const { settings } = useSettings()
  const roster = useOpenPlayRoster(session.id)
  const [joining, setJoining] = useState(false)
  const [showPlayers, setShowPlayers] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [addingPlayer, setAddingPlayer] = useState(false)
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
  const chatAvailable = settings.openPlayChatEnabled && session.chatEnabled

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

  async function handleAddPlayer(playerName: string): Promise<RegisterOpenPlayResult> {
    if (!myRegistrationId) {
      return {
        success: false,
        reason: 'You must be registered for this session to add players.',
        registrationId: null,
        status: null,
        registeredCount: 0,
        remainingSlots: 0,
      }
    }
    const result = await addPlayer(session.id, myRegistrationId, playerName)
    // The added player's own roster entry needs its own refresh here — the
    // card's `addPlayer` already refreshes session counts, but the roster
    // (names) hook has its own state and, in demo mode with no Realtime,
    // won't otherwise know a new row exists until this explicit refresh.
    if (result.success) await roster.refresh()
    return result
  }

  return (
    <>
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

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setShowPlayers(true)}
          className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-bold text-cream hover:bg-white/10"
        >
          View Players
        </button>
        {alreadyJoined && myStatus === 'joined' && (
          <button
            type="button"
            onClick={() => setShowChat(true)}
            className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-bold text-cream hover:bg-white/10"
          >
            Open Play Chat
          </button>
        )}
      </div>

      {alreadyJoined && !joining ? (
        <div className="text-center">
          <p className="text-sm font-semibold text-lime-500">
            {myStatus === 'waitlisted'
              ? "✓ You're on the waitlist! We'll notify you if a spot opens."
              : "✓ You're registered for this session!"}
          </p>
          {myStatus === 'joined' && (
            <>
              {spotsLeft > 0 ? (
                <Button size="md" variant="secondary" className="mt-3" onClick={() => setAddingPlayer(true)}>
                  Add Player
                </Button>
              ) : (
                <p className="mt-3 font-display text-xs font-extrabold uppercase tracking-wide text-red-300">Session Full</p>
              )}
            </>
          )}
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
          <input
            type="text"
            value={facebookName}
            onChange={(e) => setFacebookName(e.target.value)}
            placeholder="Facebook Name (optional)"
            className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
          />
          <p className="text-xs text-cream-dim">
            Your name will be visible on the Open Play player list. Players who join may also see your name in the Open
            Play chat.
          </p>
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

    </Card>

    {/* Rendered as a sibling of Card, not inside it — Card uses backdrop-blur,
        and a `backdrop-filter` (or transform/filter/will-change) ancestor
        creates a new containing block for `position: fixed` descendants,
        which was confining this modal's "fixed inset-0" to the Card's own
        small box instead of the full viewport (the actual cause of the
        "blank screen" — the overlay was rendering, just squeezed into a tiny
        region instead of covering the page). */}
    {showPlayers && (
      <WhosPlayingModal
        session={session}
        roster={roster}
        onClose={() => setShowPlayers(false)}
        onRequestJoin={() => {
          setShowPlayers(false)
          setJoining(true)
        }}
      />
    )}

    {showChat && <OpenPlayChatModal session={session} chatAvailable={chatAvailable} onClose={() => setShowChat(false)} />}

    {addingPlayer && <AddPlayerModal onAdd={handleAddPlayer} onClose={() => setAddingPlayer(false)} />}
    </>
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

function AddPlayerModal({
  onAdd,
  onClose,
}: {
  onAdd: (playerName: string) => Promise<RegisterOpenPlayResult>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  async function handleAdd() {
    if (!name.trim()) {
      setError('Enter a player name.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await onAdd(name.trim())
      if (!result.success) {
        setError(result.reason || 'Player could not be added. Please try again.')
        return
      }
      setAdded(name.trim())
      setName('')
    } catch (err) {
      // The previous version had no catch here at all: if the request threw
      // (a real backend/network failure, not just a business-rule rejection
      // like "session full"), the exception silently escaped as an
      // unhandled rejection — no error shown, no success shown, the button
      // just reset. This is what "nothing happens when I click Add Player"
      // actually was.
      logError('Failed to add Open Play player:', err)
      setError(getErrorMessage(err, 'Player could not be added. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-3xl bg-court-900 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:max-w-sm sm:rounded-3xl"
      >
        {added ? (
          <div className="text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-lime-500/15 text-3xl">✅</div>
            <h2 className="font-display text-xl font-extrabold text-cream">Player Added!</h2>
            <p className="mt-1 text-sm text-cream-dim">{added} has been added to this session.</p>
            <div className="mt-5 flex gap-2">
              <Button fullWidth onClick={() => setAdded(null)}>
                Add Another
              </Button>
              <Button fullWidth variant="secondary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold text-cream">Add Player</h2>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-cream hover:bg-white/10">
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAdd()
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Player Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  autoFocus
                  className="h-12 w-full rounded-xl border border-white/10 bg-court-800 px-4 text-base text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                />
              </label>

              {error && <p className="mt-3 text-sm font-medium text-red-400">{error}</p>}

              <Button type="submit" fullWidth size="lg" className="mt-5" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add Player'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function WhosPlayingModal({
  session,
  roster,
  onClose,
  onRequestJoin,
}: {
  session: OpenPlaySessionWithCount
  /** Reuses the same OpenPlayCard's already-fetched roster (and its single
   *  live subscription) instead of fetching again — a second independent
   *  useOpenPlayRoster() call here used to open a second Realtime
   *  subscription to the exact same channel topic the instant this modal
   *  mounted, which is what was crashing the whole page to a blank screen. */
  roster: ReturnType<typeof useOpenPlayRoster>
  onClose: () => void
  onRequestJoin: () => void
}) {
  const { settings } = useSettings()
  const myRegistrationId = getMyOpenPlayRegistrationId(session.id)
  const alreadyJoined = myRegistrationId !== null
  const spotsLeft = Math.max(0, session.playerLimit - session.registeredCount)

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-court-900 p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:max-w-sm sm:rounded-3xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-cream">Open Play Players</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-cream hover:bg-white/10">
            ✕
          </button>
        </div>
        <p className="text-sm text-cream-dim">{formatDateLong(session.sessionDate)}</p>
        <p className="text-sm text-cream-dim">{formatTimeRange12h(session.startTime, session.endTime)}</p>
        <p className="mb-4 mt-1 font-display text-sm font-bold text-lime-500">
          {session.registeredCount} / {session.playerLimit} Players Joined
        </p>

        {roster.loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ) : roster.error ? (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-center">
            <p className="text-sm text-red-300">{roster.error}</p>
            <button onClick={roster.refresh} className="mt-2 text-xs font-bold text-cream underline underline-offset-2">
              Try again
            </button>
          </div>
        ) : !settings.openPlayShowPlayerList ? (
          <p className="rounded-xl bg-white/5 p-4 text-center text-sm text-cream-dim">
            The player list is currently private — only the joined/waitlisted counts are shown.
          </p>
        ) : roster.joined.length === 0 ? (
          <p className="text-sm text-cream-dim">No players have joined yet.</p>
        ) : (
          <>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cream-dim">Players</p>
            <div className="space-y-1.5">
              {roster.joined.map((p, i) => (
                <p key={p.registrationId} className="text-sm text-cream">
                  {i + 1}. {p.displayName}
                  {p.registrationId === myRegistrationId && <span className="ml-1 font-bold text-lime-400">— YOU</span>}
                </p>
              ))}
            </div>
          </>
        )}

        {settings.openPlayShowPlayerList && !roster.error && roster.waitlisted.length > 0 && (
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

function OpenPlayChatModal({
  session,
  chatAvailable,
  onClose,
}: {
  session: OpenPlaySessionWithCount
  chatAvailable: boolean
  onClose: () => void
}) {
  const chat = useOpenPlayChat(session.id)
  const [text, setText] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)

  async function handleSend() {
    if (!text.trim()) return
    setSendError(null)
    const result = await chat.sendMessage(text.trim())
    if (!result.success) {
      setSendError(result.reason || 'Could not send your message. Please try again.')
      return
    }
    setText('')
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="flex h-[85vh] w-full flex-col rounded-t-3xl bg-court-900 p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:h-[70vh] sm:max-w-sm sm:rounded-3xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-cream">Open Play Chat</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-cream hover:bg-white/10">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-cream-dim">
          {formatDateShort(session.sessionDate)} · {formatTimeRange12h(session.startTime, session.endTime)}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-court-800/60 p-3">
          {!chatAvailable ? (
            <p className="mt-6 text-center text-sm text-cream-dim">Chat is currently unavailable for this Open Play session.</p>
          ) : !chat.canAccess ? (
            <p className="mt-6 text-center text-sm text-cream-dim">Join this Open Play session to view and post in the chat.</p>
          ) : chat.loading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ) : chat.error ? (
            <div className="mt-6 text-center">
              <p className="text-sm text-red-300">{chat.error}</p>
              <button onClick={chat.refresh} className="mt-2 text-xs font-bold text-cream underline underline-offset-2">
                Try again
              </button>
            </div>
          ) : chat.messages.length === 0 ? (
            <p className="mt-6 text-center text-sm text-cream-dim">No messages yet — say hi!</p>
          ) : (
            <div className="space-y-3">
              {chat.messages.map((m) => (
                <div key={m.id} className={m.isMe ? 'text-right' : ''}>
                  <p className="text-xs font-bold text-lime-500">{m.isMe ? 'You' : m.participantName}</p>
                  <p className="whitespace-pre-wrap text-sm text-cream">{m.message}</p>
                  <p className="text-[10px] text-cream-dim">{new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {chatAvailable && chat.canAccess && (
          <div className="mt-3 shrink-0">
            {sendError && <p className="mb-2 text-xs font-medium text-red-400">{sendError}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                placeholder="Type a message…"
                rows={1}
                maxLength={500}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                className="h-11 flex-1 resize-none rounded-xl border border-white/10 bg-court-800 px-3 py-2.5 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
              />
              <Button size="md" onClick={handleSend} disabled={chat.sending || !text.trim()}>
                Send
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
