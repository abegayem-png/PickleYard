import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { uploadPaymentQrImage, type PaymentQrKind } from '../../lib/paymentSettingsStorage'
import type { Settings } from '../../types'
import { Section, TextField, NumberField, TimeField } from '../../components/admin/SettingsFields'
import OpenPlaySettingsPanel from '../../components/admin/OpenPlaySettingsPanel'
import { getErrorMessage, logError } from '../../lib/errors'

/** Large (200-300px), aspect-ratio-preserving QR preview with real load-failure
 *  handling — a broken/private-bucket URL shows a clear admin message and logs
 *  the actual browser error, instead of silently rendering as a tiny broken-
 *  image icon (which is what a private bucket or bad path looks like). */
function QrPreview({ url, alt }: { url: string; alt: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const failed = failedUrl === url

  if (!url) {
    return (
      <div className="grid h-56 w-56 max-w-full place-items-center rounded-xl bg-white text-3xl">📷</div>
    )
  }

  if (failed) {
    return (
      <div className="grid h-56 w-56 max-w-full place-items-center rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-center text-xs font-semibold text-red-300">
        QR image could not be loaded. Check Storage permissions or saved path.
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      className="h-56 w-56 max-w-full rounded-xl border border-white/10 bg-white object-contain p-2"
      onError={(e) => {
        logError(`Failed to load QR preview (${alt}):`, { url, event: e })
        setFailedUrl(url)
      }}
    />
  )
}

export default function AdminSettings() {
  const { settings, updateSettings } = useSettings()
  const [form, setForm] = useState<Settings>(settings)
  const [saving, setSaving] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [uploadingQr, setUploadingQr] = useState<PaymentQrKind | null>(null)
  const gcashQrFileInputRef = useRef<HTMLInputElement>(null)
  const bankQrFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setForm(settings), [settings])

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleQrFileSelected(kind: PaymentQrKind, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const ref = kind === 'gcash' ? gcashQrFileInputRef : bankQrFileInputRef
    if (!file) return
    setUploadingQr(kind)
    setErrorMsg(null)
    try {
      const url = await uploadPaymentQrImage(file, kind)
      const field = kind === 'gcash' ? 'gcashQrCodeUrl' : 'bankQrCodeUrl'
      set(field, url)
      await save(kind === 'gcash' ? 'GCash settings' : 'Bank QR', { [field]: url })
    } catch (err) {
      logError(`Failed to upload ${kind === 'gcash' ? 'GCash' : 'Bank'} QR code:`, err)
      setErrorMsg(`Couldn't upload ${kind === 'gcash' ? 'GCash' : 'Bank'} QR code: ${getErrorMessage(err)}`)
    } finally {
      setUploadingQr(null)
      if (ref.current) ref.current.value = ''
    }
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
        title="GCash Payment"
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

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-cream-dim">GCash QR</span>
          <div className="flex flex-wrap items-start gap-4">
            <QrPreview url={form.gcashQrCodeUrl} alt="GCash QR code" />
            <div className="min-w-[200px] flex-1 space-y-2">
              <TextField label="" value={form.gcashQrCodeUrl} onChange={(v) => set('gcashQrCodeUrl', v)} />
              {isSupabaseConfigured && (
                <>
                  <input
                    ref={gcashQrFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleQrFileSelected('gcash', e)}
                    className="hidden"
                    id="gcash-qr-file-input"
                  />
                  <label
                    htmlFor="gcash-qr-file-input"
                    className="inline-block cursor-pointer rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-cream hover:bg-white/10"
                  >
                    {uploadingQr === 'gcash' ? 'Uploading…' : 'Upload / Replace'}
                  </label>
                </>
              )}
            </div>
          </div>
          {!isSupabaseConfigured && (
            <p className="mt-1 text-xs text-cream-dim">Paste an image URL above (QR upload requires Supabase to be connected).</p>
          )}
        </div>
      </Section>

      <Section
        title="Bank Transfer QR"
        onSave={() => save('Bank QR', { bankQrCodeUrl: form.bankQrCodeUrl })}
        saving={saving === 'Bank QR'}
      >
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Bank QR</span>
          <div className="flex flex-wrap items-start gap-4">
            <QrPreview url={form.bankQrCodeUrl} alt="Bank transfer QR code" />
            <div className="min-w-[200px] flex-1 space-y-2">
              <TextField label="" value={form.bankQrCodeUrl} onChange={(v) => set('bankQrCodeUrl', v)} />
              {isSupabaseConfigured && (
                <>
                  <input
                    ref={bankQrFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleQrFileSelected('bank', e)}
                    className="hidden"
                    id="bank-qr-file-input"
                  />
                  <label
                    htmlFor="bank-qr-file-input"
                    className="inline-block cursor-pointer rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-cream hover:bg-white/10"
                  >
                    {uploadingQr === 'bank' ? 'Uploading…' : 'Upload / Replace'}
                  </label>
                </>
              )}
            </div>
          </div>
          {!isSupabaseConfigured && (
            <p className="mt-1 text-xs text-cream-dim">Paste an image URL above (QR upload requires Supabase to be connected).</p>
          )}
          <p className="mt-2 text-xs text-cream-dim">
            Not shown at checkout yet — Bank Transfer isn't a selectable payment option there. Stored here so it's ready when it is.
          </p>
        </div>
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
