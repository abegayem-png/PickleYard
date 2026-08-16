/** Shape of the error object supabase-js throws for failed requests (PostgrestError).
 *  Not necessarily `instanceof Error` — a naive `err instanceof Error` check silently
 *  discards message/code/details/hint and falls back to a generic message. */
interface SupabaseLikeError {
  message?: unknown
  code?: unknown
  details?: unknown
  hint?: unknown
}

function isSupabaseLikeError(err: unknown): err is SupabaseLikeError {
  return typeof err === 'object' && err !== null && 'message' in err
}

/** User-facing message: the real error text, plus the hint (if any) — the most
 *  actionable part of a Postgres/PostgREST error for someone reading the UI. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isSupabaseLikeError(err) && typeof err.message === 'string' && err.message) {
    return typeof err.hint === 'string' && err.hint ? `${err.message} (${err.hint})` : err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** Full detail for the browser console — message/code/details/hint, not just a string. */
export function logError(context: string, err: unknown): void {
  if (isSupabaseLikeError(err)) {
    // eslint-disable-next-line no-console
    console.error(context, {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
      raw: err,
    })
    return
  }
  // eslint-disable-next-line no-console
  console.error(context, err)
}
