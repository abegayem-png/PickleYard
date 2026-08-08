import type { Booking, BookingStatus, PaymentStatus, BlockedSlot, Settings } from '../../types'
import { DEFAULT_SETTINGS } from '../../types'
import { supabase } from '../supabaseClient'
import type { AvailabilityRow, DataStore } from './types'

function sb() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

// ---- row <-> model mapping ----

function bookingFromRow(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    bookingReference: row.booking_reference as string,
    customerName: row.customer_name as string,
    mobileNumber: row.mobile_number as string,
    email: row.email as string,
    numberOfPlayers: row.number_of_players as number,
    bookingDate: row.booking_date as string,
    startTime: (row.start_time as string).slice(0, 5),
    endTime: (row.end_time as string).slice(0, 5),
    duration: row.duration as number,
    rateBreakdown: (row.rate_breakdown as Booking['rateBreakdown']) ?? [],
    totalAmount: Number(row.total_amount),
    status: row.status as BookingStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: row.payment_method as Booking['paymentMethod'],
    notes: (row.notes as string) ?? undefined,
    createdAt: row.created_at as string,
  }
}

function settingsFromRow(row: Record<string, unknown>): Settings {
  return {
    businessName: (row.business_name as string) ?? DEFAULT_SETTINGS.businessName,
    tagline: (row.tagline as string) ?? DEFAULT_SETTINGS.tagline,
    daytimeRate: Number(row.daytime_rate ?? DEFAULT_SETTINGS.daytimeRate),
    nighttimeRate: Number(row.nighttime_rate ?? DEFAULT_SETTINGS.nighttimeRate),
    daytimeStart: ((row.daytime_start as string) ?? DEFAULT_SETTINGS.daytimeStart).slice(0, 5),
    daytimeEnd: ((row.daytime_end as string) ?? DEFAULT_SETTINGS.daytimeEnd).slice(0, 5),
    nighttimeStart: ((row.nighttime_start as string) ?? DEFAULT_SETTINGS.nighttimeStart).slice(0, 5),
    nighttimeEnd: ((row.nighttime_end as string) ?? DEFAULT_SETTINGS.nighttimeEnd).slice(0, 5),
    openingTime: ((row.opening_time as string) ?? DEFAULT_SETTINGS.openingTime).slice(0, 5),
    closingTime: ((row.closing_time as string) ?? DEFAULT_SETTINGS.closingTime).slice(0, 5),
    gapEnabled: Boolean(row.gap_enabled ?? DEFAULT_SETTINGS.gapEnabled),
    gapRate: Number(row.gap_rate ?? DEFAULT_SETTINGS.gapRate),
    phone: (row.phone as string) ?? DEFAULT_SETTINGS.phone,
    facebook: (row.facebook as string) ?? DEFAULT_SETTINGS.facebook,
    messenger: (row.messenger as string) ?? DEFAULT_SETTINGS.messenger,
    address: (row.address as string) ?? DEFAULT_SETTINGS.address,
    mapsUrl: (row.maps_url as string) ?? DEFAULT_SETTINGS.mapsUrl,
    gcashNumber: (row.gcash_number as string) ?? DEFAULT_SETTINGS.gcashNumber,
    gcashAccountName: (row.gcash_account_name as string) ?? DEFAULT_SETTINGS.gcashAccountName,
    gcashQrCodeUrl: (row.gcash_qr_code_url as string) ?? DEFAULT_SETTINGS.gcashQrCodeUrl,
    adminPassword: DEFAULT_SETTINGS.adminPassword, // admin auth is handled via Supabase Auth, not this field
  }
}

function settingsToRow(s: Partial<Settings>): Record<string, unknown> {
  const map: Record<keyof Settings, string> = {
    businessName: 'business_name',
    tagline: 'tagline',
    daytimeRate: 'daytime_rate',
    nighttimeRate: 'nighttime_rate',
    daytimeStart: 'daytime_start',
    daytimeEnd: 'daytime_end',
    nighttimeStart: 'nighttime_start',
    nighttimeEnd: 'nighttime_end',
    openingTime: 'opening_time',
    closingTime: 'closing_time',
    gapEnabled: 'gap_enabled',
    gapRate: 'gap_rate',
    phone: 'phone',
    facebook: 'facebook',
    messenger: 'messenger',
    address: 'address',
    mapsUrl: 'maps_url',
    gcashNumber: 'gcash_number',
    gcashAccountName: 'gcash_account_name',
    gcashQrCodeUrl: 'gcash_qr_code_url',
    adminPassword: 'admin_password',
  }
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(s)) {
    if (key === 'adminPassword') continue
    const column = map[key as keyof Settings]
    if (column) row[column] = value
  }
  return row
}

