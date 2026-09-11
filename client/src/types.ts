// ─── Investigator-facing operational types (case data model) ───

export type ActiveTab = 'network' | 'resolution' | 'map' | 'cases' | 'addcase' | 'assistant' | 'analytics' | 'ai'

export interface CrimeIncident {
  id: string
  date: string
  latitude: number
  longitude: number
  crime_type: string
  severity_score: number
  crime_hour: number
  suspect_name: string
  phone_number?: string
  vehicle_number?: string
  gang_affiliation: string
  evidence_found: string
  case_status: 'Open' | 'Under Investigation' | 'Closed'
  station?: string
}

export interface Hotspot {
  cluster_id: number
  center_lat: number
  center_lon: number
  incident_count: number
  avg_severity: number
}

export interface CaseOfficer {
  incidentId: string
  officerName: string
  badgeNumber: string
  assignedDate: string
}

export interface CaseImage {
  incidentId: string
  imageType: 'suspect' | 'evidence' | 'crime_scene'
  dataUrl: string
  label: string
}

export type SuggestionType = 'alert' | 'pattern' | 'link'

export interface AISuggestion {
  id: string
  type: SuggestionType
  title: string
  description: string
  confidence: number
  related_incidents: string[]
}

export type NodeType = 'Suspect' | 'Gang' | 'Crime Scene' | 'Evidence'

export interface NetworkNode {
  id: string
  label: string
  type: NodeType
}

export interface NetworkEdge {
  source: string
  target: string
  relationship: string
}

// ─── Multi-source knowledge-graph model (PS-189 core) ───

export type EntityType = 'Person' | 'Phone' | 'Vehicle' | 'Location' | 'Organization' | 'Account'
export type SourceType = 'FIR' | 'CDR' | 'Financial' | 'Surveillance' | 'Social' | 'Criminal'

export interface Entity {
  id: string; type: EntityType; name: string
  aliases: string[]; attributes: Record<string, string>
  sources: SourceType[]; community: number; pageRank: number
}

export interface Relationship {
  id: string; source: string; target: string
  type: string; weight: number; timestamp: string
  sourceDoc: string; verified: boolean
}

export interface GraphNode extends Entity { val: number; color: string; x?: number; y?: number }
export interface GraphLink { source: string; target: string; type: string; weight: number; sourceDoc: string }

export interface UploadedSource {
  id: string; type: SourceType; name: string
  uploadedAt: string; entityCount: number; relCount: number
}

// ─── Auth / role-based access ───

export type UserRole = 'Admin' | 'National Analyst' | 'State Analyst' | 'Officer' | 'Auditor'

// ─── Police rank ladder — determines jurisdiction breadth for Officers ───
export type Rank = 'Constable' | 'Head Constable' | 'Sub-Inspector' | 'Inspector' | 'DSP' | 'SP' | 'IG' | 'Director'

export type JurisdictionScope = 'station' | 'district' | 'zone' | 'national'

export function scopeForRank(rank: Rank): JurisdictionScope {
  switch (rank) {
    case 'Constable':
    case 'Head Constable': return 'station'
    case 'Sub-Inspector':
    case 'Inspector': return 'district'
    case 'DSP':
    case 'SP': return 'zone'
    case 'IG':
    case 'Director': return 'national'
  }
}

export interface Station {
  id: string
  name: string
  district: string
  zone: string
}

export type Department = 'Local Police' | 'Cyber Cell' | 'Financial Intelligence Unit' | 'Surveillance Unit' | 'Intelligence Agency'

export interface AppUser {
  id: string
  employeeId: string
  name: string
  role: UserRole
  organization: string
  region: string
  department: Department
  rank?: Rank            // only meaningful for role === 'Officer'
  stationId?: string      // only meaningful for role === 'Officer'
  phone?: string
  photoDataUrl?: string
  isActive: boolean
  createdAt: string
  grantedOverrides?: string[]   // extra station/district/zone ids approved via access requests
}

// ─── Access requests: officer asks Admin for broader jurisdiction ───
export interface AccessRequest {
  id: string
  userId: string
  userName: string
  reason: string
  scopeRequested: string       // a station/district/zone name, or "All-India"
  status: 'Pending' | 'Approved' | 'Denied'
  requestedAt: string
  resolvedAt?: string
  resolvedBy?: string
}

// ─── Evidence — attached to a case, structured by type ───
export type EvidenceType = 'CDR' | 'Financial' | 'Physical' | 'Digital' | 'Document' | 'Photo'

export interface Evidence {
  id: string
  caseId: string
  type: EvidenceType
  department: Department
  uploadedBy: string
  createdAt: string
  notes: string
  fields: Record<string, string>   // type-specific structured fields
  fileName?: string
  fileDataUrl?: string
}

// ─── Admin: audit + access control ───

export interface AuditEntry {
  id: string
  userId: string
  userName: string
  action: string
  resource: string
  timestamp: string
  details: string
  prevHash: string
  hash: string
}

export interface DataSourceAccess {
  role: UserRole
  sources: SourceType[]
  regions: string[]
}
