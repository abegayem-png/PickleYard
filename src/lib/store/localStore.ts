import type { Booking, BookingStatus, PaymentStatus, BlockedSlot, Settings } from '../../types'
import { DEFAULT_SETTINGS } from '../../types'
import { generateBookingReference } from '../pricing'
import type { AvailabilityRow, DataStore } from './types'

const KEYS = {
  bookings: 'pkl_bookings',
  blockedSlots: 'pkl_blocked_slots',
  settings: 'pkl_settings',
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const localStore: DataStore = {
  async getSettings() {
    return read<Settings>(KEYS.settings, DEFAULT_SETTINGS)
  },

  async updateSettings(patch) {
    const current = read<Settings>(KEYS.settings, DEFAULT_SETTINGS)
    const updated = { ...current, ...patch }
    write(KEYS.settings, updated)
    return updated
  },

  async getAvailabilityForDate(date) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    return bookings
      .filter((b) => b.bookingDate === date)
      .map((b) => ({ bookingDate: b.bookingDate, startTime: b.startTime, endTime: b.endTime, status: b.status }))
  },

  async getAvailabilityForRange(startDate, endDate) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    return bookings
      .filter((b) => b.bookingDate >= startDate && b.bookingDate <= endDate)
      .map((b) => ({ bookingDate: b.bookingDate, startTime: b.startTime, endTime: b.endTime, status: b.status }))
  },

  async listBookings() {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    return [...bookings].sort((a, b) =>
      a.bookingDate === b.bookingDate ? a.startTime.localeCompare(b.startTime) : a.bookingDate.localeCompare(b.bookingDate),
    )
  },

  async getBooking(id) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    return bookings.find((b) => b.id === id) ?? null
  },

  async findBookingByReference(reference, mobileNumber) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    const norm = (s: string) => s.replace(/\s|-/g, '')
    return (
      bookings.find(
        (b) =>
          b.bookingReference.toUpperCase() === reference.toUpperCase().trim() &&
          norm(b.mobileNumber) === norm(mobileNumber),
      ) ?? null
    )
  },

  async createBooking(input) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    const booking: Booking = {
      id: newId(),
      bookingReference: generateBookingReference(),
      status: 'pending',
      paymentStatus: 'unpaid',
      createdAt: new Date().toISOString(),
      ...input,
    }
    bookings.push(booking)
    write(KEYS.bookings, bookings)
    return booking
  },

  async updateBookingStatus(id, status: BookingStatus) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    const idx = bookings.findIndex((b) => b.id === id)
    if (idx === -1) throw new Error('Booking not found')
    bookings[idx] = { ...bookings[idx], status }
    write(KEYS.bookings, bookings)
    return bookings[idx]
  },

  async updateBookingPayment(id, paymentStatus: PaymentStatus) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    const idx = bookings.findIndex((b) => b.id === id)
    if (idx === -1) throw new Error('Booking not found')
    bookings[idx] = { ...bookings[idx], paymentStatus }
    write(KEYS.bookings, bookings)
    return bookings[idx]
  },

  async cancelBooking(id) {
    return localStore.updateBookingStatus(id, 'cancelled')
  },

  async deleteBooking(id) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    write(
      KEYS.bookings,
      bookings.filter((b) => b.id !== id),
    )
  },

  async listBlockedSlots() {
    const slots = read<BlockedSlot[]>(KEYS.blockedSlots, [])
    return [...slots].sort((a, b) => a.date.localeCompare(b.date))
  },

  async addBlockedSlot(input) {
    const slots = read<BlockedSlot[]>(KEYS.blockedSlots, [])
    const slot: BlockedSlot = { id: newId(), createdAt: new Date().toISOString(), ...input }
    slots.push(slot)
    write(KEYS.blockedSlots, slots)
    return slot
  },

  async removeBlockedSlot(id) {
    const slots = read<BlockedSlot[]>(KEYS.blockedSlots, [])
    write(
      KEYS.blockedSlots,
      slots.filter((s) => s.id !== id),
    )
  },
}

export type { AvailabilityRow }
