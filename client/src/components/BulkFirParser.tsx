/**
 * BulkFIRParser.tsx
 * -----------------
 * Handles the real-world scenario: a police station uploads a .txt file
 * containing multiple case reports / FIR paragraphs in sequence.
 *
 * Supported input formats:
 *   • .txt file upload with multiple FIRs
 *   • Paste multiple FIRs into text area
 *
 * Auto-detection splits the text by:
 *   1. "FIR No." / "Case No." / "FIR #" headers
 *   2. "---" or "===" divider lines
 *   3. Triple blank lines
 *   4. Numbered entries ("1.", "2.")
 *
 * Each block is parsed individually (Claude backend or regex fallback).
 * Officer sees a results table, selects which to add, clicks "Add to Platform".
 */

import { useState, useRef } from 'react'
import type { CrimeIncident } from '../types'
import { useTheme } from '../context/ThemeContext'

// ── National locality lookup (representative points across major metros) ──
const LOCALITIES: Record<string, [number, number]> = {
  // Delhi NCR
  'connaught place': [28.6315, 77.2167], 'karol bagh': [28.6519, 77.1909],
  'dwarka': [28.5921, 77.0460], 'rohini': [28.7495, 77.0565],
  // Mumbai
  'andheri': [19.1136, 72.8697], 'bandra': [19.0596, 72.8295],
  'dadar': [19.0176, 72.8562], 'borivali': [19.2307, 72.8567],
  // Bengaluru
  'koramangala': [12.9352, 77.6245], 'whitefield': [12.9698, 77.7499],
  'indiranagar': [12.9784, 77.6408], 'electronic city': [12.8457, 77.6602],
  // Hyderabad
  'banjara hills': [17.4156, 78.4347], 'secunderabad': [17.4399, 78.4983],
  'gachibowli': [17.4401, 78.3489], 'kukatpally': [17.4849, 78.4138],
  // Kolkata
  'salt lake': [22.5726, 88.4171], 'park street': [22.5535, 88.3510],
  'howrah': [22.5958, 88.2636], 'behala': [22.4989, 88.3145],
  // Chennai
  'anna nagar': [13.0850, 80.2101], 't nagar': [13.0418, 80.2341],
  'adyar': [13.0012, 80.2565], 'velachery': [12.9791, 80.2213],
}

function resolveLocation(locations: string[]): [number, number] {
  for (const loc of locations) {
    for (const [area, coords] of Object.entries(LOCALITIES)) {
      if (loc.toLowerCase().includes(area)) return coords
    }
  }
  return [12.9716 + (Math.random() - 0.5) * 0.05, 77.5946 + (Math.random() - 0.5) * 0.05]
}

// ── Split a large text into individual FIR blocks ─────────────────────────────
function splitIntoFIRs(text: string): string[] {
  const strategies: (() => string[])[] = [
    // FIR No. / Case No. header
    () => text.split(/(?=FIR No\.?\s*[\d/]+)/i).filter(s => s.trim().length > 80),
    () => text.split(/(?=Case No\.?\s*[\d/]+)/i).filter(s => s.trim().length > 80),
    // Divider lines --- or ===
    () => text.split(/\n\s*[-=]{3,}\s*\n/).filter(s => s.trim().length > 80),
    // Numbered sections 1. 2. 3.
    () => text.split(/\n\d+\.\s+(?=[A-Z])/).filter(s => s.trim().length > 80),
    // Triple blank lines
    () => text.split(/\n\s*\n\s*\n\s*\n/).filter(s => s.trim().length > 80),
    // Double blank lines (last resort)
    () => text.split(/\n\s*\n\s*\n/).filter(s => s.trim().length > 80),
  ]

  for (const strategy of strategies) {
    const parts = strategy()
    if (parts.length > 1) return parts.map(p => p.trim())
  }
  return text.trim().length > 80 ? [text.trim()] : []
}

