import type {
  Booking,
  BookingInput,
  BookingStatus,
  PaymentStatus,
  BlockedSlot,
  Settings,
  OpenPlaySession,
  OpenPlaySessionInput,
  OpenPlaySessionWithCount,
  OpenPlayRegistration,
  OpenPlayRegistrationInput,
  PromoCode,
  PromoCodeInput,
  PromoPreview,
  ActivePromoBanner,
  MiniMartItem,
  MiniMartItemInput,
  MiniMartOrder,
  MiniMartOrderStatus,
  PlaceMiniMartOrderInput,
  PlaceOrderResult,
  MiniMartOrderStatusLookup,
} from '../../types'

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

  /** All sessions (any status) with their public registration counts. */
  listOpenPlaySessions(): Promise<OpenPlaySessionWithCount[]>
  /** Scheduled-only sessions for a date, used to block regular court bookings. */
  getOpenPlaySessionsForDate(date: string): Promise<OpenPlaySession[]>
  createOpenPlaySession(input: OpenPlaySessionInput): Promise<OpenPlaySession>
  createOpenPlaySessions(inputs: OpenPlaySessionInput[]): Promise<OpenPlaySession[]>
  updateOpenPlaySession(id: string, patch: Partial<OpenPlaySessionInput>): Promise<OpenPlaySession>
  cancelOpenPlaySession(id: string): Promise<OpenPlaySession>

  listOpenPlayRegistrations(sessionId: string): Promise<OpenPlayRegistration[]>
  addOpenPlayRegistration(input: OpenPlayRegistrationInput): Promise<OpenPlayRegistration>
  removeOpenPlayRegistration(id: string): Promise<void>

  /** Admin: every promo code, any status. */
  listPromoCodes(): Promise<PromoCode[]>
  createPromoCode(input: PromoCodeInput): Promise<PromoCode>
  updatePromoCode(id: string, patch: Partial<PromoCodeInput>): Promise<PromoCode>
  deletePromoCode(id: string): Promise<void>

  /** Trusted validation + pricing preview — always authoritative (DB/RPC in production). */
  previewPromoCode(
    code: string,
    bookingDate: string,
    startHour: number,
    duration: number,
    mobileNumber: string,
  ): Promise<PromoPreview>

  /** The one promo code (if any) currently eligible to show its public banner. */
  getActivePromoBanner(): Promise<ActivePromoBanner | null>

  /** All Mini Mart products, any status — the public page filters sold-out items client-side. */
  listMiniMartItems(): Promise<MiniMartItem[]>
  createMiniMartItem(input: MiniMartItemInput): Promise<MiniMartItem>
  updateMiniMartItem(id: string, patch: Partial<MiniMartItemInput>): Promise<MiniMartItem>
  deleteMiniMartItem(id: string): Promise<void>
  /** Atomic relative stock change (clamped at 0) — safe against stale reads,
   *  used by the admin's quick +1/+5/-1/-5 buttons. */
  adjustMiniMartItemStock(id: string, delta: number): Promise<MiniMartItem>

  /** Trusted order placement — recalculates pricing from mini_mart_items server-side. */
  placeMiniMartOrder(input: PlaceMiniMartOrderInput): Promise<PlaceOrderResult>
  /** Narrow, PII-free status check for the customer's own just-placed order. */
  getMiniMartOrderStatus(orderNumber: string): Promise<MiniMartOrderStatusLookup | null>

  /** Admin: every order (any status), with its line items, newest first. */
  listMiniMartOrders(): Promise<MiniMartOrder[]>
  updateMiniMartOrderStatus(id: string, status: MiniMartOrderStatus): Promise<MiniMartOrder>
}
