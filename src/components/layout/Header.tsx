import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'

export default function Header() {
  const { settings } = useSettings()
  const location = useLocation()
  const navigate = useNavigate()

  function goToBooking() {
    if (location.pathname === '/') {
      document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/#book')
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-court-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime-500 font-display text-[11px] font-extrabold leading-none text-court-950">
            24/7
          </span>
          <span className="font-display text-sm font-bold leading-tight text-cream sm:text-base">
            {settings.businessName.toUpperCase()}
          </span>
        </Link>
        <button
          onClick={goToBooking}
          className="rounded-xl bg-lime-500 px-4 py-2.5 font-display text-sm font-bold text-court-950 shadow-[var(--shadow-glow)] transition active:scale-95"
        >
          Book Now
        </button>
      </div>
    </header>
  )
}
