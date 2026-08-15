import { useCallback, useEffect, useState } from 'react'
import { store } from '../lib/store'
import type { PromoCode, PromoCodeInput } from '../types'

export function usePromoCodes() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = await store.listPromoCodes()
    setPromoCodes(list)
    return list
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const createPromoCode = useCallback(
    async (input: PromoCodeInput) => {
      await store.createPromoCode(input)
      await refresh()
    },
    [refresh],
  )

  const updatePromoCode = useCallback(
    async (id: string, patch: Partial<PromoCodeInput>) => {
      await store.updatePromoCode(id, patch)
      await refresh()
    },
    [refresh],
  )

  const deletePromoCode = useCallback(
    async (id: string) => {
      await store.deletePromoCode(id)
      await refresh()
    },
    [refresh],
  )

  return { promoCodes, loading, refresh, createPromoCode, updatePromoCode, deletePromoCode }
}
