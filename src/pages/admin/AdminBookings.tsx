import { useMemo, useState } from 'react'
import { useAdminData } from '../../hooks/useAdminData'
import BookingRow from '../../components/admin/BookingRow'
import type { BookingStatus } from '../../types'

const FILTERS: Array<{ label: string; value: BookingStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default function AdminBookings() {
  const data = useAdminData()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<BookingStatus | 'all'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...data.bookings]
      .reverse()
      .filter((b) => (filter === 'all' ? true : b.status === filter))
      .filter((b) =>
        q
          ? b.customerName.toLowerCase().includes(q) ||
            b.mobileNumber.replace(/\s|-/g, '').includes(q.replace(/\s|-/g, '')) ||
            b.bookingReference.toLowerCase().includes(q)
          : true,
      )
  }, [data.bookings, query, filter])

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-extrabold text-cream">All Bookings</h1>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, mobile, or reference…"
          className="h-11 flex-1 rounded-xl border border-white/10 bg-court-800 px-4 text-sm text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
        />
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${
                filter === f.value ? 'bg-lime-500 text-court-950' : 'bg-white/5 text-cream-dim hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {data.loading ? (
        <p className="text-cream-dim">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-cream-dim">No bookings found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              onApprove={data.approveBooking}
              onCancel={data.cancelBooking}
              onMarkPaid={data.markPaid}
              onMarkUnpaid={data.markUnpaid}
              onDelete={data.deleteBooking}
            />
          ))}
        </div>
      )}
    </div>
  )
}
