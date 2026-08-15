import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import { AdminAuthProvider } from './context/AdminAuthContext'
import Home from './pages/Home'
import BookingLookup from './pages/BookingLookup'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import AdminOverview from './pages/admin/AdminOverview'
import AdminBookings from './pages/admin/AdminBookings'
import AdminCalendar from './pages/admin/AdminCalendar'
import AdminBlockedSlots from './pages/admin/AdminBlockedSlots'
import AdminManualBooking from './pages/admin/AdminManualBooking'
import AdminSettings from './pages/admin/AdminSettings'
import AdminOpenPlay from './pages/admin/AdminOpenPlay'
import AdminPromoCodes from './pages/admin/AdminPromoCodes'

export default function App() {
  return (
    <SettingsProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/my-booking" element={<BookingLookup />} />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="calendar" element={<AdminCalendar />} />
              <Route path="blocked" element={<AdminBlockedSlots />} />
              <Route path="new-booking" element={<AdminManualBooking />} />
              <Route path="open-play" element={<AdminOpenPlay />} />
              <Route path="promo-codes" element={<AdminPromoCodes />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </SettingsProvider>
  )
}
