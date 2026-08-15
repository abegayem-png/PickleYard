import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { store } from '../lib/store'
import { calculatePrice, getAvailableDurations, getAvailableStartHours } from '../lib/pricing'
import type { BookingLike, BlockedSlotLike } from '../lib/pricing'
import { hourToTime, minutesToTime, timeToMinutes, todayISO } from '../lib/time'
import type { Booking, BookingInput, PaymentMethod, PromoPreview } from '../types'

export type BookingStep = 'date' | 'time' | 'duration' | 'info' | 'summary' | 'confirmation'

export interface CustomerInfo {
  customerName: string
  mobileNumber: string
  email: string
  numberOfPlayers: number
  notes: string
  paymentMethod: PaymentMethod
}

const STEP_ORDER: BookingStep[] = ['date', 'time', 'duration', 'info', 'summary', 'confirmation']

export function useBookingFlow() {
  const { settings } = useSettings()

  const [step, setStep] = useState<BookingStep>('date')
  const [date, setDate] = useState<string | null>(null)
  const [startHour, setStartHour] = useState<number | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [customer, setCustomer] = useState<CustomerInfo>({
    customerName: '',
    mobileNumber: '',
    email: '',
    numberOfPlayers: 2,
    notes: '',
    paymentMethod: 'cash',
  })

  const [availability, setAvailability] = useState<{ bookings: BookingLike[]; blocked: BlockedSlotLike[] }>({
    bookings: [],
    blocked: [],
  })
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null)

  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<PromoPreview | null>(null)
  const [promoChecking, setPromoChecking] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)

  // Fetch fresh availability whenever the selected date changes.
  useEffect(() => {
    if (!date) return
    let cancelled = false
    setLoadingAvailability(true)
    Promise.all([
      store.getAvailabilityForDate(date),
      store.listBlockedSlots(),
      settings.openPlayBlockBookings ? store.getOpenPlaySessionsForDate(date) : Promise.resolve([]),
    ])
      .then(([rows, blockedSlots, openPlaySessions]) => {
        if (cancelled) return
        const blockedForDate: BlockedSlotLike[] = blockedSlots
          .filter((b) => b.date === date)
          .map((b) => ({
            date: b.date,
            startTime: b.allDay ? settings.openingTime : b.startTime,
            endTime: b.allDay ? settings.closingTime : b.endTime,
            allDay: b.allDay,
          }))
        const openPlayBlocked: BlockedSlotLike[] = openPlaySessions.map((s) => ({
          date: s.sessionDate,
          startTime: s.startTime,
          endTime: s.endTime,
          allDay: false,
        }))
        setAvailability({ bookings: rows, blocked: [...blockedForDate, ...openPlayBlocked] })
      })
      .finally(() => !cancelled && setLoadingAvailability(false))
    return () => {
      cancelled = true
    }
  }, [date, settings.openingTime, settings.closingTime, settings.openPlayBlockBookings])

  const availableStartHours = useMemo(() => {
    if (!date) return []
    return getAvailableStartHours(date, settings, availability.bookings, availability.blocked)
  }, [date, settings, availability])

  const availableDurations = useMemo(() => {
    if (!date || startHour === null) return []
    return getAvailableDurations(startHour, date, settings, availability.bookings, availability.blocked)
  }, [date, startHour, settings, availability])

  const priceResult = useMemo(() => {
    if (startHour === null || !duration) return null
    return calculatePrice(startHour, duration, settings)
  }, [startHour, duration, settings])

  const endTime = useMemo(() => {
    if (startHour === null || !duration) return null
    return minutesToTime((startHour + duration) * 60)
  }, [startHour, duration])

  const goToStep = useCallback((s: BookingStep) => setStep(s), [])

  const selectDate = useCallback((iso: string) => {
    setDate(iso)
    setStartHour(null)
    setDuration(null)
    setStep('time')
  }, [])

  const selectStartHour = useCallback((h: number) => {
    setStartHour(h)
    setDuration(null)
    setStep('duration')
  }, [])

  const selectDuration = useCallback((d: number) => {
    setDuration(d)
    setStep('info')
  }, [])

  const goBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
  }, [step])

  const submitCustomerInfo = useCallback(() => {
    setStep('summary')
  }, [])

  const applyPromoCode = useCallback(async () => {
    if (!promoInput.trim() || !date || startHour === null || !duration) return
    setPromoChecking(true)
    setPromoError(null)
    try {
      const preview = await store.previewPromoCode(promoInput, date, startHour, duration, customer.mobileNumber)
      if (preview.valid) {
        setAppliedPromo(preview)
      } else {
        setAppliedPromo(null)
        setPromoError(preview.reason ?? 'Invalid or expired promo code.')
      }
    } catch {
      setAppliedPromo(null)
      setPromoError('Invalid or expired promo code.')
    } finally {
      setPromoChecking(false)
    }
  }, [promoInput, date, startHour, duration, customer.mobileNumber])

  const removePromoCode = useCallback(() => {
    setAppliedPromo(null)
    setPromoError(null)
    setPromoInput('')
  }, [])

  const submitBooking = useCallback(async () => {
    if (!date || startHour === null || !duration || !priceResult?.valid || !endTime) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Re-check availability right before submit to avoid double-booking races.
      const [freshRows, blockedSlots, openPlaySessions] = await Promise.all([
        store.getAvailabilityForDate(date),
        store.listBlockedSlots(),
        settings.openPlayBlockBookings ? store.getOpenPlaySessionsForDate(date) : Promise.resolve([]),
      ])
      const startMin = timeToMinutes(hourToTime(startHour))
      const endMin = timeToMinutes(endTime)
      const conflict =
        freshRows.some(
          (r) =>
            r.status !== 'cancelled' &&
            startMin < timeToMinutes(r.endTime) &&
            timeToMinutes(r.startTime) < endMin,
        ) ||
        blockedSlots.some((b) => {
          if (b.date !== date) return false
          const bStart = timeToMinutes(b.allDay ? settings.openingTime : b.startTime)
          const bEnd = timeToMinutes(b.allDay ? settings.closingTime : b.endTime)
          return startMin < bEnd && bStart < endMin
        }) ||
        openPlaySessions.some((s) => startMin < timeToMinutes(s.endTime) && timeToMinutes(s.startTime) < endMin)

      if (conflict) {
        setSubmitError('Sorry, this time slot was just booked by someone else. Please choose another time.')
        setStep('time')
        setSubmitting(false)
        return
      }

      const input: BookingInput = {
        customerName: customer.customerName.trim(),
        mobileNumber: customer.mobileNumber.trim(),
        email: customer.email.trim(),
        numberOfPlayers: customer.numberOfPlayers,
        bookingDate: date,
        startTime: hourToTime(startHour),
        endTime,
        duration,
        rateBreakdown: appliedPromo?.valid ? appliedPromo.rateBreakdown : priceResult.breakdown,
        totalAmount: appliedPromo?.valid ? appliedPromo.promoTotal : priceResult.total,
        notes: customer.notes.trim() || undefined,
        paymentMethod: customer.paymentMethod,
        promoCode: appliedPromo?.valid ? appliedPromo.code : undefined,
      }
      const booking = await store.createBooking(input)
      setConfirmedBooking(booking)
      setStep('confirmation')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [date, startHour, duration, priceResult, endTime, customer, settings, appliedPromo])

  const reset = useCallback(() => {
    setStep('date')
    setDate(null)
    setStartHour(null)
    setDuration(null)
    setCustomer({
      customerName: '',
      mobileNumber: '',
      email: '',
      numberOfPlayers: 2,
      notes: '',
      paymentMethod: 'cash',
    })
    setConfirmedBooking(null)
    setSubmitError(null)
    setPromoInput('')
    setAppliedPromo(null)
    setPromoError(null)
  }, [])

  return {
    step,
    date,
    startHour,
    duration,
    endTime,
    customer,
    setCustomer,
    availableStartHours,
    availableDurations,
    priceResult,
    loadingAvailability,
    submitting,
    submitError,
    confirmedBooking,
    minDate: todayISO(),
    goToStep,
    selectDate,
    selectStartHour,
    selectDuration,
    goBack,
    submitCustomerInfo,
    submitBooking,
    reset,
    promoInput,
    setPromoInput,
    appliedPromo,
    promoChecking,
    promoError,
    applyPromoCode,
    removePromoCode,
  }
}
