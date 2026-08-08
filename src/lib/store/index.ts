import { isSupabaseConfigured } from '../supabaseClient'
import { localStore } from './localStore'
import { supabaseStore } from './supabaseStore'
import type { DataStore } from './types'

/**
 * Data access is Supabase-backed when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * are set (see .env.example). Otherwise it falls back to a localStorage-backed
 * store so the full booking flow works out of the box in local development.
 */
export const store: DataStore = isSupabaseConfigured ? supabaseStore : localStore

export { isSupabaseConfigured }
export type { DataStore, AvailabilityRow } from './types'
