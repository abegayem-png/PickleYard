import { isSupabaseConfigured, supabase } from './supabaseClient'

const BUCKET = 'payment-qr-codes'

export type PaymentQrKind = 'gcash' | 'bank'

/** Uploads the admin's payment QR code (GCash or Bank) and returns its public
 *  URL. Each kind lives at a fixed path (`gcash/qr-code.<ext>` or
 *  `bank/qr-code.<ext>`) with upsert enabled, so "Upload / Replace" genuinely
 *  replaces the same object instead of piling up random files — this bucket
 *  is public read, admin-only write, same shape as mini-mart-images.
 *
 *  A `?v=` cache-busting suffix is appended to the returned URL so the new
 *  image shows immediately after a replace, even though the underlying
 *  object path never changes (the browser would otherwise keep serving the
 *  previously cached image at that same URL).
 *
 *  Only usable when Supabase is configured — demo mode falls back to a plain
 *  "paste an image URL" field in Admin Settings. */
export async function uploadPaymentQrImage(file: File, kind: PaymentQrKind): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('QR code upload requires Supabase to be configured. Paste an image URL instead.')
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${kind}/qr-code.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}
