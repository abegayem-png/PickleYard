import type {
  Booking,
  BookingStatus,
  PaymentStatus,
  BlockedSlot,
  Settings,
  OpenPlaySession,
  OpenPlayRegistration,
  PromoCode,
  PromoPreview,
  MiniMartItem,
  MiniMartOrder,
  MiniMartOrderItem,
  MiniMartOrderStatus,
  MiniMartInventoryLog,
  MiniMartInventoryReason,
  FreePlayParticipant,
  OpenPlayMessageAdmin,
} from '../../types'
import { DEFAULT_SETTINGS } from '../../types'
import { calculatePrice, generateBookingReference } from '../pricing'
import { checkPromoEligibility, normalizePromoCode, GENERIC_INVALID_MESSAGE } from '../promo'
import { rangesOverlap, timeToHour, timeToMinutes, todayISO } from '../time'
import type { AvailabilityRow, DataStore } from './types'

const KEYS = {
  bookings: 'pkl_bookings',
  blockedSlots: 'pkl_blocked_slots',
  settings: 'pkl_settings',
  openPlaySessions: 'pkl_open_play_sessions',
  openPlayRegistrations: 'pkl_open_play_registrations',
  promoCodes: 'pkl_promo_codes',
  miniMartItems: 'pkl_mini_mart_items',
  miniMartOrders: 'pkl_mini_mart_orders',
  miniMartOrderSeq: 'pkl_mini_mart_order_seq',
  miniMartInventoryLogs: 'pkl_mini_mart_inventory_logs',
  freePlayParticipants: 'pkl_free_play_participants',
  openPlayMessages: 'pkl_open_play_messages',
}

/** Mirrors join_free_play()'s server-side conflict check: a slot only
 *  counts as free if nothing else — an active booking, a blocked slot, or
 *  (when configured to) an Open Play session — already covers it. */
function isFreePlaySlotBooked(playDate: string, startTime: string, endTime: string, settings: Settings): boolean {
  const startMin = timeToMinutes(startTime)
  const endMin = timeToMinutes(endTime)

  const bookings = read<Booking[]>(KEYS.bookings, [])
  if (
    bookings.some(
      (b) => b.bookingDate === playDate && b.status !== 'cancelled' && rangesOverlap(startMin, endMin, timeToMinutes(b.startTime), timeToMinutes(b.endTime)),
    )
  ) {
    return true
  }

  const blocked = read<BlockedSlot[]>(KEYS.blockedSlots, [])
  if (
    blocked.some((b) => {
      if (b.date !== playDate) return false
      const bStart = timeToMinutes(b.allDay ? settings.openingTime : b.startTime)
      const bEnd = timeToMinutes(b.allDay ? settings.closingTime : b.endTime)
      return rangesOverlap(startMin, endMin, bStart, bEnd)
    })
  ) {
    return true
  }

  if (settings.openPlayBlockBookings) {
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    if (
      sessions.some(
        (s) => s.sessionDate === playDate && s.status === 'scheduled' && rangesOverlap(startMin, endMin, timeToMinutes(s.startTime), timeToMinutes(s.endTime)),
      )
    ) {
      return true
    }
  }

  return false
}

function nextMiniMartOrderNumber(): string {
  const current = Number(localStorage.getItem(KEYS.miniMartOrderSeq) || '1000')
  const next = current + 1
  localStorage.setItem(KEYS.miniMartOrderSeq, String(next))
  return `PY-${next}`
}

/** Demo-mode mirror of the Supabase trigger (log_mini_mart_stock_change): every
 *  stock_quantity change is logged here, whatever the source, so the admin's
 *  Inventory History page behaves the same with or without Supabase. */
function logMiniMartStockChange(entry: {
  item: MiniMartItem
  changeQuantity: number
  previousStock: number
  reason: MiniMartInventoryReason
  orderId?: string | null
  orderNumber?: string | null
  notes?: string
  createdBy?: string | null
}) {
  if (entry.changeQuantity === 0) return
  const logs = read<MiniMartInventoryLog[]>(KEYS.miniMartInventoryLogs, [])
  logs.push({
    id: newId(),
    itemId: entry.item.id,
    itemName: entry.item.name,
    changeQuantity: entry.changeQuantity,
    previousStock: entry.previousStock,
    newStock: entry.previousStock + entry.changeQuantity,
    reason: entry.reason,
    orderId: entry.orderId ?? null,
    orderNumber: entry.orderNumber ?? null,
    notes: entry.notes ?? '',
    createdBy: entry.createdBy ?? null,
    createdAt: new Date().toISOString(),
  })
  write(KEYS.miniMartInventoryLogs, logs)
}

