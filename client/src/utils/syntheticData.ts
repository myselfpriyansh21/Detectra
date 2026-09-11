import type { AppUser, Entity, Relationship, GraphNode, GraphLink, DataSourceAccess } from '../types'
import { appendToChain, type ChainableEntry } from './auditChain'

// ─── Demo users (offline / no-Supabase mode) ───
// Region labels are generic zones, not a specific state — PS-189 is a
// national NCRB system, so no single state is used as the platform's
// identity or default framing.
export const DEMO_USERS: (AppUser & { password: string })[] = [
  { id: 'U0', employeeId: 'ADMIN001', password: 'Admin@123',   name: 'Admin Superintendent', role: 'Admin',            organization: 'NCRB',        region: 'All-India',  department: 'Local Police',                  isActive: true, createdAt: '2025-01-01' },
  { id: 'U1', employeeId: 'NCRB1042', password: 'Analyst@123', name: 'R. Sharma',            role: 'National Analyst', organization: 'NCRB',        region: 'All-India',  department: 'Intelligence Agency',           isActive: true, createdAt: '2025-01-10' },
  { id: 'U2', employeeId: 'ZNE2055',  password: 'State@123',   name: 'S. Reddy',             role: 'State Analyst',    organization: 'State CID',   region: 'South Zone', department: 'Financial Intelligence Unit',   isActive: true, createdAt: '2025-01-10' },
  { id: 'U3', employeeId: 'OFC3017',  password: 'Officer@123', name: 'K. Gowda',             role: 'Officer',          organization: 'State Police', region: 'North Zone', department: 'Local Police', rank: 'Inspector', stationId: 'ST-01', isActive: true, createdAt: '2025-02-01' },
  { id: 'U5', employeeId: 'CYB4021',  password: 'Cyber@123',   name: 'A. Verma',             role: 'Officer',          organization: 'Cyber Cell',   region: 'South Zone', department: 'Cyber Cell', rank: 'Sub-Inspector', stationId: 'ST-05', isActive: true, createdAt: '2025-02-10' },
  { id: 'U6', employeeId: 'SPZ5090',  password: 'Senior@123',  name: 'M. Iyer',              role: 'Officer',          organization: 'State Police', region: 'South Zone', department: 'Local Police', rank: 'SP', stationId: 'ST-05', isActive: true, createdAt: '2025-02-12' },
  { id: 'U4', employeeId: 'AUD4001',  password: 'Audit@123',   name: 'P. Nair',              role: 'Auditor',          organization: 'NCRB',        region: 'All-India',  department: 'Local Police',                  isActive: true, createdAt: '2025-02-15' },
]

// ─── Default data-source / region access grants per role ───
export const DEFAULT_ACCESS_GRANTS: DataSourceAccess[] = [
  { role: 'Admin',            sources: ['FIR', 'CDR', 'Financial', 'Surveillance', 'Social', 'Criminal'], regions: ['All-India'] },
  { role: 'National Analyst', sources: ['FIR', 'CDR', 'Financial', 'Surveillance', 'Social', 'Criminal'], regions: ['All-India'] },
  { role: 'State Analyst',    sources: ['FIR', 'CDR', 'Financial', 'Criminal'],                            regions: ['South Zone'] },
  { role: 'Officer',          sources: ['FIR', 'CDR', 'Criminal'],                                          regions: ['North Zone'] },
  { role: 'Auditor',          sources: [],                                                                  regions: ['All-India'] },
]

