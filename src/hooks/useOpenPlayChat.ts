import { useCallback, useEffect, useState } from 'react'
import { store } from '../lib/store'
import { subscribeToOpenPlayMessages } from '../lib/openPlayRealtime'
import { getMyOpenPlayRegistrationId } from '../lib/myOpenPlayRegistrations'
import { getErrorMessage, logError } from '../lib/errors'
import type { OpenPlayMessage } from '../types'

/** One Open Play session's chat thread. Access is entirely keyed off the
 *  registration id already saved locally when the visitor joined (see
 *  lib/myOpenPlayRegistrations.ts) — no separate account or login. If this
 *  device never joined this exact session, `canAccess` is false and
 *  nothing is fetched: per the "only joined players can view and post"
 *  preference, non-participants don't see the thread at all. */
export function useOpenPlayChat(sessionId: string) {
  const participantId = getMyOpenPlayRegistrationId(sessionId)
  const canAccess = participantId !== null

  const [messages, setMessages] = useState<OpenPlayMessage[]>([])
  const [loading, setLoading] = useState(canAccess)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const refresh = useCallback(async () => {
    if (!participantId) return
    try {
      const list = await store.getOpenPlayMessages(sessionId, participantId)
      setMessages(list)
      setError(null)
    } catch (err) {
      logError('Failed to load Open Play chat:', err)
      setError(getErrorMessage(err, 'Chat could not be loaded. Please try again.'))
    }
  }, [sessionId, participantId])

  useEffect(() => {
    if (!canAccess) {
      setLoading(false)
      return
    }
    setLoading(true)
    refresh().finally(() => setLoading(false))
    const unsubscribe = subscribeToOpenPlayMessages(sessionId, refresh)
    return unsubscribe
  }, [sessionId, canAccess, refresh])

  const sendMessage = useCallback(
    async (text: string): Promise<{ success: boolean; reason: string | null }> => {
      if (!participantId) return { success: false, reason: 'You must join this Open Play session before posting in chat.' }
      setSending(true)
      try {
        const result = await store.sendOpenPlayMessage(sessionId, participantId, text)
        if (result.success) await refresh()
        return { success: result.success, reason: result.reason }
      } catch (err) {
        return { success: false, reason: getErrorMessage(err, 'Could not send your message. Please try again.') }
      } finally {
        setSending(false)
      }
    },
    [sessionId, participantId, refresh],
  )

  return { canAccess, messages, loading, error, sending, sendMessage, refresh }
}
