import { useState } from 'react'
import { dateToISO, todayISO } from '../../lib/time'

interface MiniCalendarProps {
  selected: string | null
  onSelect: (iso: string) => void
  minDateISO?: string
  disabledDates?: Set<string>
  markedDates?: Set<string>
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function MiniCalendar({
  selected,
  onSelect,
  minDateISO = todayISO(),
  disabledDates,
  markedDates,
}: MiniCalendarProps) {
  const initial = selected ? new Date(selected + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  const today = todayISO()
  const monthStart = new Date(viewYear, viewMonth, 1)
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstWeekday = monthStart.getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const canGoPrev = !(viewYear === new Date(minDateISO).getFullYear() && viewMonth === new Date(minDateISO).getMonth())

  function changeMonth(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) {
      m = 11
      y -= 1
    } else if (m > 11) {
      m = 0
      y += 1
    }
    setViewYear(y)
    setViewMonth(m)
  }

  const cells: Array<{ day: number; iso: string } | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: dateToISO(new Date(viewYear, viewMonth, d)) })
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          disabled={!canGoPrev}
          className="grid h-9 w-9 place-items-center rounded-full text-cream disabled:opacity-20 hover:bg-white/10"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="font-display text-sm font-bold text-cream">{monthLabel}</p>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="grid h-9 w-9 place-items-center rounded-full text-cream hover:bg-white/10"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="py-1 text-xs font-semibold text-cream-dim">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />
          const isPast = cell.iso < minDateISO
          const isDisabled = isPast || disabledDates?.has(cell.iso)
          const isToday = cell.iso === today
          const isSelected = cell.iso === selected
          const isMarked = markedDates?.has(cell.iso)

          return (
            <button
              key={cell.iso}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(cell.iso)}
              className={[
                'relative aspect-square rounded-xl text-sm font-semibold transition-colors',
                isDisabled ? 'cursor-not-allowed text-cream-dim/25' : 'text-cream hover:bg-white/10 active:scale-95',
                isSelected ? 'bg-lime-500 text-court-950 hover:bg-lime-500' : '',
                isToday && !isSelected ? 'ring-2 ring-lime-500/70' : '',
              ].join(' ')}
            >
              {cell.day}
              {isMarked && !isSelected && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-red-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
