import { useFreePlayAvailability } from '../../hooks/useFreePlayAvailability'
import type { FreePlayDay, FreePlaySlot } from '../../hooks/useFreePlayAvailability'
import Badge from '../ui/Badge'
import Card from '../ui/Card'

export default function FreePlaySection() {
  const { loading, phase, tomorrow, visibleSlots, anyFreeVisible } = useFreePlayAvailability()

  return (
    <section id="free-play" className="scroll-mt-20 bg-court-900/50 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-cream sm:text-4xl">
            {phase === 'after' ? 'Free Play' : 'Free Play Today'}
          </h2>
          <p className="mt-2 text-cream-dim">
            Open court? Play for <span className="font-semibold text-lime-500">FREE from 2 PM–5 PM</span> when there is no
            existing booking.
          </p>
          <p className="mt-1 text-sm text-cream-dim">No paddle? No worries. Paddles are available for rent.</p>
        </div>

        <Card className="mt-8 p-5 sm:p-6">
          {loading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          ) : phase === 'after' ? (
            <AfterHoursView tomorrow={tomorrow} />
          ) : (
            <>
              <div className="space-y-3">
                {visibleSlots.map((slot) => (
                  <SlotRow key={slot.startTime} slot={slot} />
                ))}
              </div>

              <div className="mt-6 text-center">
                {anyFreeVisible ? (
                  <>
                    <div className="inline-block rounded-xl bg-lime-500 px-6 py-3 font-display text-base font-extrabold uppercase tracking-wide text-court-950 sm:text-lg">
                      Come Play Free
                    </div>
                    <p className="mt-3 text-xs text-cream-dim">No paddle? Paddles available for rent.</p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-sm font-extrabold uppercase tracking-wide text-red-300 sm:text-base">
                      Free Play Currently Unavailable
                    </p>
                    <p className="mt-2 text-sm text-cream-dim">
                      Today's 2 PM–5 PM slots are already booked. Check back again tomorrow.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </section>
  )
}

function SlotRow({ slot }: { slot: FreePlaySlot }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 ${
        slot.free ? 'border-lime-500/40 bg-lime-500/10' : 'border-white/5 bg-white/5 opacity-60'
      }`}
    >
      <span className={`font-display font-bold ${slot.free ? 'text-cream' : 'text-cream-dim'}`}>{slot.label}</span>
      <Badge tone={slot.free ? 'paid' : 'cancelled'}>{slot.free ? 'Available — Free Play' : 'Booked'}</Badge>
    </div>
  )
}

function AfterHoursView({ tomorrow }: { tomorrow: FreePlayDay | null }) {
  return (
    <div>
      <p className="text-center font-display text-lg font-extrabold text-cream">Free Play has ended for today.</p>

      {tomorrow && (
        <div className="mt-6">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-cream-dim">
            Tomorrow's Free Play (2 PM–5 PM)
          </p>
          <div className="space-y-3">
            {tomorrow.slots.map((slot) => (
              <SlotRow key={slot.startTime} slot={slot} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
