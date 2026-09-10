import { useMemo, useState } from 'react'
import Layout from '../components/layout/Layout'
import { useMiniMartItems } from '../hooks/useMiniMartItems'
import CategoryTabs from '../components/minimart/CategoryTabs'
import type { CategoryFilter } from '../components/minimart/CategoryTabs'
import ProductCard from '../components/minimart/ProductCard'
import CartBar from '../components/minimart/CartBar'
import OrderSummaryModal from '../components/minimart/OrderSummaryModal'

export default function MiniMart() {
  const { items, loading } = useMiniMartItems()
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [showSummary, setShowSummary] = useState(false)

  const visibleItems = useMemo(
    () => (category === 'all' ? items : items.filter((i) => i.category === category)),
    [items, category],
  )

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => ({ item: items.find((i) => i.id === id)!, quantity }))
        .filter((line) => line.item),
    [cart, items],
  )

  const itemCount = cartLines.reduce((sum, l) => sum + l.quantity, 0)
  const total = cartLines.reduce((sum, l) => sum + l.item.price * l.quantity, 0)

  function setQuantity(itemId: string, qty: number) {
    setCart((c) => ({ ...c, [itemId]: qty }))
  }

  function handleNewOrder() {
    setCart({})
    setShowSummary(false)
  }

  return (
    <Layout>
      <div className="px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h1 className="font-display text-3xl font-extrabold text-cream sm:text-4xl">PickleYard Mini Mart</h1>
            <p className="mt-2 text-cream-dim">Snacks, drinks &amp; court essentials — all in one place.</p>
          </div>

          <div className="sticky top-[60px] z-20 -mx-4 mt-6 bg-court-950/95 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
            <CategoryTabs value={category} onChange={setCategory} />
          </div>

          {loading ? (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-white/5" />
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <p className="mt-10 text-center text-sm text-cream-dim">No products in this category yet — check back soon!</p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visibleItems.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  quantity={cart[item.id] ?? 0}
                  onQuantityChange={(qty) => setQuantity(item.id, qty)}
                />
              ))}
            </div>
          )}

          <div className="h-24 sm:hidden" />
        </div>
      </div>

      <CartBar itemCount={itemCount} total={total} onView={() => setShowSummary(true)} />

      {showSummary && (
        <OrderSummaryModal lines={cartLines} total={total} onClose={() => setShowSummary(false)} onNewOrder={handleNewOrder} />
      )}
    </Layout>
  )
}
