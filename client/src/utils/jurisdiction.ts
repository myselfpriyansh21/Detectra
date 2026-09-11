import type { AppUser, Station, CrimeIncident } from '../types'
import { scopeForRank } from '../types'

// ─── Placeholder station hierarchy for the prototype ───
// Station -> District -> Zone. Names are representative, not real
// jurisdictions — swap for real station data before a production
// deployment.
export const STATIONS: Station[] = [
  { id: 'ST-01', name: 'Station Alpha',   district: 'Central District',  zone: 'North Zone' },
  { id: 'ST-02', name: 'Station Beta',    district: 'Central District',  zone: 'North Zone' },
  { id: 'ST-03', name: 'Station Gamma',   district: 'Riverside District', zone: 'North Zone' },
  { id: 'ST-04', name: 'Station Delta',   district: 'Riverside District', zone: 'North Zone' },
  { id: 'ST-05', name: 'Station Epsilon', district: 'Lakeview District',  zone: 'South Zone' },
  { id: 'ST-06', name: 'Station Zeta',    district: 'Lakeview District',  zone: 'South Zone' },
  { id: 'ST-07', name: 'Station Eta',     district: 'Hilltop District',   zone: 'South Zone' },
  { id: 'ST-08', name: 'Station Theta',   district: 'Hilltop District',   zone: 'South Zone' },
]

export function getStation(id?: string): Station | undefined {
  return STATIONS.find(s => s.id === id)
}

export function stationsInDistrict(district: string): Station[] {
  return STATIONS.filter(s => s.district === district)
}

export function stationsInZone(zone: string): Station[] {
  return STATIONS.filter(s => s.zone === zone)
}

/** Station ids visible to a user, given their role/rank/overrides. */
export function visibleStationIds(user: AppUser): string[] | 'all' {
  if (user.role === 'Admin' || user.role === 'National Analyst') return 'all'
  if (user.role === 'Auditor') return []              // auditors see the log, not case data
  if (user.role === 'State Analyst') return stationsInZone(user.region).map(s => s.id)

  // Officer: breadth depends on rank.
  const station = getStation(user.stationId)
  const scope = user.rank ? scopeForRank(user.rank) : 'station'
  let base: string[]
  if (!station) base = []
  else if (scope === 'station') base = stationsInDistrict(station.district).map(s => s.id) // own + neighbouring stations, same district
  else if (scope === 'district') base = stationsInDistrict(station.district).map(s => s.id)
  else if (scope === 'zone') base = stationsInZone(station.zone).map(s => s.id)
  else base = STATIONS.map(s => s.id) // national

  const overrides = user.grantedOverrides ?? []
  if (overrides.length === 0) return base

  // Overrides can grant a whole zone/district by name, or a single station id.
  const overrideStationIds = new Set<string>()
  overrides.forEach(o => {
    if (STATIONS.some(s => s.id === o)) overrideStationIds.add(o)
    else { stationsInDistrict(o).forEach(s => overrideStationIds.add(s.id)); stationsInZone(o).forEach(s => overrideStationIds.add(s.id)) }
  })
  return [...new Set([...base, ...overrideStationIds])]
}

export function canAccessIncident(user: AppUser, incident: CrimeIncident): boolean {
  const visible = visibleStationIds(user)
  if (visible === 'all') return true
  if (!incident.station) return true // legacy/no-station rows stay visible rather than silently vanishing
  return visible.includes(incident.station)
}

export function filterIncidentsForUser(user: AppUser, incidents: CrimeIncident[]): CrimeIncident[] {
  return incidents.filter(i => canAccessIncident(user, i))
}

export function jurisdictionLabel(user: AppUser): string {
  if (user.role === 'Admin' || user.role === 'National Analyst') return 'All-India'
  if (user.role === 'Auditor') return 'Audit log only'
  if (user.role === 'State Analyst') return `${user.region} (all districts)`
  const station = getStation(user.stationId)
  if (!station) return 'Unassigned'
  const scope = user.rank ? scopeForRank(user.rank) : 'station'
  if (scope === 'station' || scope === 'district') return `${station.district} (district-wide)`
  if (scope === 'zone') return `${station.zone} (zone-wide)`
  return 'All-India'
}
