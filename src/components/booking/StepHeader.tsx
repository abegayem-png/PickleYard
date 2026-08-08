interface StepHeaderProps {
  title: string
  subtitle?: string
  stepNumber: number
  totalSteps: number
  onBack?: () => void
}

export default function StepHeader({ title, subtitle, stepNumber, totalSteps, onBack }: StepHeaderProps) {
  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-cream hover:bg-white/10 active:scale-95"
          >
            ‹
          </button>
        )}
        <div className="flex-1">
          <div className="mb-1.5 flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < stepNumber ? 'bg-lime-500' : 'bg-white/10'}`}
              />
            ))}
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cream-dim">
            Step {stepNumber} of {totalSteps}
          </p>
        </div>
      </div>
      <h3 className="font-display text-xl font-extrabold text-cream sm:text-2xl">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-cream-dim">{subtitle}</p>}
    </div>
  )
}
