import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { store } from '../lib/store'

interface AdminAuthContextValue {
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  login: (emailOrPassword: string, password?: string) => Promise<boolean>
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

const SESSION_KEY = 'pkl_admin_session'

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setIsAuthenticated(Boolean(data.session))
        setLoading(false)
      })
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(Boolean(session))
      })
      return () => sub.subscription.unsubscribe()
    } else {
      setIsAuthenticated(sessionStorage.getItem(SESSION_KEY) === 'true')
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (emailOrPassword: string, password?: string) => {
    setError(null)
    if (isSupabaseConfigured && supabase) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailOrPassword,
        password: password ?? '',
      })
      if (authError) {
        setError('Invalid admin email or password.')
        return false
      }
      setIsAuthenticated(true)
      return true
    } else {
      const settings = await store.getSettings()
      if (emailOrPassword === settings.adminPassword) {
        sessionStorage.setItem(SESSION_KEY, 'true')
        setIsAuthenticated(true)
        return true
      }
      setError('Incorrect admin password.')
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
    setIsAuthenticated(false)
  }, [])

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, loading, error, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
