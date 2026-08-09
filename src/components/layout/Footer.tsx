import { Link } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'

export default function Footer() {
  const { settings } = useSettings()

  return (
    <footer className="border-t border-white/5 bg-court-950 px-4 pb-10 pt-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <p className="font-display text-xl font-extrabold text-lime-500">
              {settings.businessName.toUpperCase()}
            </p>
            <p className="mt-1 text-sm text-cream-dim">{settings.tagline}</p>
          </div>

          <div>
            <p className="font-display text-xs font-bold uppercase tracking-widest text-cream-dim">Court Hours</p>
            <p className="mt-2 text-sm text-cream">24/7</p>
            <p className="mt-3 text-sm text-cream-dim">
              Daytime: <span className="text-cream">₱{settings.daytimeRate}/hour</span>
            </p>
            <p className="text-sm text-cream-dim">
              Night: <span className="text-cream">₱{settings.nighttimeRate}/hour</span>
            </p>
          </div>

          <div>
            <p className="font-display text-xs font-bold uppercase tracking-widest text-cream-dim">Contact</p>
            <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="mt-2 block text-sm text-cream hover:text-lime-500">
              {settings.phone}
            </a>
            <a
              href={settings.facebook}
              target="_blank"
              rel="noreferrer"
              className="block text-sm text-cream-dim hover:text-lime-500"
            >
              PickleYard Compostela
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-cream-dim sm:flex-row">
          <p>&copy; {new Date().getFullYear()} {settings.businessName}. All rights reserved.</p>
          <Link to="/admin/login" className="text-cream-dim/60 hover:text-lime-500">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  )
}
