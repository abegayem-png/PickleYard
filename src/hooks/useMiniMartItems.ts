import { useCallback, useEffect, useState } from 'react'
import { store } from '../lib/store'
import type { MiniMartItem, MiniMartItemInput } from '../types'

export function useMiniMartItems() {
  const [items, setItems] = useState<MiniMartItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = await store.listMiniMartItems()
    setItems(list)
    return list
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const createItem = useCallback(
    async (input: MiniMartItemInput) => {
      await store.createMiniMartItem(input)
      await refresh()
    },
    [refresh],
  )

  const updateItem = useCallback(
    async (id: string, patch: Partial<MiniMartItemInput>) => {
      await store.updateMiniMartItem(id, patch)
      await refresh()
    },
    [refresh],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      await store.deleteMiniMartItem(id)
      await refresh()
    },
    [refresh],
  )

  const adjustStock = useCallback(
    async (id: string, delta: number) => {
      await store.adjustMiniMartItemStock(id, delta)
      await refresh()
    },
    [refresh],
  )

  return { items, loading, refresh, createItem, updateItem, deleteItem, adjustStock }
}