export const supabaseStore: DataStore = {
  async getSettings() {
    const { data, error } = await sb().from('settings').select('*').eq('id', 1).maybeSingle()
    if (error) throw error
    if (!data) return DEFAULT_SETTINGS
    return settingsFromRow(data)
  },

  async updateSettings(patch) {
    const row = settingsToRow(patch)
    const { data, error } = await sb().from('settings').update(row).eq('id', 1).select('*').single()
    if (error) throw error
    return settingsFromRow(data)
  },

  async getAvailabilityForDate(date) {
    const { data, error } = await sb()
      .from('public_availability')
      .select('booking_date, start_time, end_time, status')
      .eq('booking_date', date)
    if (error) throw error
    return (data ?? []).map(
      (r): AvailabilityRow => ({
        bookingDate: r.booking_date,
        startTime: String(r.start_time).slice(0, 5),
        endTime: String(r.end_time).slice(0, 5),
        status: r.status,
      }),
    )
  },

  async getAvailabilityForRange(startDate, endDate) {
    const { data, error } = await sb()
      .from('public_availability')
      .select('booking_date, start_time, end_time, status')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
    if (error) throw error
    return (data ?? []).map(
      (r): AvailabilityRow => ({
        bookingDate: r.booking_date,
        startTime: String(r.start_time).slice(0, 5),
        endTime: String(r.end_time).slice(0, 5),
        status: r.status,
      }),
    )
  },

  async listBookings() {
    const { data, error } = await sb()
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw error
    return (data ?? []).map(bookingFromRow)
  },

  async getBooking(id) {
    const { data, error } = await sb().from('bookings').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? bookingFromRow(data) : null
  },

  async findBookingByReference(reference, mobileNumber) {
    const { data, error } = await sb().rpc('get_booking_by_reference', {
      p_reference: reference.trim(),
      p_mobile: mobileNumber.trim(),
    })
    if (error) throw error
    if (!data || (Array.isArray(data) && data.length === 0)) return null
    const row = Array.isArray(data) ? data[0] : data
    return bookingFromRow(row)
  },

  async createBooking(input) {
    const row = {
      customer_name: input.customerName,
      mobile_number: input.mobileNumber,
      email: input.email,
      number_of_players: input.numberOfPlayers,
      booking_date: input.bookingDate,
      start_time: input.startTime,
      end_time: input.endTime,
      duration: input.duration,
      rate_breakdown: input.rateBreakdown,
      total_amount: input.totalAmount,
      notes: input.notes ?? null,
      payment_method: input.paymentMethod,
    }
    const { data, error } = await sb().from('bookings').insert(row).select('*').single()
    if (error) throw error
    return bookingFromRow(data)
  },

  async updateBookingStatus(id, status) {
    const { data, error } = await sb().from('bookings').update({ status }).eq('id', id).select('*').single()
    if (error) throw error
    return bookingFromRow(data)
  },

  async updateBookingPayment(id, paymentStatus) {
    const { data, error } = await sb()
      .from('bookings')
      .update({ payment_status: paymentStatus })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return bookingFromRow(data)
  },

  async cancelBooking(id) {
    return supabaseStore.updateBookingStatus(id, 'cancelled')
  },

  async deleteBooking(id) {
    const { error } = await sb().from('bookings').delete().eq('id', id)
    if (error) throw error
  },

  async listBlockedSlots() {
    const { data, error } = await sb().from('blocked_slots').select('*').order('date', { ascending: true })
    if (error) throw error
    return (data ?? []).map(
      (r): BlockedSlot => ({
        id: r.id,
        date: r.date,
        startTime: String(r.start_time).slice(0, 5),
        endTime: String(r.end_time).slice(0, 5),
        reason: r.reason ?? '',
        allDay: r.all_day,
        createdAt: r.created_at,
      }),
    )
  },

  async addBlockedSlot(input) {
    const row = {
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      reason: input.reason,
      all_day: input.allDay,
    }
    const { data, error } = await sb().from('blocked_slots').insert(row).select('*').single()
    if (error) throw error
    return {
      id: data.id,
      date: data.date,
      startTime: String(data.start_time).slice(0, 5),
      endTime: String(data.end_time).slice(0, 5),
      reason: data.reason ?? '',
      allDay: data.all_day,
      createdAt: data.created_at,
    }
  },

  async removeBlockedSlot(id) {
    const { error } = await sb().from('blocked_slots').delete().eq('id', id)
    if (error) throw error
  },
}
