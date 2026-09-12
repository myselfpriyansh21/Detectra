import { useState, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import type { CrimeIncident, Department, Evidence } from '../types'
import { STATIONS } from '../utils/jurisdiction'
import EvidenceForm from './EvidenceForm'

const LOCALITIES: Record<string, [number, number]> = {
  'hebbal': [13.0358, 77.5972],
  'koramangala': [12.9352, 77.6245],
  'indiranagar': [12.9784, 77.6408],
  'whitefield': [12.9698, 77.7499],
  'jp nagar': [12.9102, 77.5840],
  'rajajinagar': [12.9912, 77.5555],
  'malleswaram': [13.0035, 77.5680],
  'jayanagar': [12.9282, 77.5818],
  'btm layout': [12.9165, 77.6101],
  'electronic city': [12.8457, 77.6602],
  'yelahanka': [13.1005, 77.5963],
  'marathahalli': [12.9591, 77.6974],
  'rt nagar': [13.0204, 77.5957],
  'shivajinagar': [12.9850, 77.6000],
  'majestic': [12.9766, 77.5713],
  'basavanagudi': [12.9420, 77.5740],
  'vijayanagar': [12.9715, 77.5341],
  'thanisandra': [13.0573, 77.6268],
  'peenya': [13.0279, 77.5181],
  'banaswadi': [13.0225, 77.6504],
  'frazer town': [12.9784, 77.6148],
  'kr puram': [13.0060, 77.6956],
  'halasuru': [12.9784, 77.6243],
  'nagarbhavi': [12.9645, 77.5178],
}

// Pulls a clean case ID out of whatever FIR number appears in the source
// text ("FIR No-043", "FIR No. 0142/2024", etc.) — falls back to a short
// random suffix only if no FIR number is found at all. This is only ever
// a starting suggestion: the officer can freely edit it before saving.
function extractFirNumber(text: string): string {
  const m = text.match(/FIR\s*No\.?\s*-?\s*(\d+)/i)
  if (m) return `FIR-${m[1]}`
  return `FIR-${Math.floor(1000 + Math.random() * 9000)}`
}

function resolveLocation(locs: string[]): [number, number] {
  for (const loc of locs) {
    for (const [a, c] of Object.entries(LOCALITIES)) {
      if (loc.toLowerCase().includes(a)) return c
    }
  }
  return [
    12.9716 + (Math.random() - 0.5) * 0.05,
    77.5946 + (Math.random() - 0.5) * 0.05,
  ]
}

function extractLocally(text: string) {
  const t = text.toLowerCase()
  const vehicles = [
    ...new Set(
      (text.match(/\b([A-Z]{2}[-]?\d{2}[-]?[A-Z]{1,3}[-]?\d{4})\b/gi) ?? []).map((v) =>
        v.toUpperCase()
      )
    ),
  ]
  const phones = [...new Set(text.match(/\b[6-9]\d{9}\b/g) ?? [])]
  const wkw = ['pistol', 'revolver', 'knife', 'dagger', 'crowbar', 'sword']
  const weapons = wkw.filter((w) => t.includes(w))
  const cmap: Record<string, string> = {
    snatch: 'Chain Snatching',
    chain: 'Chain Snatching',
    burgl: 'Burglary',
    theft: 'Vehicle Theft',
    vehicle: 'Vehicle Theft',
    assault: 'Assault',
    attack: 'Assault',
    phishing: 'Financial Fraud',
    upi: 'Financial Fraud',
    otp: 'Financial Fraud',
    fraud: 'Financial Fraud',
    'fake profile': 'Social Media Fraud',
    catfish: 'Social Media Fraud',
    sextortion: 'Social Media Fraud',
    impersonat: 'Social Media Fraud',
  }
  let crime_type = 'Unknown'
  for (const [k, v] of Object.entries(cmap)) {
    if (t.includes(k)) {
      crime_type = v
      break
    }
  }
  const hm = text.match(/(\d{1,2})[:\s]?\d{0,2}\s*(hrs?|am|pm)/i)
  let crime_hour = 22
  if (hm) {
    let h = parseInt(hm[1])
    if (hm[2]?.toLowerCase().includes('pm') && h < 12) h += 12
    crime_hour = h % 24
  }
  const locations = Object.keys(LOCALITIES).filter((l) => t.includes(l))
  let severity = 5
  if (t.includes('murder') || t.includes('bomb')) severity = 10
  else if (t.includes('pistol') || t.includes('revolver')) severity = 9
  else if (t.includes('assault')) severity = 7
  else if (t.includes('snatch') || t.includes('burglary')) severity = 6

  return {
    suspects: [],
    vehicles,
    weapons,
    phone_numbers: phones,
    locations,
    gang_affiliations: [],
    evidence: weapons,
    crime_type,
    crime_hour,
    severity_score: severity,
    case_summary: `${crime_type} detected.${
      locations.length ? ` Location: ${locations[0]}.` : ''
    }${vehicles.length ? ` Vehicle: ${vehicles[0]}.` : ''}`,
  }
}

const SAMPLE_FIR = `FIR No. 0142/2024 | Delhi — Karol Bagh Division | 17-Nov-2024\n\nComplainant Ramesh Nayak reported that on 15-Nov-2024 at approx. 23:40 hrs, four unknown persons in a white Maruti Swift bearing DL-05-NB-5678 forcibly snatched his gold chain near Connaught Place. One suspect carried a knife. Suspect Ravi Kumar of Kabir Gang is the believed leader. Crowbar recovered from scene.`

type Panel = 'none' | 'fir' | 'bulk' | 'cctns' | 'scan'

interface Parsed {
  suspects: string[]
  vehicles: string[]
  weapons: string[]
  phone_numbers: string[]
  locations: string[]
  gang_affiliations: string[]
  evidence: string[]
  crime_type: string
  crime_hour: number
  severity_score: number
  case_summary: string
}

interface Props {
  onAddIncident: (i: CrimeIncident) => void
  onAddIncidents: (i: CrimeIncident[]) => void
  onFileUpload: (t: string) => void
  existingCount: number
  submittingDepartment: Department
  onDepartmentChange: (d: Department) => void
  onAddEvidence: (caseId: string, ev: Omit<Evidence, 'id' | 'caseId' | 'createdAt'>) => void
}

export default function LandingPage({
  onAddIncident,
  onAddIncidents,
  onFileUpload,
  existingCount,
  submittingDepartment,
  onDepartmentChange,
  onAddEvidence,
}: Props) {
  const { isDark } = useTheme()
  const [panel, setPanel] = useState<Panel>('none')
  const [firText, setFirText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [added, setAdded] = useState(false)
  const [newCaseId, setNewCaseId] = useState<string | null>(null)
  const [stationId, setStationId] = useState(STATIONS[0].id)
  // Editable review fields — populated from the parse result but never
  // auto-saved. Nothing touches the database until "Save to Database"
  // is clicked with whatever is currently typed in these fields.
  const [editCaseId, setEditCaseId] = useState('')
  const [editSuspect, setEditSuspect] = useState('')
  const [editVehicle, setEditVehicle] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editGang, setEditGang] = useState('')
  const [editCrimeType, setEditCrimeType] = useState('')
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanTranscript, setScanTranscript] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const bulkRef = useRef<HTMLInputElement>(null)

  const bg = 'bg-slate-50'
  const hdr = 'bg-white border-slate-200'
  const card = 'bg-white border-slate-200 shadow-sm'
  const textP = 'text-slate-800'
  const textS = 'text-slate-500'
  const inp = 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400'

  const BUTTONS = [
    {
      key: 'fir' as Panel,
      icon: '📝',
      title: 'Analyse Single Report',
      sub: 'Paste one FIR, intelligence note, or surveillance report — AI extracts suspects, vehicles, phones and evidence, then maps the case.',
      accent: 'border-blue-500',
      iconBg: isDark ? 'bg-blue-900/40' : 'bg-blue-50',
    },
    {
      key: 'bulk' as Panel,
      icon: '📋',
      title: 'Batch Report Analysis',
      sub: 'Upload a .txt with multiple FIRs or intelligence reports — all parsed and added in one click.',
      accent: 'border-purple-500',
      iconBg: isDark ? 'bg-purple-900/40' : 'bg-purple-50',
    },
    {
      key: 'cctns' as Panel,
      icon: '📂',
      title: 'Import CCTNS-style Export',
      sub: 'Load a flattened case-report CSV — from a station MIS, Cyber Cell CDR export, or Financial Intelligence Unit transaction dump.',
      accent: 'border-green-500',
      iconBg: 'bg-green-50',
    },
    {
      key: 'scan' as Panel,
      icon: '📷',
      title: 'Scan Written Report',
      sub: 'Photograph a handwritten or printed report — AI transcribes it and extracts suspects, evidence and crime details automatically.',
      accent: 'border-red-500',
      iconBg: 'bg-red-50',
    },
  ]

  async function handleParse() {
    if (!firText.trim()) return
    setParsing(true)
    setParsed(null)
    setAdded(false)
    try {
      const res = await fetch('https://detectra-cxkp.onrender.com/parse_fir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: firText }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        setParsed(data)
        primeEditFields(data)
        setParsing(false)
        return
      }
    } catch {}
    const local = extractLocally(firText)
    setParsed(local)
    primeEditFields(local)
    setParsing(false)
  }

  function primeEditFields(p: Parsed) {
    setEditCaseId(extractFirNumber(firText))
    setEditSuspect(p.suspects[0] || '')
    setEditVehicle(p.vehicles[0] || '')
    setEditPhone(p.phone_numbers[0] || '')
    setEditGang(p.gang_affiliations[0] || '')
    setEditCrimeType(p.crime_type || 'Unknown')
  }

  async function handleScanImage(file: File) {
    setScanError(null)
    setParsing(true)
    setParsed(null)
    setAdded(false)
    setScanPreview(URL.createObjectURL(file))
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      try {
        const res = await fetch('/api/scan_report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64, media_type: file.type || 'image/jpeg' }),
        })
        const data = await res.json()
        if (data.status === 'success') {
          setScanTranscript(data.transcript ?? null)
          setParsed(data)
        } else {
          setScanError(data.message || 'Could not scan this image.')
        }
      } catch {
        setScanError('Could not reach the scanning service. Check your connection and try again.')
      }
      setParsing(false)
    }
    reader.readAsDataURL(file)
  }

  function handleAddFIR() {
    if (!parsed) return
    const id = editCaseId.trim()
    if (!id) return
    const [lat, lon] = resolveLocation(parsed.locations)
    onAddIncident({
      id,
      date: new Date().toISOString().split('T')[0],
      latitude: lat,
      longitude: lon,
      crime_type: editCrimeType.trim() || 'Unknown',
      severity_score: Math.max(1, Math.min(10, parsed.severity_score)),
      crime_hour: parsed.crime_hour,
      suspect_name: editSuspect.trim() || 'Unknown',
      phone_number: editPhone.trim() || undefined,
      vehicle_number: editVehicle.trim() || undefined,
      gang_affiliation: editGang.trim() || 'Unknown',
      evidence_found: parsed.evidence[0] || parsed.weapons[0] || 'None',
      case_status: 'Open',
      station: stationId,
    })
    setNewCaseId(id)
    setAdded(true)
  }

  function handleCSV(file: File) {
    const r = new FileReader()
    r.onload = (e) => onFileUpload(e.target?.result as string)
    r.readAsText(file)
  }

  function handleBulkTxt(file: File) {
    const r = new FileReader()
    r.onload = (e) => {
      const text = e.target?.result as string
      const blocks = text
        .split(/(?=FIR No\.?\s*[\d/]+)/i)
        .filter((s) => s.trim().length > 80)
      const incs: CrimeIncident[] = blocks.map((b, i) => {
        const p = extractLocally(b)
        const [lat, lon] = resolveLocation(p.locations)
        return {
          id: `BULK${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2,4)}`,
          date: new Date().toISOString().split('T')[0],
          latitude: lat,
          longitude: lon,
          crime_type: p.crime_type || 'Unknown',
          severity_score: Math.max(1, Math.min(10, p.severity_score)),
          crime_hour: p.crime_hour,
          suspect_name: p.suspects[0] || 'Unknown',
          phone_number: p.phone_numbers[0] || undefined,
          vehicle_number: p.vehicles[0] || undefined,
          gang_affiliation: p.gang_affiliations[0] || 'Unknown',
          evidence_found: p.evidence[0] || p.weapons[0] || 'None',
          case_status: 'Open',
          station: stationId,
        }
      })
      onAddIncidents(incs)
    }
    r.readAsText(file)
  }

  const entityGroups = parsed
    ? [
        {
          label: 'Suspects',
          icon: '🕵️',
          items: parsed.suspects,
          color: 'text-red-500 bg-red-50 border-red-200',
        },
        {
          label: 'Vehicles',
          icon: '🚗',
          items: parsed.vehicles,
          color: 'text-blue-500 bg-blue-50 border-blue-200',
        },
        {
          label: 'Weapons',
          icon: '🔫',
          items: [...new Set([...parsed.weapons, ...parsed.evidence])],
          color: 'text-orange-500 bg-orange-50 border-orange-200',
        },
        {
          label: 'Phones',
          icon: '📱',
          items: parsed.phone_numbers,
          color: 'text-green-500 bg-green-50 border-green-200',
        },
        {
          label: 'Locations',
          icon: '📍',
          items: parsed.locations,
          color: 'text-amber-500 bg-amber-50 border-amber-200',
        },
      ]
    : []

  return (
    <div
      className={`min-h-screen flex flex-col relative overflow-hidden ${bg} transition-colors duration-200`}
    >
      {/* Header */}
      <header className={`shrink-0 border-b z-10 ${hdr}`}>
        <div className="flex items-center justify-between px-8 py-3">
          <div>
            <h2 className="text-slate-900 font-bold text-sm">Add / Import Case</h2>
            <p className="text-slate-400 text-xs">
              Register a new case from a report, batch upload, structured export, or scanned document.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-full px-4 py-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-700 text-xs font-medium">
                {existingCount} cases in system
              </span>
            </div>
            <select value={submittingDepartment} onChange={e => onDepartmentChange(e.target.value as Department)}
              className="text-xs font-medium rounded-full border border-slate-300 bg-white text-slate-700 px-3 py-1.5 outline-none">
              <option value="Local Police">Local Police</option>
              <option value="Cyber Cell">Cyber Cell</option>
              <option value="Financial Intelligence Unit">Financial Intelligence Unit</option>
              <option value="Surveillance Unit">Surveillance Unit</option>
              <option value="Intelligence Agency">Intelligence Agency</option>
            </select>
            <select value={stationId} onChange={e => setStationId(e.target.value)}
              className="text-xs font-medium rounded-full border border-slate-300 bg-white text-slate-700 px-3 py-1.5 outline-none">
              {STATIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Hero heading */}
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4 border ${
              isDark
                ? 'bg-blue-900/30 border-blue-700 text-blue-300'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}
          >
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs font-semibold">
              System Active · Pan-India Coverage
            </span>
          </div>
          <h2 className={`text-4xl font-black mb-3 ${textP}`}>
            AI-Powered Crime Intelligence
          </h2>
          <p className={`text-base max-w-2xl mx-auto ${textS}`}>
            Geospatial hotspot mapping · Criminal network analysis · FIR
            intelligence · Predictive policing
          </p>
        </div>

        {/* Case-entry option grid */}
        {panel === 'none' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-3xl mb-6">
            {BUTTONS.map((btn) => (
              <button
                key={btn.key}
                onClick={() => {
                  setPanel(btn.key)
                  setParsed(null)
                  setAdded(false)
                }}
                className={`flex items-start gap-4 p-6 rounded-2xl border-2 text-left transition-all duration-200 group cursor-pointer ${card} hover:${btn.accent} hover:shadow-lg`}
              >
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0 ${btn.iconBg} group-hover:scale-110 transition-transform duration-200`}
                >
                  {btn.icon}
                </div>
                <div>
                  <p className={`font-bold text-base mb-1 ${textP}`}>
                    {btn.title}
                  </p>
                  <p className={`text-xs leading-relaxed ${textS}`}>
                    {btn.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Single FIR Panel */}
        {panel === 'fir' && (
          <div className={`w-full max-w-4xl rounded-2xl border p-6 ${card}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold text-base ${textP}`}>
                📝 Analyse Single FIR
              </h3>
              <button
                onClick={() => {
                  setPanel('none')
                  setParsed(null)
                }}
                className={`text-xs px-3 py-1 rounded-lg border ${
                  isDark
                    ? 'border-slate-600 text-slate-400 hover:text-white'
                    : 'border-slate-300 text-slate-500 hover:text-slate-800'
                }`}
              >
                ← Back
              </button>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-3">
                <textarea
                  value={firText}
                  onChange={(e) => {
                    setFirText(e.target.value)
                    setParsed(null)
                    setAdded(false)
                  }}
                  placeholder="Paste FIR narrative here — no formatting needed, paste the original text..."
                  rows={8}
                  className={`w-full rounded-xl border p-3 text-xs font-mono resize-none focus:outline-none focus:border-blue-500 transition-colors ${inp}`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFirText(SAMPLE_FIR)
                      setParsed(null)
                      setAdded(false)
                    }}
                    className={`flex-1 py-2 rounded-lg border text-xs transition-colors ${
                      isDark
                        ? 'border-slate-600 text-slate-400 hover:text-white'
                        : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    Load Sample FIR
                  </button>
                  <button
                    onClick={() => {
                      setFirText('')
                      setParsed(null)
                    }}
                    className={`px-4 py-2 rounded-lg border text-xs ${
                      isDark
                        ? 'border-slate-700 text-slate-600'
                        : 'border-slate-200 text-slate-400'
                    }`}
                  >
                    Clear
                  </button>
                </div>
                <button
                  onClick={handleParse}
                  disabled={parsing || !firText.trim()}
                  className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-600 disabled:bg-slate-300 disabled:text-slate-400 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {parsing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    '🔍 Parse with AI'
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto max-h-72">
                {!parsed && !parsing && (
                  <div
                    className={`flex flex-col items-center justify-center h-full text-center ${textS} opacity-50`}
                  >
                    <div className="text-4xl mb-2">📄</div>
                    <p className="text-sm">Paste a FIR to extract entities</p>
                  </div>
                )}
                {parsing && (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-blue-600 text-sm">Reading FIR...</p>
                  </div>
                )}
                {parsed && (
                  <div className="space-y-2">
                    <div
                      className={`rounded-lg p-3 border ${
                        isDark
                          ? 'bg-slate-700 border-slate-600'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <p className={`text-xs ${textS} mb-1`}>Summary</p>
                      <p className={`text-xs leading-relaxed ${textP}`}>
                        {parsed.case_summary}
                      </p>
                    </div>

                    {/* Review & edit — nothing is saved until "Save to Database" is clicked */}
                    <div className={`rounded-lg p-3 border space-y-2 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                      <p className={`text-xs font-semibold ${textS}`}>Review before saving</p>

                      <div>
                        <label className={`block text-[11px] mb-0.5 ${textS}`}>Case / FIR ID</label>
                        <input value={editCaseId} onChange={e => setEditCaseId(e.target.value)}
                          disabled={added}
                          placeholder="FIR-043"
                          className={`w-full rounded-lg border px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500 ${inp}`} />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={`block text-[11px] mb-0.5 ${textS}`}>Suspect Name</label>
                          <input value={editSuspect} onChange={e => setEditSuspect(e.target.value)} disabled={added}
                            placeholder="Unknown"
                            className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 ${inp}`} />
                        </div>
                        <div>
                          <label className={`block text-[11px] mb-0.5 ${textS}`}>Crime Type</label>
                          <input value={editCrimeType} onChange={e => setEditCrimeType(e.target.value)} disabled={added}
                            placeholder="Unknown"
                            className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 ${inp}`} />
                        </div>
                        <div>
                          <label className={`block text-[11px] mb-0.5 ${textS}`}>Vehicle Number</label>
                          <input value={editVehicle} onChange={e => setEditVehicle(e.target.value)} disabled={added}
                            placeholder="e.g. DL-05-NB-5678"
                            className={`w-full rounded-lg border px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500 ${inp}`} />
                        </div>
                        <div>
                          <label className={`block text-[11px] mb-0.5 ${textS}`}>Phone Number</label>
                          <input value={editPhone} onChange={e => setEditPhone(e.target.value)} disabled={added}
                            placeholder="e.g. 9845600001"
                            className={`w-full rounded-lg border px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500 ${inp}`} />
                        </div>
                        <div className="col-span-2">
                          <label className={`block text-[11px] mb-0.5 ${textS}`}>Gang Affiliation</label>
                          <input value={editGang} onChange={e => setEditGang(e.target.value)} disabled={added}
                            placeholder="Unknown"
                            className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 ${inp}`} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className={`rounded-lg p-2 text-center border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                          <p className={`text-xs ${textS}`}>Hour</p>
                          <p className="text-xs font-bold text-blue-600">{parsed.crime_hour}:00</p>
                        </div>
                        <div className={`rounded-lg p-2 text-center border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                          <p className={`text-xs ${textS}`}>Severity</p>
                          <p className={`text-xs font-bold ${parsed.severity_score >= 7 ? 'text-red-600' : 'text-green-600'}`}>{parsed.severity_score}/10</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleAddFIR}
                      disabled={added || !editCaseId.trim()}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
                        added
                          ? 'bg-green-600 text-white'
                          : 'bg-blue-700 hover:bg-blue-600 disabled:bg-slate-300 disabled:text-slate-400 text-white'
                      }`}
                    >
                      {added ? 'Saved to Database' : 'Save to Database'}
                    </button>
                    {added && newCaseId && (
                      <div className="mt-3">
                        <p className={`text-xs font-semibold mb-2 ${textP}`}>
                          Attach supporting evidence to {newCaseId} (optional)
                        </p>
                        <EvidenceForm
                          department={submittingDepartment}
                          submittedBy={submittingDepartment}
                          onSubmit={ev => onAddEvidence(newCaseId, ev)}
                          onCancel={() => { setNewCaseId(null); setAdded(false); setParsed(null); setFirText('') }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scan Written Report Panel */}
        {panel === 'scan' && (
          <div className={`w-full max-w-4xl rounded-2xl border p-6 ${card}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold text-base ${textP}`}>
                📷 Scan Written Report
              </h3>
              <button
                onClick={() => {
                  setPanel('none')
                  setParsed(null)
                  setScanPreview(null)
                  setScanTranscript(null)
                  setScanError(null)
                }}
                className="text-xs px-3 py-1 rounded-lg border border-slate-300 text-slate-500 hover:text-slate-800"
              >
                ← Back
              </button>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-3">
                <label
                  htmlFor="scan-file-input"
                  className={`flex-1 min-h-[220px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                    scanPreview ? 'border-slate-200 p-2' : 'border-slate-300 hover:border-red-400 p-6'
                  }`}
                >
                  {scanPreview ? (
                    <img src={scanPreview} alt="Scanned report" className="max-h-56 rounded-lg object-contain" />
                  ) : (
                    <>
                      <span className="text-4xl">📷</span>
                      <p className={`text-sm ${textS}`}>Click to upload a photo or scan of the report</p>
                      <p className={`text-xs ${textS} opacity-70`}>JPG, PNG — handwritten or printed</p>
                    </>
                  )}
                </label>
                <input
                  id="scan-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleScanImage(e.target.files[0])}
                />
                {scanPreview && (
                  <button
                    onClick={() => document.getElementById('scan-file-input')?.click()}
                    className="w-full py-2 rounded-lg border border-slate-300 text-xs text-slate-600 hover:border-red-400 hover:text-red-600"
                  >
                    Choose a different photo
                  </button>
                )}
                {scanError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs p-3">
                    {scanError}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto max-h-96">
                {!parsed && !parsing && !scanError && (
                  <div className={`flex flex-col items-center justify-center h-full text-center ${textS} opacity-50`}>
                    <div className="text-4xl mb-2">🧾</div>
                    <p className="text-sm">Upload a photo to transcribe and extract entities</p>
                  </div>
                )}
                {parsing && (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-red-600 text-sm">Reading report...</p>
                  </div>
                )}
                {parsed && (
                  <div className="space-y-2">
                    {scanTranscript && (
                      <div className="rounded-lg p-3 border bg-slate-50 border-slate-200">
                        <p className={`text-xs ${textS} mb-1`}>Transcript</p>
                        <p className={`text-xs leading-relaxed font-mono ${textP}`}>{scanTranscript}</p>
                      </div>
                    )}
                    <div className="rounded-lg p-3 border bg-slate-50 border-slate-200">
                      <p className={`text-xs ${textS} mb-1`}>Summary</p>
                      <p className={`text-xs leading-relaxed ${textP}`}>{parsed.case_summary}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { l: 'Type', v: parsed.crime_type, c: 'text-amber-600' },
                        { l: 'Hour', v: `${parsed.crime_hour}:00`, c: 'text-blue-600' },
                        { l: 'Severity', v: `${parsed.severity_score}/10`, c: parsed.severity_score >= 7 ? 'text-red-600' : 'text-green-600' },
                      ].map(f => (
                        <div key={f.l} className="rounded-lg p-2 text-center border bg-white border-slate-200">
                          <p className={`text-xs ${textS}`}>{f.l}</p>
                          <p className={`text-xs font-bold ${f.c}`}>{f.v}</p>
                        </div>
                      ))}
                    </div>
                    {entityGroups.map(g => g.items.length > 0 && (
                      <div key={g.label} className={`border rounded-lg p-2 ${g.color}`}>
                        <p className="text-xs font-semibold mb-1">{g.icon} {g.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {g.items.map((item, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-white/60 rounded font-mono border">{item}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={handleAddFIR}
                      disabled={added}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
                        added ? 'bg-green-600 text-white' : 'bg-blue-700 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {added ? 'Case Added' : 'Add Case to Platform'}
                    </button>
                    {added && newCaseId && (
                      <div className="mt-3">
                        <p className={`text-xs font-semibold mb-2 ${textP}`}>
                          Attach supporting evidence to {newCaseId} (optional)
                        </p>
                        <EvidenceForm
                          department={submittingDepartment}
                          submittedBy={submittingDepartment}
                          onSubmit={ev => onAddEvidence(newCaseId, ev)}
                          onCancel={() => { setNewCaseId(null); setAdded(false); setParsed(null); setScanPreview(null); setScanTranscript(null) }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bulk FIR Panel */}
        {panel === 'bulk' && (
          <div className={`w-full max-w-2xl rounded-2xl border p-6 ${card}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold text-base ${textP}`}>
                📋 Batch FIR Analysis
              </h3>
              <button
                onClick={() => setPanel('none')}
                className={`text-xs px-3 py-1 rounded-lg border ${
                  isDark
                    ? 'border-slate-600 text-slate-400'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                ← Back
              </button>
            </div>
            <p className={`text-sm mb-4 ${textS}`}>
              Upload a .txt file containing multiple FIR reports separated by{' '}
              <code className="bg-slate-100 px-1 rounded text-slate-800">
                FIR No.
              </code>{' '}
              headers or{' '}
              <code className="bg-slate-100 px-1 rounded text-slate-800">
                ---
              </code>{' '}
              dividers.
            </p>
            <div
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f) handleBulkTxt(f)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => bulkRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-purple-400 bg-purple-50'
                  : isDark
                  ? 'border-slate-600 hover:border-purple-500'
                  : 'border-slate-300 hover:border-purple-400'
              }`}
            >
              <div className="text-5xl mb-3">📄</div>
              <p className={`font-bold mb-1 ${textP}`}>
                Drop .txt file here or click to browse
              </p>
              <p className={`text-xs ${textS}`}>
                Each FIR will be parsed individually and added to the platform
              </p>
              <input
                ref={bulkRef}
                type="file"
                accept=".txt,.text"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    handleBulkTxt(f)
                    setPanel('none')
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* CCTNS Import Panel */}
        {panel === 'cctns' && (
          <div className={`w-full max-w-2xl rounded-2xl border p-6 ${card}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold text-base ${textP}`}>
                📂 Import CCTNS-style Export
              </h3>
              <button
                onClick={() => setPanel('none')}
                className={`text-xs px-3 py-1 rounded-lg border ${
                  isDark
                    ? 'border-slate-600 text-slate-400'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                ← Back
              </button>
            </div>
            <p className={`text-sm mb-4 ${textS}`}>
              Upload a CSV in the flattened case-report format a station's
              MIS/reporting layer would generate from CCTNS — one row per
              case, joined across the crime head, gravity, and status lookup
              tables. This is not a raw CCTNS system-to-system dump; it's the
              analytics-ready export format Detectra consumes.
            </p>
            <div
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f) handleCSV(f)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-green-400 bg-green-50'
                  : isDark
                  ? 'border-slate-600 hover:border-green-500'
                  : 'border-slate-300 hover:border-green-400'
              }`}
            >
              <div className="text-5xl mb-3">📂</div>
              <p className={`font-bold mb-1 ${textP}`}>
                Drop case-report CSV here or click to browse
              </p>
              <p className={`text-xs ${textS} mb-3`}>
                Accepts .csv files in Detectra's flattened case format
              </p>
              <p className={`text-xs font-mono ${textS}`}>
                id · date · latitude · longitude · crime_type · severity_score ·
                crime_hour · suspect_name · gang_affiliation · evidence_found ·
                case_status
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleCSV(f)
                }}
              />
            </div>
          </div>
        )}

        {/* Capability badges */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {[
            '🌐 Geospatial Mapping',
            '🕸️ Criminal Networks',
            '📊 Crime Analytics',
            '🤖 AI Insights',
            '🔮 Predictive Policing',
            '💬 AI Assistant',
            '⚠️ Early Warnings',
            '🔍 FIR Intelligence',
          ].map((f) => (
            <span
              key={f}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-400'
                  : 'bg-white border-slate-200 text-slate-500 shadow-sm'
              }`}
            >
              {f}
            </span>
          ))}
        </div>

        <p className={`mt-6 text-xs ${textS}`}>
          DETECTRA v2.0 · Ministry of Home Affairs · NCRB · Smart India Hackathon 2026 · Confidential
        </p>
      </div>
    </div>
  )
}