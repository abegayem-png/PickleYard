export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid'
export type PaymentMethod = 'gcash' | 'cash'
export type SlotStatus = 'available' | 'pending' | 'confirmed' | 'paid' | 'blocked' | 'past'

export interface Booking {
  id: string
  bookingReference: string
  customerName: string
  mobileNumber: string
  email: string
  numberOfPlayers: number
  bookingDate: string // YYYY-MM-DD
  startTime: string // HH:MM (24h)
  endTime: string // HH:MM (24h)
  duration: number // hours
  rateBreakdown: HourRate[]
  /** Pre-discount total. Equal to totalAmount when no promo was applied. */
  normalTotal: number
  /** Final amount charged — always server/DB-computed, never trusted from the client. */
  totalAmount: number
  /** Uppercased promo code that was actually applied, or null. */
  promoCode: string | null
  discountAmount: number
  status: BookingStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  notes?: string
  createdAt: string
}

export interface BookingInput {
  customerName: string
  mobileNumber: string
  email: string
  numberOfPlayers: number
  bookingDate: string
  startTime: string
  endTime: string
  duration: number
  /** Client-side preview only — the server/store always recomputes the authoritative
   *  rate breakdown, totals, and promo eligibility rather than trusting these. */
  rateBreakdown: HourRate[]
  totalAmount: number
  notes?: string
  paymentMethod: PaymentMethod
  /** Promo code the customer applied, if any — re-validated server-side before it counts. */
  promoCode?: string
}

export interface HourRate {
  hour: number // 24h start hour of the segment
  label: string // e.g. "6:00 PM - 7:00 PM"
  rate: number
  period: 'daytime' | 'nighttime' | 'gap'
}

export type OpenPlayScheduleType = 'specific' | 'recurring'
export type OpenPlaySessionStatus = 'scheduled' | 'cancelled'
export type OpenPlaySessionSource = 'specific' | 'recurring'

export interface OpenPlaySession {
  id: string
  sessionDate: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  pricePerPlayer: number
  playerLimit: number
  status: OpenPlaySessionStatus
  source: OpenPlaySessionSource
  createdAt: string
}

export interface OpenPlaySessionWithCount extends OpenPlaySession {
  registeredCount: number
}

export interface OpenPlaySessionInput {
  sessionDate: string
  startTime: string
  endTime: string
  pricePerPlayer: number
  playerLimit: number
  source: OpenPlaySessionSource
}

export interface OpenPlayRegistration {
  id: string
  sessionId: string
  playerName: string
  mobileNumber: string
  createdAt: string
}

export interface OpenPlayRegistrationInput {
  sessionId: string
  playerName: string
  mobileNumber: string
}

export interface PromoCode {
  id: string
  code: string
  active: boolean
  daytimeRate: number
  nighttimeRate: number
  validFrom: string // YYYY-MM-DD
  validUntil: string // YYYY-MM-DD, '' = no end date
  validDays: number[] // 0 = Sunday ... 6 = Saturday, [] = every day
  minBookingHours: number | null
  maxTotalUses: number | null
  maxUsesPerCustomer: number | null
  showBanner: boolean
  bannerMessage: string
  createdAt: string
}

export interface PromoCodeInput {
  code: string
  active: boolean
  daytimeRate: number
  nighttimeRate: number
  validFrom: string
  validUntil: string
  validDays: number[]
  minBookingHours: number | null
  maxTotalUses: number | null
  maxUsesPerCustomer: number | null
  showBanner: boolean
  bannerMessage: string
}

/** Result of checking a promo code against a specific date/duration/customer — always
 *  computed by trusted logic (the Supabase RPC in production, or the local store in
 *  demo mode), never trusted from raw client input. */
export interface PromoPreview {
  valid: boolean
  /** Always the generic customer-facing message when invalid — never leaks *why*. */
  reason: string | null
  code: string
  daytimeRate: number
  nighttimeRate: number
  rateBreakdown: HourRate[]
  normalTotal: number
  promoTotal: number
  discountAmount: number
}

/** Narrow, public-safe view of whichever promo currently has its banner enabled. */
export interface ActivePromoBanner {
  code: string
  bannerMessage: string
  daytimeRate: number
  nighttimeRate: number
}

export interface BlockedSlot {
  id: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM, if allDay this is opening_time
  endTime: string // HH:MM
  reason: string
  allDay: boolean
  createdAt: string
}

export interface Settings {
  businessName: string
  tagline: string
  daytimeRate: number
  nighttimeRate: number
  daytimeStart: string // HH:MM
  daytimeEnd: string // HH:MM
  nighttimeStart: string // HH:MM
  nighttimeEnd: string // HH:MM
  openingTime: string // HH:MM
  closingTime: string // HH:MM
  gapEnabled: boolean
  gapRate: number
  phone: string
  facebook: string
  messenger: string
  address: string
  mapsUrl: string
  gcashNumber: string
  gcashAccountName: string
  gcashQrCodeUrl: string
  adminPassword: string

  openPlayEnabled: boolean
  openPlayScheduleType: OpenPlayScheduleType
  openPlayRecurringDays: number[] // 0 = Sunday ... 6 = Saturday
  openPlayRecurringStartDate: string // YYYY-MM-DD
  openPlayRecurringEndDate: string // '' = no end date, runs until turned off
  openPlayStartTime: string // HH:MM
  openPlayEndTime: string // HH:MM
  openPlayPrice: number // per player
  openPlayPlayerLimit: number
  openPlayBlockBookings: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  businessName: 'PickleYard Compostela',
  tagline: 'Play More. Play Anytime.',
  daytimeRate: 150,
  nighttimeRate: 180,
  daytimeStart: '06:00',
  daytimeEnd: '17:00',
  nighttimeStart: '18:00',
  nighttimeEnd: '22:00',
  // "24:00" means midnight at the end of the booking day (see lib/time.ts /
  // lib/pricing.ts, both of which treat hour 24 as wrapping to 00:00).
  openingTime: '00:00',
  closingTime: '24:00',
  // Daytime (6 AM-5 PM) and nighttime (6 PM-10 PM) keep their existing rates.
  // Every other hour of the day (the 5-6 PM buffer, and 10 PM-6 AM overnight)
  // is priced as the "gap" so the whole day is bookable at a single admin-
  // editable overnight rate, without touching the existing day/night rates.
  gapEnabled: true,
  gapRate: 180,
  phone: '+63 935 922 0897',
  facebook: 'https://www.facebook.com/profile.php?id=61592997513033',
  messenger: 'm.me/247pickleballplay',
  address: 'Court address — set this in Admin Settings',
  mapsUrl: '',
  gcashNumber: '09XX XXX XXXX',
  gcashAccountName: 'Set in Admin Settings',
  gcashQrCodeUrl: '',
  adminPassword: 'admin123',

  openPlayEnabled: false,
  openPlayScheduleType: 'specific',
  openPlayRecurringDays: [],
  openPlayRecurringStartDate: '',
  openPlayRecurringEndDate: '',
  openPlayStartTime: '18:00',
  openPlayEndTime: '23:00',
  openPlayPrice: 50,
  openPlayPlayerLimit: 16,
  openPlayBlockBookings: true,
}
