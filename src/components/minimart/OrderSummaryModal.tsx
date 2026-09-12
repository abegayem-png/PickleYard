import { useState } from 'react'
import { store } from '../../lib/store'
import { getErrorMessage } from '../../lib/errors'
import { useSettings } from '../../context/SettingsContext'
import GcashPaymentSection from '../payments/GcashPaymentSection'
import type { MiniMartItem, PaymentMethod, PlaceOrderResult } from '../../types'
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
  const { settings } = useSettings()
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<PlaceOrderResult | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  async function handlePlaceOrder() {
    if (!customerName.trim()) {
      setError('Enter your name.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await store.placeMiniMartOrder({
        customerName: customerName.trim(),
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity })),
        paymentMethod,
      })
      if (!result.success) {
        setError(result.reason || 'Could not place your order. Please try again.')
        return
      }
      setPlaced(result)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not place your order. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleViewStatus() {
    if (!placed?.orderNumber) return
    setCheckingStatus(true)
    try {
      const lookup = await store.getMiniMartOrderStatus(placed.orderNumber)
      if (lookup) setPlaced((p) => (p ? { ...p, status: lookup.status, total: lookup.total, paymentStatus: lookup.paymentStatus } : p))
    } catch {
      // Status refresh is best-effort — keep showing whatever we already have.
    } finally {
      setCheckingStatus(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-court-900 p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:max-w-md sm:rounded-3xl">
        {placed ? (
          <div className="text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-lime-500/15 text-3xl">✅</div>
            <h2 className="font-display text-xl font-extrabold text-cream">Order Received!</h2>
            <p className="mt-1 font-display text-lg font-bold text-lime-500">Order #{placed.orderNumber}</p>
            <p className="mt-2 text-sm text-cream-dim">We've received your order.</p>

            <div className="mt-5 space-y-2 rounded-2xl bg-court-800 p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Total</span>
                <span className="font-display text-xl font-extrabold text-lime-500">₱{placed.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Status</span>
                <span className="font-display font-bold uppercase text-cream">{placed.status}</span>
              </div>
            </div>

            {paymentMethod === 'gcash' && placed.paymentStatus ? (
              <GcashPaymentSection
                amount={placed.total}
                paymentStatus={placed.paymentStatus}
                gcashNumber={settings.gcashNumber}
                gcashAccountName={settings.gcashAccountName}
                gcashQrCodeUrl={settings.gcashQrCodeUrl}
                onSubmitProof={async (proofUrl) => {
                  const result = await store.submitMiniMartPaymentProof(placed.orderNumber!, proofUrl)
                  if (result.success) setPlaced((p) => (p ? { ...p, paymentStatus: 'pending' } : p))
                  return result
                }}
              />
            ) : (
              <p className="mt-4 text-sm text-cream-dim">Please wait while we prepare your order.</p>
            )}

            <Button fullWidth size="lg" className="mt-5" onClick={onNewOrder}>
              Start New Order
            </Button>
            <Button fullWidth size="lg" variant="secondary" className="mt-3" onClick={handleViewStatus} disabled={checkingStatus}>
              {checkingStatus ? 'Checking…' : 'View Order Status'}
            </Button>
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

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Your Name</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full Name"
                  className="h-12 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-base text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Add a note…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-court-800 px-3 py-2 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Payment Method</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`h-12 rounded-xl border font-display font-bold transition active:scale-95 ${
                      paymentMethod === 'cash'
                        ? 'border-lime-500 bg-lime-500/10 text-lime-400'
                        : 'border-white/10 bg-court-800 text-cream hover:bg-court-700'
                    }`}
                  >
                    Cash on Pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('gcash')}
                    className={`h-12 rounded-xl border font-display font-bold transition active:scale-95 ${
                      paymentMethod === 'gcash'
                        ? 'border-lime-500 bg-lime-500/10 text-lime-400'
                        : 'border-white/10 bg-court-800 text-cream hover:bg-court-700'
                    }`}
                  >
                    GCash
                  </button>
                </div>
              </label>
            </div>

            {error && <p className="mt-3 text-sm font-medium text-red-400">{error}</p>}

            <Button fullWidth size="lg" className="mt-5" onClick={handlePlaceOrder} disabled={submitting}>
              {submitting ? 'Placing Order…' : 'Place Order'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
