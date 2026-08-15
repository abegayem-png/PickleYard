import { useSettings } from '../../context/SettingsContext'
import { useOpenPlaySessions } from '../../hooks/useOpenPlaySessions'
import { formatDateFull, formatTime12h, todayISO } from '../../lib/time'

export default function OpenPlayBanner() {
  const { settings } = useSettings()
  const openPlay = useOpenPlaySessions()

  if (!settings.openPlayEnabled) return null

  const next = openPlay.sessions
    .filter((s) => s.status === 'scheduled' && s.sessionDate >= todayISO())
    .sort((a, b) => (a.sessionDate === b.sessionDate ? a.startTime.localeCompare(b.startTime) : a.sessionDate.localeCompare(b.sessionDate)))[0]

  if (!next) return null

  const slotsRemaining = Math.max(0, next.playerLimit - next.registeredCount)
  const isFull = slotsRemaining === 0

  function scrollToOpenPlay() {
    document.getElementById('open-play')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="bg-gradient-to-r from-lime-400 to-lime-500 text-court-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
          <div className="shrink-0">
            <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.15em]">🎾 Open Play</p>
            <p className="font-display text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">
              ₱{next.pricePerPlayer} Only
            </p>
          </div>

          <div className="sm:border-l sm:border-court-950/25 sm:pl-5">
            <p className="font-display text-sm font-extrabold uppercase tracking-wide">{formatDateFull(next.sessionDate)}</p>
            <p className="text-sm font-bold">
              {formatTime12h(next.startTime)} – {formatTime12h(next.endTime)}
            </p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-court-950/80">
              {next.registeredCount} / {next.playerLimit} Players
              {!isFull && ` • ${slotsRemaining} Slot${slotsRemaining === 1 ? '' : 's'} Left`}
            </p>
          </div>
        </div>

        {isFull ? (
          <div className="shrink-0 rounded-xl bg-court-950 px-6 py-3 text-center font-display text-sm font-extrabold uppercase tracking-wide text-red-400">
            Open Play Full
          </div>
        ) : (
          <button
            type="button"
            onClick={scrollToOpenPlay}
            className="shrink-0 rounded-xl bg-court-950 px-6 py-3 font-display text-sm font-extrabold uppercase tracking-wide text-lime-400 shadow-lg transition active:scale-95 sm:px-8"
          >
            Join Open Play →
          </button>
        )}
      </div>
    </div>
  )
}
