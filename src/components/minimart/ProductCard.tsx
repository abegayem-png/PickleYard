import type { MiniMartItem } from '../../types'
import { isEffectivelyAvailable, isLowStock } from '../../lib/miniMartStock'
import Badge from '../ui/Badge'
import Card from '../ui/Card'

export default function ProductCard({
  item,
  quantity,
  onQuantityChange,
}: {
  item: MiniMartItem
  quantity: number
  onQuantityChange: (qty: number) => void
}) {
  const soldOut = !isEffectivelyAvailable(item)
  const lowStock = isLowStock(item)
  const atStockLimit = quantity >= item.stockQuantity

  return (
    <Card className={`overflow-hidden ${soldOut ? 'opacity-50' : ''}`}>
      <div className="relative aspect-square w-full bg-court-800">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl">🛒</div>
        )}
        {soldOut && (
          <div className="absolute right-2 top-2">
            <Badge tone="blocked">Sold Out</Badge>
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="truncate font-display font-bold text-cream">{item.name}</p>
        {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-cream-dim">{item.description}</p>}
        <div className="mt-2 flex items-center justify-between">
          <p className="font-display text-lg font-extrabold text-lime-500">₱{item.price}</p>
          {!soldOut && (
            <p className="text-xs font-semibold text-cream-dim">{lowStock ? `Only ${item.stockQuantity} left` : 'Available'}</p>
          )}
        </div>

        {soldOut ? (
          <button
            disabled
            className="mt-3 h-10 w-full cursor-not-allowed rounded-xl bg-white/5 text-sm font-bold text-cream-dim/50"
          >
            Sold Out
          </button>
        ) : (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-court-900/60 p-1">
            <button
              type="button"
              onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
              disabled={quantity === 0}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-lg font-bold text-cream disabled:opacity-30"
              aria-label={`Remove one ${item.name}`}
            >
              −
            </button>
            <span className="font-display text-base font-extrabold text-cream">{quantity}</span>
            <button
              type="button"
              onClick={() => onQuantityChange(Math.min(item.stockQuantity, quantity + 1))}
              disabled={atStockLimit}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime-500 text-lg font-bold text-court-950 disabled:opacity-30"
              aria-label={`Add one ${item.name}`}
            >
              +
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
