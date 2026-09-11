import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppUser } from '../types'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { DEMO_USERS } from '../utils/syntheticData'

interface LoginResult { success: boolean; error?: string }
interface ProfileUpdate { name?: string; phone?: string; photoDataUrl?: string }

interface AuthCtx {
  user: AppUser | null
  loading: boolean
  demoMode: boolean
  login: (employeeId: string, password: string) => Promise<LoginResult>
  logout: () => void
  updateProfile: (update: ProfileUpdate) => void
  addOverride: (userId: string, scope: string) => void   // grants extra jurisdiction after an approved access request
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: false,
  demoMode: true,
  login: async () => ({ success: false, error: 'Not initialized' }),
  logout: () => {},
  updateProfile: () => {},
  addOverride: () => {},
})

// Supabase Auth needs an email; employee IDs are mapped to a stable
// synthetic address so officers/analysts still log in with their
// employee ID + password everywhere in the UI.
function employeeIdToEmail(employeeId: string) {
  return `${employeeId.toLowerCase()}@detectra.local`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseConfigured || !supabase) { setLoading(false); return }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) await loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) await loadProfile(session.user.id)
      else setUser(null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function loadProfile(authUserId: string) {
    if (!supabase) return
    const { data, error } = await supabase.from('app_users').select('*').eq('id', authUserId).single()
    if (error || !data) { setUser(null); return }
    setUser({
      id: data.id, employeeId: data.employee_id, name: data.name, role: data.role,
      organization: data.organization, region: data.region, department: data.department,
      rank: data.rank ?? undefined, stationId: data.station_id ?? undefined,
      phone: data.phone ?? undefined, photoDataUrl: data.photo_data_url ?? undefined,
      isActive: data.is_active, createdAt: data.created_at, grantedOverrides: data.granted_overrides ?? [],
    })
  }

  async function login(employeeId: string, password: string): Promise<LoginResult> {
    if (supabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: employeeIdToEmail(employeeId), password })
      if (error) return { success: false, error: error.message }
      return { success: true }
    }
    // Offline demo mode
    const found = DEMO_USERS.find(u => u.employeeId === employeeId && u.password === password)
    if (!found || !found.isActive) return { success: false, error: 'Invalid employee ID or password' }
    const { password: _pw, ...u } = found
    setUser(u)
    return { success: true }
  }

  function logout() {
    if (supabaseConfigured && supabase) supabase.auth.signOut()
    setUser(null)
  }

  function updateProfile(update: ProfileUpdate) {
    setUser(prev => prev ? { ...prev, ...update } : prev)
    if (supabaseConfigured && supabase && user) {
      supabase.from('app_users').update({
        ...(update.name ? { name: update.name } : {}),
        ...(update.phone ? { phone: update.phone } : {}),
        ...(update.photoDataUrl ? { photo_data_url: update.photoDataUrl } : {}),
      }).eq('id', user.id)
    }
  }

  function addOverride(userId: string, scope: string) {
    setUser(prev => prev && prev.id === userId ? { ...prev, grantedOverrides: [...(prev.grantedOverrides ?? []), scope] } : prev)
  }

  return (
    <Ctx.Provider value={{ user, loading, demoMode: !supabaseConfigured, login, logout, updateProfile, addOverride }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
