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
  totalAmount: number
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
  rateBreakdown: HourRate[]
  totalAmount: number
  notes?: string
  paymentMethod: PaymentMethod
}

export interface HourRate {
  hour: number // 24h start hour of the segment
  label: string // e.g. "6:00 PM - 7:00 PM"
  rate: number
  period: 'daytime' | 'nighttime' | 'gap'
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
}
