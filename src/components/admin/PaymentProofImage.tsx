import { useEffect, useState } from 'react'
import { resolvePaymentProofUrl } from '../../lib/paymentProofStorage'

/** Admin-only viewer for a customer's uploaded GCash screenshot. Resolves the
 *  stored reference (private Storage path, or demo-mode data URL) to a
 *  displayable image — the resolve call itself is gated by Storage RLS to
 *  authenticated users only, so this silently can't work for a non-admin. */
export default function PaymentProofImage({ proofRef }: { proofRef: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(false)
    resolvePaymentProofUrl(proofRef)
      .then((resolved) => !cancelled && setUrl(resolved))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [proofRef])

  if (error) return <p className="text-xs text-red-400">Could not load payment screenshot.</p>
  if (!url) return <div className="h-40 w-40 animate-pulse rounded-xl bg-white/5" />

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="GCash payment screenshot" className="h-40 w-40 rounded-xl border border-white/10 object-cover" />
    </a>
  )
}