// ─── Demo criminal network (multi-source fusion example) ───
export const DEMO_ENTITIES: Entity[] = [
  { id: 'P1', type: 'Person',        name: 'Ravi Kumar',       aliases: ['Tiger', 'R.Kumar'],     attributes: { age: '34', role: 'Leader' },   sources: ['FIR', 'CDR', 'Criminal'], community: 0, pageRank: 0.28 },
  { id: 'P2', type: 'Person',        name: 'Salim Sheikh',     aliases: ['Bhai'],                 attributes: { age: '29', role: 'Associate' }, sources: ['FIR', 'Financial'],       community: 0, pageRank: 0.19 },
  { id: 'P3', type: 'Person',        name: 'Arjun Nair',       aliases: ['AJ'],                   attributes: { age: '26', role: 'Runner' },    sources: ['CDR', 'Surveillance'],    community: 1, pageRank: 0.12 },
  { id: 'P4', type: 'Person',        name: 'Mohammed Raza',    aliases: ['Mamu'],                 attributes: { age: '38', role: 'Financer' },  sources: ['Financial', 'Criminal'],  community: 1, pageRank: 0.21 },
  { id: 'P5', type: 'Person',        name: 'Vikram Singh',     aliases: ['Vicky'],                attributes: { age: '31', role: 'Associate' }, sources: ['CDR', 'FIR'],             community: 2, pageRank: 0.09 },
  { id: 'PH1', type: 'Phone',        name: '98456XXXX1',       aliases: [],                       attributes: { carrier: 'Airtel' },            sources: ['CDR'],                    community: 0, pageRank: 0.15 },
  { id: 'PH2', type: 'Phone',        name: '77609XXXX5',       aliases: [],                       attributes: { carrier: 'Jio' },               sources: ['CDR'],                    community: 0, pageRank: 0.11 },
  { id: 'PH3', type: 'Phone',        name: '99012XXXX7',       aliases: [],                       attributes: { carrier: 'Vi' },                sources: ['CDR'],                    community: 1, pageRank: 0.08 },
  { id: 'V1',  type: 'Vehicle',      name: 'XX-05-NB-5678',    aliases: ['Maruti Swift White'],   attributes: { model: 'Maruti Swift' },        sources: ['FIR', 'Surveillance'],    community: 0, pageRank: 0.10 },
  { id: 'V2',  type: 'Vehicle',      name: 'XX-12-AB-3456',    aliases: [],                       attributes: { model: 'Honda City' },          sources: ['Surveillance'],           community: 1, pageRank: 0.06 },
  { id: 'L1',  type: 'Location',     name: 'Flyover Junction', aliases: [],                       attributes: { type: 'Hotspot' },              sources: ['FIR', 'Surveillance'],    community: 0, pageRank: 0.13 },
  { id: 'L2',  type: 'Location',     name: 'City ATM Cluster', aliases: [],                       attributes: { type: 'ATM' },                  sources: ['CDR', 'Financial'],       community: 0, pageRank: 0.09 },
  { id: 'L3',  type: 'Location',     name: 'Safe House',       aliases: [],                       attributes: { type: 'Hideout' },              sources: ['Surveillance'],           community: 2, pageRank: 0.07 },
  { id: 'O1',  type: 'Organization', name: 'Kabir Gang',       aliases: ['KG', 'The Network'],    attributes: { strength: '15 members' },       sources: ['FIR', 'Criminal'],        community: 0, pageRank: 0.22 },
  { id: 'A1',  type: 'Account',      name: 'Acct-XXXX4417',    aliases: [],                       attributes: { bank: 'Bank A' },               sources: ['Financial'],              community: 1, pageRank: 0.08 },
  { id: 'A2',  type: 'Account',      name: 'Acct-XXXX7823',    aliases: [],                       attributes: { bank: 'Bank B' },               sources: ['Financial'],              community: 1, pageRank: 0.07 },
]

export const DEMO_RELATIONSHIPS: Relationship[] = [
  { id: 'R1',  source: 'P1', target: 'O1',  type: 'leads',          weight: 5, timestamp: '2025-01-03', sourceDoc: 'FIR-0142/2025', verified: true },
  { id: 'R2',  source: 'P2', target: 'O1',  type: 'member_of',      weight: 4, timestamp: '2025-01-05', sourceDoc: 'FIR-0143/2025', verified: true },
  { id: 'R3',  source: 'P3', target: 'O1',  type: 'associate',      weight: 2, timestamp: '2025-01-07', sourceDoc: 'CDR-Jan-2025',  verified: false },
  { id: 'R4',  source: 'P4', target: 'O1',  type: 'finances',       weight: 5, timestamp: '2025-01-09', sourceDoc: 'FIN-2025-01',   verified: true },
  { id: 'R5',  source: 'P1', target: 'PH1', type: 'uses',           weight: 5, timestamp: '2025-01-03', sourceDoc: 'CDR-Jan-2025',  verified: true },
  { id: 'R6',  source: 'P2', target: 'PH2', type: 'uses',           weight: 4, timestamp: '2025-01-05', sourceDoc: 'CDR-Jan-2025',  verified: true },
  { id: 'R7',  source: 'P3', target: 'PH3', type: 'uses',           weight: 3, timestamp: '2025-01-07', sourceDoc: 'CDR-Jan-2025',  verified: false },
  { id: 'R8',  source: 'PH1', target: 'PH2', type: 'called',        weight: 8, timestamp: '2025-01-11', sourceDoc: 'CDR-Jan-2025',  verified: true },
  { id: 'R9',  source: 'PH1', target: 'PH3', type: 'called',        weight: 3, timestamp: '2025-01-15', sourceDoc: 'CDR-Jan-2025',  verified: false },
  { id: 'R10', source: 'P1', target: 'V1',  type: 'drives',         weight: 5, timestamp: '2025-01-03', sourceDoc: 'FIR-0142/2025', verified: true },
  { id: 'R11', source: 'P3', target: 'V2',  type: 'drives',         weight: 3, timestamp: '2025-01-15', sourceDoc: 'SURV-2025-01',  verified: false },
  { id: 'R12', source: 'P1', target: 'L1',  type: 'spotted_at',     weight: 5, timestamp: '2025-01-03', sourceDoc: 'FIR-0142/2025', verified: true },
  { id: 'R13', source: 'P2', target: 'L2',  type: 'spotted_at',     weight: 4, timestamp: '2025-01-05', sourceDoc: 'CDR-Jan-2025',  verified: true },
  { id: 'R14', source: 'P3', target: 'L3',  type: 'operates_from',  weight: 3, timestamp: '2025-01-19', sourceDoc: 'SURV-2025-01',  verified: false },
  { id: 'R15', source: 'P4', target: 'A1',  type: 'controls',       weight: 5, timestamp: '2025-01-09', sourceDoc: 'FIN-2025-01',   verified: true },
  { id: 'R16', source: 'P4', target: 'A2',  type: 'controls',       weight: 4, timestamp: '2025-01-09', sourceDoc: 'FIN-2025-01',   verified: true },
  { id: 'R17', source: 'A1', target: 'A2',  type: 'transferred_to', weight: 3, timestamp: '2025-01-12', sourceDoc: 'FIN-2025-01',   verified: true },
  { id: 'R18', source: 'P5', target: 'P1',  type: 'reports_to',     weight: 3, timestamp: '2025-01-17', sourceDoc: 'CDR-Jan-2025',  verified: false },
  { id: 'R19', source: 'P5', target: 'L3',  type: 'spotted_at',     weight: 2, timestamp: '2025-01-19', sourceDoc: 'SURV-2025-01',  verified: false },
  { id: 'R20', source: 'V1', target: 'L1',  type: 'seen_at',        weight: 5, timestamp: '2025-01-03', sourceDoc: 'FIR-0142/2025', verified: true },
]

