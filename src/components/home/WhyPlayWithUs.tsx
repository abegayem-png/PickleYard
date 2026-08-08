const REASONS = [
  { icon: '💸', title: 'Affordable Court Rates' },
  { icon: '💡', title: 'Court Lights for Night Games' },
  { icon: '📱', title: 'Easy Mobile Booking' },
  { icon: '🏟️', title: 'Quality Playing Court' },
  { icon: '👨‍👩‍👧‍👦', title: 'Great for Friends & Family' },
]

export default function WhyPlayWithUs() {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-cream sm:text-4xl">Why Play With Us</h2>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {REASONS.map((r) => (
            <div
              key={r.title}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-court-800/50 px-4 py-6 text-center"
            >
              <span className="text-3xl">{r.icon}</span>
              <p className="font-display text-sm font-bold text-cream">{r.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
