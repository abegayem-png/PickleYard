import { useState } from 'react'
import type { MiniMartItem } from '../../types'
import Button from '../ui/Button'

export interface CartLine {
  item: MiniMartItem
  quantity: number
}

export default function OrderSummaryModal({
  lines,
  total,
  onClose,
  onNewOrder,
}: {
  lines: CartLine[]
  total: number
  onClose: () => void
  onNewOrder: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-court-900 p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:max-w-md sm:rounded-3xl">
        {confirmed ? (
          <div className="text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-lime-500/15 text-3xl">✅</div>
            <h2 className="font-display text-xl font-extrabold text-cream">Show This Screen to Mini Mart Staff</h2>
            <p className="mt-1 text-sm text-cream-dim">Present your phone at the Mini Mart to complete your order.</p>

            <div className="mt-5 space-y-2 rounded-2xl bg-court-800 p-4 text-left">
              {lines.map(({ item, quantity }) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <span className="font-display text-base font-bold text-cream">
                    {quantity} × {item.name}
                  </span>
                  <span className="font-display text-base font-bold text-cream">₱{item.price * quantity}</span>
                </div>
              ))}
              <div className="my-2 h-px bg-white/10" />
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-extrabold text-cream">TOTAL</span>
                <span className="font-display text-2xl font-extrabold text-lime-500">₱{total}</span>
              </div>
            </div>

            <Button fullWidth size="lg" className="mt-5" onClick={onNewOrder}>
              Start New Order
            </Button>
            <button onClick={() => setConfirmed(false)} className="mt-3 text-sm font-semibold text-cream-dim underline">
              Edit order
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold text-cream">Your Order</h2>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-cream hover:bg-white/10">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {lines.map(({ item, quantity }) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-cream">{item.name}</p>
                    <p className="text-xs text-cream-dim">
                      ₱{item.price} × {quantity}
                    </p>
                  </div>
                  <p className="shrink-0 font-display font-bold text-cream">₱{item.price * quantity}</p>
                </div>
              ))}
            </div>

            <div className="my-4 h-px bg-white/10" />

            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-extrabold text-cream">TOTAL</span>
              <span className="font-display text-3xl font-extrabold text-lime-500">₱{total}</span>
            </div>

            <Button fullWidth size="lg" className="mt-6" onClick={() => setConfirmed(true)}>
              Show Order to Mini Mart
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