// ── Regex-based entity extraction ─────────────────────────────────────────────
function extractLocally(text: string) {
  const t = text.toLowerCase()
  const vehicles = [...new Set((text.match(/\b([A-Z]{2}[-]?\d{2}[-]?[A-Z]{1,3}[-]?\d{4})\b/gi) ?? []).map(v => v.toUpperCase()))]
  const phones   = [...new Set((text.match(/\b[6-9]\d{9}\b/g) ?? []))]
  const wkw = ['pistol','revolver','knife','dagger','crowbar','sword','crude bomb','country-made gun']
  const weapons  = wkw.filter(w => t.includes(w))
  const cmap: Record<string, string> = {
    'snatch':'Chain Snatching','chain':'Chain Snatching','burgl':'Burglary',
    'theft':'Vehicle Theft','vehicle':'Vehicle Theft','assault':'Assault',
    'attack':'Assault','robbery':'Chain Snatching','dacoity':'Burglary',
    'phishing':'Financial Fraud','upi':'Financial Fraud','otp':'Financial Fraud',
    'investment scam':'Financial Fraud','bank fraud':'Financial Fraud','fraud':'Financial Fraud',
    'fake profile':'Social Media Fraud','catfish':'Social Media Fraud',
    'sextortion':'Social Media Fraud','impersonat':'Social Media Fraud',
  }
  let crime_type = 'Unknown'
  for (const [kw, ct] of Object.entries(cmap)) { if (t.includes(kw)) { crime_type = ct; break } }
  const hm = text.match(/(\d{1,2})[:\s]?\d{0,2}\s*(hrs?|am|pm)/i)
  let crime_hour = 22
  if (hm) { let h = parseInt(hm[1]); if (hm[2]?.toLowerCase().includes('pm') && h < 12) h += 12; crime_hour = h % 24 }
  const locations = Object.keys(LOCALITIES).filter(loc => t.includes(loc))
  // Try to extract suspect name (word after "accused" or "suspect")
  const suspectMatch = text.match(/(?:accused|suspect|offender)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
  const suspects = suspectMatch ? [suspectMatch[1]] : []
  // Gang name
  const gangMatch = text.match(/([A-Z][a-zA-Z]+\s+(?:Gang|Syndicate|Crew|Group))/i)
  const gangs = gangMatch ? [gangMatch[1]] : []
  let severity = 5
  if (t.includes('murder') || t.includes('bomb') || t.includes('dacoity')) severity = 9
  else if (t.includes('pistol') || t.includes('revolver') || t.includes('armed')) severity = 8
  else if (t.includes('assault') || t.includes('grievous')) severity = 7
  else if (t.includes('snatch') || t.includes('burglary') || t.includes('theft')) severity = 6
  return { suspects, vehicles, weapons, phone_numbers:phones, locations, gang_affiliations:gangs,
    evidence:weapons, crime_type, crime_hour, severity_score:severity,
    case_summary:`${crime_type}.${locations.length?` Location: ${locations[0]}.`:''}${suspects.length?` Suspect: ${suspects[0]}.`:''}` }
}

// ── Parsed result per FIR ─────────────────────────────────────────────────────
interface ParsedFIR {
  index: number
  rawText: string
  crime_type: string
  suspect_name: string
  gang_affiliation: string
  evidence_found: string
  locations: string[]
  crime_hour: number
  severity_score: number
  case_summary: string
  method: 'claude' | 'regex'
}

interface Props {
  onAddIncidents: (incidents: CrimeIncident[]) => void
  existingCount: number
}

const STATUS_COLORS: Record<string, string> = {
  'Chain Snatching':    'text-yellow-500',
  'Burglary':           'text-red-400',
  'Assault':            'text-purple-400',
  'Vehicle Theft':      'text-blue-400',
  'Financial Fraud':    'text-emerald-500',
  'Social Media Fraud': 'text-pink-500',
  'Unknown':            'text-slate-400',
}

export default function BulkFIRParser({ onAddIncidents, existingCount }: Props) {
  const { isDark } = useTheme()
  const [rawText, setRawText]       = useState('')
  const [blocks, setBlocks]         = useState<string[]>([])
  const [results, setResults]       = useState<ParsedFIR[]>([])
  const [parsing, setParsing]       = useState(false)
  const [progress, setProgress]     = useState(0)
  const [selected, setSelected]     = useState<Set<number>>(new Set())
  const [added, setAdded]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const card  = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
  const input = isDark ? 'bg-slate-800 border-slate-700 text-slate-300 placeholder-slate-600' : 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400'
  const text  = isDark ? 'text-white' : 'text-slate-900'
  const sub   = isDark ? 'text-slate-400' : 'text-slate-500'

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const content = e.target?.result as string
      setRawText(content)
      const detected = splitIntoFIRs(content)
      setBlocks(detected)
      setResults([])
      setSelected(new Set())
      setAdded(false)
    }
    reader.readAsText(file)
  }

  function handleTextChange(text: string) {
    setRawText(text)
    const detected = splitIntoFIRs(text)
    setBlocks(detected)
    setResults([])
    setSelected(new Set())
    setAdded(false)
  }

  async function parseAllFIRs() {
    if (blocks.length === 0) return
    setParsing(true)
    setProgress(0)
    setResults([])
    setAdded(false)

    const parsedResults: ParsedFIR[] = []

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      let result: ParsedFIR | null = null

      // Try Claude backend
      try {
        const res = await fetch('/api/parse_fir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: block }),
        })
        const data = await res.json()
        if (data.status === 'success') {
          result = {
            index: i,
            rawText: block,
            crime_type: data.crime_type || 'Unknown',
            suspect_name: data.suspects?.[0] || 'Unknown',
            gang_affiliation: data.gang_affiliations?.[0] || 'Unknown',
            evidence_found: data.evidence?.[0] || data.weapons?.[0] || 'None',
            locations: data.locations || [],
            crime_hour: data.crime_hour ?? 22,
            severity_score: data.severity_score ?? 5,
            case_summary: data.case_summary || '',
            method: data.method === 'claude' ? 'claude' : 'regex',
          }
        }
      } catch { /* fallback */ }

      // Regex fallback
      if (!result) {
        const local = extractLocally(block)
        result = {
          index: i,
          rawText: block,
          crime_type: local.crime_type,
          suspect_name: local.suspects[0] || 'Unknown',
          gang_affiliation: local.gang_affiliations[0] || 'Unknown',
          evidence_found: local.evidence[0] || local.weapons[0] || 'None',
          locations: local.locations,
          crime_hour: local.crime_hour,
          severity_score: local.severity_score,
          case_summary: local.case_summary,
          method: 'regex',
        }
      }

      parsedResults.push(result)
      setProgress(i + 1)
      setResults([...parsedResults])
      // Small delay so UI updates are visible
      await new Promise(r => setTimeout(r, 80))
    }

    // Auto-select all
    setSelected(new Set(parsedResults.map(r => r.index)))
    setParsing(false)
  }

  function toggleSelect(idx: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(results.map(r => r.index)))
  }

  function addSelected() {
    const toAdd = results.filter(r => selected.has(r.index))
    const incidents: CrimeIncident[] = toAdd.map((r, i) => {
      const [lat, lon] = resolveLocation(r.locations)
      return {
        id: `BULK${String(existingCount + i + 1).padStart(3, '0')}`,
        date: new Date().toISOString().split('T')[0],
        latitude: lat,
        longitude: lon,
        crime_type: r.crime_type,
        severity_score: Math.max(1, Math.min(10, r.severity_score)),
        crime_hour: r.crime_hour,
        suspect_name: r.suspect_name,
        gang_affiliation: r.gang_affiliation,
        evidence_found: r.evidence_found,
        case_status: 'Open',
      }
    })
    onAddIncidents(incidents)
    setAdded(true)
  }

  const progressPct = blocks.length > 0 ? Math.round((progress / blocks.length) * 100) : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Top input area */}
      <div className={`shrink-0 p-5 border-b ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex gap-4 items-start">

          {/* Text area */}
          <div className="flex-1">
            <p className={`text-sm font-semibold mb-1 ${text}`}>
              Paste Multiple FIR Reports
            </p>
            <p className={`text-xs mb-2 ${sub}`}>
              Separate FIRs with <code className="bg-slate-700 px-1 rounded text-amber-400">---</code> dividers,
              or start each with <code className="bg-slate-700 px-1 rounded text-amber-400">FIR No.</code> headers.
              The system auto-detects the structure.
            </p>
            <textarea
              value={rawText}
              onChange={e => handleTextChange(e.target.value)}
              rows={5}
              placeholder={`FIR No. 0142/2024 | Delhi — Karol Bagh Division\nAt 23:40 hrs, suspect snatched chain near Connaught Place...\n\n---\n\nFIR No. 0143/2024 | Bengaluru South Division\nAt 02:15 hrs, burglary reported at Koramangala...`}
              className={`w-full rounded-xl border p-3 text-xs font-mono resize-none focus:outline-none focus:border-amber-500 transition-colors ${input}`}
            />
          </div>

          {/* OR upload file */}
          <div className="shrink-0 flex flex-col gap-2 mt-6">
            <button
              onClick={() => fileRef.current?.click()}
              className={`px-4 py-3 rounded-xl border-2 border-dashed text-xs font-medium transition-colors
                ${isDark ? 'border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400' : 'border-slate-300 hover:border-amber-500 text-slate-500 hover:text-amber-600'}`}>
              📄 Upload .txt File
            </button>
            <input ref={fileRef} type="file" accept=".txt,.text" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            {blocks.length > 0 && (
              <div className={`text-center px-3 py-2 rounded-lg text-xs font-medium
                ${isDark ? 'bg-amber-900/30 border border-amber-800 text-amber-400' : 'bg-amber-50 border border-amber-300 text-amber-700'}`}>
                {blocks.length} FIR{blocks.length !== 1 ? 's' : ''} detected
              </div>
            )}
            <button
              onClick={parseAllFIRs}
              disabled={parsing || blocks.length === 0}
              className="px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-500
                         disabled:bg-slate-700 disabled:text-slate-500
                         text-white font-bold text-xs transition-colors
                         flex items-center justify-center gap-2">
              {parsing
                ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Parsing...</>
                : `🔍 Parse ${blocks.length > 0 ? `All ${blocks.length} FIRs` : 'FIRs'}`}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {parsing && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className={sub}>Parsing FIR {progress} of {blocks.length}...</span>
              <span className="text-amber-400 font-bold">{progressPct}%</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
              <div className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Results table */}
      <div className="flex-1 overflow-y-auto p-5">
        {results.length === 0 && !parsing && (
          <div className={`flex flex-col items-center justify-center h-full text-center ${sub}`}>
            <div className="text-6xl mb-4 opacity-40">📋</div>
            <p className={`font-semibold text-base mb-2 ${text}`}>Paste multiple FIRs above</p>
            <p className="text-sm max-w-md">
              Upload a .txt file from the police station, or paste the full case report document.
              Each FIR will be parsed individually and shown here.
            </p>
            <div className={`mt-4 rounded-xl p-4 text-xs text-left max-w-sm ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100 border border-slate-200'}`}>
              <p className={`font-bold mb-2 ${text}`}>Accepted Formats:</p>
              <p className={sub}>• Multiple FIRs separated by <code>---</code></p>
              <p className={sub}>• FIRs starting with <code>FIR No. XXXX</code></p>
              <p className={sub}>• Numbered case reports <code>1. ... 2. ...</code></p>
              <p className={sub}>• Triple blank lines between FIRs</p>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div>
            {/* Table header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={`font-bold text-sm ${text}`}>
                  {results.length} FIR{results.length !== 1 ? 's' : ''} Parsed
                  {parsing && <span className={`ml-2 text-xs ${sub}`}>(processing...)</span>}
                </span>
                {!parsing && (
                  <button onClick={selectAll}
                    className={`text-xs px-2 py-1 rounded border transition-colors
                      ${isDark ? 'border-slate-600 text-slate-400 hover:text-white hover:border-slate-400' : 'border-slate-300 text-slate-500 hover:text-slate-700'}`}>
                    Select All
                  </button>
                )}
              </div>
              {!parsing && selected.size > 0 && (
                <button onClick={addSelected} disabled={added}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
                    added ? 'bg-green-700 text-green-200' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}>
                  {added ? `✅ ${selected.size} Cases Added` : `➕ Add ${selected.size} Selected Case${selected.size !== 1 ? 's' : ''} to Platform`}
                </button>
              )}
            </div>

            {/* Table */}
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <table className="w-full text-xs">
                <thead>
                  <tr className={isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}>
                    <th className="px-3 py-2 text-left w-8">☑</th>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Crime Type</th>
                    <th className="px-3 py-2 text-left">Suspect</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-left">Hour</th>
                    <th className="px-3 py-2 text-left">Severity</th>
                    <th className="px-3 py-2 text-left">Evidence</th>
                    <th className="px-3 py-2 text-left">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.index}
                      onClick={() => toggleSelect(r.index)}
                      className={`border-t cursor-pointer transition-colors
                        ${isDark ? 'border-slate-800' : 'border-slate-100'}
                        ${selected.has(r.index)
                          ? isDark ? 'bg-amber-900/20' : 'bg-amber-50'
                          : isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(r.index)} readOnly
                          className="accent-amber-500 w-3.5 h-3.5" />
                      </td>
                      <td className={`px-3 py-2 font-mono ${sub}`}>{i + 1}</td>
                      <td className={`px-3 py-2 font-semibold ${STATUS_COLORS[r.crime_type] ?? 'text-slate-400'}`}>
                        {r.crime_type}
                      </td>
                      <td className={`px-3 py-2 ${text}`}>{r.suspect_name}</td>
                      <td className={`px-3 py-2 ${sub}`}>
                        {r.locations[0] || '—'}
                      </td>
                      <td className={`px-3 py-2 ${sub}`}>{r.crime_hour}:00</td>
                      <td className="px-3 py-2">
                        <span className={`font-bold ${r.severity_score >= 8 ? 'text-red-400' : r.severity_score >= 6 ? 'text-amber-400' : 'text-green-400'}`}>
                          {r.severity_score}/10
                        </span>
                      </td>
                      <td className={`px-3 py-2 ${sub}`}>{r.evidence_found}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${r.method === 'claude' ? 'bg-amber-900/40 text-amber-400' : isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500'}`}>
                          {r.method === 'claude' ? '✨ AI' : '⚙️'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary footer */}
            {!parsing && results.length > 0 && (
              <div className={`mt-3 flex gap-4 text-xs ${sub}`}>
                <span>✅ {results.filter(r => r.crime_type !== 'Unknown').length} crime types identified</span>
                <span>📍 {results.filter(r => r.locations.length > 0).length} locations geocoded</span>
                <span>🕵️ {results.filter(r => r.suspect_name !== 'Unknown').length} suspects extracted</span>
                <span>✨ {results.filter(r => r.method === 'claude').length} parsed by Claude AI</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
