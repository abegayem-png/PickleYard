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
  businessName: '24/7 Pickleball Play',
  tagline: 'Play More. Play Anytime.',
  daytimeRate: 150,
  nighttimeRate: 180,
  daytimeStart: '06:00',
  daytimeEnd: '17:00',
  nighttimeStart: '18:00',
  nighttimeEnd: '22:00',
  openingTime: '06:00',
  closingTime: '22:00',
  gapEnabled: false,
  gapRate: 150,
  phone: '+63 9XX XXX XXXX',
  facebook: 'facebook.com/247pickleballplay',
  messenger: 'm.me/247pickleballplay',
  address: 'Court address — set this in Admin Settings',
  mapsUrl: '',
  gcashNumber: '09XX XXX XXXX',
  gcashAccountName: 'Set in Admin Settings',
  gcashQrCodeUrl: '',
  adminPassword: 'admin123',
}
