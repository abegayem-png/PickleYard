import { useSettings } from '../../context/SettingsContext'
import { formatTime12h } from '../../lib/time'
import Button from '../ui/Button'

export default function Hero() {
  const { settings } = useSettings()

  function scrollToBooking() {
    document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative overflow-hidden bg-court-950 px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
      <div
        className="pointer-events-none absolute -top-24 right-1/2 h-72 w-72 translate-x-1/2 rounded-full bg-lime-500/20 blur-[100px] sm:right-0 sm:translate-x-0"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-lime-400">
          🎾 {settings.businessName}
        </span>

        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] text-cream sm:text-6xl">
          READY TO <span className="text-lime-500">PLAY?</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-cream-dim sm:text-lg">
          Book your court at {settings.businessName}.
        </p>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
          <RateBadge
            label="DAYTIME"
            hours={`${formatTime12h(settings.daytimeStart)} – ${formatTime12h(settings.daytimeEnd)}`}
            rate={settings.daytimeRate}
          />
          <RateBadge
            label="NIGHT"
            hours={`${formatTime12h(settings.nighttimeStart)} – ${formatTime12h(settings.nighttimeEnd)}`}
            rate={settings.nighttimeRate}
          />
        </div>

        <div className="mt-8">
          <Button size="lg" onClick={scrollToBooking} className="w-full sm:w-auto sm:px-12">
            BOOK A COURT
          </Button>
          <p className="mt-3 text-sm font-semibold text-cream-dim">💡 Court Lights Available</p>
        </div>
      </div>
    </section>
  )
}

function RateBadge({ label, hours, rate }: { label: string; hours: string; rate: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-court-800/70 px-4 py-3">
      <p className="font-display text-xs font-extrabold tracking-widest text-lime-500">{label}</p>
      <p className="mt-1 text-xs text-cream-dim">{hours}</p>
      <p className="mt-1 font-display text-lg font-extrabold text-cream">₱{rate}<span className="text-xs font-semibold text-cream-dim">/HR</span></p>
    </div>
  )
}
