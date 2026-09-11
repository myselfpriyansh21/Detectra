import { useState, useCallback, useEffect, useRef } from 'react'
import type { CrimeIncident, Hotspot, ActiveTab, CaseOfficer, CaseImage, Evidence, Department } from './types'
import { loadSampleData, loadFraudData, FRAUD_SEED_EVIDENCE, parseCSVText } from './utils/mockData'
import { generateSuggestions } from './utils/suggestions'
import { useAuth } from './context/AuthContext'
import { useAudit } from './context/AuditContext'
import { useDirectory } from './context/DirectoryContext'
import { filterIncidentsForUser } from './utils/jurisdiction'
import IntroAnimation from './components/IntroAnimation'
import Navigation from './components/Navigation'
import LandingPage from './components/LandingPage'
import Login from './components/Login'
import Welcome from './components/Welcome'
import CrimeMap from './components/CrimeMap'
import NetworkGraph from './components/NetworkGraph'
import EntityResolution from './components/EntityResolution'
import { resolveName, pickCanonicalName, pairKey } from './utils/entityResolution'
import type { IdentityGroup } from './utils/entityResolution'
import CaseManagement from './components/CaseManagement'
import Analytics from './components/Analytics'
import AISuggestions from './components/AISuggestions'
import CrimeAssistant from './components/CrimeAssistant'
import AdminDashboard from './components/admin/AdminDashboard'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { logAction } = useAudit()
  const { currentUserRecord } = useDirectory()
  const [showIntro, setShowIntro]     = useState(true)
  const [showWelcome, setShowWelcome] = useState(true)
  const [showAdmin, setShowAdmin]     = useState(false)
  // Demo data is treated as permanent baseline data for the platform,
  // not a one-off "load demo" action — the system starts populated,
  // the way a production deployment would with existing case records.
  const [incidents, setIncidents]     = useState<CrimeIncident[]>(() => [...loadSampleData(), ...loadFraudData()])
  const [evidence, setEvidence]       = useState<Evidence[]>(() => FRAUD_SEED_EVIDENCE.map((e, i) => ({ ...e, id: `EV${i + 1}` })))
  const [hotspots, setHotspots]       = useState<Hotspot[]>([])
  const [activeTab, setActiveTab]     = useState<ActiveTab>('network')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [officers, setOfficers]       = useState<CaseOfficer[]>([])
  const [caseImages, setCaseImages]   = useState<CaseImage[]>([])
  const [focusCaseId, setFocusCaseId] = useState<string | null>(null)
  const [nameAliases, setNameAliases]   = useState<Record<string, string>>({})
  const [rejectedPairs, setRejectedPairs] = useState<Set<string>>(new Set())
  const [submittingDepartment, setSubmittingDepartment] = useState<Department>(user?.department ?? 'Local Police')
  const suggestions = generateSuggestions(incidents)

  // Entity-resolution merges are applied here: once a pair is confirmed,
  // every incident carrying either spelling is remapped to one canonical
  // suspect_name, so the network graph (which keys nodes by suspect_name)
  // naturally collapses both identities into a single connected node —
  // this is what links previously-separate cases together on confirm.
  const resolvedIncidents = incidents.map(i => ({
    ...i,
    suspect_name: resolveName(i.suspect_name, nameAliases),
  }))

  // Jurisdiction/rank based visibility — an Officer only ever sees cases
  // in their station + district (or wider, per rank); State Analysts see
  // their zone; Admin/National Analyst see everything; Auditors see none
  // of the case data (audit log only). This is enforced here so every
  // tab (graph, map, case list, analytics, assistant) is consistently
  // scoped, not just the old per-source toggle grid.
  const visibleIncidents = currentUserRecord
    ? filterIncidentsForUser(currentUserRecord, resolvedIncidents)
    : []
  const visibleEvidence = evidence.filter(ev => visibleIncidents.some(i => i.id === ev.caseId))

  // Admin lands straight in the control center after entering the
  // platform — that's the flagship view for this role.
  useEffect(() => {
    if (user?.role === 'Admin' && !showWelcome) setShowAdmin(true)
  }, [user?.id, showWelcome])

  /* ── Browser back button support ── */
  const isPopping = useRef(false)

  useEffect(() => {
    if (showWelcome || showIntro) return
    const onPopState = (e: PopStateEvent) => {
      const tab = e.state?.tab as ActiveTab | undefined
      if (tab) { isPopping.current = true; setActiveTab(tab) }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [showWelcome, showIntro])

  function changeTab(t: ActiveTab) {
    if (t !== 'network') setFocusCaseId(null)
    setActiveTab(t)
    if (!isPopping.current) window.history.pushState({ tab: t }, '', `#${t}`)
    isPopping.current = false
  }

  function handleBrowserBackClick() { window.history.back() }

  function handleFileUpload(text: string) {
    try {
      const parsed = parseCSVText(text)
      if (parsed.length === 0) { setError('File empty or wrong format.'); return }
      setIncidents(p => [...p, ...parsed])
      logAction('UPLOAD_DATA', 'Dataset', `Uploaded CSV — ${parsed.length} records processed`)
      changeTab('cases')
    } catch { setError('Failed to parse CSV.') }
  }
  function handleAddIncident(inc: CrimeIncident) {
    setIncidents(p => [...p, inc])
    logAction('ADD_CASE', `Case: ${inc.id}`, `Added case via single-report entry (${submittingDepartment})`)
  }
  function handleAddIncidents(incs: CrimeIncident[]) {
    setIncidents(p => [...p, ...incs])
    logAction('BULK_ADD_CASES', 'Dataset', `Added ${incs.length} cases via batch upload (${submittingDepartment})`)
  }
  function handleAddEvidence(caseId: string, ev: Omit<Evidence, 'id' | 'caseId' | 'createdAt'>) {
    const entry: Evidence = { ...ev, id: `EV${evidence.length + 1}`, caseId, createdAt: new Date().toISOString() }
    setEvidence(p => [...p, entry])
    logAction('ADD_EVIDENCE', `Case: ${caseId}`, `Attached ${ev.type} evidence (${ev.department})`)
  }
  function handleUpdateOfficer(id: string, name: string, badge: string) {
    setOfficers(p => { const f = p.filter(o => o.incidentId !== id); return name === 'Unassigned' ? f : [...f, { incidentId:id, officerName:name, badgeNumber:badge, assignedDate:new Date().toISOString().split('T')[0] }] })
  }
  function handleUpdateStatus(id: string, status: CrimeIncident['case_status']) {
    setIncidents(p => p.map(i => i.id === id ? { ...i, case_status: status } : i))
    logAction('UPDATE_CASE_STATUS', `Case: ${id}`, `Status changed to ${status}`)
  }
  function handleAddImage(img: CaseImage) {
    setCaseImages(p => [...p.filter(i => !(i.incidentId === img.incidentId && i.imageType === img.imageType)), img])
  }
  function handleFocusCase(id: string, tab: ActiveTab) { setFocusCaseId(id); changeTab(tab) }

  function handleConfirmMerge(groupA: IdentityGroup, groupB: IdentityGroup) {
    const { canonical, alias } = pickCanonicalName(groupA, groupB)
    setNameAliases(prev => ({ ...prev, [alias]: canonical }))
    logAction('MERGE_ENTITIES', `Entity: ${canonical}`, `Confirmed "${alias}" and "${canonical}" as the same person — ${groupA.incidentIds.length + groupB.incidentIds.length} cases linked`)
  }

  function handleRejectMatch(nameA: string, nameB: string) {
    setRejectedPairs(prev => new Set(prev).add(pairKey(nameA, nameB)))
    logAction('REJECT_ENTITY_MATCH', `Entities: ${nameA} / ${nameB}`, 'Marked as not the same person')
  }

  const handleRunAnalysis = useCallback(async (filtered: CrimeIncident[], eps: number, minSamples: number) => {
    if (filtered.length < 2) { setHotspots([]); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/cluster', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ incidents: filtered.map(i => ({ latitude:i.latitude, longitude:i.longitude, severity_score:i.severity_score })), eps, min_samples:minSamples }) })
      const data = await res.json()
      if (data.status === 'success') { setHotspots(data.hotspots); setLoading(false); return }
    } catch {}
    try {
      const { runDBSCAN } = await import('./utils/dbscan')
      setHotspots(runDBSCAN(filtered.map(i => ({ latitude:i.latitude, longitude:i.longitude, severity_score:i.severity_score })), eps, minSamples))
    } catch { setError('Clustering failed.') }
    finally { setLoading(false) }
  }, [])

  if (authLoading) return null
  if (!user) return <Login />
  if (showIntro) return <IntroAnimation onComplete={() => setShowIntro(false)} />
  if (showWelcome) return <Welcome onEnter={() => setShowWelcome(false)} />
  if (showAdmin) return <AdminDashboard onExit={() => setShowAdmin(false)} />

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      <Navigation activeTab={activeTab} onTabChange={changeTab}
        incidentCount={visibleIncidents.length} onGoHome={() => changeTab('network')}
        onBack={handleBrowserBackClick} canGoBack={true}
        onOpenAdmin={() => setShowAdmin(true)} />
      {error && (
        <div className="shrink-0 bg-red-50 border-b border-red-200 px-6 py-2 text-red-600 text-xs flex items-center gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-700">Dismiss</button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'network'    && <NetworkGraph incidents={visibleIncidents} images={caseImages} focusCaseId={focusCaseId} />}
        {activeTab === 'resolution' && <EntityResolution incidents={visibleIncidents} aliases={nameAliases} rejectedPairs={rejectedPairs} onConfirm={handleConfirmMerge} onReject={handleRejectMatch} />}
        {activeTab === 'map'        && <CrimeMap incidents={visibleIncidents} hotspots={hotspots} loading={loading} onRunAnalysis={handleRunAnalysis} />}
        {activeTab === 'cases'      && <CaseManagement incidents={visibleIncidents} officers={officers} images={caseImages} evidence={visibleEvidence} submittingDepartment={submittingDepartment} submittedBy={user.name} onUpdateOfficer={handleUpdateOfficer} onUpdateStatus={handleUpdateStatus} onAddImage={handleAddImage} onAddEvidence={handleAddEvidence} onFocusCase={handleFocusCase} />}
        {activeTab === 'addcase'    && <LandingPage onAddIncident={handleAddIncident} onAddIncidents={handleAddIncidents} onFileUpload={handleFileUpload} existingCount={incidents.length} submittingDepartment={submittingDepartment} onDepartmentChange={setSubmittingDepartment} onAddEvidence={handleAddEvidence} />}
        {activeTab === 'analytics'  && <Analytics incidents={visibleIncidents} />}
        {activeTab === 'ai'         && <AISuggestions suggestions={suggestions} totalIncidents={visibleIncidents.length} />}
        {activeTab === 'assistant'  && <CrimeAssistant incidents={visibleIncidents} />}
      </div>
      <footer className="shrink-0 border-t px-6 py-1.5 flex items-center justify-between text-xs bg-white border-slate-200 text-slate-400">
        <span>DETECTRA v1.0 · Ministry of Home Affairs · NCRB · Confidential</span>
        <span>{visibleIncidents.length} cases in your jurisdiction · {incidents.length} total in system</span>
      </footer>
    </div>
  )
}
