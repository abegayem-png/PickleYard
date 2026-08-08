import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

export default function AdminLogin() {
  const { isAuthenticated, login, error } = useAdminAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to="/admin" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const ok = isSupabaseConfigured ? await login(email, password) : await login(password)
    setSubmitting(false)
    if (ok) navigate('/admin')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-court-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-lime-500 font-display text-sm font-extrabold leading-none text-court-950">
            24/7
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-cream">Admin Login</h1>
          <p className="mt-1 text-sm text-cream-dim">Manage bookings, pricing, and settings.</p>
        </div>

        <Card className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSupabaseConfigured && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Admin Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 w-full rounded-xl border border-white/10 bg-court-800 px-4 text-base text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                  placeholder="admin@yourcourt.com"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-cream-dim">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 w-full rounded-xl border border-white/10 bg-court-800 px-4 text-base text-cream placeholder:text-cream-dim/50 focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                placeholder="••••••••"
              />
            </label>
            {error && <p className="text-sm font-medium text-red-400">{error}</p>}
            <Button type="submit" fullWidth size="lg" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </Card>

        {!isSupabaseConfigured && (
          <p className="mt-4 text-center text-xs text-cream-dim">
            Demo mode: default password is <span className="font-mono text-cream">admin123</span> (change it in
            Admin Settings, or connect Supabase for real authentication).
          </p>
        )}
      </div>
    </div>
  )
}
