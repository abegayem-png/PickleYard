import type { ReactNode } from 'react'

type Tone = 'lime' | 'cream' | 'pending' | 'confirmed' | 'paid' | 'unpaid' | 'blocked' | 'cancelled'

const toneClasses: Record<Tone, string> = {
  lime: 'bg-lime-500 text-court-950',
  cream: 'bg-white/10 text-cream',
  pending: 'bg-amber-400/20 text-amber-300',
  confirmed: 'bg-sky-400/20 text-sky-300',
  paid: 'bg-lime-500/20 text-lime-400',
  unpaid: 'bg-amber-400/20 text-amber-300',
  blocked: 'bg-red-400/20 text-red-300',
  cancelled: 'bg-white/10 text-cream-dim',
}

export default function Badge({ tone = 'cream', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${toneClasses[tone]}`}>
      {children}
    </span>
  )
}
