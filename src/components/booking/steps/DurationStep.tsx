import { useSettings } from '../../../context/SettingsContext'
import { calculatePrice } from '../../../lib/pricing'
import { formatDateLong, formatTime12h, hourToTime, minutesToTime } from '../../../lib/time'
import StepHeader from '../StepHeader'

interface DurationStepProps {
  date: string
  startHour: number
  availableDurations: number[]
  onSelect: (duration: number) => void
  onBack: () => void
}

const LABELS: Record<number, string> = { 1: '1 Hour', 2: '2 Hours', 3: '3 Hours', 4: '4 Hours' }

export default function DurationStep({ date, startHour, availableDurations, onSelect, onBack }: DurationStepProps) {
  const { settings } = useSettings()

  return (
    <div>
      <StepHeader
        title="Select Duration"
        subtitle={`${formatDateLong(date)} · Starting ${formatTime12h(hourToTime(startHour))}`}
        stepNumber={3}
        totalSteps={5}
        onBack={onBack}
      />

      {availableDurations.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="font-display font-bold text-cream">No durations available</p>
          <p className="mt-1 text-sm text-cream-dim">Try a different start time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((d) => {
            const available = availableDurations.includes(d)
            const price = calculatePrice(startHour, d, settings)
            const end = minutesToTime((startHour + d) * 60)
            return (
              <button
                key={d}
                type="button"
                disabled={!available}
                onClick={() => onSelect(d)}
                className={`flex flex-col items-start rounded-2xl border px-4 py-4 text-left transition ${
                  available
                    ? 'border-white/10 bg-court-800 hover:border-lime-500/60 hover:bg-court-700 active:scale-95'
                    : 'cursor-not-allowed border-white/5 bg-white/5 opacity-30'
                }`}
              >
                <span className="font-display text-base font-extrabold text-cream">{LABELS[d]}</span>
                <span className="mt-0.5 text-xs text-cream-dim">
                  until {formatTime12h(end)}
                </span>
                {available && price.valid && (
                  <span className="mt-2 font-display text-lg font-extrabold text-lime-500">₱{price.total}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
