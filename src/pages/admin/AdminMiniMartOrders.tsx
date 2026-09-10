import { useEffect, useMemo, useState } from 'react'
import { useMiniMartOrdersContext } from '../../context/MiniMartOrdersContext'
import { isOrderSoundEnabled, setOrderSoundEnabled, unlockNotificationSound } from '../../lib/notificationSound'
import type { MiniMartOrder, MiniMartOrderStatus } from '../../types'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

const TABS: Array<{ label: string; value: MiniMartOrderStatus | 'all' }> = [
  { label: 'New', value: 'new' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Ready', value: 'ready' },
  { label: 'Completed', value: 'completed' },
  { label: 'All', value: 'all' },
]

const STATUS_BADGE_TONE: Record<MiniMartOrderStatus, 'pending' | 'confirmed' | 'paid' | 'cancelled'> = {
  new: 'pending',
  preparing: 'confirmed',
  ready: 'confirmed',
  completed: 'paid',
  cancelled: 'cancelled',
}

export default function AdminMiniMartOrders() {
  const { orders, loading, updateStatus, newOrderToast, dismissToast } = useMiniMartOrdersContext()
  const [tab, setTab] = useState<MiniMartOrderStatus | 'all'>('new')
  const [soundOn, setSoundOn] = useState(isOrderSoundEnabled())

  useEffect(() => {
    if (!newOrderToast) return
    const t = setTimeout(dismissToast, 6000)
    return () => clearTimeout(t)
  }, [newOrderToast, dismissToast])

  const visibleOrders = useMemo(() => {
    const filtered = tab === 'all' ? orders : orders.filter((o) => o.status === tab)
    return filtered
  }, [orders, tab])

  function toggleSound() {
    const next = !soundOn
    if (next) unlockNotificationSound()
    setOrderSoundEnabled(next)
    setSoundOn(next)
  }

  return (
    <div>
      {newOrderToast && (
        <div className="fixed inset-x-4 top-20 z-50 mx-auto max-w-sm rounded-2xl border border-lime-500/40 bg-court-900 p-4 shadow-[var(--shadow-glow)] sm:right-6 sm:left-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xs font-extrabold uppercase tracking-widest text-lime-500">New Mini Mart Order</p>
              <p className="mt-1 font-display text-lg font-extrabold text-cream">Order #{newOrderToast.orderNumber}</p>
              <p className="text-sm text-cream-dim">
                {newOrderToast.customerName} · ₱{newOrderToast.total}
              </p>
            </div>
            <button onClick={dismissToast} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/5 text-cream hover:bg-white/10">
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-cream">Mini Mart Orders</h1>
        <button
          onClick={toggleSound}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-cream hover:bg-white/10"
        >
          {soundOn ? '🔔' : '🔕'} Order Sound: {soundOn ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${
              tab === t.value ? 'bg-lime-500 text-court-950' : 'bg-white/5 text-cream-dim hover:bg-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-cream-dim">Loading…</p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-sm text-cream-dim">No orders here yet.</p>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order) => (
            <OrderCard key={order.id} order={order} onUpdateStatus={updateStatus} />
          ))}
        </div>
      )}
    </div>
  )
}

function OrderCard({
  order,
  onUpdateStatus,
}: {
  order: MiniMartOrder
  onUpdateStatus: (id: string, status: MiniMartOrderStatus) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)

  async function run(action: string, status: MiniMartOrderStatus) {
    setBusy(action)
    try {
      await onUpdateStatus(order.id, status)
    } finally {
      setBusy(null)
    }
  }

  const time = new Date(order.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_BADGE_TONE[order.status]}>{order.status.toUpperCase()} ORDER</Badge>
        <span className="font-display font-bold text-lime-500">Order #{order.orderNumber}</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cream-dim">Customer</p>
          <p className="text-cream">{order.customerName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cream-dim">Time</p>
          <p className="text-cream">{time}</p>
        </div>
      </div>

      <div className="my-3 h-px bg-white/10" />

      <div className="space-y-1">
        {order.items.map((line) => (
          <div key={line.id} className="flex items-center justify-between text-sm">
            <span className="text-cream">
              {line.quantity} × {line.itemName}
            </span>
            <span className="font-semibold text-cream">₱{line.subtotal}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="font-display font-bold text-cream">TOTAL</span>
        <span className="font-display text-xl font-extrabold text-lime-500">₱{order.total}</span>
      </div>

      {order.notes && (
        <p className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-cream-dim">
          <span className="font-semibold text-cream">Notes: </span>
          {order.notes}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {order.status === 'new' && (
          <Button size="md" disabled={busy !== null} onClick={() => run('accept', 'preparing')}>
            {busy === 'accept' ? 'Accepting…' : 'Accept Order'}
          </Button>
        )}
        {order.status === 'preparing' && (
          <Button size="md" disabled={busy !== null} onClick={() => run('ready', 'ready')}>
            {busy === 'ready' ? 'Updating…' : 'Mark Ready'}
          </Button>
        )}
        {order.status === 'ready' && (
          <Button size="md" disabled={busy !== null} onClick={() => run('complete', 'completed')}>
            {busy === 'complete' ? 'Updating…' : 'Complete Order'}
          </Button>
        )}
        {(order.status === 'new' || order.status === 'preparing' || order.status === 'ready') && (
          <Button size="md" variant="danger" disabled={busy !== null} onClick={() => run('cancel', 'cancelled')}>
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel Order'}
          </Button>
        )}
      </div>
    </Card>
  )
}
