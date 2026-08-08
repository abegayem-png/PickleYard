import type { Booking, BookingInput, BookingStatus, PaymentStatus, BlockedSlot, Settings } from '../../types'

/** Lightweight shape used only for availability/pricing checks — no customer PII. */
export interface AvailabilityRow {
  bookingDate: string
  startTime: string
  endTime: string
  status: BookingStatus
}

export interface DataStore {
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<Settings>

  /** Non-sensitive rows for a given date, used to compute available slots. */
  getAvailabilityForDate(date: string): Promise<AvailabilityRow[]>
  /** Non-sensitive rows across a date range, used for the admin calendar view. */
  getAvailabilityForRange(startDate: string, endDate: string): Promise<AvailabilityRow[]>

  /** Admin: full booking list (optionally filtered). */
  listBookings(): Promise<Booking[]>
  getBooking(id: string): Promise<Booking | null>
  findBookingByReference(reference: string, mobileNumber: string): Promise<Booking | null>

  createBooking(input: BookingInput): Promise<Booking>
  updateBookingStatus(id: string, status: BookingStatus): Promise<Booking>
  updateBookingPayment(id: string, paymentStatus: PaymentStatus): Promise<Booking>
  cancelBooking(id: string): Promise<Booking>
  deleteBooking(id: string): Promise<void>

  listBlockedSlots(): Promise<BlockedSlot[]>
  addBlockedSlot(input: Omit<BlockedSlot, 'id' | 'createdAt'>): Promise<BlockedSlot>
  removeBlockedSlot(id: string): Promise<void>
}
