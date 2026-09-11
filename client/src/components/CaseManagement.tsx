/**
 * CaseManagement.tsx
 * ------------------
 * Case-by-case investigation tracking dashboard.
 *
 * Each case card shows:
 *   - Case ID, date, crime type, severity, location
 *   - Suspect name, gang, evidence
 *   - Officer assignment (dropdown)
 *   - Status update (Open → Under Investigation → Closed)
 *   - Photo upload: suspect photo + evidence photo
 *   - Action buttons: Focus on Map, Open Case Network
 *
 * Images are stored as base64 data URLs in browser state — no backend needed.
 */

import { useState, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import type { CrimeIncident, CaseOfficer, CaseImage, ActiveTab, Evidence, Department } from '../types'
import EvidenceForm from './EvidenceForm'

// ── Officer roster ─────────────────────────────────────────────────────────────
const OFFICERS = [
  { name: 'Insp. R. Sharma',   badge: 'KSP-1042' },
  { name: 'Insp. K. Reddy',    badge: 'KSP-1055' },
  { name: 'SI P. Kumar',       badge: 'KSP-2017' },
  { name: 'SI M. Nair',        badge: 'KSP-2031' },
  { name: 'HC S. Gowda',       badge: 'KSP-3008' },
  { name: 'HC A. Patel',       badge: 'KSP-3019' },
  { name: 'Const. V. Rao',     badge: 'KSP-4042' },
  { name: 'Unassigned',        badge: '—' },
]

const STATUS_COLORS = {
  'Open':                '#EF4444',
  'Under Investigation': '#F59E0B',
  'Closed':              '#22C55E',
}

const SEVERITY_COLOR = (s: number, isDark: boolean) =>
  s >= 8 ? 'text-red-400' : s >= 5 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-green-400' : 'text-green-600')

interface Props {
  incidents: CrimeIncident[]
  officers: CaseOfficer[]
  images: CaseImage[]
  evidence: Evidence[]
  submittingDepartment: Department
  submittedBy: string
  onUpdateOfficer: (incidentId: string, officerName: string, badge: string) => void
  onUpdateStatus: (incidentId: string, status: CrimeIncident['case_status']) => void
  onAddImage: (image: CaseImage) => void
  onAddEvidence: (caseId: string, ev: Omit<Evidence, 'id' | 'caseId' | 'createdAt'>) => void
  onFocusCase: (incidentId: string, tab: ActiveTab) => void
}

export default function CaseManagement({
  incidents, officers, images, evidence, submittingDepartment, submittedBy,
  onUpdateOfficer, onUpdateStatus, onAddImage, onAddEvidence, onFocusCase,
}: Props) {
  const { isDark } = useTheme()
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [filterType, setFilterType]   = useState<string>('All')
  const [filterOfficer, setFilterOfficer] = useState<string>('All')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [addingEvidenceFor, setAddingEvidenceFor] = useState<string | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const pendingUpload = useRef<{ incidentId: string; imageType: CaseImage['imageType'] } | null>(null)

  // ── Theme-derived classes ──
  const pageBg        = isDark ? 'bg-slate-950' : 'bg-brand-bg'
  const kpiBarBg       = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
  const filterBarBg    = isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/70 border-slate-200'
  const inputBg        = isDark ? 'bg-slate-800 border-slate-700 text-slate-300 placeholder-slate-600' : 'bg-white border-slate-300 text-slate-700 placeholder-slate-400'
  const selectBg       = isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
  const mutedText      = isDark ? 'text-slate-500' : 'text-slate-400'
  const cardBg         = isDark ? 'bg-slate-900' : 'bg-white'
  const cardBorder     = isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300'
  const cardBorderExp  = isDark ? 'border-amber-700' : 'border-amber-500'
  const titleColor     = isDark ? 'text-white' : 'text-slate-900'
  const subText        = isDark ? 'text-slate-400' : 'text-slate-500'
  const placeholderBg  = isDark ? 'bg-slate-800 border-slate-700 text-slate-600' : 'bg-slate-100 border-slate-200 text-slate-400'
  const expandedBg     = isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'
  const expandedLabel  = isDark ? 'text-slate-400' : 'text-slate-500'
  const noResultsText  = isDark ? 'text-slate-500' : 'text-slate-400'

  // Derived
  const openCount = incidents.filter(i => i.case_status === 'Open').length
  const closedCount = incidents.filter(i => i.case_status === 'Closed').length
  const underCount  = incidents.filter(i => i.case_status === 'Under Investigation').length
  const types = [...new Set(incidents.map(i => i.crime_type))]
  const officerNames = ['All', ...OFFICERS.map(o => o.name)]

  // Filtering
  const filtered = incidents.filter(inc => {
    const matchSearch = search === '' || [inc.id, inc.suspect_name, inc.gang_affiliation, inc.evidence_found]
      .some(v => v.toLowerCase().includes(search.toLowerCase()))
    const matchStatus  = filterStatus === 'All' || inc.case_status === filterStatus
    const matchType    = filterType === 'All' || inc.crime_type === filterType
    const assigned = officers.find(o => o.incidentId === inc.id)?.officerName ?? 'Unassigned'
    const matchOfficer = filterOfficer === 'All' || assigned === filterOfficer
    return matchSearch && matchStatus && matchType && matchOfficer
  })

  function getOfficer(id: string) {
    return officers.find(o => o.incidentId === id) ?? null
  }

  function getCaseImages(id: string) {
    return images.filter(img => img.incidentId === id)
  }

  function triggerImageUpload(incidentId: string, imageType: CaseImage['imageType']) {
    pendingUpload.current = { incidentId, imageType }
    imgInputRef.current?.click()
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pendingUpload.current) return
    const reader = new FileReader()
    reader.onload = ev => {
      onAddImage({
        incidentId: pendingUpload.current!.incidentId,
        imageType:  pendingUpload.current!.imageType,
        dataUrl:    ev.target?.result as string,
        label: `${pendingUpload.current!.imageType} — ${file.name}`,
      })
    }
    reader.readAsDataURL(file)
    e.target.value = '' // reset so same file can be re-selected
  }

  const STATUS_CYCLE: CrimeIncident['case_status'][] = ['Open', 'Under Investigation', 'Closed']

  function nextStatus(current: CrimeIncident['case_status']): CrimeIncident['case_status'] {
    const idx = STATUS_CYCLE.indexOf(current)
    return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
  }

  return (
    <div className={`flex flex-col h-full overflow-hidden ${pageBg}`}>

      {/* ── KPI strip ── */}
      <div className={`shrink-0 px-5 py-3 border-b flex gap-6 ${kpiBarBg}`}>
        {[
          { label:'Total Cases',           value: incidents.length, color: titleColor  },
          { label:'🔴 Open',               value: openCount,        color:'text-red-400' },
          { label:'🟡 Under Investigation', value: underCount,      color: isDark ? 'text-amber-400' : 'text-amber-600' },
          { label:'🟢 Closed',              value: closedCount,     color: isDark ? 'text-green-400' : 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
            <span className={`text-xs ${mutedText}`}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className={`shrink-0 px-5 py-3 border-b flex flex-wrap gap-3 items-center ${filterBarBg}`}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by case ID, suspect, evidence..."
          className={`flex-1 min-w-[200px] border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500 ${inputBg}`}
        />
        {[
          { label:'Status',  value:filterStatus, options:['All','Open','Under Investigation','Closed'], set:setFilterStatus },
          { label:'Type',    value:filterType,   options:['All',...types],                               set:setFilterType },
          { label:'Officer', value:filterOfficer,options:officerNames,                                   set:setFilterOfficer },
        ].map(f => (
          <select key={f.label} value={f.value} onChange={e => f.set(e.target.value)}
            className={`border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500 ${selectBg}`}>
            {f.options.map(o => <option key={o} value={o}>{f.label}: {o}</option>)}
          </select>
        ))}
        <span className={`text-xs ml-auto ${mutedText}`}>{filtered.length} cases shown</span>
      </div>

      {/* Hidden image input */}
      <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

      {/* ── Case list ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {filtered.length === 0 && (
          <div className={`text-center py-20 text-sm ${noResultsText}`}>No cases match the current filters.</div>
        )}

        {filtered.map(inc => {
          const officer    = getOfficer(inc.id)
          const caseImages = getCaseImages(inc.id)
          const isExpanded = expandedId === inc.id
          const suspectPhoto = caseImages.find(img => img.imageType === 'suspect')
          const evidencePhoto = caseImages.find(img => img.imageType === 'evidence')

          return (
            <div key={inc.id}
              className={`border rounded-xl overflow-hidden transition-all ${cardBg} ${
                isExpanded ? cardBorderExp : cardBorder}`}>

              {/* Card header — always visible */}
              <div className="flex items-start gap-4 p-4">

                {/* Suspect photo or placeholder */}
                <div className="shrink-0">
                  {suspectPhoto
                    ? <img src={suspectPhoto.dataUrl} alt="Suspect"
                        className={`w-14 h-14 rounded-lg object-cover border ${isDark ? 'border-slate-600' : 'border-slate-300'}`} />
                    : <div className={`w-14 h-14 rounded-lg border flex items-center justify-center text-2xl ${placeholderBg}`}>
                        👤
                      </div>
                  }
                </div>

                {/* Case details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`font-bold text-sm font-mono ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{inc.id}</span>
                    <span className={`font-semibold text-sm ${titleColor}`}>{inc.crime_type}</span>
                    <span className={`text-xs ${mutedText}`}>{inc.date}</span>
                    <span className={`text-xs font-bold ${SEVERITY_COLOR(inc.severity_score, isDark)}`}>
                      Severity {inc.severity_score}/10
                    </span>
                    {/* Status badge — click to cycle */}
                    <button
                      onClick={() => onUpdateStatus(inc.id, nextStatus(inc.case_status))}
                      className="text-xs px-2.5 py-0.5 rounded-full font-bold border transition-colors"
                      style={{ color: STATUS_COLORS[inc.case_status], borderColor: STATUS_COLORS[inc.case_status] + '66', backgroundColor: STATUS_COLORS[inc.case_status] + '22' }}
                      title="Click to update status"
                    >
                      {inc.case_status}
                    </button>
                  </div>

                  <div className={`flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs ${subText}`}>
                    <span>🕵️ {inc.suspect_name}</span>
                    {inc.gang_affiliation !== 'Unknown' && <span>👥 {inc.gang_affiliation}</span>}
                    {inc.evidence_found !== 'None' && <span>🔍 {inc.evidence_found}</span>}
                    <span>⏰ {inc.crime_hour}:00</span>
                  </div>

                  {/* Officer assignment */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs ${mutedText}`}>Assigned to:</span>
                    <select
                      value={officer?.officerName ?? 'Unassigned'}
                      onChange={e => {
                        const o = OFFICERS.find(of => of.name === e.target.value)!
                        onUpdateOfficer(inc.id, o.name, o.badge)
                      }}
                      className={`border rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500 ${selectBg}`}>
                      {OFFICERS.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                    </select>
                    {officer && officer.officerName !== 'Unassigned' && (
                      <span className={`text-xs font-mono ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{officer.badgeNumber}</span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="shrink-0 flex flex-col gap-1.5">
                  <button onClick={() => onFocusCase(inc.id, 'map')}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap ${
                      isDark ? 'bg-blue-900/50 border-blue-800 text-blue-300 hover:bg-blue-800/60' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
                    🌐 View on Map
                  </button>
                  <button onClick={() => onFocusCase(inc.id, 'network')}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap ${
                      isDark ? 'bg-purple-900/50 border-purple-800 text-purple-300 hover:bg-purple-800/60' : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'}`}>
                    🕸️ Case Network
                  </button>
                  <button onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-700' : 'bg-slate-100 border-slate-200 text-slate-500 hover:border-amber-400'}`}>
                    {isExpanded ? '▲ Collapse' : '▼ Photos & Notes'}
                  </button>
                </div>
              </div>

              {/* Expanded section — photos */}
              {isExpanded && (
                <>
                <div className={`border-t px-4 py-4 ${expandedBg}`}>
                  <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${expandedLabel}`}>
                    Case Photos
                  </p>
                  <div className="flex gap-4 flex-wrap">

                    {/* Suspect photo */}
                    <div className="flex flex-col items-center gap-2">
                      {suspectPhoto
                        ? <img src={suspectPhoto.dataUrl} alt="Suspect"
                            className="w-28 h-28 rounded-xl object-cover border border-red-800" />
                        : <div className={`w-28 h-28 rounded-xl border flex flex-col items-center justify-center gap-1 ${placeholderBg}`}>
                            <span className="text-3xl">👤</span>
                            <span className="text-xs">No photo</span>
                          </div>
                      }
                      <button
                        onClick={() => triggerImageUpload(inc.id, 'suspect')}
                        className={`px-3 py-1 rounded-lg border text-xs transition-colors ${
                          isDark ? 'border-red-800 text-red-400 hover:bg-red-900/30' : 'border-red-300 text-red-600 hover:bg-red-50'}`}>
                        📷 Upload Suspect Photo
                      </button>
                    </div>

                    {/* Evidence photo */}
                    <div className="flex flex-col items-center gap-2">
                      {evidencePhoto
                        ? <img src={evidencePhoto.dataUrl} alt="Evidence"
                            className="w-28 h-28 rounded-xl object-cover border border-amber-800" />
                        : <div className={`w-28 h-28 rounded-xl border flex flex-col items-center justify-center gap-1 ${placeholderBg}`}>
                            <span className="text-3xl">🔍</span>
                            <span className="text-xs">No photo</span>
                          </div>
                      }
                      <button
                        onClick={() => triggerImageUpload(inc.id, 'evidence')}
                        className={`px-3 py-1 rounded-lg border text-xs transition-colors ${
                          isDark ? 'border-amber-800 text-amber-400 hover:bg-amber-900/30' : 'border-amber-300 text-amber-600 hover:bg-amber-50'}`}>
                        📷 Upload Evidence Photo
                      </button>
                    </div>

                    {/* Crime scene photo */}
                    {(() => {
                      const scenePhoto = caseImages.find(img => img.imageType === 'crime_scene')
                      return (
                        <div className="flex flex-col items-center gap-2">
                          {scenePhoto
                            ? <img src={scenePhoto.dataUrl} alt="Crime Scene"
                                className="w-28 h-28 rounded-xl object-cover border border-blue-800" />
                            : <div className={`w-28 h-28 rounded-xl border flex flex-col items-center justify-center gap-1 ${placeholderBg}`}>
                                <span className="text-3xl">📍</span>
                                <span className="text-xs">No photo</span>
                              </div>
                          }
                          <button
                            onClick={() => triggerImageUpload(inc.id, 'crime_scene')}
                            className={`px-3 py-1 rounded-lg border text-xs transition-colors ${
                              isDark ? 'border-blue-800 text-blue-400 hover:bg-blue-900/30' : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}>
                            📷 Upload Scene Photo
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Evidence — CDR, financial, physical, digital, document, photo */}
                <div className={`border-t mt-4 pt-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-semibold uppercase tracking-widest ${expandedLabel}`}>
                      Evidence ({evidence.filter(ev => ev.caseId === inc.id).length})
                    </p>
                    <button
                      onClick={() => setAddingEvidenceFor(addingEvidenceFor === inc.id ? null : inc.id)}
                      className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400">
                      {addingEvidenceFor === inc.id ? 'Cancel' : '+ Add Evidence'}
                    </button>
                  </div>

                  {evidence.filter(ev => ev.caseId === inc.id).length === 0 && addingEvidenceFor !== inc.id && (
                    <p className={`text-xs ${mutedText}`}>No evidence attached yet.</p>
                  )}

                  <div className="space-y-2 mb-3">
                    {evidence.filter(ev => ev.caseId === inc.id).map(ev => (
                      <div key={ev.id} className={`rounded-lg border p-3 text-xs ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-amber-500">{ev.type}</span>
                          <span className={mutedText}>{ev.department} · {new Date(ev.createdAt).toLocaleString()}</span>
                        </div>
                        <div className={`grid grid-cols-2 gap-x-4 gap-y-0.5 ${subText}`}>
                          {Object.entries(ev.fields).filter(([, v]) => v).map(([k, v]) => (
                            <span key={k}><span className="opacity-60">{k}:</span> {v}</span>
                          ))}
                        </div>
                        {ev.notes && <p className={`mt-1 ${subText}`}>{ev.notes}</p>}
                        {ev.fileName && <p className={`mt-1 ${mutedText}`}>📎 {ev.fileName}</p>}
                      </div>
                    ))}
                  </div>

                  {addingEvidenceFor === inc.id && (
                    <EvidenceForm
                      department={submittingDepartment}
                      submittedBy={submittedBy}
                      onSubmit={ev => { onAddEvidence(inc.id, ev); setAddingEvidenceFor(null) }}
                      onCancel={() => setAddingEvidenceFor(null)}
                    />
                  )}
                </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}