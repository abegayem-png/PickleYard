import { isSupabaseConfigured, supabase } from './supabaseClient'

const BUCKET = 'payment-settings'

/** Uploads the admin's GCash QR code image and returns its public URL — this
 *  QR is meant to be shown to every customer, so (unlike payment proofs) the
 *  bucket is public read, admin-only write, same shape as mini-mart-images.
 *  Only usable when Supabase is configured — demo mode falls back to a plain
 *  "paste an image URL" field in Admin Settings. */
export async function uploadGcashQrImage(file: File): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('QR code upload requires Supabase to be configured. Paste an image URL instead.')
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
