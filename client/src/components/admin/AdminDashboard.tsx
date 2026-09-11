import { useMemo, useState, useEffect, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useAudit } from '../../context/AuditContext'
import { useDirectory } from '../../context/DirectoryContext'
import { DEMO_ENTITIES, DEMO_RELATIONSHIPS } from '../../utils/syntheticData'
import { STATIONS, jurisdictionLabel } from '../../utils/jurisdiction'
import type { AppUser, UserRole, Rank, Department } from '../../types'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import detectraIcon from '../../assets/detectra.png'

type AdminTab = 'overview' | 'users' | 'jurisdiction' | 'requests' | 'audit'

const ROLES: UserRole[] = ['Admin', 'National Analyst', 'State Analyst', 'Officer', 'Auditor']
const RANKS: Rank[] = ['Constable', 'Head Constable', 'Sub-Inspector', 'Inspector', 'DSP', 'SP', 'IG', 'Director']
const DEPARTMENTS: Department[] = ['Local Police', 'Cyber Cell', 'Financial Intelligence Unit', 'Surveillance Unit', 'Intelligence Agency']

export default function AdminDashboard({ onExit }: { onExit: () => void }) {
  const { user, logout } = useAuth()
  const { entries, logAction, verifyIntegrity, source } = useAudit()
  const { users, addUser, toggleUserActive, requests: localRequests, resolveAccessRequest } = useDirectory()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [integrity, setIntegrity] = useState<{ checked: boolean; valid: boolean; brokenAtIndex: number | null }>({ checked: false, valid: true, brokenAtIndex: null })
  
  // Database-backed requests state
  const [dbRequests, setDbRequests] = useState<any[]>([])

  const loadDbRequests = useCallback(async () => {
    if (!supabaseConfigured || !supabase) return
    const { data, error } = await supabase
      .from('access_grants')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const mapped = data.map(r => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        requestedAt: r.created_at,
        scopeRequested: r.requested_jurisdiction,
        reason: r.reason,
        status: r.status,
        resolvedBy: r.status !== 'Pending' ? 'Admin' : undefined,
      }))
      setDbRequests(mapped)
    }
  }, [])

  useEffect(() => {
    loadDbRequests()
  }, [loadDbRequests])

  // Merge DB requests with any local memory requests, preferring DB
  const requests = supabaseConfigured && dbRequests.length > 0 ? dbRequests : localRequests

  async function handleResolveRequest(id: string, decision: 'Approved' | 'Denied') {
    resolveAccessRequest(id, decision)
    if (supabaseConfigured && supabase) {
      await supabase
        .from('access_grants')
        .update({ status: decision })
        .eq('id', id)
      loadDbRequests()
    }
    logAction('RESOLVE_ACCESS_REQUEST', `Request: ${id}`, `Admin marked request as ${decision}`)
  }

  const bg = 'bg-slate-50 text-slate-900'
  const card = 'bg-white border-slate-200'
  const sub = 'text-slate-500'
  const tabInactive = 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'

  const pendingRequestCount = requests.filter((r: any) => r.status === 'Pending').length

  const stats = useMemo(() => ({
    totalEntities: DEMO_ENTITIES.length,
    totalRelationships: DEMO_RELATIONSHIPS.length,
    activeUsers: users.filter(u => u.isActive).length,
    totalUsers: users.length,
    auditEvents: entries.length,
    pendingRequests: pendingRequestCount,
  }), [users, entries, pendingRequestCount])

  function handleRunVerify() {
    const result = verifyIntegrity()
    setIntegrity({ checked: true, valid: result.valid, brokenAtIndex: result.brokenAtIndex })
    logAction('VERIFY_AUDIT_INTEGRITY', 'audit_log', result.valid ? 'Chain verified intact' : `Tamper detected at entry #${result.brokenAtIndex}`)
  }

  return (
    <div className={`min-h-screen w-full ${bg}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-8 py-4 border-b ${card}`}>
        <div className="flex items-center gap-3">
          <img src={detectraIcon} alt="Detectra" className="w-9 h-9 object-contain" />
          <div>
            <h1 className="font-black text-xl tracking-widest text-amber-500">DETECTRA — ADMIN CONTROL CENTER</h1>
            <p className={`text-xs ${sub}`}>{user?.name} · {user?.organization} · {supabaseConfigured ? 'Live database' : 'Demo mode'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100">
            View Investigator Dashboard →
          </button>
          <button onClick={logout} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20">
            Log out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex items-center gap-1 px-8 border-b ${card}`}>
        {(['overview', 'users', 'jurisdiction', 'requests', 'audit'] as AdminTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
              tab === t ? 'border-amber-500 text-amber-500' : `border-transparent ${tabInactive}`
            }`}
          >
            {t === 'overview' && 'Overview'}
            {t === 'users' && 'User Management'}
            {t === 'jurisdiction' && 'Jurisdiction'}
            {t === 'requests' && 'Access Requests'}
            {t === 'audit' && 'Audit Trail'}
            {t === 'requests' && pendingRequestCount > 0 && (
              <span className="absolute top-1.5 -right-1 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </div>

      <div className="p-8 max-w-6xl mx-auto">
        {tab === 'overview' && (
          <Overview stats={stats} card={card} sub={sub} onGoAudit={() => setTab('audit')} onGoRequests={() => setTab('requests')} />
        )}
        {tab === 'users' && (
          <UserManagement users={users} addUser={addUser} toggleUserActive={toggleUserActive} card={card} sub={sub} logAction={logAction} />
        )}
        {tab === 'jurisdiction' && (
          <JurisdictionView users={users} card={card} sub={sub} />
        )}
        {tab === 'requests' && (
          <AccessRequestsPanel requests={requests} resolveAccessRequest={handleResolveRequest} card={card} sub={sub} />
        )}
        {tab === 'audit' && (
          <AuditTrail entries={entries} card={card} sub={sub} integrity={integrity} onVerify={handleRunVerify} />
        )}
      </div>
    </div>
  )
}

// ── Overview ──
function Overview({ stats, card, sub, onGoAudit, onGoRequests }: any) {
  const cards = [
    { label: 'Entities Tracked', value: stats.totalEntities, hint: 'People, phones, vehicles, locations, orgs, accounts' },
    { label: 'Relationships Mapped', value: stats.totalRelationships, hint: 'Cross-source links in the graph' },
    { label: 'Active Users', value: `${stats.activeUsers}/${stats.totalUsers}`, hint: 'Across all ranks and departments' },
    { label: 'Audit Events Logged', value: stats.auditEvents, hint: 'Hash-chained, tamper-evident' },
  ]
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map((c: any) => (
          <div key={c.label} className={`rounded-xl border p-4 ${card}`}>
            <p className={`text-xs font-medium ${sub}`}>{c.label}</p>
            <p className="text-3xl font-black text-amber-500 mt-1">{c.value}</p>
            <p className={`text-[11px] mt-1 ${sub}`}>{c.hint}</p>
          </div>
        ))}
      </div>

      {stats.pendingRequests > 0 && (
        <div className={`rounded-xl border border-amber-300 bg-amber-50 p-4 mb-6 flex items-center justify-between`}>
          <p className="text-sm font-semibold text-amber-700">
            {stats.pendingRequests} pending jurisdiction access request{stats.pendingRequests > 1 ? 's' : ''}
          </p>
          <button onClick={onGoRequests} className="text-xs font-semibold text-amber-700 hover:underline">Review →</button>
        </div>
      )}

      <div className={`rounded-xl border p-5 ${card}`}>
        <h3 className="font-bold text-sm mb-1">Admin is the control layer for the whole platform</h3>
        <p className={`text-xs ${sub} leading-relaxed`}>
          Case visibility is scoped by rank and station jurisdiction — an Officer sees their own station and
          neighbouring stations in the same district by default; Inspectors see their full district; DSP/SP see
          their zone; only National Analysts and Admin see the whole country. When an officer needs to see
          outside their jurisdiction for a specific investigation, they submit a request here for Admin to
          approve. Every login, upload, profile view, and access decision lands in the hash-chained audit trail.
        </p>
        <button onClick={onGoAudit} className="mt-3 text-xs font-semibold text-amber-500 hover:underline">
          Open Audit Trail →
        </button>
      </div>
    </div>
  )
}

