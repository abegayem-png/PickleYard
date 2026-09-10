import { isSupabaseConfigured, supabase } from './supabaseClient'

/**
 * Subscribes to changes on mini_mart_orders (new orders, status updates) and
 * calls `onChange` whenever one happens — callers just refetch their own
 * view of the data rather than trying to patch individual rows. No-op in
 * localStorage/demo mode, since there's no real backend to push from.
 */
export function subscribeToMiniMartOrders(onChange: () => void): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {}
  }
  const client = supabase

  const channel = client
    .channel('mini-mart-orders-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mini_mart_orders' }, () => onChange())
    .subscribe()

  return () => {
    client.removeChannel(channel)
  }
}
