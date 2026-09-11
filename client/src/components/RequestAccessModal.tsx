import { useState } from 'react'
import { useDirectory } from '../context/DirectoryContext'
import { useAuth } from '../context/AuthContext'
import { STATIONS } from '../utils/jurisdiction'
import { supabase, supabaseConfigured } from '../lib/supabase'

export default function RequestAccessModal({ onClose }: { onClose: () => void }) {
  const { submitAccessRequest } = useDirectory()
  const { user } = useAuth()
  const [scope, setScope] = useState(STATIONS[0].district)
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const districts = [...new Set(STATIONS.map(s => s.district))]
  const zones = [...new Set(STATIONS.map(s => s.zone))]

  async function submit() {
    if (!reason.trim() || loading) return
    setLoading(true)

    const reqId = `REQ-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

    // 1. Update in-memory directory context (local state)
    submitAccessRequest(reason.trim(), scope)

    // 2. Persist to Supabase database so Admin can see it across sessions
    if (supabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('access_grants').insert({
          id: reqId,
          user_id: user?.id || 'U3',
          user_name: user?.name || 'Officer',
          role: user?.role || 'Officer',
          current_jurisdiction: user?.region || 'North Zone',
          requested_jurisdiction: scope,
          reason: reason.trim(),
          status: 'Pending',
        })
        if (error) console.error('Failed to write access request to Supabase:', error.message)
      } catch (err) {
        console.error('Supabase access request error:', err)
      }
    }

    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-6" onClick={e => e.stopPropagation()}>
        {submitted ? (
          <>
            <h3 className="font-bold text-sm mb-2">Request submitted</h3>
            <p className="text-xs text-slate-500 mb-4">An Admin will review your request for access to <span className="font-semibold text-amber-600">{scope}</span>.</p>
            <button onClick={onClose} className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm">Close</button>
          </>
        ) : (
          <>
            <h3 className="font-bold text-sm mb-1">Request Jurisdiction Access</h3>
            <p className="text-xs text-slate-500 mb-4">Ask Admin to temporarily extend your case visibility beyond your default jurisdiction — for example, when an investigation crosses district lines.</p>

            <label className="block text-xs font-medium text-slate-500 mb-1">Requested scope</label>
            <select value={scope} onChange={e => setScope(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none mb-3">
              <optgroup label="District">
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </optgroup>
              <optgroup label="Zone">
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </optgroup>
              <option value="All-India">All-India</option>
            </select>

            <label className="block text-xs font-medium text-slate-500 mb-1">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="e.g. Suspect in case FIR0142 is linked to activity in this district"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none mb-4" />

            <div className="flex items-center gap-2">
              <button onClick={submit} disabled={loading} className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm disabled:opacity-50">
                {loading ? 'Submitting…' : 'Submit Request'}
              </button>
              <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium text-sm">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}