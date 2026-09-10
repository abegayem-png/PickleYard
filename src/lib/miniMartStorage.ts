import { isSupabaseConfigured, supabase } from './supabaseClient'

const BUCKET = 'mini-mart-images'

/** Uploads a Mini Mart product photo to Supabase Storage and returns its public URL.
 *  Only usable when Supabase is configured — demo/local mode has no real storage,
 *  so the admin form falls back to a plain "paste an image URL" field there. */
export async function uploadMiniMartImage(file: File): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Image upload requires Supabase to be configured. Paste an image URL instead.')
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
