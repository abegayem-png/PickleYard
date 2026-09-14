import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMiniMartInventoryLogs } from '../../hooks/useMiniMartInventoryLogs'
import { useMiniMartItems } from '../../hooks/useMiniMartItems'
import { MINI_MART_INVENTORY_REASON_LABELS } from '../../types'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AdminMiniMartInventoryHistory() {
  const [searchParams] = useSearchParams()
  const itemId = searchParams.get('item') ?? undefined
  const { logs, loading } = useMiniMartInventoryLogs(itemId)
  const { items } = useMiniMartItems()

  const filteredItemName = useMemo(() => items.find((i) => i.id === itemId)?.name, [items, itemId])

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-cream">Inventory History</h1>
          <p className="text-sm text-cream-dim">
            {filteredItemName ? (
              <>
                Stock changes for <span className="font-semibold text-cream">{filteredItemName}</span>.{' '}
                <Link to="/admin/mini-mart/inventory" className="text-lime-500 hover:text-lime-400">
                  Show all products
                </Link>
              </>
            ) : (
              'Every stock change across all products — orders, cancellations, and manual adjustments.'
            )}
          </p>
        </div>
        <Link to="/admin/mini-mart" className="rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-cream hover:bg-white/10">
          Back to Products
        </Link>
      </div>

      {loading ? (
        <p className="text-cream-dim">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-cream-dim">No stock changes recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const isIncrease = log.changeQuantity > 0
            const sourceLabel =
              log.reason === 'order' && log.orderNumber
                ? `Online Order #${log.orderNumber}`
                : log.reason === 'cancellation' && log.orderNumber
                  ? `Order #${log.orderNumber} Cancelled`
                  : MINI_MART_INVENTORY_REASON_LABELS[log.reason]

            return (
              <Card key={log.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-cream-dim">{formatDateTime(log.createdAt)}</p>
                    <p className="truncate font-display font-bold text-cream">{log.itemName}</p>
                  </div>
                  <Badge tone={isIncrease ? 'confirmed' : 'blocked'}>
                    {isIncrease ? '+' : ''}
                    {log.changeQuantity}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cream-dim">
                  <p>
                    {log.previousStock} → <span className="font-semibold text-cream">{log.newStock}</span>
                  </p>
                  <p className="font-semibold text-cream">{sourceLabel}</p>
                  {log.createdBy && <p className="text-xs">by {log.createdBy}</p>}
                </div>
                {log.notes && <p className="mt-1.5 text-xs italic text-cream-dim">"{log.notes}"</p>}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
