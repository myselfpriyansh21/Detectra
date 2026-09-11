import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { appendToChain, verifyChain, type ChainableEntry, type IntegrityResult } from '../utils/auditChain'
import { DEMO_AUDIT_LOG } from '../utils/syntheticData'
import { useAuth } from './AuthContext'

interface AuditCtx {
  entries: ChainableEntry[]
  logAction: (action: string, resource: string, details: string) => void
  verifyIntegrity: () => IntegrityResult
  refresh: () => Promise<void>
  source: 'demo' | 'supabase'
}

const Ctx = createContext<AuditCtx>({
  entries: [],
  logAction: () => {},
  verifyIntegrity: () => ({ valid: true, brokenAtIndex: null }),
  refresh: async () => {},
  source: 'demo',
})

export function AuditProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [entries, setEntries] = useState<ChainableEntry[]>(DEMO_AUDIT_LOG)

  async function refresh() {
    if (!supabaseConfigured || !supabase) return
    const { data, error } = await supabase.from('audit_log').select('*').order('id', { ascending: true })
    if (error || !data) return
    setEntries(data.map((r: any) => ({
      id: String(r.id), userId: r.user_id, userName: r.user_name, action: r.action,
      resource: r.resource, timestamp: r.created_at, details: r.details ?? '',
      prevHash: r.prev_hash, hash: r.hash,
    })))
  }

  useEffect(() => { refresh() }, [])

  function logAction(action: string, resource: string, details: string) {
    if (!user) return
    // Always keep a responsive local chain so the UI updates instantly.
    setEntries(prev => appendToChain(prev, { userId: user.id, userName: user.name, action, resource, details }))
    if (supabaseConfigured && supabase) {
      supabase.from('audit_log').insert({
        user_id: user.id, user_name: user.name, action, resource, details,
        prev_hash: 'placeholder', hash: 'placeholder', // overwritten by the DB trigger
      }).then(() => refresh())
    }
  }

  function verifyIntegrity(): IntegrityResult {
    // Demo-mode chain uses the same toy hash function for its own entries;
    // when Supabase is active the fetched rows already carry real sha256
    // hashes from the DB trigger, so full recompute isn't meaningful
    // client-side — instead we check structural linkage (each row's
    // prevHash must equal the previous row's hash), which still catches
    // deleted/reordered/inserted rows.
    if (!supabaseConfigured) return verifyChain(entries)
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].prevHash !== entries[i - 1].hash) return { valid: false, brokenAtIndex: i }
    }
    return { valid: true, brokenAtIndex: null }
  }

  return (
    <Ctx.Provider value={{ entries, logAction, verifyIntegrity, refresh, source: supabaseConfigured ? 'supabase' : 'demo' }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAudit = () => useContext(Ctx)
