import { useEffect, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import type { Settings } from '../../types'
import { Section, TextField, NumberField, TimeField } from '../../components/admin/SettingsFields'
import OpenPlaySettingsPanel from '../../components/admin/OpenPlaySettingsPanel'
import { getErrorMessage, logError } from '../../lib/errors'

export default function AdminSettings() {
  const { settings, updateSettings } = useSettings()
  const [form, setForm] = useState<Settings>(settings)
  const [saving, setSaving] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => setForm(settings), [settings])

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save(section: string, patch: Partial<Settings>) {
    setSaving(section)
    setSavedMsg(null)
    setErrorMsg(null)
    try {
      await updateSettings(patch)
      setSavedMsg('Settings saved successfully.')
      setTimeout(() => setSavedMsg(null), 3000)
    } catch (err) {
      logError(`Failed to save "${section}":`, err)
      setErrorMsg(`Couldn't save "${section}": ${getErrorMessage(err)}`)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-extrabold text-cream">Settings</h1>
        {savedMsg && <span className="text-sm font-semibold text-lime-500">✓ {savedMsg}</span>}
      </div>
      {errorMsg && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{errorMsg}</div>
      )}

      <Section title="Business Info" onSave={() => save('Business info', { businessName: form.businessName, tagline: form.tagline })} saving={saving === 'Business info'}>
        <TextField label="Business Name" value={form.businessName} onChange={(v) => set('businessName', v)} />
        <TextField label="Tagline" value={form.tagline} onChange={(v) => set('tagline', v)} />
      </Section>

      <Section
        title="Court Pricing"
        onSave={() =>
          save('Pricing', {
            daytimeRate: form.daytimeRate,
            nighttimeRate: form.nighttimeRate,
            gapEnabled: form.gapEnabled,
            gapRate: form.gapRate,
          })
        }
        saving={saving === 'Pricing'}
      >
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Daytime Rate (₱/hr)" value={form.daytimeRate} onChange={(v) => set('daytimeRate', v)} />
          <NumberField label="Night Rate (₱/hr)" value={form.nighttimeRate} onChange={(v) => set('nighttimeRate', v)} />
        </div>
        <label className="mt-4 flex items-center gap-2">
          <input type="checkbox" checked={form.gapEnabled} onChange={(e) => set('gapEnabled', e.target.checked)} className="h-4 w-4 accent-lime-500" />
          <span className="text-sm font-semibold text-cream">
            Allow bookings outside daytime/nighttime hours (e.g. the {form.daytimeEnd}–{form.nighttimeStart} buffer, or
            overnight)
          </span>
        </label>
        {form.gapEnabled && (
          <div className="mt-3 max-w-xs">
            <NumberField label="Overnight / Off-Peak Rate (₱/hr)" value={form.gapRate} onChange={(v) => set('gapRate', v)} />
          </div>
        )}
        {!form.gapEnabled && (
          <p className="mt-3 text-xs text-cream-dim">
            With this off, only the {form.daytimeStart}–{form.daytimeEnd} and {form.nighttimeStart}–{form.nighttimeEnd}
            {' '}windows are bookable — enable it to make the rest of the day (including overnight) bookable too.
          </p>
        )}
      </Section>

      <Section
        title="Operating Hours & Schedule"
        onSave={() =>
          save('Operating hours', {
            openingTime: form.openingTime,
            closingTime: form.closingTime,
            daytimeStart: form.daytimeStart,
            daytimeEnd: form.daytimeEnd,
            nighttimeStart: form.nighttimeStart,
            nighttimeEnd: form.nighttimeEnd,
          })
        }
        saving={saving === 'Operating hours'}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.openingTime === '00:00' && form.closingTime === '24:00'}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                openingTime: e.target.checked ? '00:00' : '06:00',
                closingTime: e.target.checked ? '24:00' : '22:00',
              }))
            }
            className="h-4 w-4 accent-lime-500"
          />
          <span className="text-sm font-semibold text-cream">Open 24 hours (bookable any time, including overnight)</span>
        </label>

        {form.openingTime === '00:00' && form.closingTime === '24:00' ? (
          <p className="mt-3 text-xs text-cream-dim">
            Every hour of the day is bookable. Turn this off to restrict online booking to a specific window instead.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <TimeField label="Booking Opens" value={form.openingTime} onChange={(v) => set('openingTime', v)} />
            <TimeField label="Booking Closes" value={form.closingTime} onChange={(v) => set('closingTime', v)} />
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4">
          <TimeField label="Daytime Start" value={form.daytimeStart} onChange={(v) => set('daytimeStart', v)} />
          <TimeField label="Daytime End" value={form.daytimeEnd} onChange={(v) => set('daytimeEnd', v)} />
          <TimeField label="Night Start" value={form.nighttimeStart} onChange={(v) => set('nighttimeStart', v)} />
          <TimeField label="Night End" value={form.nighttimeEnd} onChange={(v) => set('nighttimeEnd', v)} />
        </div>
        <p className="mt-3 text-xs text-cream-dim">
          Daytime and Night define the two priced windows above; anything outside them (including overnight) follows
          the "Overnight / Off-Peak Rate" set in Court Pricing once that's enabled.
        </p>
      </Section>

      <Section
        title="Contact Information"
        onSave={() => save('Contact info', { phone: form.phone, facebook: form.facebook, messenger: form.messenger })}
        saving={saving === 'Contact info'}
      >
        <TextField label="Mobile Number" value={form.phone} onChange={(v) => set('phone', v)} />
        <TextField label="Facebook Page" value={form.facebook} onChange={(v) => set('facebook', v)} />
        <TextField label="Messenger Link" value={form.messenger} onChange={(v) => set('messenger', v)} />
      </Section>

      <Section
        title="Court Location"
        onSave={() => save('Location', { address: form.address, mapsUrl: form.mapsUrl })}
        saving={saving === 'Location'}
      >
        <TextField label="Address" value={form.address} onChange={(v) => set('address', v)} />
        <TextField label="Google Maps URL (optional)" value={form.mapsUrl} onChange={(v) => set('mapsUrl', v)} />
      </Section>

      <Section
        title="GCash Payment Details"
        onSave={() =>
          save('GCash settings', {
            gcashNumber: form.gcashNumber,
            gcashAccountName: form.gcashAccountName,
            gcashQrCodeUrl: form.gcashQrCodeUrl,
          })
        }
        saving={saving === 'GCash settings'}
      >
        <TextField label="GCash Number" value={form.gcashNumber} onChange={(v) => set('gcashNumber', v)} />
        <TextField label="GCash Account Name" value={form.gcashAccountName} onChange={(v) => set('gcashAccountName', v)} />
        <TextField label="QR Code Image URL (optional)" value={form.gcashQrCodeUrl} onChange={(v) => set('gcashQrCodeUrl', v)} />
      </Section>

      {!isSupabaseConfigured && (
        <Section title="Admin Password (Demo Mode)" onSave={() => save('Admin password', { adminPassword: form.adminPassword })} saving={saving === 'Admin password'}>
          <TextField label="Admin Password" value={form.adminPassword} onChange={(v) => set('adminPassword', v)} />
          <p className="mt-2 text-xs text-cream-dim">
            This simple password is used because Supabase is not connected. Connect Supabase and create an admin user
            in Supabase Auth for production-grade security.
          </p>
        </Section>
      )}

      <OpenPlaySettingsPanel />
    </div>
  )
}
