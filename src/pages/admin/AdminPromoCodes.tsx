import { useState } from 'react'
import { usePromoCodes } from '../../hooks/usePromoCodes'
import { WEEKDAY_LABELS, DISPLAY_WEEKDAYS } from '../../lib/openPlay'
import { formatDateLong } from '../../lib/time'
import type { PromoCode, PromoCodeInput } from '../../types'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { DateField, NumberField, TextField } from '../../components/admin/SettingsFields'

const EMPTY_FORM: PromoCodeInput = {
  code: '',
  active: true,
  daytimeRate: 133,
  nighttimeRate: 155,
  validFrom: new Date().toISOString().slice(0, 10),
  validUntil: '',
  validDays: [],
  minBookingHours: null,
  maxTotalUses: null,
  maxUsesPerCustomer: null,
  showBanner: false,
  bannerMessage: '',
}

export default function AdminPromoCodes() {
  const promo = usePromoCodes()
  const [creating, setCreating] = useState(false)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-cream">Promo Codes</h1>
          <p className="text-sm text-cream-dim">Discount codes that reduce the hourly court rate.</p>
        </div>
        <Button size="md" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Close' : '+ New Promo Code'}
        </Button>
      </div>

      {creating && (
        <Card className="mb-4 p-5">
          <p className="mb-4 font-display font-bold text-cream">New Promo Code</p>
          <PromoCodeForm
            initial={EMPTY_FORM}
            onSubmit={async (input) => {
              await promo.createPromoCode(input)
              setCreating(false)
            }}
            submitLabel="Create Promo Code"
          />
        </Card>
      )}

      {promo.loading ? (
        <p className="text-cream-dim">Loading…</p>
      ) : promo.promoCodes.length === 0 ? (
        <p className="text-sm text-cream-dim">No promo codes yet.</p>
      ) : (
        <div className="space-y-3">
          {promo.promoCodes.map((p) => (
            <PromoCodeRow key={p.id} promo={p} onUpdate={promo.updatePromoCode} onDelete={promo.deletePromoCode} />
          ))}
        </div>
      )}
    </div>
  )
}

