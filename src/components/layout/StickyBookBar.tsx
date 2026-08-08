import { useEffect, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'

/** Mobile-only sticky CTA that hides once the booking widget scrolls into view. */
export default function StickyBookBar() {
  const { settings } = useSettings()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const target = document.getElementById('book')
    if (!target) return
    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), {
      rootMargin: '-40% 0px -40% 0px',
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  function scrollToBooking() {
    document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-court-950/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-md transition-transform duration-300 sm:hidden ${
        hidden ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <button
        onClick={scrollToBooking}
        className="flex h-14 w-full items-center justify-between rounded-2xl bg-lime-500 px-5 font-display font-bold text-court-950 shadow-[var(--shadow-glow)] active:scale-[0.98]"
      >
        <span>Book a Court</span>
        <span className="text-sm font-semibold">
          From ₱{Math.min(settings.daytimeRate, settings.nighttimeRate)}/hr →
        </span>
      </button>
    </div>
  )
}
