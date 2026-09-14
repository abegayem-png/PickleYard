import { useCallback, useEffect, useState } from 'react'
import { store } from '../lib/store'
import type { MiniMartInventoryLog } from '../types'

/** Admin-only: full stock-change history, optionally scoped to one product. */
export function useMiniMartInventoryLogs(itemId?: string) {
  const [logs, setLogs] = useState<MiniMartInventoryLog[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = await store.listMiniMartInventoryLogs(itemId)
    setLogs(list)
    return list
  }, [itemId])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  return { logs, loading, refresh }
}
