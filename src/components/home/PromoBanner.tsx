import { useEffect, useState } from 'react'
import { store } from '../../lib/store'
import type { ActivePromoBanner } from '../../types'
import Button from '../ui/Button'
import Card from '../ui/Card'

/** Small promo banner near the top of the booking section — separate from the
 *  big Open Play promo banner at the very top of the page. Only ever shows a
 *  promo code that's active, has its banner enabled, and is within its valid
 *  date range (enforced by the promo_banner view / store, not this component). */
export default function PromoBanner() {
  const [banner, setBanner] = useState<ActivePromoBanner | null>(null)

  useEffect(() => {
    let cancelled = false
    store
      .getActivePromoBanner()
      .then((b) => !cancelled && setBanner(b))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!banner) return null

  function scrollToBooking() {
    document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <Card className="mb-6 border-lime-500/40 bg-gradient-to-br from-court-800 to-court-900 p-5">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="font-display text-xs font-extrabold uppercase tracking-widest text-lime-500">Special Rate</p>
          <p className="mt-1 text-sm text-cream">
            {banner.bannerMessage || `Use code ${banner.code} and save on your next booking!`}
          </p>
          <p className="mt-1 text-xs font-bold text-cream-dim">
            Code <span className="text-lime-400">{banner.code}</span> · ₱{banner.daytimeRate}/hr Daytime • ₱{banner.nighttimeRate}/hr Night
          </p>
        </div>
        <Button size="md" onClick={scrollToBooking} className="shrink-0">
          Book Now
        </Button>
      </div>
    </Card>
  )
}
