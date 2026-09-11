import { useMemo } from 'react'
import type { CrimeIncident } from '../types'
import { useTheme } from '../context/ThemeContext'
import { generateEntityMatchCandidates, pairKey, type EntityMatchCandidate, type IdentityGroup } from '../utils/entityResolution'

interface Props {
  incidents: CrimeIncident[]           // raw incidents (pre-resolution) so candidates reflect true source variance
  aliases: Record<string, string>       // confirmed merges: variant name -> canonical name
  rejectedPairs: Set<string>
  onConfirm: (groupA: IdentityGroup, groupB: IdentityGroup) => void
  onReject: (nameA: string, nameB: string) => void
}

export default function EntityResolution({ incidents, aliases, rejectedPairs, onConfirm, onReject }: Props) {
  const { isDark } = useTheme()

  const confirmedPairKeys = useMemo(() => {
    const keys = new Set<string>()
    Object.entries(aliases).forEach(([variant, canonical]) => keys.add(pairKey(variant, canonical)))
    return keys
  }, [aliases])

  const excludeKeys = useMemo(() => new Set([...rejectedPairs, ...confirmedPairKeys]), [rejectedPairs, confirmedPairKeys])

  const candidates = useMemo(
    () => generateEntityMatchCandidates(incidents, { excludePairKeys: excludeKeys }),
    [incidents, excludeKeys]
  )

  const confirmedList = useMemo(() => Object.entries(aliases), [aliases])

  const bg = isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
  const sub = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`h-full w-full overflow-y-auto ${bg} p-6`}>
      <div className="max-w-4xl mx-auto">
        <h2 className="font-bold text-lg mb-1">Entity Resolution</h2>
        <p className={`text-xs mb-6 ${sub}`}>
          Detectra compares every suspect name across all loaded sources for near-duplicate spellings and shared
          phone numbers or vehicle registrations. Nothing merges automatically — an investigator confirms each
          match before the network graph links the cases together.
        </p>

        {candidates.length === 0 && (
          <div className={`rounded-xl border p-6 text-center text-sm ${card} ${sub}`}>
            No pending candidates — every suspect identity in the current dataset is either already resolved or
            has no plausible duplicate.
          </div>
        )}

        <div className="space-y-4">
          {candidates.map(c => (
            <CandidateCard key={c.id} candidate={c} card={card} sub={sub} isDark={isDark}
              onConfirm={() => onConfirm(c.groupA, c.groupB)}
              onReject={() => onReject(c.nameA, c.nameB)} />
          ))}
        </div>

        {confirmedList.length > 0 && (
          <div className="mt-8">
            <h3 className="font-bold text-sm mb-3">Confirmed Merges ({confirmedList.length})</h3>
            <div className={`rounded-xl border overflow-hidden ${card}`}>
              <table className="w-full text-xs">
                <thead className={isDark ? 'bg-slate-800/60' : 'bg-slate-100'}>
                  <tr className={`text-left ${sub}`}>
                    <th className="px-4 py-2 font-medium">Variant Name</th>
                    <th className="px-4 py-2 font-medium">Merged Into</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {confirmedList.map(([variant, canonical]) => (
                    <tr key={variant}>
                      <td className="px-4 py-2">{variant}</td>
                      <td className="px-4 py-2 text-amber-500 font-medium">{canonical}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CandidateCard({ candidate, card, sub, isDark, onConfirm, onReject }: {
  candidate: EntityMatchCandidate; card: string; sub: string; isDark: boolean
  onConfirm: () => void; onReject: () => void
}) {
  const { groupA, groupB, nameSimilarity, phoneMatch, vehicleMatch, score } = candidate
  const confidenceColor = score >= 0.75 ? 'text-green-500 bg-green-500/10 border-green-500/30'
    : score >= 0.5 ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
    : 'text-slate-400 bg-slate-500/10 border-slate-500/30'

  return (
    <div className={`rounded-xl border p-4 ${card}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{groupA.name}</span>
          <span className={sub}>↔</span>
          <span className="font-bold text-sm">{groupB.name}</span>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${confidenceColor}`}>
          {Math.round(score * 100)}% confidence
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <EvidenceChip label={`Name similarity ${Math.round(nameSimilarity * 100)}%`} active={nameSimilarity >= 0.45} />
        <EvidenceChip label="Phone number match" active={phoneMatch} />
        <EvidenceChip label="Vehicle number match" active={vehicleMatch} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
        <IdentityDetail group={groupA} sub={sub} isDark={isDark} />
        <IdentityDetail group={groupB} sub={sub} isDark={isDark} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onConfirm} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400">
          ✓ Confirm — same person
        </button>
        <button onClick={onReject} className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
          ✕ Not the same
        </button>
      </div>
    </div>
  )
}

function EvidenceChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${active ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-500/10 text-slate-400 line-through'}`}>
      {label}
    </span>
  )
}

function IdentityDetail({ group, sub, isDark }: { group: IdentityGroup; sub: string; isDark: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
      <p className="font-semibold mb-1">{group.name}</p>
      <p className={sub}>Cases: {group.incidentIds.join(', ')}</p>
      {group.phones.length > 0 && <p className={sub}>Phone: {group.phones.join(', ')}</p>}
      {group.vehicles.length > 0 && <p className={sub}>Vehicle: {group.vehicles.join(', ')}</p>}
      {group.gangs.length > 0 && <p className={sub}>Gang: {group.gangs.join(', ')}</p>}
    </div>
  )
}
