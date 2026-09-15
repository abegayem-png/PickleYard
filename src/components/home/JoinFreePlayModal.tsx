import { useState } from 'react'
import type { JoinFreePlayResult } from '../../types'
import Button from '../ui/Button'

export default function JoinFreePlayModal({
  slotLabel,
  playDate,
  startTime,
  endTime,
  onJoin,
  onClose,
}: {
  slotLabel: string
  playDate: string
  startTime: string
  endTime: string
  onJoin: (playDate: string, startTime: string, endTime: string, participantName: string) => Promise<JoinFreePlayResult>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  async function handleJoin() {
    if (!name.trim()) {
      setError('Enter your name.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await onJoin(playDate, startTime, endTime, name.trim())
      if (!result.success) {
        setError(result.reason || 'Could not join Free Play. Please try again.')
        return
      }
      setJoined(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-court-900 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:max-w-sm sm:rounded-3xl">
        {joined ? (
          <div className="text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-lime-500/15 text-3xl">✅</div>
            <h2 className="font-display text-2xl font-extrabold text-cream">You're In!</h2>
            <p className="mt-1 text-sm text-cream-dim">See you at PickleYard.</p>
            <p className="mt-3 font-display text-lg font-bold text-lime-500">{slotLabel}</p>
            <Button fullWidth size="lg" className="mt-6" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold text-cream">Join Free Play</h2>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-cream hover:bg-white/10">
                ✕
              </button>
            </div>
            <p className="mb-5 text-sm font-semibold text-lime-500">{slotLabel}</p>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Your Name</span>
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

            <Button fullWidth size="lg" className="mt-5" onClick={handleJoin} disabled={submitting}>
              {submitting ? 'Joining…' : 'Join'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
