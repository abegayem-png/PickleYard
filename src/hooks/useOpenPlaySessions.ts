import { useCallback, useEffect, useState } from 'react'
import { store } from '../lib/store'
import { buildRecurringSessionInputs, withoutExistingDates } from '../lib/openPlay'
import type { OpenPlaySessionInput, OpenPlaySessionWithCount, OpenPlayRegistration, Settings } from '../types'

export function useOpenPlaySessions() {
  const [sessions, setSessions] = useState<OpenPlaySessionWithCount[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const s = await store.listOpenPlaySessions()
    setSessions(s)
    return s
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const createSpecificSession = useCallback(
    async (input: OpenPlaySessionInput) => {
      await store.createOpenPlaySession(input)
      await refresh()
    },
    [refresh],
  )

  const updateSession = useCallback(
    async (id: string, patch: Partial<OpenPlaySessionInput>) => {
      await store.updateOpenPlaySession(id, patch)
      await refresh()
    },
    [refresh],
  )

  const cancelSession = useCallback(
    async (id: string) => {
      await store.cancelOpenPlaySession(id)
      await refresh()
    },
    [refresh],
  )

  /** Materializes any missing recurring sessions implied by the current settings. Safe to call repeatedly. */
  const syncRecurringSessions = useCallback(
    async (settings: Settings) => {
      if (settings.openPlayScheduleType !== 'recurring' || settings.openPlayRecurringDays.length === 0) return
      const existing = await store.listOpenPlaySessions()
      const wanted = buildRecurringSessionInputs(settings)
      const missing = withoutExistingDates(wanted, existing)
      if (missing.length > 0) {
        await store.createOpenPlaySessions(missing)
        await refresh()
      }
    },
    [refresh],
  )

  const listRegistrations = useCallback((sessionId: string): Promise<OpenPlayRegistration[]> => {
    return store.listOpenPlayRegistrations(sessionId)
  }, [])

  const addRegistration = useCallback(
    async (sessionId: string, playerName: string, mobileNumber: string, facebookName?: string) => {
      await store.addOpenPlayRegistration({ sessionId, playerName, mobileNumber, facebookName })
      await refresh()
    },
    [refresh],
  )

  const removeRegistration = useCallback(
    async (registrationId: string) => {
      await store.removeOpenPlayRegistration(registrationId)
      await refresh()
    },
    [refresh],
  )

  return {
    sessions,
    loading,
    refresh,
    createSpecificSession,
    updateSession,
    cancelSession,
    syncRecurringSessions,
    listRegistrations,
    addRegistration,
    removeRegistration,
  }
}
