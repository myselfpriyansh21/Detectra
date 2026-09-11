import { supabase, supabaseConfigured } from './supabase'
import type { CrimeIncident, Evidence } from '../types'

// ── Cases ──

function rowToIncident(r: any): CrimeIncident {
  return {
    id: r.id,
    date: r.date,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    crime_type: r.crime_type,
    severity_score: r.severity_score,
    crime_hour: r.crime_hour,
    suspect_name: r.suspect_name,
    phone_number: r.phone_number ?? undefined,
    vehicle_number: r.vehicle_number ?? undefined,
    gang_affiliation: r.gang_affiliation,
    evidence_found: r.evidence_found,
    case_status: r.case_status,
    station: r.station ?? undefined,
  }
}

function incidentToRow(i: CrimeIncident, userId: string, region: string, department?: string) {
  return {
    id: i.id,
    date: i.date,
    latitude: i.latitude,
    longitude: i.longitude,
    crime_type: i.crime_type,
    severity_score: i.severity_score,
    crime_hour: i.crime_hour,
    suspect_name: i.suspect_name,
    phone_number: i.phone_number ?? null,
    vehicle_number: i.vehicle_number ?? null,
    gang_affiliation: i.gang_affiliation,
    evidence_found: i.evidence_found,
    case_status: i.case_status,
    station: i.station ?? null,
    department: department ?? null,
    region,
    created_by: userId,
  }
}

/** Fetches every case visible to the signed-in user (RLS-scoped by region on the server).
 *  Returns null (not []) when Supabase isn't configured, so callers can fall back to demo data. */
export async function fetchCases(): Promise<CrimeIncident[] | null> {
  if (!supabaseConfigured || !supabase) return null
  const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: true })
  if (error) { console.error('fetchCases failed:', error.message); return null }
  return (data ?? []).map(rowToIncident)
}

export async function insertCase(incident: CrimeIncident, userId: string, region: string, department?: string): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false
  const { error } = await supabase.from('cases').insert(incidentToRow(incident, userId, region, department))
  if (error) { console.error('insertCase failed:', error.message); return false }
  return true
}

export async function insertCasesBulk(incidents: CrimeIncident[], userId: string, region: string, department?: string): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false
  const rows = incidents.map(i => incidentToRow(i, userId, region, department))
  const { error } = await supabase.from('cases').insert(rows)
  if (error) { console.error('insertCasesBulk failed:', error.message); return false }
  return true
}

export async function updateCaseStatus(id: string, status: CrimeIncident['case_status']): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false
  const { error } = await supabase.from('cases').update({ case_status: status }).eq('id', id)
  if (error) { console.error('updateCaseStatus failed:', error.message); return false }
  return true
}

// ── Evidence ──

function rowToEvidence(r: any): Evidence {
  return {
    id: r.id,
    caseId: r.case_id,
    type: r.type,
    department: r.department,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
    notes: r.notes ?? '',
    fields: r.fields ?? {},
    fileName: r.file_name ?? undefined,
    fileDataUrl: r.file_data_url ?? undefined,
  }
}

export async function fetchEvidence(): Promise<Evidence[] | null> {
  if (!supabaseConfigured || !supabase) return null
  const { data, error } = await supabase.from('evidence').select('*').order('created_at', { ascending: true })
  if (error) { console.error('fetchEvidence failed:', error.message); return null }
  return (data ?? []).map(rowToEvidence)
}

export async function insertEvidence(ev: Evidence, userId: string, region: string): Promise<boolean> {
  if (!supabaseConfigured || !supabase) return false
  const { error } = await supabase.from('evidence').insert({
    id: ev.id,
    case_id: ev.caseId,
    type: ev.type,
    department: ev.department,
    uploaded_by: ev.uploadedBy,
    notes: ev.notes,
    fields: ev.fields,
    file_name: ev.fileName ?? null,
    file_data_url: ev.fileDataUrl ?? null,
    region,
    created_by: userId,
  })
  if (error) { console.error('insertEvidence failed:', error.message); return false }
  return true
}