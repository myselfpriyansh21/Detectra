import { useState } from 'react'
import type { Evidence, EvidenceType, Department } from '../types'
import { useTheme } from '../context/ThemeContext'

const EVIDENCE_TYPES: EvidenceType[] = ['CDR', 'Financial', 'Physical', 'Digital', 'Document', 'Photo']

const FIELD_SCHEMA: Record<EvidenceType, { key: string; label: string; placeholder?: string }[]> = {
  CDR: [
    { key: 'callerNumber', label: 'Caller number', placeholder: '98456XXXX1' },
    { key: 'receiverNumber', label: 'Receiver number', placeholder: '77609XXXX5' },
    { key: 'timestamp', label: 'Call timestamp', placeholder: '2025-01-11 22:40' },
    { key: 'durationSeconds', label: 'Duration (sec)', placeholder: '184' },
    { key: 'towerId', label: 'Tower / cell ID', placeholder: 'TWR-central-014' },
  ],
  Financial: [
    { key: 'senderAccount', label: 'Sender account', placeholder: 'Acct-XXXX4417' },
    { key: 'receiverAccount', label: 'Receiver account', placeholder: 'Acct-XXXX7823' },
    { key: 'amount', label: 'Amount (INR)', placeholder: '50000' },
    { key: 'timestamp', label: 'Transaction time', placeholder: '2025-01-12 09:15' },
    { key: 'bank', label: 'Bank', placeholder: 'Bank A' },
    { key: 'transactionType', label: 'Transaction type', placeholder: 'NEFT / UPI / Cash' },
  ],
  Physical: [
    { key: 'label', label: 'Item description', placeholder: 'Crowbar recovered from scene' },
    { key: 'location', label: 'Recovered from', placeholder: 'Crime scene' },
  ],
  Digital: [
    { key: 'label', label: 'Item description', placeholder: 'Chat log export, social handle' },
    { key: 'source', label: 'Source platform', placeholder: 'WhatsApp / device forensics' },
  ],
  Document: [
    { key: 'label', label: 'Document title', placeholder: 'Bank statement, ID proof' },
  ],
  Photo: [
    { key: 'label', label: 'Photo description', placeholder: 'Suspect CCTV still' },
  ],
}

interface Props {
  department: Department
  submittedBy: string
  onSubmit: (ev: Omit<Evidence, 'id' | 'caseId' | 'createdAt'>) => void
  onCancel?: () => void
  compact?: boolean
}

const DEFAULT_TYPE_BY_DEPARTMENT: Record<Department, EvidenceType> = {
  'Local Police': 'Physical',
  'Cyber Cell': 'CDR',
  'Financial Intelligence Unit': 'Financial',
  'Surveillance Unit': 'Digital',
  'Intelligence Agency': 'Digital',
}

export default function EvidenceForm({ department, submittedBy, onSubmit, onCancel, compact }: Props) {
  const { isDark } = useTheme()
  const [type, setType] = useState<EvidenceType>(DEFAULT_TYPE_BY_DEPARTMENT[department] ?? 'CDR')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [fileName, setFileName] = useState<string | undefined>()
  const [fileDataUrl, setFileDataUrl] = useState<string | undefined>()

  const inputCls = `rounded-lg border px-3 py-2 text-xs outline-none w-full ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`
  const chipBase = 'text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors'

  function handleFile(f: File) {
    setFileName(f.name)
    const r = new FileReader()
    r.onload = e => setFileDataUrl(e.target?.result as string)
    r.readAsDataURL(f)
  }

  function submit() {
    onSubmit({ type, department, uploadedBy: submittedBy, notes, fields, fileName, fileDataUrl })
    setFields({}); setNotes(''); setFileName(undefined); setFileDataUrl(undefined)
  }

  const needsFile = type === 'Document' || type === 'Photo'
  const schema = FIELD_SCHEMA[type]

  return (
    <div className={compact ? '' : `rounded-xl border p-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="flex flex-wrap gap-2 mb-3">
        {EVIDENCE_TYPES.map(t => (
          <button key={t} onClick={() => { setType(t); setFields({}) }}
            className={`${chipBase} ${type === t ? 'bg-amber-500 border-amber-500 text-slate-900' : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {schema.map(f => (
          <input key={f.key} placeholder={f.label + (f.placeholder ? ` (e.g. ${f.placeholder})` : '')}
            value={fields[f.key] ?? ''}
            onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
            className={inputCls} />
        ))}
      </div>

      {needsFile && (
        <div className="mb-3">
          <input type="file" accept={type === 'Photo' ? 'image/*' : undefined}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="text-xs" />
          {fileName && <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Attached: {fileName}</p>}
        </div>
      )}

      <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
        rows={2} className={`${inputCls} mb-3`} />

      <div className="flex items-center gap-2">
        <button onClick={submit} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400">
          Attach Evidence
        </button>
        {onCancel && (
          <button onClick={onCancel} className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