// ── User Management ──
function UserManagement({ users, addUser, toggleUserActive, card, sub, logAction }: any) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    employeeId: '', name: '', role: 'Officer' as UserRole, organization: '', region: 'All-India',
    department: 'Local Police' as Department, rank: 'Sub-Inspector' as Rank, stationId: STATIONS[0].id,
  })

  function createUser(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employeeId || !form.name) return
    const newUser: AppUser = {
      id: `U${users.length + 1}`,
      employeeId: form.employeeId,
      name: form.name,
      role: form.role,
      organization: form.organization || 'NCRB',
      region: form.region,
      department: form.department,
      rank: form.role === 'Officer' ? form.rank : undefined,
      stationId: form.role === 'Officer' ? form.stationId : undefined,
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
    }
    addUser(newUser)
    logAction('CREATE_USER', `User: ${newUser.employeeId}`, `Created ${newUser.role} account for ${newUser.name}`)
    setForm({ employeeId: '', name: '', role: 'Officer', organization: '', region: 'All-India', department: 'Local Police', rank: 'Sub-Inspector', stationId: STATIONS[0].id })
    setShowForm(false)
  }

  function toggle(u: AppUser) {
    toggleUserActive(u.id)
    logAction(u.isActive ? 'DEACTIVATE_USER' : 'ACTIVATE_USER', `User: ${u.employeeId}`, `${u.isActive ? 'Deactivated' : 'Reactivated'} ${u.name}`)
  }

  const inputCls = 'rounded-lg border px-3 py-2 text-sm outline-none bg-slate-50 border-slate-300 text-slate-900'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm">All Users ({users.length})</h3>
        <button onClick={() => setShowForm((s: boolean) => !s)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400">
          {showForm ? 'Cancel' : '+ Create User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createUser} className={`rounded-xl border p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 ${card}`}>
          <input required placeholder="Employee ID" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={inputCls} />
          <input required placeholder="Full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} className={inputCls}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value as Department }))} className={inputCls}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input placeholder="Organization" value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} className={inputCls} />
          <input placeholder="Region / zone" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className={inputCls} />
          {form.role === 'Officer' && (
            <>
              <select value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value as Rank }))} className={inputCls}>
                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={form.stationId} onChange={e => setForm(f => ({ ...f, stationId: e.target.value }))} className={inputCls}>
                {STATIONS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.district})</option>)}
              </select>
            </>
          )}
          <button type="submit" className="col-span-2 md:col-span-4 mt-1 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400">
            Generate credentials & create account
          </button>
        </form>
      )}

      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr className={`text-left ${sub}`}>
              <th className="px-4 py-2 font-medium">Employee ID</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Role / Rank</th>
              <th className="px-4 py-2 font-medium">Department</th>
              <th className="px-4 py-2 font-medium">Jurisdiction</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((u: AppUser) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-mono text-amber-500">{u.employeeId}</td>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{u.role}{u.rank ? ` · ${u.rank}` : ''}</td>
                <td className="px-4 py-2">{u.department}</td>
                <td className="px-4 py-2">{jurisdictionLabel(u)}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-500/15 text-green-600' : 'bg-slate-500/15 text-slate-500'}`}>
                    {u.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => toggle(u)} className="text-xs font-medium text-amber-500 hover:underline">
                    {u.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Jurisdiction overview (read-only station hierarchy + assignments) ──
function JurisdictionView({ users, card, sub }: any) {
  const districts = [...new Set(STATIONS.map(s => s.district))]
  return (
    <div>
      <h3 className="font-bold text-sm mb-1">Station Hierarchy</h3>
      <p className={`text-xs mb-4 ${sub}`}>
        Station → District → Zone. An Officer's default visibility comes from their rank and assigned station
        (see the ladder below); Admin and National Analyst always see everything.
      </p>

      <div className={`rounded-xl border p-4 mb-6 ${card}`}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-slate-500">Rank → Jurisdiction Breadth</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div><span className="font-semibold">Constable / Head Constable</span><br /><span className={sub}>Own station + district</span></div>
          <div><span className="font-semibold">Sub-Inspector / Inspector</span><br /><span className={sub}>Full district</span></div>
          <div><span className="font-semibold">DSP / SP</span><br /><span className={sub}>Full zone</span></div>
          <div><span className="font-semibold">IG / Director</span><br /><span className={sub}>All-India</span></div>
        </div>
      </div>

      <div className="space-y-4">
        {districts.map(d => {
          const stations = STATIONS.filter(s => s.district === d)
          const zone = stations[0]?.zone
          const assigned = users.filter((u: AppUser) => stations.some(s => s.id === u.stationId))
          return (
            <div key={d} className={`rounded-xl border p-4 ${card}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">{d}</p>
                <span className={`text-xs ${sub}`}>{zone}</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {stations.map(s => <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{s.name}</span>)}
              </div>
              {assigned.length > 0 && (
                <p className={`text-xs ${sub}`}>Assigned: {assigned.map((u: AppUser) => `${u.name} (${u.rank})`).join(', ')}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Access Requests ──
function AccessRequestsPanel({ requests, resolveAccessRequest, card, sub }: any) {
  const pending = requests.filter((r: any) => r.status === 'Pending')
  const resolved = requests.filter((r: any) => r.status !== 'Pending')

  return (
    <div>
      <h3 className="font-bold text-sm mb-1">Jurisdiction Access Requests</h3>
      <p className={`text-xs mb-4 ${sub}`}>Officers request temporary access beyond their default jurisdiction when an investigation crosses station or district lines.</p>

      {pending.length === 0 && <p className={`text-sm ${sub} mb-6`}>No pending requests.</p>}

      <div className="space-y-3 mb-8">
        {pending.map((r: any) => (
          <div key={r.id} className={`rounded-xl border p-4 ${card}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm">{r.userName}</p>
              <span className={`text-xs ${sub}`}>{new Date(r.requestedAt).toLocaleString()}</span>
            </div>
            <p className="text-xs mb-1"><span className="text-slate-500">Requesting access to:</span> <span className="font-semibold text-amber-600">{r.scopeRequested}</span></p>
            <p className="text-xs text-slate-600 mb-3">{r.reason}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => resolveAccessRequest(r.id, 'Approved')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400">
                Approve
              </button>
              <button onClick={() => resolveAccessRequest(r.id, 'Denied')} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100">
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <>
          <h4 className="font-bold text-sm mb-2">Resolved</h4>
          <div className={`rounded-xl border overflow-hidden ${card}`}>
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr className={`text-left ${sub}`}>
                  <th className="px-4 py-2 font-medium">Officer</th>
                  <th className="px-4 py-2 font-medium">Scope</th>
                  <th className="px-4 py-2 font-medium">Decision</th>
                  <th className="px-4 py-2 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {resolved.map((r: any) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{r.userName}</td>
                    <td className="px-4 py-2">{r.scopeRequested}</td>
                    <td className="px-4 py-2">
                      <span className={`font-semibold ${r.status === 'Approved' ? 'text-green-600' : 'text-red-500'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-2">{r.resolvedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Audit Trail ──
function AuditTrail({ entries, card, sub, integrity, onVerify }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-sm">Immutable Audit Trail</h3>
          <p className={`text-xs ${sub}`}>Every entry is hash-chained to the one before it — editing or deleting a past entry breaks the chain.</p>
        </div>
        <button onClick={onVerify} className="text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400">
          Verify Integrity
        </button>
      </div>

      {integrity.checked && (
        <div className={`mb-4 rounded-lg px-4 py-2.5 text-xs font-semibold ${integrity.valid ? 'bg-green-500/10 text-green-600 border border-green-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'}`}>
          {integrity.valid
            ? 'Chain verified — all hashes match, no tampering detected.'
            : `Tamper detected — chain breaks at entry #${integrity.brokenAtIndex! + 1}. This entry (or one before it) does not match its recorded hash.`}
        </div>
      )}

      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <table className="w-full text-xs">
          <thead className="bg-slate-100">
            <tr className={`text-left ${sub}`}>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Resource</th>
              <th className="px-4 py-2 font-medium">Details</th>
              <th className="px-4 py-2 font-medium">Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {entries.map((e: any) => (
              <tr key={e.id}>
                <td className="px-4 py-2 whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                <td className="px-4 py-2">{e.userName}</td>
                <td className="px-4 py-2 font-mono text-amber-500">{e.action}</td>
                <td className="px-4 py-2">{e.resource}</td>
                <td className="px-4 py-2">{e.details}</td>
                <td className="px-4 py-2 font-mono opacity-60">{e.hash.slice(0, 10)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}