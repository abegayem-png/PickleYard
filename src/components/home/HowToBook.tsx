const STEPS = [
  {
    n: 1,
    title: 'Choose Your Schedule',
    desc: 'Select your preferred date and available time.',
  },
  {
    n: 2,
    title: 'Enter Your Details',
    desc: 'Provide your contact information.',
  },
  {
    n: 3,
    title: 'Confirm Your Court',
    desc: 'Review your booking and secure your schedule.',
  },
]

export default function HowToBook() {
  return (
    <section className="bg-court-900/50 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-cream sm:text-4xl">How to Book</h2>
          <p className="mt-2 text-cream-dim">Three simple steps to your next game.</p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-white/5 bg-court-800/50 p-6 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-lime-500 font-display text-lg font-extrabold text-court-950">
                {s.n}
              </span>
              <p className="mt-4 font-display font-bold text-cream">{s.title}</p>
              <p className="mt-1.5 text-sm text-cream-dim">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
