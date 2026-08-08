import { useSettings } from '../../../context/SettingsContext'
import { getHourRate } from '../../../lib/pricing'
import { formatDateLong, formatTime12h, hourToTime } from '../../../lib/time'
import StepHeader from '../StepHeader'

interface TimeStepProps {
  date: string
  availableStartHours: number[]
  loading: boolean
  onSelect: (hour: number) => void
  onBack: () => void
}

export default function TimeStep({ date, availableStartHours, loading, onSelect, onBack }: TimeStepProps) {
  const { settings } = useSettings()

  return (
    <div>
      <StepHeader
        title="Select Start Time"
        subtitle={formatDateLong(date)}
        stepNumber={2}
        totalSteps={5}
        onBack={onBack}
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : availableStartHours.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="font-display font-bold text-cream">No time slots available</p>
          <p className="mt-1 text-sm text-cream-dim">This date is fully booked. Please choose another date.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {availableStartHours.map((h) => {
            const rate = getHourRate(h, settings)
            return (
              <button
                key={h}
                type="button"
                onClick={() => onSelect(h)}
                className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-court-800 px-3 py-4 transition active:scale-95 hover:border-lime-500/60 hover:bg-court-700"
              >
                <span className="font-display text-base font-extrabold text-cream">{formatTime12h(hourToTime(h))}</span>
                <span className="mt-1 text-xs font-semibold text-lime-500">₱{rate?.rate}/hr</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