function PromoCodeRow({
  promo,
  onUpdate,
  onDelete,
}: {
  promo: PromoCode
  onUpdate: (id: string, patch: Partial<PromoCodeInput>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const daysLabel = promo.validDays.length === 0 ? 'Every day' : promo.validDays.map((d) => WEEKDAY_LABELS[d].slice(0, 3)).join(', ')

  async function handleDelete() {
    if (!confirm(`Delete promo code ${promo.code}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await onDelete(promo.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg font-extrabold text-lime-500">{promo.code}</p>
            <Badge tone={promo.active ? 'confirmed' : 'cancelled'}>{promo.active ? 'Active' : 'Inactive'}</Badge>
            {promo.showBanner && <Badge tone="paid">Banner On</Badge>}
          </div>
          <p className="mt-1 text-sm text-cream-dim">
            ₱{promo.daytimeRate}/hr daytime · ₱{promo.nighttimeRate}/hr night
          </p>
          <p className="text-xs text-cream-dim">
            {formatDateLong(promo.validFrom)} {promo.validUntil ? `– ${formatDateLong(promo.validUntil)}` : '(no end date)'} · {daysLabel}
          </p>
          {(promo.minBookingHours || promo.maxTotalUses || promo.maxUsesPerCustomer) && (
            <p className="mt-1 text-xs text-cream-dim">
              {promo.minBookingHours && `Min ${promo.minBookingHours}h · `}
              {promo.maxTotalUses && `Max ${promo.maxTotalUses} total uses · `}
              {promo.maxUsesPerCustomer && `Max ${promo.maxUsesPerCustomer} per customer`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => onUpdate(promo.id, { active: !promo.active })}
            disabled={busy}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-cream hover:bg-white/10"
          >
            {promo.active ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-cream hover:bg-white/10"
          >
            {editing ? 'Close' : 'Edit'}
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="rounded-lg bg-red-400/10 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-400/20"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <PromoCodeForm
            initial={{
              code: promo.code,
              active: promo.active,
              daytimeRate: promo.daytimeRate,
              nighttimeRate: promo.nighttimeRate,
              validFrom: promo.validFrom,
              validUntil: promo.validUntil,
              validDays: promo.validDays,
              minBookingHours: promo.minBookingHours,
              maxTotalUses: promo.maxTotalUses,
              maxUsesPerCustomer: promo.maxUsesPerCustomer,
              showBanner: promo.showBanner,
              bannerMessage: promo.bannerMessage,
            }}
            onSubmit={async (input) => {
              await onUpdate(promo.id, input)
              setEditing(false)
            }}
            submitLabel="Save Changes"
          />
        </div>
      )}
    </Card>
  )
}

function PromoCodeForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial: PromoCodeInput
  onSubmit: (input: PromoCodeInput) => Promise<void>
  submitLabel: string
}) {
  const [form, setForm] = useState<PromoCodeInput>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof PromoCodeInput>(key: K, value: PromoCodeInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleDay(day: number) {
    set('validDays', form.validDays.includes(day) ? form.validDays.filter((d) => d !== day) : [...form.validDays, day].sort())
  }

  async function handleSubmit() {
    if (!form.code.trim()) {
      setError('Enter a promo code.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ ...form, code: form.code.trim().toUpperCase() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save promo code.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Promo Code" value={form.code} onChange={(v) => set('code', v.toUpperCase())} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Status</span>
          <select
            value={form.active ? 'active' : 'inactive'}
            onChange={(e) => set('active', e.target.value === 'active')}
            className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream focus:border-lime-500/50 focus:outline-none"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Daytime Promo Rate (₱/hr)" value={form.daytimeRate} onChange={(v) => set('daytimeRate', v)} />
        <NumberField label="Nighttime Promo Rate (₱/hr)" value={form.nighttimeRate} onChange={(v) => set('nighttimeRate', v)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DateField label="Valid From" value={form.validFrom} onChange={(v) => set('validFrom', v)} />
        <DateField label="Valid Until (optional)" value={form.validUntil} onChange={(v) => set('validUntil', v)} min={form.validFrom} />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Valid Days (none selected = every day)</span>
        <div className="flex flex-wrap gap-2">
          {DISPLAY_WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                form.validDays.includes(day)
                  ? 'border-lime-500 bg-lime-500/10 text-lime-400'
                  : 'border-white/10 bg-court-800 text-cream hover:bg-court-700'
              }`}
            >
              {WEEKDAY_LABELS[day].slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <NullableNumberField label="Min Booking Hours" value={form.minBookingHours} onChange={(v) => set('minBookingHours', v)} />
        <NullableNumberField label="Max Total Uses" value={form.maxTotalUses} onChange={(v) => set('maxTotalUses', v)} />
        <NullableNumberField label="Max Uses / Customer" value={form.maxUsesPerCustomer} onChange={(v) => set('maxUsesPerCustomer', v)} />
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.showBanner} onChange={(e) => set('showBanner', e.target.checked)} className="h-4 w-4 accent-lime-500" />
        <span className="text-sm font-semibold text-cream">Show Promo Banner</span>
      </label>

      {form.showBanner && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Promo Banner Message</span>
          <textarea
            value={form.bannerMessage}
            onChange={(e) => set('bannerMessage', e.target.value)}
            rows={2}
            placeholder="Use code PLAYMORE and play for only ₱133/hour daytime or ₱155/hour at night!"
            className="w-full resize-none rounded-xl border border-white/10 bg-court-800 px-3 py-2 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
          />
        </label>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button size="md" onClick={handleSubmit} disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
    </div>
  )
}

function NullableNumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-cream-dim">{label}</span>
      <input
        type="number"
        min={0}
        value={value ?? ''}
        placeholder="None"
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
      />
    </label>
  )
}
