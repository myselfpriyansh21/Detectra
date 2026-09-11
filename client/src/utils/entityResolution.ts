import type { CrimeIncident } from '../types'

export interface IdentityGroup {
  name: string
  incidentIds: string[]
  phones: string[]
  vehicles: string[]
  gangs: string[]
}

export interface EntityMatchCandidate {
  id: string            // stable key: "<nameA>::<nameB>" (alphabetical)
  nameA: string
  nameB: string
  groupA: IdentityGroup
  groupB: IdentityGroup
  nameSimilarity: number   // 0..1
  phoneMatch: boolean
  vehicleMatch: boolean
  score: number             // 0..1 overall confidence
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
}

/** Dice coefficient over character bigrams — cheap, dependency-free fuzzy
 *  string similarity that tolerates abbreviation ("R. Kumar" vs "Ravi Kumar") */
function bigramSimilarity(a: string, b: string): number {
  const bigrams = (s: string) => {
    const out = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
    return out
  }
  const A = bigrams(a), B = bigrams(b)
  if (A.size === 0 || B.size === 0) return a === b ? 1 : 0
  let overlap = 0
  A.forEach(g => { if (B.has(g)) overlap++ })
  return (2 * overlap) / (A.size + B.size)
}

/** Token-level bonus: shared surname or a first-name initial matching the
 *  other's first name gives a strong boost even when bigram similarity on
 *  the full string is middling (e.g. "R Kumar" vs "Ravi Kumar"). */
function tokenBonus(a: string, b: string): number {
  const ta = a.split(' ').filter(Boolean)
  const tb = b.split(' ').filter(Boolean)
  if (ta.length === 0 || tb.length === 0) return 0
  const lastA = ta[ta.length - 1], lastB = tb[tb.length - 1]
  const sameSurname = lastA === lastB && lastA.length > 2
  const firstA = ta[0], firstB = tb[0]
  const initialMatch =
    (firstA.length === 1 && firstB.startsWith(firstA)) ||
    (firstB.length === 1 && firstA.startsWith(firstB))
  if (sameSurname && initialMatch) return 0.35
  if (sameSurname) return 0.15
  return 0
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return 1
  const base = bigramSimilarity(na, nb)
  const bonus = tokenBonus(na, nb)
  return Math.min(1, base + bonus)
}

function groupByIdentity(incidents: CrimeIncident[]): IdentityGroup[] {
  const map = new Map<string, IdentityGroup>()
  for (const inc of incidents) {
    if (!inc.suspect_name || inc.suspect_name === 'Unknown') continue
    const key = inc.suspect_name
    if (!map.has(key)) map.set(key, { name: key, incidentIds: [], phones: [], vehicles: [], gangs: [] })
    const g = map.get(key)!
    g.incidentIds.push(inc.id)
    if (inc.phone_number && inc.phone_number !== 'Unknown' && !g.phones.includes(inc.phone_number)) g.phones.push(inc.phone_number)
    if (inc.vehicle_number && inc.vehicle_number !== 'Unknown' && !g.vehicles.includes(inc.vehicle_number)) g.vehicles.push(inc.vehicle_number)
    if (inc.gang_affiliation && inc.gang_affiliation !== 'Unknown' && !g.gangs.includes(inc.gang_affiliation)) g.gangs.push(inc.gang_affiliation)
  }
  return [...map.values()]
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::')
}

/** Generates candidate duplicate-identity pairs across all distinct suspect
 *  names in the dataset. A pair surfaces if the names are similar OR they
 *  share a phone/vehicle — either signal alone can indicate the same person
 *  reported under different name spellings across sources. */
export function generateEntityMatchCandidates(
  incidents: CrimeIncident[],
  opts?: { minNameSimilarity?: number; excludePairKeys?: Set<string> }
): EntityMatchCandidate[] {
  const minNameSim = opts?.minNameSimilarity ?? 0.45
  const exclude = opts?.excludePairKeys ?? new Set<string>()
  const groups = groupByIdentity(incidents)
  const candidates: EntityMatchCandidate[] = []

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j]
      if (a.name === b.name) continue
      const key = pairKey(a.name, b.name)
      if (exclude.has(key)) continue

      const sim = nameSimilarity(a.name, b.name)
      const phoneMatch = a.phones.some(p => b.phones.includes(p))
      const vehicleMatch = a.vehicles.some(v => b.vehicles.includes(v))

      if (sim < minNameSim && !phoneMatch && !vehicleMatch) continue

      // Weighted confidence: shared phone/vehicle is stronger evidence
      // than name similarity alone (a name typo is common; a shared
      // phone number reported across two different sources is not).
      let score = sim * 0.4
      if (phoneMatch) score += 0.4
      if (vehicleMatch) score += 0.35
      score = Math.min(1, score)

      candidates.push({
        id: key, nameA: a.name, nameB: b.name, groupA: a, groupB: b,
        nameSimilarity: sim, phoneMatch, vehicleMatch, score,
      })
    }
  }

  return candidates.sort((x, y) => y.score - x.score)
}

/** Resolves an incident's raw suspect_name through the confirmed alias
 *  map to its canonical identity — this is what collapses "R. Kumar" and
 *  "Ravi Kumar" into a single connected node once a match is confirmed. */
export function resolveName(name: string, aliases: Record<string, string>): string {
  let current = name
  const seen = new Set<string>()
  while (aliases[current] && !seen.has(current)) {
    seen.add(current)
    current = aliases[current]
  }
  return current
}

/** Picks the canonical name for a confirmed merge: the fuller/more common
 *  spelling wins (more incidents, then longer string, then alphabetical). */
export function pickCanonicalName(a: IdentityGroup, b: IdentityGroup): { canonical: string; alias: string } {
  if (a.incidentIds.length !== b.incidentIds.length) {
    return a.incidentIds.length > b.incidentIds.length ? { canonical: a.name, alias: b.name } : { canonical: b.name, alias: a.name }
  }
  if (a.name.length !== b.name.length) {
    return a.name.length > b.name.length ? { canonical: a.name, alias: b.name } : { canonical: b.name, alias: a.name }
  }
  return a.name < b.name ? { canonical: a.name, alias: b.name } : { canonical: b.name, alias: a.name }
}