const COMMUNITY_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899']
const TYPE_COLORS: Record<string, string> = {
  Person: '#EF4444', Phone: '#3B82F6', Vehicle: '#22C55E',
  Location: '#F59E0B', Organization: '#8B5CF6', Account: '#EC4899',
}

export function toGraphData(entities: Entity[], relationships: Relationship[], colorBy: 'type' | 'community' = 'community') {
  const nodes: GraphNode[] = entities.map(e => ({
    ...e,
    val: 2 + e.pageRank * 40,
    color: colorBy === 'community' ? COMMUNITY_COLORS[e.community % COMMUNITY_COLORS.length] : TYPE_COLORS[e.type] ?? '#94A3B8',
  }))
  const links: GraphLink[] = relationships.map(r => ({ source: r.source, target: r.target, type: r.type, weight: r.weight, sourceDoc: r.sourceDoc }))
  return { nodes, links }
}

// ─── Seed audit log, built through the same hash chain used live ───
function seedAuditLog(): ChainableEntry[] {
  let chain: ChainableEntry[] = []
  const seed: Array<[string, string, string, string, string]> = [
    ['U1', 'R. Sharma', 'LOGIN', 'System', 'Login from national analyst workstation'],
    ['U1', 'R. Sharma', 'UPLOAD_DATA', 'FIR-0142/2025', 'Uploaded FIR text — 3 entities extracted'],
    ['U3', 'K. Gowda', 'VIEW_PROFILE', 'Entity: P1', 'Viewed suspect profile: Ravi Kumar'],
    ['U3', 'K. Gowda', 'UPLOAD_DATA', 'CDR-Jan-2025', 'Uploaded CDR CSV — 8 call records processed'],
    ['U2', 'S. Reddy', 'SEARCH', 'Entity Search', 'Search query: "XX-05-NB-5678"'],
    ['U1', 'R. Sharma', 'VERIFY_LINK', 'Relationship R8', 'Verified call link: PH1 -> PH2'],
    ['U2', 'S. Reddy', 'UPLOAD_DATA', 'FIN-2025-01', 'Uploaded financial CSV — 4 accounts, 2 transfers'],
    ['U3', 'K. Gowda', 'GENERATE_REPORT', 'Investigation-01', 'Generated report for case INV-001'],
    ['U1', 'R. Sharma', 'LOGIN', 'System', 'Login from national analyst workstation'],
    ['U2', 'S. Reddy', 'FLAG_ANOMALY', 'Entity: P4', 'Flagged Mohammed Raza for unusual financial activity'],
  ]
  for (const [userId, userName, action, resource, details] of seed) {
    chain = appendToChain(chain, { userId, userName, action, resource, details })
  }
  return chain
}

export const DEMO_AUDIT_LOG: ChainableEntry[] = seedAuditLog()
