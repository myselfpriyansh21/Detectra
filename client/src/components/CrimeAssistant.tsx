import { useState, useMemo } from 'react'
import type { CrimeIncident } from '../types'

interface CrimeAssistantProps {
  incidents: CrimeIncident[]
}

/* Local fallback summary generator — used if the Claude backend is
   unavailable, so the assistant always returns something useful. */
function localSummary(caseItem: CrimeIncident, related: CrimeIncident[]): string {
  const lines: string[] = []
  lines.push(`Case ${caseItem.id} is a ${caseItem.crime_type} incident recorded on ${caseItem.date || 'an unspecified date'} at ${caseItem.crime_hour}:00, with a severity rating of ${caseItem.severity_score}/10.`)
  if (caseItem.suspect_name !== 'Unknown') {
    lines.push(`The primary suspect on record is ${caseItem.suspect_name}${caseItem.gang_affiliation !== 'Unknown' ? `, affiliated with ${caseItem.gang_affiliation}` : ''}.`)
  }
  if (caseItem.evidence_found !== 'None') {
    lines.push(`Evidence recovered: ${caseItem.evidence_found}.`)
  }
  if (related.length > 0) {
    lines.push(`${related.length} related case${related.length !== 1 ? 's' : ''} share the same suspect, gang, or evidence — investigators should cross-reference case IDs ${related.map(r => r.id).join(', ')} before closing this file.`)
  } else {
    lines.push('No related cases were found sharing this suspect, gang, or evidence in the current dataset.')
  }
  lines.push(`Recommended next step: ${caseItem.case_status === 'Open' ? 'assign an investigating officer and prioritise based on severity.' : caseItem.case_status === 'Under Investigation' ? 'continue evidence corroboration and suspect interviews.' : 'archive with cross-references to any linked open cases.'}`)
  return lines.join(' ')
}

function findSimilarCases(target: CrimeIncident, all: CrimeIncident[]): CrimeIncident[] {
  return all.filter(i => {
    if (i.id === target.id) return false
    const sameSuspect = target.suspect_name !== 'Unknown' && i.suspect_name === target.suspect_name
    const sameGang = target.gang_affiliation !== 'Unknown' && i.gang_affiliation === target.gang_affiliation
    const sameEvidence = target.evidence_found !== 'None' && i.evidence_found === target.evidence_found
    const sameTypeNearby = i.crime_type === target.crime_type &&
      Math.sqrt((i.latitude - target.latitude) ** 2 + (i.longitude - target.longitude) ** 2) < 0.01
    return sameSuspect || sameGang || sameEvidence || sameTypeNearby
  })
}

