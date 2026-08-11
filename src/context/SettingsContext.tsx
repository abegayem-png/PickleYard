import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, type Settings } from '../types'
import { store } from '../lib/store'

interface SettingsContextValue {
  settings: Settings
  loading: boolean
  refresh: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const s = await store.getSettings()
      setSettings(s)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load settings:', err)
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const updated = await store.updateSettings(patch)
    setSettings(updated)
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
