import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { store } from '../lib/store'
import { subscribeToMiniMartOrders } from '../lib/miniMartRealtime'
import { playNotificationBeep } from '../lib/notificationSound'
import type { MiniMartOrder, MiniMartOrderStatus } from '../types'

interface MiniMartOrdersContextValue {
  orders: MiniMartOrder[]
  loading: boolean
  newOrderCount: number
  updateStatus: (id: string, status: MiniMartOrderStatus) => Promise<void>
  newOrderToast: MiniMartOrder | null
  dismissToast: () => void
}

const MiniMartOrdersContext = createContext<MiniMartOrdersContextValue | null>(null)

/** Mounted once in AdminLayout so the realtime subscription, new-order toast,
 *  and notification sound are shared across every admin page — not
 *  re-subscribed (and re-announced) separately by the nav badge and the
 *  Orders page each running their own copy. */
export function MiniMartOrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<MiniMartOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [newOrderToast, setNewOrderToast] = useState<MiniMartOrder | null>(null)
  const knownIds = useRef<Set<string> | null>(null)

  const refresh = useCallback(async () => {
    const list = await store.listMiniMartOrders()

    // Skip announcing on the very first load so opening the dashboard
    // doesn't "announce" every pre-existing order at once.
    if (knownIds.current) {
      const freshlyNew = list.find((o) => o.status === 'new' && !knownIds.current!.has(o.id))
      if (freshlyNew) {
        setNewOrderToast(freshlyNew)
        playNotificationBeep()
      }
    }
    knownIds.current = new Set(list.map((o) => o.id))
    setOrders(list)
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
    const unsubscribe = subscribeToMiniMartOrders(() => refresh())
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateStatus = useCallback(
    async (id: string, status: MiniMartOrderStatus) => {
      await store.updateMiniMartOrderStatus(id, status)
      await refresh()
    },
    [refresh],
  )

  const newOrderCount = orders.filter((o) => o.status === 'new').length

  return (
    <MiniMartOrdersContext.Provider
      value={{ orders, loading, newOrderCount, updateStatus, newOrderToast, dismissToast: () => setNewOrderToast(null) }}
    >
      {children}
    </MiniMartOrdersContext.Provider>
  )
}

export function useMiniMartOrdersContext() {
  const ctx = useContext(MiniMartOrdersContext)
  if (!ctx) throw new Error('useMiniMartOrdersContext must be used within MiniMartOrdersProvider')
  return ctx
}