export default function CrimeAssistant({ incidents }: CrimeAssistantProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [method, setMethod] = useState<'claude' | 'local' | null>(null)

  const filteredCases = useMemo(() => {
    if (!query.trim()) return incidents
    const q = query.toLowerCase()
    return incidents.filter(i =>
      i.id.toLowerCase().includes(q) ||
      i.crime_type.toLowerCase().includes(q) ||
      i.suspect_name.toLowerCase().includes(q) ||
      i.gang_affiliation.toLowerCase().includes(q) ||
      i.evidence_found.toLowerCase().includes(q)
    )
  }, [incidents, query])

  const selectedCase = incidents.find(i => i.id === selectedId) ?? null
  const relatedCases = selectedCase ? findSimilarCases(selectedCase, incidents) : []

  async function handleGenerateSummary() {
    if (!selectedCase) return
    setLoading(true); setSummary(null)
    try {
      const res = await fetch('/api/parse_fir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Generate a concise investigation summary for this case: ${selectedCase.crime_type} on ${selectedCase.date} at ${selectedCase.crime_hour}:00, severity ${selectedCase.severity_score}/10, suspect ${selectedCase.suspect_name}, gang ${selectedCase.gang_affiliation}, evidence ${selectedCase.evidence_found}. There are ${relatedCases.length} related cases: ${relatedCases.map(r => r.id).join(', ') || 'none'}. Just return the case_summary field with a 3-4 sentence investigator-facing summary.`
        }),
      })
      const data = await res.json()
      if (data.status === 'success' && data.case_summary) {
        setSummary(data.case_summary)
        setMethod(data.method === 'claude' ? 'claude' : 'local')
        setLoading(false)
        return
      }
      throw new Error('no summary')
    } catch {
      setSummary(localSummary(selectedCase, relatedCases))
      setMethod('local')
      setLoading(false)
    }
  }

  if (incidents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm bg-slate-50">
        Load a dataset to use the AI Crime Assistant
      </div>
    )
  }

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left: case search */}
      <div className="w-96 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-slate-900 font-bold text-base">🤖 AI Crime Assistant</h2>
          <p className="text-slate-500 text-xs mt-1">Search cases, retrieve similar incidents, generate investigation summaries.</p>
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by case ID, suspect, gang, evidence..."
            className="w-full mt-3 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800
                       placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredCases.map(c => (
            <button key={c.id} onClick={() => { setSelectedId(c.id); setSummary(null) }}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors
                ${selectedId === c.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-slate-900 font-semibold text-sm">{c.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.case_status === 'Open' ? 'bg-red-50 text-red-600' :
                  c.case_status === 'Closed' ? 'bg-emerald-50 text-emerald-600' :
                  'bg-amber-50 text-amber-600'}`}>{c.case_status}</span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">{c.crime_type} · {c.suspect_name}</p>
            </button>
          ))}
          {filteredCases.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-8">No cases match your search.</p>
          )}
        </div>
      </div>

      {/* Right: selected case + AI summary */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedCase ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
            <div className="text-5xl mb-3">🕵️</div>
            <p className="font-medium text-slate-600">Select a case to view details and generate an AI investigation summary</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-900 font-bold text-lg">{selectedCase.id} — {selectedCase.crime_type}</h3>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  selectedCase.case_status === 'Open' ? 'bg-red-50 text-red-600' :
                  selectedCase.case_status === 'Closed' ? 'bg-emerald-50 text-emerald-600' :
                  'bg-amber-50 text-amber-600'}`}>{selectedCase.case_status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p className="text-slate-500">Date <span className="block text-slate-800 font-medium">{selectedCase.date || '—'}</span></p>
                <p className="text-slate-500">Hour <span className="block text-slate-800 font-medium">{selectedCase.crime_hour}:00</span></p>
                <p className="text-slate-500">Suspect <span className="block text-slate-800 font-medium">{selectedCase.suspect_name}</span></p>
                <p className="text-slate-500">Gang <span className="block text-slate-800 font-medium">{selectedCase.gang_affiliation}</span></p>
                <p className="text-slate-500">Evidence <span className="block text-slate-800 font-medium">{selectedCase.evidence_found}</span></p>
                <p className="text-slate-500">Severity <span className="block text-slate-800 font-medium">{selectedCase.severity_score}/10</span></p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-2">
                🔗 Similar Case Retrieval ({relatedCases.length})
              </p>
              {relatedCases.length === 0 ? (
                <p className="text-slate-400 text-sm">No related cases found sharing suspect, gang, evidence, or nearby location.</p>
              ) : (
                <div className="space-y-2">
                  {relatedCases.map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                      <span className="text-slate-800 font-medium">{r.id} — {r.crime_type}</span>
                      <span className="text-slate-500 text-xs">{r.suspect_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleGenerateSummary} disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300
                         text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating summary...</>
                : '✨ Generate AI Investigation Summary'}
            </button>

            {summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-blue-700 text-xs font-semibold uppercase tracking-widest">Investigation Summary</p>
                  <span className="text-xs text-slate-400">{method === 'claude' ? '✨ Claude Sonnet AI' : '⚙️ Generated locally'}</span>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed">{summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
