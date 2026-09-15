import { useCallback, useEffect, useState } from 'react'
import { store } from '../lib/store'
import type { FreePlayParticipant } from '../types'

/** Admin-only: every Free Play participant for one date. */
export function useFreePlayParticipants(date: string) {
  const [participants, setParticipants] = useState<FreePlayParticipant[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = await store.listFreePlayParticipants(date)
    setParticipants(list)
    return list
  }, [date])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const removeParticipant = useCallback(
    async (id: string) => {
      await store.removeFreePlayParticipant(id)
      await refresh()
    },
    [refresh],
  )

  const clearSlot = useCallback(
    async (startTime: string, endTime: string) => {
      await store.clearFreePlaySlot(date, startTime, endTime)
      await refresh()
    },
    [date, refresh],
  )

  return { participants, loading, refresh, removeParticipant, clearSlot }
}
