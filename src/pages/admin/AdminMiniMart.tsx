import { useRef, useState } from 'react'
import { useMiniMartItems } from '../../hooks/useMiniMartItems'
import { uploadMiniMartImage } from '../../lib/miniMartStorage'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { getErrorMessage } from '../../lib/errors'
import { isEffectivelyAvailable, isLowStock } from '../../lib/miniMartStock'
import { MINI_MART_CATEGORIES, MINI_MART_CATEGORY_LABELS } from '../../types'
import type { MiniMartCategory, MiniMartItem, MiniMartItemInput } from '../../types'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { NumberField, TextField } from '../../components/admin/SettingsFields'

const EMPTY_FORM: MiniMartItemInput = {
  name: '',
  description: '',
  price: 0,
  category: 'food',
  imageUrl: '',
  isAvailable: true,
  stockQuantity: 0,
}

export default function AdminMiniMart() {
  const mart = useMiniMartItems()
  const [creating, setCreating] = useState(false)

  const lowStockItems = mart.items.filter(isLowStock)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-cream">Mini Mart</h1>
          <p className="text-sm text-cream-dim">Manage products shown on the public Mini Mart page.</p>
        </div>
        <Button size="md" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Close' : '+ New Product'}
        </Button>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="mb-4 border-amber-400/30 bg-amber-400/5 p-4">
          <p className="font-display text-xs font-extrabold uppercase tracking-widest text-amber-400">Low Stock</p>
          <div className="mt-2 space-y-1">
            {lowStockItems.map((i) => (
              <p key={i.id} className="text-sm text-cream">
                {i.name} — {i.stockQuantity} left
              </p>
            ))}
          </div>
        </Card>
      )}

      {creating && (
        <Card className="mb-4 p-5">
          <p className="mb-4 font-display font-bold text-cream">New Product</p>
          <ProductForm
            initial={EMPTY_FORM}
            onSubmit={async (input) => {
              await mart.createItem(input)
              setCreating(false)
            }}
            submitLabel="Create Product"
          />
        </Card>
      )}

      {mart.loading ? (
        <p className="text-cream-dim">Loading…</p>
      ) : mart.items.length === 0 ? (
        <p className="text-sm text-cream-dim">No products yet.</p>
      ) : (
        <div className="space-y-3">
          {mart.items.map((item) => (
            <ProductRow key={item.id} item={item} onUpdate={mart.updateItem} onDelete={mart.deleteItem} onAdjustStock={mart.adjustStock} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductRow({
  item,
  onUpdate,
  onDelete,
  onAdjustStock,
}: {
  item: MiniMartItem
  onUpdate: (id: string, patch: Partial<MiniMartItemInput>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAdjustStock: (id: string, delta: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [adjusting, setAdjusting] = useState<number | null>(null)
  const [setStockValue, setSetStockValue] = useState(String(item.stockQuantity))
  const [stockError, setStockError] = useState<string | null>(null)

  const available = isEffectivelyAvailable(item)
  const lowStock = isLowStock(item)

  async function handleDelete() {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    setBusy(true)
    try {
      await onDelete(item.id)
    } finally {
      setBusy(false)
    }
  }

  async function handleAdjust(delta: number) {
    setAdjusting(delta)
    setStockError(null)
    try {
      await onAdjustStock(item.id, delta)
    } catch (err) {
      setStockError(getErrorMessage(err, 'Failed to adjust stock.'))
    } finally {
      setAdjusting(null)
    }
  }

  async function handleSetStock() {
    const value = Number(setStockValue)
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      setStockError('Enter a whole number, 0 or more.')
      return
    }
    setAdjusting(-1)
    setStockError(null)
    try {
      await onUpdate(item.id, { stockQuantity: value })
    } catch (err) {
      setStockError(getErrorMessage(err, 'Failed to update stock.'))
    } finally {
      setAdjusting(null)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-court-800">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl">🛒</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-display font-bold text-cream">{item.name}</p>
              <Badge tone={available ? 'confirmed' : 'blocked'}>{available ? 'Available' : 'Sold Out'}</Badge>
              {lowStock && <Badge tone="pending">Low Stock</Badge>}
            </div>
            <p className="text-sm text-cream-dim">
              ₱{item.price} · {MINI_MART_CATEGORY_LABELS[item.category]} · Stock: {item.stockQuantity}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => onUpdate(item.id, { isAvailable: !item.isAvailable })}
            disabled={busy}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-cream hover:bg-white/10"
          >
            {item.isAvailable ? 'Mark Sold Out' : 'Mark Available'}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-cream hover:bg-white/10"
          >
            {editing ? 'Close' : 'Edit'}
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="rounded-lg bg-red-400/10 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-400/20"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cream-dim">Stock: {item.stockQuantity}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleAdjust(-5)}
            disabled={adjusting !== null || item.stockQuantity === 0}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-bold text-cream hover:bg-white/10 disabled:opacity-30"
          >
            −5
          </button>
          <button
            onClick={() => handleAdjust(-1)}
            disabled={adjusting !== null || item.stockQuantity === 0}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-bold text-cream hover:bg-white/10 disabled:opacity-30"
          >
            −1
          </button>
          <button
            onClick={() => handleAdjust(1)}
            disabled={adjusting !== null}
            className="rounded-lg bg-lime-500/10 px-3 py-1.5 text-sm font-bold text-lime-400 hover:bg-lime-500/20"
          >
            +1
          </button>
          <button
            onClick={() => handleAdjust(5)}
            disabled={adjusting !== null}
            className="rounded-lg bg-lime-500/10 px-3 py-1.5 text-sm font-bold text-lime-400 hover:bg-lime-500/20"
          >
            +5
          </button>

          <div className="ml-2 flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={setStockValue}
              onChange={(e) => setSetStockValue(e.target.value)}
              className="h-9 w-20 rounded-lg border border-white/10 bg-court-800 px-2 text-sm text-cream focus:border-lime-500/50 focus:outline-none"
            />
            <button
              onClick={handleSetStock}
              disabled={adjusting !== null}
              className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-bold text-cream hover:bg-white/10"
            >
              Set Stock
            </button>
          </div>
        </div>
        {stockError && <p className="mt-2 text-xs text-red-400">{stockError}</p>}
      </div>

      {editing && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <ProductForm
            initial={{
              name: item.name,
              description: item.description,
              price: item.price,
              category: item.category,
              imageUrl: item.imageUrl,
              isAvailable: item.isAvailable,
              stockQuantity: item.stockQuantity,
            }}
            onSubmit={async (input) => {
              await onUpdate(item.id, input)
              setEditing(false)
            }}
            submitLabel="Save Changes"
          />
        </div>
      )}
    </Card>
  )
}

function ProductForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial: MiniMartItemInput
  onSubmit: (input: MiniMartItemInput) => Promise<void>
  submitLabel: string
}) {
  const [form, setForm] = useState<MiniMartItemInput>(initial)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof MiniMartItemInput>(key: K, value: MiniMartItemInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadMiniMartImage(file)
      set('imageUrl', url)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to upload image.'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError('Enter a product name.')
      return
    }
    if (form.price < 0) {
      setError('Price cannot be negative.')
      return
    }
    if (!Number.isInteger(form.stockQuantity) || form.stockQuantity < 0) {
      setError('Stock quantity must be a whole number, 0 or more.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ ...form, name: form.name.trim(), description: form.description.trim() })
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save product.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <TextField label="Product Name" value={form.name} onChange={(v) => set('name', v)} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Description (optional)</span>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl border border-white/10 bg-court-800 px-3 py-2 text-sm text-cream focus:border-lime-500/50 focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Price (₱)" value={form.price} onChange={(v) => set('price', v)} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Category</span>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value as MiniMartCategory)}
            className="h-11 w-full rounded-xl border border-white/10 bg-court-800 px-3 text-sm text-cream focus:border-lime-500/50 focus:outline-none"
          >
            {MINI_MART_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {MINI_MART_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <NumberField label="Stock Quantity" value={form.stockQuantity} onChange={(v) => set('stockQuantity', Math.trunc(v))} />

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Product Photo</span>
        <div className="flex items-center gap-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-court-800">
            {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl">🛒</span>}
          </div>
          <div className="flex-1 space-y-2">
            <TextField label="" value={form.imageUrl} onChange={(v) => set('imageUrl', v)} />
            {isSupabaseConfigured && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" id="mm-file-input" />
                <label
                  htmlFor="mm-file-input"
                  className="inline-block cursor-pointer rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-cream hover:bg-white/10"
                >
                  {uploading ? 'Uploading…' : 'Upload Photo'}
                </label>
              </>
            )}
          </div>
        </div>
        {!isSupabaseConfigured && (
          <p className="mt-1 text-xs text-cream-dim">Paste an image URL above (photo upload requires Supabase to be connected).</p>
        )}
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.isAvailable} onChange={(e) => set('isAvailable', e.target.checked)} className="h-4 w-4 accent-lime-500" />
        <span className="text-sm font-semibold text-cream">Available</span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button size="md" onClick={handleSubmit} disabled={busy || uploading}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
    </div>
  )
}
