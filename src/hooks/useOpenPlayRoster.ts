import { useCallback, useEffect, useState } from 'react'
import { store } from '../lib/store'
import { subscribeToOpenPlayRegistrations } from '../lib/openPlayRealtime'
import { getErrorMessage, logError } from '../lib/errors'
import type { OpenPlayPublicRosterEntry } from '../types'

/** Public, safe-names-only roster for one Open Play session — shared by the
 *  homepage card's social-proof preview and the "Who's Playing" modal so
 *  both read the same live data instead of fetching twice. Automatically
 *  empty when the owner has the player list turned off (enforced
 *  server-side by get_open_play_public_roster, not just hidden here).
 *
 *  A failed fetch (e.g. a real backend error) sets `error` instead of
 *  silently leaving the roster empty — an empty roster on its own just
 *  means "no one has joined yet", which looks identical to a broken
 *  fetch unless the two are tracked separately. */
export function useOpenPlayRoster(sessionId: string) {
  const [roster, setRoster] = useState<OpenPlayPublicRosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await store.getOpenPlayPublicRoster(sessionId)
      setRoster(list)
      setError(null)
    } catch (err) {
      logError('Failed to load Open Play players:', err)
      setError(getErrorMessage(err, 'Players could not be loaded. Please try again.'))
    }
  }, [sessionId])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
    const unsubscribe = subscribeToOpenPlayRegistrations(sessionId, refresh)
    return unsubscribe
  }, [sessionId, refresh])

  const joined = roster.filter((r) => r.status === 'joined')
  const waitlisted = roster.filter((r) => r.status === 'waitlisted')

  return { loading, error, roster, joined, waitlisted, refresh }
}
