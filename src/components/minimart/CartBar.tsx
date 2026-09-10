export default function CartBar({
  itemCount,
  total,
  onView,
}: {
  itemCount: number
  total: number
  onView: () => void
}) {
  if (itemCount === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-court-950/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-md">
      <button
        onClick={onView}
        className="flex h-14 w-full items-center justify-between rounded-2xl bg-lime-500 px-5 font-display font-bold text-court-950 shadow-[var(--shadow-glow)] active:scale-[0.98]"
      >
        <span>View Order</span>
        <span className="text-sm font-semibold">
          {itemCount} Item{itemCount === 1 ? '' : 's'} · ₱{total}
        </span>
      </button>
    </div>
  )
}
