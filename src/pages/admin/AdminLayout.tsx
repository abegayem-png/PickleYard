import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'

const TABS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/calendar', label: 'Calendar' },
  { to: '/admin/blocked', label: 'Blocked Slots' },
  { to: '/admin/new-booking', label: 'New Booking' },
  { to: '/admin/settings', label: 'Settings' },
]

export default function AdminLayout() {
  const { isAuthenticated, loading, logout } = useAdminAuth()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-court-950 text-cream-dim">Loading…</div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />

  return (
    <div className="min-h-dvh bg-court-950">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-court-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-500 font-display text-[10px] font-extrabold leading-none text-court-950">
              24/7
            </span>
            <span className="font-display text-sm font-bold text-cream">Admin Dashboard</span>
          </div>
          <button
            onClick={() => logout()}
            className="rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-cream-dim hover:bg-white/10"
          >
            Log Out
          </button>
        </div>
        <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-lime-500 text-court-950' : 'text-cream-dim hover:bg-white/5 hover:text-cream'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
