import { isSupabaseConfigured, supabase } from './supabaseClient'

const BUCKET = 'payment-proofs'
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export function isAcceptedProofFile(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'))
    reader.readAsDataURL(file)
  })
}

/** Uploads a GCash payment screenshot and returns an opaque reference to it —
 *  a private Storage object path in production, or a data URL in demo mode
 *  (no real Storage there). Never a public URL: the bucket is private, so
 *  only an authenticated admin can later resolve it to a viewable image via
 *  resolvePaymentProofUrl(). */
export async function uploadPaymentProof(file: File): Promise<string> {
  if (!isAcceptedProofFile(file)) {
    throw new Error('Please upload a JPG, PNG, or WEBP image.')
  }
  if (!isSupabaseConfigured || !supabase) {
    return readFileAsDataUrl(file)
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

/** Resolves a stored proof reference to something an <img> can display.
 *  A demo-mode data URL is already displayable as-is. A production Storage
 *  path needs a short-lived signed URL — requesting one is itself gated by
 *  the bucket's RLS policy (authenticated/admin only), so a non-admin caller
 *  is refused here even if they somehow had the path. */
export async function resolvePaymentProofUrl(ref: string): Promise<string> {
  if (!ref || ref.startsWith('data:')) return ref
  if (!isSupabaseConfigured || !supabase) return ref
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ref, 3600)
  if (error) throw error
  return data.signedUrl
}
