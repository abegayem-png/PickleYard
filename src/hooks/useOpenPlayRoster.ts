import { useCallback, useEffect, useState } from 'react'
import { store } from '../lib/store'
import { subscribeToOpenPlayRegistrations } from '../lib/openPlayRealtime'
import type { OpenPlayPublicRosterEntry } from '../types'

/** Public, safe-names-only roster for one Open Play session — shared by the
 *  homepage card's social-proof preview and the "Who's Playing" modal so
 *  both read the same live data instead of fetching twice. Automatically
 *  empty when the owner has the player list turned off (enforced
 *  server-side by get_open_play_public_roster, not just hidden here). */
export function useOpenPlayRoster(sessionId: string) {
  const [roster, setRoster] = useState<OpenPlayPublicRosterEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = await store.getOpenPlayPublicRoster(sessionId)
    setRoster(list)
  }, [sessionId])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
    const unsubscribe = subscribeToOpenPlayRegistrations(sessionId, refresh)
    return unsubscribe
  }, [sessionId, refresh])

  const joined = roster.filter((r) => r.status === 'joined')
  const waitlisted = roster.filter((r) => r.status === 'waitlisted')

  return { loading, roster, joined, waitlisted, refresh }
}
