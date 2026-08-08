import { useMemo } from 'react'
import { useAdminData } from '../../hooks/useAdminData'
import BookingRow from '../../components/admin/BookingRow'
import Card from '../../components/ui/Card'
import { todayISO } from '../../lib/time'

export default function AdminOverview() {
  const data = useAdminData()
  const today = todayISO()

  const todaysBookings = useMemo(
    () => data.bookings.filter((b) => b.bookingDate === today && b.status !== 'cancelled'),
    [data.bookings, today],
  )
  const upcoming = useMemo(
    () => data.bookings.filter((b) => b.bookingDate > today && b.status !== 'cancelled').slice(0, 8),
    [data.bookings, today],
  )
  const pendingCount = useMemo(() => data.bookings.filter((b) => b.status === 'pending').length, [data.bookings])
  const unpaidCount = useMemo(
    () => data.bookings.filter((b) => b.paymentStatus === 'unpaid' && b.status !== 'cancelled').length,
    [data.bookings],
  )

  if (data.loading) return <p className="text-cream-dim">Loading…</p>

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Today" value={todaysBookings.length} />
        <Stat label="Upcoming" value={upcoming.length} />
        <Stat label="Pending Approval" value={pendingCount} />
        <Stat label="Unpaid" value={unpaidCount} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-cream">Today's Bookings</h2>
        {todaysBookings.length === 0 ? (
          <p className="text-sm text-cream-dim">No bookings today.</p>
        ) : (
          <div className="space-y-3">
            {todaysBookings.map((b) => (
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
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-cream">Upcoming Bookings</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-cream-dim">No upcoming bookings.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
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
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-cream-dim">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold text-lime-500">{value}</p>
    </Card>
  )
}
