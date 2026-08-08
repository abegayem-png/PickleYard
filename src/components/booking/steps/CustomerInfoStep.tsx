import { useMemo, useState } from 'react'
import type { CustomerInfo } from '../../../hooks/useBookingFlow'
import Button from '../../ui/Button'
import StepHeader from '../StepHeader'

interface CustomerInfoStepProps {
  value: CustomerInfo
  onChange: (value: CustomerInfo) => void
  onSubmit: () => void
  onBack: () => void
}

export default function CustomerInfoStep({ value, onChange, onSubmit, onBack }: CustomerInfoStepProps) {
  const [touched, setTouched] = useState(false)

  const errors = useMemo(() => {
    const e: Partial<Record<keyof CustomerInfo, string>> = {}
    if (!value.customerName.trim()) e.customerName = 'Full name is required.'
    if (!value.mobileNumber.trim()) e.mobileNumber = 'Mobile number is required.'
    else if (!/^[0-9+\s-]{7,15}$/.test(value.mobileNumber.trim())) e.mobileNumber = 'Enter a valid mobile number.'
    if (value.email.trim() && !/^\S+@\S+\.\S+$/.test(value.email.trim())) e.email = 'Enter a valid email address.'
    if (value.numberOfPlayers < 1 || value.numberOfPlayers > 8) e.numberOfPlayers = '1–8 players.'
    return e
  }, [value])

  const isValid = Object.keys(errors).length === 0

  function handleSubmit() {
    setTouched(true)
    if (isValid) onSubmit()
  }

  function set<K extends keyof CustomerInfo>(key: K, v: CustomerInfo[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <div>
      <StepHeader title="Your Information" subtitle="We'll use this to confirm your booking." stepNumber={4} totalSteps={5} onBack={onBack} />

      <div className="space-y-4">
        <Field label="Full Name" error={touched ? errors.customerName : undefined}>
          <input
            type="text"
            value={value.customerName}
            onChange={(e) => set('customerName', e.target.value)}
            placeholder="Juan Dela Cruz"
            className={inputClass(touched && !!errors.customerName)}
          />
        </Field>

        <Field label="Mobile Number" error={touched ? errors.mobileNumber : undefined}>
          <input
            type="tel"
            inputMode="tel"
            value={value.mobileNumber}
            onChange={(e) => set('mobileNumber', e.target.value)}
            placeholder="09XX XXX XXXX"
            className={inputClass(touched && !!errors.mobileNumber)}
          />
        </Field>

        <Field label="Email Address" error={touched ? errors.email : undefined}>
          <input
            type="email"
            inputMode="email"
            value={value.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="you@email.com"
            className={inputClass(touched && !!errors.email)}
          />
        </Field>

        <Field label="Number of Players" error={touched ? errors.numberOfPlayers : undefined}>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => set('numberOfPlayers', Math.max(1, value.numberOfPlayers - 1))}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xl font-bold text-cream active:scale-95"
            >
              −
            </button>
            <span className="w-8 text-center font-display text-lg font-extrabold text-cream">{value.numberOfPlayers}</span>
            <button
              type="button"
              onClick={() => set('numberOfPlayers', Math.min(8, value.numberOfPlayers + 1))}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xl font-bold text-cream active:scale-95"
            >
              +
            </button>
          </div>
        </Field>

        <Field label="Optional Notes">
          <textarea
            value={value.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Anything we should know?"
            rows={3}
            className={inputClass(false) + ' resize-none'}
          />
        </Field>

        <Field label="Payment Method">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => set('paymentMethod', 'cash')}
              className={paymentBtnClass(value.paymentMethod === 'cash')}
            >
              Cash at Court
            </button>
            <button
              type="button"
              onClick={() => set('paymentMethod', 'gcash')}
              className={paymentBtnClass(value.paymentMethod === 'gcash')}
            >
              GCash
            </button>
          </div>
        </Field>
      </div>

      <Button fullWidth size="lg" className="mt-6" onClick={handleSubmit}>
        Continue to Summary
      </Button>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-cream-dim">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-400">{error}</span>}
    </label>
  )
}

function inputClass(hasError: boolean) {
  return `h-12 w-full rounded-xl border bg-court-800 px-4 text-base text-cream placeholder:text-cream-dim/50 focus:outline-none focus:ring-2 ${
    hasError ? 'border-red-400 focus:ring-red-400/40' : 'border-white/10 focus:ring-lime-500/40 focus:border-lime-500/50'
  }`
}

function paymentBtnClass(active: boolean) {
  return `h-12 rounded-xl border font-display font-bold transition active:scale-95 ${
    active ? 'border-lime-500 bg-lime-500/10 text-lime-400' : 'border-white/10 bg-court-800 text-cream hover:bg-court-700'
  }`
}
