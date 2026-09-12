import type { MiniMartItem } from '../types'

/** Default low-stock warning threshold, per spec. Not admin-configurable. */
export const LOW_STOCK_THRESHOLD = 5

/** A product is actually orderable only if the admin hasn't manually marked
 *  it unavailable AND it has stock on hand — either alone makes it sold out. */
export function isEffectivelyAvailable(item: Pick<MiniMartItem, 'isAvailable' | 'stockQuantity'>): boolean {
  return item.isAvailable && item.stockQuantity > 0
}

export function isLowStock(item: Pick<MiniMartItem, 'stockQuantity'>): boolean {
  return item.stockQuantity > 0 && item.stockQuantity <= LOW_STOCK_THRESHOLD
}
