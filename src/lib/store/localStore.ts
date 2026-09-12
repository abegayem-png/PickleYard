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
} from '../../types'
import { DEFAULT_SETTINGS } from '../../types'
import { calculatePrice, generateBookingReference } from '../pricing'
import { checkPromoEligibility, normalizePromoCode, GENERIC_INVALID_MESSAGE } from '../promo'
import { timeToHour, todayISO } from '../time'
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
}

function nextMiniMartOrderNumber(): string {
  const current = Number(localStorage.getItem(KEYS.miniMartOrderSeq) || '1000')
  const next = current + 1
  localStorage.setItem(KEYS.miniMartOrderSeq, String(next))
  return `PY-${next}`
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
      notes: input.notes,
      createdAt: new Date().toISOString(),
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

  async listOpenPlaySessions() {
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
    return [...sessions]
      .sort((a, b) =>
        a.sessionDate === b.sessionDate ? a.startTime.localeCompare(b.startTime) : a.sessionDate.localeCompare(b.sessionDate),
      )
      .map((s) => ({ ...s, registeredCount: registrations.filter((r) => r.sessionId === s.id).length }))
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
      }),
    )
    write(KEYS.openPlaySessions, [...sessions, ...created])
    return created
  },

  async updateOpenPlaySession(id, patch) {
    const sessions = read<OpenPlaySession[]>(KEYS.openPlaySessions, [])
    const idx = sessions.findIndex((s) => s.id === id)
    if (idx === -1) throw new Error('Open Play session not found')
    sessions[idx] = { ...sessions[idx], ...patch }
    write(KEYS.openPlaySessions, sessions)
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
    const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
    const registration: OpenPlayRegistration = {
      id: newId(),
      createdAt: new Date().toISOString(),
      ...input,
      facebookName: input.facebookName ?? '',
    }
    registrations.push(registration)
    write(KEYS.openPlayRegistrations, registrations)
    return registration
  },

  async removeOpenPlayRegistration(id) {
    const registrations = read<OpenPlayRegistration[]>(KEYS.openPlayRegistrations, [])
    write(
      KEYS.openPlayRegistrations,
      registrations.filter((r) => r.id !== id),
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
    items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() }
    write(KEYS.miniMartItems, items)
    return items[idx]
  },

  async deleteMiniMartItem(id) {
    const items = read<MiniMartItem[]>(KEYS.miniMartItems, DEFAULT_MINI_MART_ITEMS)
    write(
      KEYS.miniMartItems,
      items.filter((i) => i.id !== id),
    )
  },

  async adjustMiniMartItemStock(id, delta) {
    const items = read<MiniMartItem[]>(KEYS.miniMartItems, DEFAULT_MINI_MART_ITEMS)
    const idx = items.findIndex((i) => i.id === id)
    if (idx === -1) throw new Error('Mini Mart item not found')
    items[idx] = {
      ...items[idx],
      stockQuantity: Math.max(0, items[idx].stockQuantity + delta),
      updatedAt: new Date().toISOString(),
    }
    write(KEYS.miniMartItems, items)
    return items[idx]
  },

  async placeMiniMartOrder(input) {
    if (!input.customerName.trim()) return { success: false, reason: 'Customer name is required.', orderId: null, orderNumber: null, total: 0, status: null }
    if (input.items.length === 0) return { success: false, reason: 'Your cart is empty.', orderId: null, orderNumber: null, total: 0, status: null }

    const products = read<MiniMartItem[]>(KEYS.miniMartItems, DEFAULT_MINI_MART_ITEMS)
    const orderId = newId()
    const now = new Date().toISOString()
    const orderItems: MiniMartOrderItem[] = []
    let total = 0

    // Validate every line (including stock) before writing anything.
    for (const line of input.items) {
      const product = products.find((p) => p.id === line.itemId)
      if (!product) return { success: false, reason: 'One of the items in your cart is no longer available.', orderId: null, orderNumber: null, total: 0, status: null }
      if (!product.isAvailable) return { success: false, reason: `${product.name} is sold out.`, orderId: null, orderNumber: null, total: 0, status: null }
      if (product.stockQuantity < line.quantity) {
        return {
          success: false,
          reason: `Only ${product.stockQuantity} ${product.name} left in stock.`,
          orderId: null,
          orderNumber: null,
          total: 0,
          status: null,
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

    const order: MiniMartOrder = {
      id: orderId,
      orderNumber: nextMiniMartOrderNumber(),
      customerName: input.customerName.trim(),
      notes: input.notes?.trim() || '',
      status: 'new',
      total,
      items: orderItems,
      createdAt: now,
      updatedAt: now,
    }

    const orders = read<MiniMartOrder[]>(KEYS.miniMartOrders, [])
    orders.push(order)
    write(KEYS.miniMartOrders, orders)

    // Only deduct stock after the order itself has been successfully created.
    const updatedProducts = products.map((p) => {
      const line = orderItems.find((oi) => oi.itemId === p.id)
      return line ? { ...p, stockQuantity: p.stockQuantity - line.quantity, updatedAt: now } : p
    })
    write(KEYS.miniMartItems, updatedProducts)

    return { success: true, reason: null, orderId: order.id, orderNumber: order.orderNumber, total, status: 'new' }
  },

  async getMiniMartOrderStatus(orderNumber) {
    const orders = read<MiniMartOrder[]>(KEYS.miniMartOrders, [])
    const order = orders.find((o) => o.orderNumber === orderNumber)
    if (!order) return null
    return { orderNumber: order.orderNumber, status: order.status, total: order.total }
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
      const restored = products.map((p) => {
        const line = orders[idx].items.find((oi) => oi.itemId === p.id)
        return line ? { ...p, stockQuantity: p.stockQuantity + line.quantity, updatedAt: new Date().toISOString() } : p
      })
      write(KEYS.miniMartItems, restored)
    }

    orders[idx] = { ...orders[idx], status, updatedAt: new Date().toISOString() }
    write(KEYS.miniMartOrders, orders)
    return orders[idx]
  },
}

export type { AvailabilityRow }
