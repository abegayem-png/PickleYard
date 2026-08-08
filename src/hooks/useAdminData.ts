import { useCallback, useEffect, useState } from 'react'
import { store } from '../lib/store'
import type { Booking, BlockedSlot } from '../types'

export function useAdminData() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [b, s] = await Promise.all([store.listBookings(), store.listBlockedSlots()])
    setBookings(b)
    setBlockedSlots(s)
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const approveBooking = useCallback(
    async (id: string) => {
      await store.updateBookingStatus(id, 'confirmed')
      await refresh()
    },
    [refresh],
  )

  const cancelBooking = useCallback(
    async (id: string) => {
      await store.cancelBooking(id)
      await refresh()
    },
    [refresh],
  )

  const markPaid = useCallback(
    async (id: string) => {
      await store.updateBookingPayment(id, 'paid')
      await refresh()
    },
    [refresh],
  )

  const markUnpaid = useCallback(
    async (id: string) => {
      await store.updateBookingPayment(id, 'unpaid')
      await refresh()
    },
    [refresh],
  )

  const deleteBooking = useCallback(
    async (id: string) => {
      await store.deleteBooking(id)
      await refresh()
    },
    [refresh],
  )

  const addBlockedSlot = useCallback(
    async (input: Omit<BlockedSlot, 'id' | 'createdAt'>) => {
      await store.addBlockedSlot(input)
      await refresh()
    },
    [refresh],
  )

  const removeBlockedSlot = useCallback(
    async (id: string) => {
      await store.removeBlockedSlot(id)
      await refresh()
    },
    [refresh],
  )

  return {
    bookings,
    blockedSlots,
    loading,
    refresh,
    approveBooking,
    cancelBooking,
    markPaid,
    markUnpaid,
    deleteBooking,
    addBlockedSlot,
    removeBlockedSlot,
  }
}
