import { MINI_MART_CATEGORIES, MINI_MART_CATEGORY_LABELS } from '../../types'
import type { MiniMartCategory } from '../../types'

export type CategoryFilter = MiniMartCategory | 'all'

export default function CategoryTabs({ value, onChange }: { value: CategoryFilter; onChange: (c: CategoryFilter) => void }) {
  const options: CategoryFilter[] = ['all', ...MINI_MART_CATEGORIES]

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {options.map((opt) => {
        const label = opt === 'all' ? 'All' : MINI_MART_CATEGORY_LABELS[opt]
        const active = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition active:scale-95 ${
              active ? 'bg-lime-500 text-court-950' : 'bg-white/5 text-cream-dim hover:bg-white/10 hover:text-cream'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