// Demo-mode-only seed so the Mini Mart page isn't empty on first load. Real
// deployments start with an empty table — the admin adds their own products.
const DEFAULT_MINI_MART_ITEMS: MiniMartItem[] = [
  {
    id: 'mm-demo-gatorade',
    name: 'Gatorade',
    description: 'Cold sports drink, assorted flavors.',
    price: 45,
    category: 'drinks',
    imageUrl: '',
    isAvailable: true,
    stockQuantity: 24,
    servingSize: '1 bottle',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'mm-demo-cheeseburger',
    name: 'Cheeseburger',
    description: 'Grilled beef patty with cheese.',
    price: 75,
    category: 'food',
    imageUrl: '',
    isAvailable: true,
    stockQuantity: 12,
    servingSize: '1 piece',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'mm-demo-water',
    name: 'Bottled Water',
    description: '500ml.',
    price: 20,
    category: 'drinks',
    imageUrl: '',
    isAvailable: true,
    stockQuantity: 30,
    servingSize: '500ml',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
]

// Mirrors the PLAYMORE row seeded by supabase/schema.sql, so demo mode has
// the same default promo code out of the box. Only used as a fallback when
// nothing has ever been written to storage — deleting it via the admin UI
// (writing `[]`) sticks, same as the SQL's `on conflict do nothing` seed.
const DEFAULT_PROMO_CODES: PromoCode[] = [
  {
    id: 'promo-playmore-default',
    code: 'PLAYMORE',
    active: true,
    daytimeRate: 133,
    nighttimeRate: 155,
    validFrom: '2000-01-01',
    validUntil: '',
    validDays: [],
    minBookingHours: null,
    maxTotalUses: null,
    maxUsesPerCustomer: null,
    showBanner: true,
    bannerMessage: 'Use code PLAYMORE and play for only ₱133/hour daytime or ₱155/hour at night!',
    createdAt: new Date(0).toISOString(),
  },
]

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

function normalizeMobile(s: string): string {
  return s.replace(/\s|-/g, '')
}

/**
 * Trusted (server-equivalent) promo validation + pricing for demo/local mode.
 * Shared by previewPromoCode (the "Apply" button) and createBooking (the actual
 * insert), so a customer can't get a different, more favorable result by racing
 * or replaying a stale preview — both paths always recompute from scratch here.
 */
function resolvePromo(code: string, bookingDate: string, startHour: number, duration: number, mobileNumber: string, settings: Settings): PromoPreview {
  const normalized = normalizePromoCode(code)
  const promos = read<PromoCode[]>(KEYS.promoCodes, DEFAULT_PROMO_CODES)
  const promo = promos.find((p) => p.code === normalized)

  const invalid = (): PromoPreview => ({
    valid: false,
    reason: GENERIC_INVALID_MESSAGE,
    code: normalized,
    daytimeRate: 0,
    nighttimeRate: 0,
    rateBreakdown: [],
    normalTotal: 0,
    promoTotal: 0,
    discountAmount: 0,
  })

  if (!promo) return invalid()

  const bookings = read<Booking[]>(KEYS.bookings, [])
  const usedBookings = bookings.filter((b) => b.status !== 'cancelled' && b.promoCode === normalized)
  const totalUsesSoFar = usedBookings.length
  const customerUsesSoFar = usedBookings.filter((b) => normalizeMobile(b.mobileNumber) === normalizeMobile(mobileNumber)).length

  const eligibility = checkPromoEligibility(promo, bookingDate, duration, totalUsesSoFar, customerUsesSoFar)
  if (!eligibility.valid) return invalid()

  const normalResult = calculatePrice(startHour, duration, settings)
  const promoResult = calculatePrice(startHour, duration, settings, {
    daytimeRate: promo.daytimeRate,
    nighttimeRate: promo.nighttimeRate,
  })
  if (!normalResult.valid || !promoResult.valid) return invalid()

  return {
    valid: true,
    reason: null,
    code: normalized,
    daytimeRate: promo.daytimeRate,
    nighttimeRate: promo.nighttimeRate,
    rateBreakdown: promoResult.breakdown,
    normalTotal: normalResult.total,
    promoTotal: promoResult.total,
    discountAmount: normalResult.total - promoResult.total,
  }
}

/** Mirrors safe_display_name() in schema.sql: "First L." only, never the
 *  raw name — used for demo mode's own public roster. */
function safeDisplayName(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return 'Player'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`
}

/** Mirrors promote_next_waitlisted()/promote_on_limit_increase(): promotes
 *  the oldest waitlisted registrations for one session up to its current
 *  player_limit. Called whenever a joined registration is removed, or a
 *  session's player_limit increases. */
function promoteWaitlisted(registrations: OpenPlayRegistration[], sessionId: string, playerLimit: number): OpenPlayRegistration[] {
  const joinedCount = registrations.filter((r) => r.sessionId === sessionId && r.status === 'joined').length
  const slotsOpen = playerLimit - joinedCount
  if (slotsOpen <= 0) return registrations
  const waitlisted = registrations
    .filter((r) => r.sessionId === sessionId && r.status === 'waitlisted')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const toPromote = new Set(waitlisted.slice(0, slotsOpen).map((r) => r.id))
  if (toPromote.size === 0) return registrations
  return registrations.map((r) => (toPromote.has(r.id) ? { ...r, status: 'joined' as const } : r))
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
    return (
      bookings.find(
        (b) =>
          b.bookingReference.toUpperCase() === reference.toUpperCase().trim() &&
          normalizeMobile(b.mobileNumber) === normalizeMobile(mobileNumber),
      ) ?? null
    )
  },

  async createBooking(input) {
    const settings = read<Settings>(KEYS.settings, DEFAULT_SETTINGS)
    const startHour = timeToHour(input.startTime)

    // Never trust input.rateBreakdown/totalAmount — always recompute from scratch,
    // the same way the Supabase insert trigger does in production.
    let promoCode: string | null = null
    let normalTotal: number
    let totalAmount: number
    let discountAmount = 0
    let rateBreakdown

    const normalResult = calculatePrice(startHour, input.duration, settings)
    if (!normalResult.valid) throw new Error(normalResult.reason ?? 'That time is not available for booking.')
    normalTotal = normalResult.total
    totalAmount = normalResult.total
    rateBreakdown = normalResult.breakdown

    if (input.promoCode && input.promoCode.trim()) {
      const promo = resolvePromo(input.promoCode, input.bookingDate, startHour, input.duration, input.mobileNumber, settings)
      if (!promo.valid) {
        throw new Error('Promo code is no longer valid. Please remove it and try again.')
      }
      promoCode = promo.code
      normalTotal = promo.normalTotal
      totalAmount = promo.promoTotal
      discountAmount = promo.discountAmount
      rateBreakdown = promo.rateBreakdown
    }

    const bookings = read<Booking[]>(KEYS.bookings, [])
    const booking: Booking = {
      id: newId(),
      bookingReference: generateBookingReference(),
      customerName: input.customerName,
      mobileNumber: input.mobileNumber,
      email: input.email,
      numberOfPlayers: input.numberOfPlayers,
      bookingDate: input.bookingDate,
      startTime: input.startTime,
      endTime: input.endTime,
      duration: input.duration,
      rateBreakdown,
      normalTotal,
      totalAmount,
      promoCode,
      discountAmount,
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentMethod: input.paymentMethod,
      paymentProofUrl: null,
      paymentVerifiedAt: null,
      accessToken: newId(),
      notes: input.notes,
      createdAt: new Date().toISOString(),
    }
    bookings.push(booking)
    write(KEYS.bookings, bookings)
    return booking
  },

  async getBookingByToken(accessToken) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    return bookings.find((b) => b.accessToken === accessToken) ?? null
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

  async submitBookingPaymentProof(bookingId, mobileNumber, proofUrl) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    const idx = bookings.findIndex((b) => b.id === bookingId)
    if (idx === -1 || normalizeMobile(bookings[idx].mobileNumber) !== normalizeMobile(mobileNumber)) {
      return { success: false, reason: 'Booking not found.' }
    }
    if (bookings[idx].paymentMethod !== 'gcash') {
      return { success: false, reason: 'This booking does not use GCash payment.' }
    }
    if (bookings[idx].paymentStatus === 'verified') {
      return { success: false, reason: 'This booking has already been paid and verified.' }
    }
    bookings[idx] = { ...bookings[idx], paymentStatus: 'pending', paymentProofUrl: proofUrl, paymentVerifiedAt: null }
    write(KEYS.bookings, bookings)
    return { success: true, reason: null }
  },

  async verifyBookingPayment(id) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    const idx = bookings.findIndex((b) => b.id === id)
    if (idx === -1) throw new Error('Booking not found')
    bookings[idx] = {
      ...bookings[idx],
      paymentStatus: 'verified',
      paymentVerifiedAt: new Date().toISOString(),
      status: bookings[idx].status === 'pending' ? 'confirmed' : bookings[idx].status,
    }
    write(KEYS.bookings, bookings)
    return bookings[idx]
  },

  async rejectBookingPayment(id) {
    const bookings = read<Booking[]>(KEYS.bookings, [])
    const idx = bookings.findIndex((b) => b.id === id)
    if (idx === -1) throw new Error('Booking not found')
    bookings[idx] = { ...bookings[idx], paymentStatus: 'rejected', paymentVerifiedAt: null }
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

  async listOpenPlaySessions() {
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
    return [...sessions]
      .sort((a, b) =>
        a.sessionDate === b.sessionDate ? a.startTime.localeCompare(b.startTime) : a.sessionDate.localeCompare(b.sessionDate),
      )
      .map((s) => ({
        ...s,
        registeredCount: registrations.filter((r) => r.sessionId === s.id && r.status === 'joined').length,
        waitlistedCount: registrations.filter((r) => r.sessionId === s.id && r.status === 'waitlisted').length,
      }))
  },

  async getOpenPlaySessionsForDate(date) {
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    return sessions.filter((s) => s.sessionDate === date && s.status === 'scheduled')
  },

  async createOpenPlaySession(input) {
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    const session: OpenPlaySession = {
      id: newId(),
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      ...input,
      chatEnabled: input.chatEnabled ?? true,
    }
    sessions.push(session)
    write(KEYS.openPlaySessions, sessions)
    return session
  },

  async createOpenPlaySessions(inputs) {
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    const created = inputs.map(
      (input): OpenPlaySession => ({
        id: newId(),
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        ...input,
        chatEnabled: input.chatEnabled ?? true,
      }),
    )
    write(KEYS.openPlaySessions, [...sessions, ...created])
    return created
  },

  async updateOpenPlaySession(id, patch) {
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    const idx = sessions.findIndex((s) => s.id === id)
    if (idx === -1) throw new Error('Open Play session not found')
    const previousLimit = sessions[idx].playerLimit
    sessions[idx] = { ...sessions[idx], ...patch }
    write(KEYS.openPlaySessions, sessions)

    if (patch.playerLimit !== undefined && patch.playerLimit > previousLimit) {
      const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
      write(KEYS.openPlayRegistrations, promoteWaitlisted(registrations, id, patch.playerLimit))
    }

    return sessions[idx]
  },

  async cancelOpenPlaySession(id) {
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    const idx = sessions.findIndex((s) => s.id === id)
    if (idx === -1) throw new Error('Open Play session not found')
    sessions[idx] = { ...sessions[idx], status: 'cancelled' }
    write(KEYS.openPlaySessions, sessions)
    return sessions[idx]
  },

  async listOpenPlayRegistrations(sessionId) {
    const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
    return registrations
      .filter((r) => r.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  async addOpenPlayRegistration(input) {
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    const session = sessions.find((s) => s.id === input.sessionId)
    if (!session) {
      return { success: false, reason: 'This Open Play session could not be found.', registrationId: null, status: null, registeredCount: 0, remainingSlots: 0 }
    }
    if (session.status !== 'scheduled') {
      return { success: false, reason: 'This Open Play session is no longer open for registration.', registrationId: null, status: null, registeredCount: 0, remainingSlots: 0 }
    }
    if (!input.playerName.trim() || !input.mobileNumber.trim()) {
      return { success: false, reason: 'Name and mobile number are required.', registrationId: null, status: null, registeredCount: 0, remainingSlots: 0 }
    }

    const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
    let joinedCount = registrations.filter((r) => r.sessionId === input.sessionId && r.status === 'joined').length
    const status: OpenPlayRegistration['status'] = joinedCount >= session.playerLimit ? 'waitlisted' : 'joined'

    const registration: OpenPlayRegistration = {
      id: newId(),
      createdAt: new Date().toISOString(),
      sessionId: input.sessionId,
      playerName: input.playerName,
      mobileNumber: input.mobileNumber,
      facebookName: input.facebookName ?? '',
      status,
    }
    registrations.push(registration)
    write(KEYS.openPlayRegistrations, registrations)

    if (status === 'joined') joinedCount += 1

    return {
      success: true,
      reason: null,
      registrationId: registration.id,
      status,
      registeredCount: joinedCount,
      remainingSlots: Math.max(session.playerLimit - joinedCount, 0),
    }
  },

  async removeOpenPlayRegistration(id) {
    const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
    const removed = registrations.find((r) => r.id === id)
    const remaining = registrations.filter((r) => r.id !== id)

    if (removed?.status === 'joined') {
      const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
      const session = sessions.find((s) => s.id === removed.sessionId)
      if (session) {
        write(KEYS.openPlayRegistrations, promoteWaitlisted(remaining, removed.sessionId, session.playerLimit))
        return
      }
    }
    write(KEYS.openPlayRegistrations, remaining)
  },

  async getOpenPlayPublicRoster(sessionId) {
    const settings = read<Settings>(KEYS.settings, DEFAULT_SETTINGS)
    if (!settings.openPlayShowPlayerList) return []
    const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
    return registrations
      .filter((r) => r.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((r) => ({
        registrationId: r.id,
        displayName: safeDisplayName(r.playerName),
        status: r.status,
        joinedAt: r.createdAt,
      }))
  },

  async getOpenPlayMessages(sessionId, participantId) {
    // Mirrors get_open_play_messages(): only a currently-joined registration
    // for this exact session can read — everyone else just gets an empty
    // list, same as "not authorized" looks like server-side.
    const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
    const reg = registrations.find((r) => r.id === participantId && r.sessionId === sessionId && r.status === 'joined')
    if (!reg) return []

    const messages = read<OpenPlayMessageAdmin[]>(KEYS.openPlayMessages, [])
    return messages
      .filter((m) => m.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => ({
        id: m.id,
        participantName: m.participantName,
        message: m.message,
        createdAt: m.createdAt,
        isMe: m.participantId === participantId,
      }))
  },

  async sendOpenPlayMessage(sessionId, participantId, message) {
    const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
    const reg = registrations.find((r) => r.id === participantId && r.sessionId === sessionId && r.status === 'joined')
    if (!reg) {
      return { success: false, reason: 'You must join this Open Play session before posting in chat.', messageId: null, createdAt: null }
    }

    const settings = read<Settings>(KEYS.settings, DEFAULT_SETTINGS)
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    const session = sessions.find((s) => s.id === sessionId)
    if (!settings.openPlayChatEnabled || !(session?.chatEnabled ?? true)) {
      return { success: false, reason: 'Chat is currently unavailable for this Open Play session.', messageId: null, createdAt: null }
    }

    const trimmed = message.trim()
    if (!trimmed) return { success: false, reason: 'Message cannot be empty.', messageId: null, createdAt: null }
    if (trimmed.length > 500) return { success: false, reason: 'Message is too long (500 characters max).', messageId: null, createdAt: null }

    const messages = read<OpenPlayMessageAdmin[]>(KEYS.openPlayMessages, [])
    const now = new Date().toISOString()
    const record: OpenPlayMessageAdmin = {
      id: newId(),
      sessionId,
      participantId,
      participantName: reg.playerName,
      message: trimmed,
      createdAt: now,
    }
    write(KEYS.openPlayMessages, [...messages, record])

    return { success: true, reason: null, messageId: record.id, createdAt: now }
  },

  async listOpenPlayMessagesAdmin(sessionId) {
    const messages = read<OpenPlayMessageAdmin[]>(KEYS.openPlayMessages, [])
    return messages.filter((m) => m.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  async deleteOpenPlayMessage(id) {
    const messages = read<OpenPlayMessageAdmin[]>(KEYS.openPlayMessages, [])
    write(
      KEYS.openPlayMessages,
      messages.filter((m) => m.id !== id),
    )
  },

  async listPromoCodes() {
    const promos = read<PromoCode[]>(KEYS.promoCodes, DEFAULT_PROMO_CODES)
    return [...promos].sort((a, b) => a.code.localeCompare(b.code))
  },

  async createPromoCode(input) {
    const promos = read<PromoCode[]>(KEYS.promoCodes, DEFAULT_PROMO_CODES)
    const promo: PromoCode = { id: newId(), createdAt: new Date().toISOString(), ...input, code: normalizePromoCode(input.code) }
    promos.push(promo)
    write(KEYS.promoCodes, promos)
    return promo
  },

  async updatePromoCode(id, patch) {
    const promos = read<PromoCode[]>(KEYS.promoCodes, DEFAULT_PROMO_CODES)
    const idx = promos.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error('Promo code not found')
    promos[idx] = { ...promos[idx], ...patch, ...(patch.code ? { code: normalizePromoCode(patch.code) } : {}) }
    write(KEYS.promoCodes, promos)
    return promos[idx]
  },

  async deletePromoCode(id) {
    const promos = read<PromoCode[]>(KEYS.promoCodes, DEFAULT_PROMO_CODES)
    write(
      KEYS.promoCodes,
      promos.filter((p) => p.id !== id),
    )
  },

  async previewPromoCode(code, bookingDate, startHour, duration, mobileNumber) {
    const settings = read<Settings>(KEYS.settings, DEFAULT_SETTINGS)
    return resolvePromo(code, bookingDate, startHour, duration, mobileNumber, settings)
  },

  async getActivePromoBanner() {
    const promos = read<PromoCode[]>(KEYS.promoCodes, DEFAULT_PROMO_CODES)
    const today = todayISO()
    const promo = promos.find(
      (p) => p.active && p.showBanner && (!p.validFrom || p.validFrom <= today) && (!p.validUntil || p.validUntil >= today),
    )
    if (!promo) return null
    return {
      code: promo.code,
      bannerMessage: promo.bannerMessage,
      daytimeRate: promo.daytimeRate,
      nighttimeRate: promo.nighttimeRate,
    }
  },

  async listMiniMartItems() {
    const items = read<MiniMartItem[]>(KEYS.miniMartItems, DEFAULT_MINI_MART_ITEMS)
    return [...items].sort((a, b) => a.name.localeCompare(b.name))
  },

  async createMiniMartItem(input) {
    const items = read<MiniMartItem[]>(KEYS.miniMartItems, DEFAULT_MINI_MART_ITEMS)
    const now = new Date().toISOString()
    const item: MiniMartItem = { id: newId(), createdAt: now, updatedAt: now, ...input }
    items.push(item)
    write(KEYS.miniMartItems, items)
    return item
  },

  async updateMiniMartItem(id, patch) {
    const items = read<MiniMartItem[]>(KEYS.miniMartItems, DEFAULT_MINI_MART_ITEMS)
    const idx = items.findIndex((i) => i.id === id)
    if (idx === -1) throw new Error('Mini Mart item not found')
    const previousStock = items[idx].stockQuantity
    items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() }
    write(KEYS.miniMartItems, items)
    // Mirrors the Supabase trigger: any direct stock edit (e.g. the "Set
    // Stock" absolute-value box) is logged too, not just the +1/+5/-1/-5
    // buttons and the reason-based Adjust Stock panel.
    if (patch.stockQuantity !== undefined && patch.stockQuantity !== previousStock) {
      logMiniMartStockChange({
        item: items[idx],
        changeQuantity: patch.stockQuantity - previousStock,
        previousStock,
        reason: 'correction',
      })
    }
    return items[idx]
  },

  async deleteMiniMartItem(id) {
    const items = read<MiniMartItem[]>(KEYS.miniMartItems, DEFAULT_MINI_MART_ITEMS)
    write(
      KEYS.miniMartItems,
      items.filter((i) => i.id !== id),
    )
  },

  async adjustMiniMartItemStock(id, delta, reason = 'correction', notes) {
    const items = read<MiniMartItem[]>(KEYS.miniMartItems, DEFAULT_MINI_MART_ITEMS)
    const idx = items.findIndex((i) => i.id === id)
    if (idx === -1) throw new Error('Mini Mart item not found')
    const previousStock = items[idx].stockQuantity
    const newStock = Math.max(0, previousStock + delta)
    items[idx] = { ...items[idx], stockQuantity: newStock, updatedAt: new Date().toISOString() }
    write(KEYS.miniMartItems, items)
    logMiniMartStockChange({
      item: items[idx],
      // The actual change may be smaller than `delta` if it was clamped at 0.
      changeQuantity: newStock - previousStock,
      previousStock,
      reason,
      notes,
    })
    return items[idx]
  },

  async listMiniMartInventoryLogs(itemId) {
    const logs = read<MiniMartInventoryLog[]>(KEYS.miniMartInventoryLogs, [])
    const filtered = itemId ? logs.filter((l) => l.itemId === itemId) : logs
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async placeMiniMartOrder(input) {
    if (!input.customerName.trim())
      return { success: false, reason: 'Customer name is required.', orderId: null, orderNumber: null, total: 0, status: null, paymentStatus: null }
    if (input.items.length === 0)
      return { success: false, reason: 'Your cart is empty.', orderId: null, orderNumber: null, total: 0, status: null, paymentStatus: null }

    const products = read<MiniMartItem[]>(KEYS.miniMartItems, DEFAULT_MINI_MART_ITEMS)
    const orderId = newId()
    const now = new Date().toISOString()
    const orderItems: MiniMartOrderItem[] = []
    let total = 0

    // Validate every line (including stock) before writing anything.
    for (const line of input.items) {
      const product = products.find((p) => p.id === line.itemId)
      if (!product)
        return { success: false, reason: 'One of the items in your cart is no longer available.', orderId: null, orderNumber: null, total: 0, status: null, paymentStatus: null }
      if (!product.isAvailable)
        return { success: false, reason: `${product.name} is sold out.`, orderId: null, orderNumber: null, total: 0, status: null, paymentStatus: null }
      if (product.stockQuantity < line.quantity) {
        return {
          success: false,
          reason: `Only ${product.stockQuantity} ${product.name} left in stock.`,
          orderId: null,
          orderNumber: null,
          total: 0,
          status: null,
          paymentStatus: null,
        }
      }
      const subtotal = product.price * line.quantity
      total += subtotal
      orderItems.push({
        id: newId(),
        orderId,
        itemId: product.id,
        itemName: product.name,
        quantity: line.quantity,
        unitPrice: product.price,
        subtotal,
        createdAt: now,
      })
    }

    const initialStatus: MiniMartOrderStatus = input.paymentMethod === 'gcash' ? 'awaiting_payment' : 'new'
    const order: MiniMartOrder = {
      id: orderId,
      orderNumber: nextMiniMartOrderNumber(),
      customerName: input.customerName.trim(),
      notes: input.notes?.trim() || '',
      status: initialStatus,
      total,
      items: orderItems,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'unpaid',
      paymentProofUrl: null,
      paymentVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    const orders = read<MiniMartOrder[]>(KEYS.miniMartOrders, [])
    orders.push(order)
    write(KEYS.miniMartOrders, orders)

    // Only deduct stock after the order itself has been successfully created —
    // GCash orders reserve stock immediately too, same as a booking reserves
    // its time slot before payment is verified.
    const updatedProducts = products.map((p) => {
      const line = orderItems.find((oi) => oi.itemId === p.id)
      if (!line) return p
      const updated = { ...p, stockQuantity: p.stockQuantity - line.quantity, updatedAt: now }
      logMiniMartStockChange({
        item: updated,
        changeQuantity: -line.quantity,
        previousStock: p.stockQuantity,
        reason: 'order',
        orderId: order.id,
        orderNumber: order.orderNumber,
      })
      return updated
    })
    write(KEYS.miniMartItems, updatedProducts)

    return {
      success: true,
      reason: null,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total,
      status: initialStatus,
      paymentStatus: order.paymentStatus,
    }
  },

  async getMiniMartOrderStatus(orderNumber) {
    const orders = read<MiniMartOrder[]>(KEYS.miniMartOrders, [])
    const order = orders.find((o) => o.orderNumber === orderNumber)
    if (!order) return null
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    }
  },

  async submitMiniMartPaymentProof(orderNumber, proofUrl) {
    const orders = read<MiniMartOrder[]>(KEYS.miniMartOrders, [])
    const idx = orders.findIndex((o) => o.orderNumber === orderNumber)
    if (idx === -1) return { success: false, reason: 'Order not found.' }
    if (orders[idx].paymentMethod !== 'gcash') return { success: false, reason: 'This order does not use GCash payment.' }
    if (orders[idx].paymentStatus === 'verified') return { success: false, reason: 'This order has already been paid and verified.' }
    orders[idx] = { ...orders[idx], paymentStatus: 'pending', paymentProofUrl: proofUrl, paymentVerifiedAt: null }
    write(KEYS.miniMartOrders, orders)
    return { success: true, reason: null }
  },

  async verifyMiniMartPayment(id) {
    const orders = read<MiniMartOrder[]>(KEYS.miniMartOrders, [])
    const idx = orders.findIndex((o) => o.id === id)
    if (idx === -1) throw new Error('Order not found')
    orders[idx] = {
      ...orders[idx],
      paymentStatus: 'verified',
      paymentVerifiedAt: new Date().toISOString(),
      status: orders[idx].status === 'awaiting_payment' ? 'new' : orders[idx].status,
      updatedAt: new Date().toISOString(),
    }
    write(KEYS.miniMartOrders, orders)
    return orders[idx]
  },

  async rejectMiniMartPayment(id) {
    const orders = read<MiniMartOrder[]>(KEYS.miniMartOrders, [])
    const idx = orders.findIndex((o) => o.id === id)
    if (idx === -1) throw new Error('Order not found')
    orders[idx] = { ...orders[idx], paymentStatus: 'rejected', paymentVerifiedAt: null, updatedAt: new Date().toISOString() }
    write(KEYS.miniMartOrders, orders)
    return orders[idx]
  },

  async listMiniMartOrders() {
    const orders = read<MiniMartOrder[]>(KEYS.miniMartOrders, [])
    return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async updateMiniMartOrderStatus(id, status) {
    const orders = read<MiniMartOrder[]>(KEYS.miniMartOrders, [])
    const idx = orders.findIndex((o) => o.id === id)
    if (idx === -1) throw new Error('Order not found')
    const previousStatus = orders[idx].status

    // Restore stock exactly once: only on the actual transition into
    // 'cancelled', never if it's already cancelled (or already completed).
    if (status === 'cancelled' && previousStatus !== 'cancelled' && previousStatus !== 'completed') {
      const products = read<MiniMartItem[]>(KEYS.miniMartItems, DEFAULT_MINI_MART_ITEMS)
      const now = new Date().toISOString()
      const restored = products.map((p) => {
        const line = orders[idx].items.find((oi) => oi.itemId === p.id)
        if (!line) return p
        const updated = { ...p, stockQuantity: p.stockQuantity + line.quantity, updatedAt: now }
        logMiniMartStockChange({
          item: updated,
          changeQuantity: line.quantity,
          previousStock: p.stockQuantity,
          reason: 'cancellation',
          orderId: orders[idx].id,
          orderNumber: orders[idx].orderNumber,
        })
        return updated
      })
      write(KEYS.miniMartItems, restored)
    }

    orders[idx] = { ...orders[idx], status, updatedAt: new Date().toISOString() }
    write(KEYS.miniMartOrders, orders)
    return orders[idx]
  },

  async getFreePlaySlotCounts(date) {
    const participants = read<FreePlayParticipant[]>(KEYS.freePlayParticipants, [])
    const counts = new Map<string, number>()
    for (const p of participants) {
      if (p.playDate !== date) continue
      const key = `${p.startTime}-${p.endTime}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()].map(([key, joinedCount]) => {
      const [startTime, endTime] = key.split('-')
      return { playDate: date, startTime, endTime, joinedCount }
    })
  },

  async joinFreePlay(input) {
    const name = input.participantName.trim()
    if (!name) return { success: false, reason: 'Enter your name.', participantId: null, joinedCount: 0 }

    const startMin = timeToMinutes(input.startTime)
    const endMin = timeToMinutes(input.endTime)
    if (startMin < timeToMinutes('14:00') || endMin > timeToMinutes('17:00') || endMin <= startMin) {
      return { success: false, reason: 'That is not a valid Free Play time slot.', participantId: null, joinedCount: 0 }
    }

    const settings = read<Settings>(KEYS.settings, DEFAULT_SETTINGS)
    if (isFreePlaySlotBooked(input.playDate, input.startTime, input.endTime, settings)) {
      return { success: false, reason: 'This Free Play slot is no longer available.', participantId: null, joinedCount: 0 }
    }

    const participants = read<FreePlayParticipant[]>(KEYS.freePlayParticipants, [])
    const sameSlot = participants.filter(
      (p) => p.playDate === input.playDate && p.startTime === input.startTime && p.endTime === input.endTime,
    )
    const alreadyJoined = sameSlot.some((p) => p.participantName.trim().toLowerCase() === name.toLowerCase())
    if (alreadyJoined) {
      return {
        success: false,
        reason: 'You may already be registered for this Free Play slot.',
        participantId: null,
        joinedCount: sameSlot.length,
      }
    }

    const participant: FreePlayParticipant = {
      id: newId(),
      participantName: name,
      playDate: input.playDate,
      startTime: input.startTime,
      endTime: input.endTime,
      createdAt: new Date().toISOString(),
    }
    write(KEYS.freePlayParticipants, [...participants, participant])

    return { success: true, reason: null, participantId: participant.id, joinedCount: sameSlot.length + 1 }
  },

  async listFreePlayParticipants(date) {
    const participants = read<FreePlayParticipant[]>(KEYS.freePlayParticipants, [])
    return participants.filter((p) => p.playDate === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  async removeFreePlayParticipant(id) {
    const participants = read<FreePlayParticipant[]>(KEYS.freePlayParticipants, [])
    write(
      KEYS.freePlayParticipants,
      participants.filter((p) => p.id !== id),
    )
  },

  async clearFreePlaySlot(playDate, startTime, endTime) {
    const participants = read<FreePlayParticipant[]>(KEYS.freePlayParticipants, [])
    write(
      KEYS.freePlayParticipants,
      participants.filter((p) => !(p.playDate === playDate && p.startTime === startTime && p.endTime === endTime)),
    )
  },
}

export type { AvailabilityRow }
