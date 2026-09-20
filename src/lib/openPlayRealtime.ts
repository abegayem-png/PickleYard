import { isSupabaseConfigured, supabase } from './supabaseClient'

/**
 * Subscribes to changes on open_play_registrations for one session (join,
 * cancel, waitlist promotion) and calls `onChange` whenever one happens —
 * callers just refetch their own view rather than trying to patch
 * individual rows. No-op in localStorage/demo mode, since there's no real
 * backend to push from.
 */
export function subscribeToOpenPlayRegistrations(sessionId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {}
  }
  const client = supabase

  const channel = client
    .channel(`open-play-registrations-${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'open_play_registrations', filter: `session_id=eq.${sessionId}` },
      () => onChange(),
    )
    .subscribe()

  return () => {
    client.removeChannel(channel)
  }
}

/** Same idea as subscribeToOpenPlayRegistrations, for one session's chat
 *  thread (open_play_messages) — new/deleted messages call `onChange` so
 *  the chat modal can refetch. No-op in demo mode. */
export function subscribeToOpenPlayMessages(sessionId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {}
  }
  const client = supabase

  const channel = client
    .channel(`open-play-messages-${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'open_play_messages', filter: `open_play_session_id=eq.${sessionId}` },
      () => onChange(),
    )
    .subscribe()

  return () => {
    client.removeChannel(channel)
  }
}
