import { useSettings } from '../../context/SettingsContext'
import { formatTime12h } from '../../lib/time'
import Card from '../ui/Card'

export default function RatesSection() {
  const { settings } = useSettings()

  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-cream sm:text-4xl">Court Rates</h2>
          <p className="mt-2 text-cream-dim">Simple, transparent pricing. No hidden fees.</p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <RateCard
            icon="☀️"
            label="DAYTIME"
            hours={`${formatTime12h(settings.daytimeStart)} – ${formatTime12h(settings.daytimeEnd)}`}
            rate={settings.daytimeRate}
          />
          <RateCard
            icon="🌙"
            label="NIGHT"
            hours={`${formatTime12h(settings.nighttimeStart)} – ${formatTime12h(settings.nighttimeEnd)}`}
            rate={settings.nighttimeRate}
            highlight
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-cream-dim">
          <span>💡 Court Lights</span>
          <span>🏆 Quality Play</span>
        </div>
        <p className="mt-4 text-center font-display text-lg font-bold text-lime-500">
          Great Games. Better Memories.
        </p>
      </div>
    </section>
  )
}

function RateCard({
  icon,
  label,
  hours,
  rate,
  highlight,
}: {
  icon: string
  label: string
  hours: string
  rate: number
  highlight?: boolean
}) {
  return (
    <Card
      className={`p-7 text-center ${highlight ? 'border-lime-500/40 bg-court-800' : ''}`}
    >
      <span className="text-4xl">{icon}</span>
      <p className="mt-3 font-display text-sm font-extrabold uppercase tracking-widest text-lime-500">{label}</p>
      <p className="mt-1 text-sm text-cream-dim">{hours}</p>
      <p className="mt-4 font-display text-5xl font-extrabold text-cream">₱{rate}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-cream-dim">Per Hour</p>
    </Card>
  )
}
