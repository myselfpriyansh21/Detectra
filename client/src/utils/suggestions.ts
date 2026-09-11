import type { CrimeIncident, AISuggestion } from '../types'

export function generateSuggestions(incidents: CrimeIncident[]): AISuggestion[] {
  const suggestions: AISuggestion[] = []

  const suspectMap = new Map<string, CrimeIncident[]>()
  incidents.forEach(inc => {
    if (inc.suspect_name && inc.suspect_name !== 'Unknown') {
      const list = suspectMap.get(inc.suspect_name) ?? []
      list.push(inc)
      suspectMap.set(inc.suspect_name, list)
    }
  })

  suspectMap.forEach((incs, suspect) => {
    if (incs.length >= 2) {
      const types = [...new Set(incs.map(i => i.crime_type))]
      suggestions.push({
        id: `susp-${suspect}`,
        type: 'alert',
        title: `Serial Offender Detected — ${suspect}`,
        description: `${suspect} is linked to ${incs.length} incidents involving: ${types.join(', ')}. Immediate profiling recommended.`,
        confidence: Math.min(60 + incs.length * 10, 97),
        related_incidents: incs.map(i => i.id),
      })
    }
  })

  const gangMap = new Map<string, CrimeIncident[]>()
  incidents.forEach(inc => {
    if (inc.gang_affiliation && inc.gang_affiliation !== 'Unknown') {
      const list = gangMap.get(inc.gang_affiliation) ?? []
      list.push(inc)
      gangMap.set(inc.gang_affiliation, list)
    }
  })

  gangMap.forEach((incs, gang) => {
    const nightCrimes = incs.filter(i => i.crime_hour >= 20 || i.crime_hour <= 5)
    if (nightCrimes.length >= 3) {
      suggestions.push({
        id: `gang-night-${gang}`,
        type: 'pattern',
        title: `Nighttime Activity Pattern — ${gang}`,
        description: `${gang} is responsible for ${nightCrimes.length} incidents between 8 PM and 5 AM. Recommend increased night patrols in their operating zones.`,
        confidence: Math.min(55 + nightCrimes.length * 8, 94),
        related_incidents: nightCrimes.map(i => i.id),
      })
    }
  })

  const evidenceMap = new Map<string, CrimeIncident[]>()
  incidents.forEach(inc => {
    if (inc.evidence_found && inc.evidence_found !== 'None') {
      const list = evidenceMap.get(inc.evidence_found) ?? []
      list.push(inc)
      evidenceMap.set(inc.evidence_found, list)
    }
  })

  evidenceMap.forEach((incs, evidence) => {
    const uniqueSuspects = [...new Set(incs.map(i => i.suspect_name).filter(s => s !== 'Unknown'))]
    if (uniqueSuspects.length >= 2) {
      suggestions.push({
        id: `evidence-${evidence.replace(/\s/g, '-')}`,
        type: 'link',
        title: `Shared Evidence Links Multiple Suspects`,
        description: `Evidence "${evidence}" appears in ${incs.length} cases involving ${uniqueSuspects.join(' and ')}. These suspects may be collaborating.`,
        confidence: 78,
        related_incidents: incs.map(i => i.id),
      })
    }
  })

  const flagged = new Set<string>()
  for (let i = 0; i < incidents.length; i++) {
    for (let j = i + 1; j < incidents.length; j++) {
      const a = incidents[i]
      const b = incidents[j]
      const dist = Math.sqrt(Math.pow(a.latitude - b.latitude, 2) + Math.pow(a.longitude - b.longitude, 2))
      const key = [a.id, b.id].sort().join('-')
      if (dist < 0.007 && a.crime_type === b.crime_type && !flagged.has(key)) {
        flagged.add(key)
        suggestions.push({
          id: `geo-${key}`,
          type: 'link',
          title: `Possible Linked Cases — Same Area, Same Crime Type`,
          description: `Incidents ${a.id} and ${b.id} (${a.crime_type}) occurred within ~700m of each other. Suspects ${a.suspect_name} and ${b.suspect_name} may be operating together.`,
          confidence: 72,
          related_incidents: [a.id, b.id],
        })
      }
    }
  }

  suspectMap.forEach((incs, suspect) => {
    if (incs.length >= 3) {
      const sorted = [...incs].sort((a, b) => a.date.localeCompare(b.date))
      const first = sorted[0].severity_score
      const last = sorted[sorted.length - 1].severity_score
      if (last - first >= 3) {
        suggestions.push({
          id: `escalation-${suspect}`,
          type: 'alert',
          title: `Escalating Violence — ${suspect}`,
          description: `${suspect}'s crimes have escalated in severity from ${first}/10 to ${last}/10 over ${incs.length} incidents. High-risk profile — prioritise arrest.`,
          confidence: 88,
          related_incidents: sorted.map(i => i.id),
        })
      }
    }
  })

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10)
}