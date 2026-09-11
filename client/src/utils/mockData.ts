import type { CrimeIncident } from '../types'

export const SAMPLE_CSV = `id,date,latitude,longitude,crime_type,severity_score,crime_hour,suspect_name,phone_number,vehicle_number,gang_affiliation,evidence_found,case_status,station
INC001,2024-01-03,28.6315,77.2167,Chain Snatching,7,22,Ravi Kumar,9845600001,DL-05-NB-5678,Kabir Gang,Gold Chain,Open,ST-01
INC002,2024-01-05,19.0596,72.8295,Burglary,8,2,Salim Sheikh,7760912345,MH-12-AB-3456,Shadow Syndicate,Crowbar,Under Investigation,ST-02
INC003,2024-01-07,12.9352,77.6245,Assault,5,21,Ravi Kumar,9845600001,DL-05-NB-5678,Kabir Gang,Knife,Open,ST-03
INC004,2024-01-09,17.4156,78.4347,Vehicle Theft,6,3,Arjun Nair,9901234567,KA-09-CD-7890,Iron Fist Crew,Stolen Vehicle Plates,Closed,ST-04
INC005,2024-01-11,22.5726,88.4171,Chain Snatching,9,23,Salim Sheikh,7760912345,MH-12-AB-3456,Shadow Syndicate,CCTV Footage,Open,ST-05
INC006,2024-01-13,28.6519,77.1909,Burglary,7,1,Mohammed Raza,9871122334,TS-08-EF-2468,Kabir Gang,Fingerprints,Under Investigation,ST-06
INC007,2024-01-15,13.0850,80.2101,Assault,8,20,Arjun Nair,9901234567,KA-09-CD-7890,Iron Fist Crew,Blood Sample,Open,ST-07
INC008,2024-01-17,12.9698,77.7499,Vehicle Theft,5,4,Ravi Kumar,9845600001,DL-05-NB-5678,Kabir Gang,Stolen Vehicle Plates,Closed,ST-08
INC009,2024-01-19,19.1136,72.8697,Chain Snatching,6,22,Vikram Singh,8899001122,WB-14-GH-1357,Silver Cobra,Gold Necklace,Open,ST-01
INC010,2024-01-21,17.4399,78.4983,Burglary,9,3,Salim Sheikh,7760912345,MH-12-AB-3456,Shadow Syndicate,9mm Pistol,Under Investigation,ST-02
INC011,2024-01-23,28.5921,77.0460,Assault,7,21,Mohammed Raza,9871122334,TS-08-EF-2468,Kabir Gang,Switchblade,Open,ST-03
INC012,2024-01-25,22.5535,88.3510,Vehicle Theft,8,2,Vikram Singh,8899001122,WB-14-GH-1357,Silver Cobra,Stolen Vehicle Plates,Closed,ST-04
INC013,2024-01-27,12.9784,77.6408,Chain Snatching,5,23,Arjun Nair,9901234567,KA-09-CD-7890,Iron Fist Crew,CCTV Footage,Open,ST-05
INC014,2024-01-29,19.0176,72.8562,Burglary,6,1,Ravi Kumar,9845600001,DL-05-NB-5678,Kabir Gang,Crowbar,Under Investigation,ST-06
INC015,2024-02-01,13.0418,80.2341,Assault,9,20,Salim Sheikh,7760912345,MH-12-AB-3456,Shadow Syndicate,.38 Caliber Revolver,Open,ST-07
INC016,2024-02-03,17.4401,78.3489,Vehicle Theft,7,3,Mohammed Raza,9871122334,TS-08-EF-2468,Kabir Gang,Stolen Vehicle Plates,Closed,ST-08
INC017,2024-02-05,12.8457,77.6602,Chain Snatching,8,22,Vikram Singh,8899001122,WB-14-GH-1357,Silver Cobra,Gold Bracelet,Open,ST-01
INC018,2024-02-07,28.7495,77.0565,Burglary,5,2,Arjun Nair,9901234567,KA-09-CD-7890,Iron Fist Crew,Fingerprints,Under Investigation,ST-02
INC019,2024-02-09,22.5958,88.2636,Assault,6,21,Ravi Kumar,9845600001,DL-05-NB-5678,Kabir Gang,Knife,Open,ST-03
INC020,2024-02-11,19.2307,72.8567,Vehicle Theft,9,4,Salim Sheikh,7760912345,MH-12-AB-3456,Shadow Syndicate,CCTV Footage,Closed,ST-04
INC021,2024-02-13,17.4849,78.4138,Chain Snatching,7,23,Mohammed Raza,9871122334,TS-08-EF-2468,Kabir Gang,Gold Chain,Open,ST-05
INC022,2024-02-15,12.9791,80.2213,Burglary,8,1,Vikram Singh,8899001122,WB-14-GH-1357,Silver Cobra,Crowbar,Under Investigation,ST-06
INC023,2024-02-17,22.4989,88.3145,Assault,5,20,Arjun Nair,9901234567,KA-09-CD-7890,Iron Fist Crew,Blood Sample,Open,ST-07
INC024,2024-02-19,13.0012,80.2565,Vehicle Theft,6,3,Ravi Kumar,9845600001,DL-05-NB-5678,Kabir Gang,Stolen Vehicle Plates,Closed,ST-08
INC025,2024-02-21,28.6315,77.2167,Chain Snatching,9,22,Salim Sheikh,7760912345,MH-12-AB-3456,Shadow Syndicate,9mm Pistol,Open,ST-01
INC026,2024-02-23,19.0596,72.8295,Burglary,7,2,Mohammed Raza,9871122334,TS-08-EF-2468,Kabir Gang,Fingerprints,Under Investigation,ST-02
INC027,2024-02-25,12.9352,77.6245,Assault,8,21,Vikram Singh,8899001122,WB-14-GH-1357,Silver Cobra,Switchblade,Open,ST-03
INC028,2024-02-27,17.4156,78.4347,Vehicle Theft,5,4,Arjun Nair,9901234567,KA-09-CD-7890,Iron Fist Crew,Stolen Vehicle Plates,Closed,ST-04
INC029,2024-03-01,22.5726,88.4171,Chain Snatching,6,23,Ravi Kumar,9845600001,DL-05-NB-5678,Kabir Gang,CCTV Footage,Open,ST-05
INC030,2024-03-03,28.6519,77.1909,Burglary,9,1,Salim Sheikh,7760912345,MH-12-AB-3456,Shadow Syndicate,.38 Caliber Revolver,Under Investigation,ST-06
INC031,2024-03-05,12.9352,77.6245,Chain Snatching,7,22,R. Kumar,9845600001,DL-05-NB-5678,Unknown,Gold Chain,Open,ST-07
INC032,2024-03-07,28.6519,77.1909,Burglary,6,2,Ravi K,9845600001,Unknown,Unknown,Crowbar,Open,ST-08`

export function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'detectra_sample_crime_data.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function loadSampleData(): CrimeIncident[] {
  return parseCSVText(SAMPLE_CSV)
}

// ─── Financial & social media fraud dataset ───
// The core street-crime dataset above demonstrates multi-source fusion
// generally; this set specifically demonstrates the PS-189 "financial
// channels / communication links" angle — UPI/bank fraud and social
// media impersonation rings, the kind of case Cyber Cell and the
// Financial Intelligence Unit actually work.
export const FRAUD_SAMPLE_CSV = `id,date,latitude,longitude,crime_type,severity_score,crime_hour,suspect_name,phone_number,vehicle_number,gang_affiliation,evidence_found,case_status,station
FRD001,2025-03-02,28.6315,77.2167,Financial Fraud,8,11,Deepak Malhotra,9811022334,Unknown,Silver Circuit Ring,UPI transaction logs,Open,ST-01
FRD002,2025-03-04,19.0596,72.8295,Financial Fraud,9,15,Deepak Malhotra,9811022334,Unknown,Silver Circuit Ring,Fake KYC documents,Under Investigation,ST-02
FRD003,2025-03-06,12.9352,77.6245,Financial Fraud,7,10,Neha Kapoor,9900112233,Unknown,Silver Circuit Ring,Bank statement — Bank C,Open,ST-03
FRD004,2025-03-09,17.4156,78.4347,Financial Fraud,8,13,Sunil Bhargava,9845098450,Unknown,Unknown,Investment app screenshots,Under Investigation,ST-05
FRD005,2025-03-11,22.5726,88.4171,Financial Fraud,6,9,Neha Kapoor,9900112233,Unknown,Silver Circuit Ring,Call recording transcript,Open,ST-06
FRD006,2025-03-13,13.0850,80.2101,Social Media Fraud,7,20,Rohit Ahluwalia,9871234455,Unknown,Unknown,Fake profile screenshots,Open,ST-04
FRD007,2025-03-15,28.6519,77.1909,Social Media Fraud,9,22,Priya Malhotra,9012345678,Unknown,Unknown,Chat log export,Under Investigation,ST-01
FRD008,2025-03-17,19.1136,72.8697,Social Media Fraud,6,19,Rohit Ahluwalia,9871234455,Unknown,Unknown,Screenshot — impersonation profile,Open,ST-07
FRD009,2025-03-19,12.9698,77.7499,Social Media Fraud,8,23,Ayesha Farooqui,9765432109,Unknown,Unknown,Payment app transfer receipt,Open,ST-08
FRD010,2025-03-21,17.4399,78.4983,Social Media Fraud,7,21,Priya Malhotra,9012345678,Unknown,Unknown,Extortion message screenshots,Under Investigation,ST-02`

export function loadFraudData(): CrimeIncident[] {
  return parseCSVText(FRAUD_SAMPLE_CSV)
}

// ─── Seed evidence for the fraud dataset ───
// Structured entries matching the same schema the Evidence form produces,
// so these cases start with real CDR / Financial / Digital evidence
// attached rather than an empty panel — useful for a live demo.
export const FRAUD_SEED_EVIDENCE: Omit<import('../types').Evidence, 'id'>[] = [
  {
    caseId: 'FRD001', type: 'Financial', department: 'Financial Intelligence Unit',
    uploadedBy: 'S. Reddy', createdAt: '2025-03-02T11:20:00.000Z',
    notes: 'Victim transferred funds via UPI to a mule account after a fake customer-support call.',
    fields: { senderAccount: 'Acct-XXXX2210', receiverAccount: 'Acct-XXXX9981', amount: '48500', timestamp: '2025-03-02 11:05', bank: 'Bank C', transactionType: 'UPI' },
  },
  {
    caseId: 'FRD001', type: 'CDR', department: 'Cyber Cell',
    uploadedBy: 'A. Verma', createdAt: '2025-03-02T12:00:00.000Z',
    notes: 'Call from spoofed bank support number just before the transfer.',
    fields: { callerNumber: '9811022334', receiverNumber: 'Victim (withheld)', timestamp: '2025-03-02 10:58', durationSeconds: '312', towerId: 'TWR-north-021' },
  },
  {
    caseId: 'FRD002', type: 'Document', department: 'Financial Intelligence Unit',
    uploadedBy: 'S. Reddy', createdAt: '2025-03-04T09:40:00.000Z',
    notes: 'Forged Aadhaar/PAN used to open the mule account.',
    fields: { label: 'Fake KYC bundle — mule account opening' },
    fileName: 'kyc_bundle_scan.pdf',
  },
  {
    caseId: 'FRD003', type: 'Financial', department: 'Financial Intelligence Unit',
    uploadedBy: 'S. Reddy', createdAt: '2025-03-06T10:15:00.000Z',
    notes: 'Layered transfer chain — funds moved through 3 accounts within 40 minutes.',
    fields: { senderAccount: 'Acct-XXXX9981', receiverAccount: 'Acct-XXXX3345', amount: '48500', timestamp: '2025-03-06 10:10', bank: 'Bank D', transactionType: 'IMPS' },
  },
  {
    caseId: 'FRD004', type: 'Digital', department: 'Cyber Cell',
    uploadedBy: 'A. Verma', createdAt: '2025-03-09T13:20:00.000Z',
    notes: 'Fraudulent investment app — not listed with SEBI, disappeared after payout requests.',
    fields: { label: 'Investment app screenshots + fake returns dashboard', source: 'Android app sideload' },
  },
  {
    caseId: 'FRD006', type: 'Digital', department: 'Cyber Cell',
    uploadedBy: 'A. Verma', createdAt: '2025-03-13T20:30:00.000Z',
    notes: 'Profile used a stolen photoset; account created 4 days before contacting the victim.',
    fields: { label: 'Fake dating profile — "Rohit A." persona', source: 'Instagram' },
  },
  {
    caseId: 'FRD007', type: 'Digital', department: 'Cyber Cell',
    uploadedBy: 'A. Verma', createdAt: '2025-03-15T22:10:00.000Z',
    notes: 'Full chat export showing escalation from friendly contact to extortion demand.',
    fields: { label: 'WhatsApp chat export', source: 'WhatsApp' },
    fileName: 'chat_export_FRD007.pdf',
  },
  {
    caseId: 'FRD009', type: 'Financial', department: 'Financial Intelligence Unit',
    uploadedBy: 'S. Reddy', createdAt: '2025-03-19T23:05:00.000Z',
    notes: 'Victim paid to a linked wallet after threat of image leak.',
    fields: { senderAccount: 'Victim wallet (withheld)', receiverAccount: 'Acct-XXXX7712', amount: '15000', timestamp: '2025-03-19 22:55', bank: 'Wallet Provider', transactionType: 'Wallet transfer' },
  },
]


export function parseCSVText(text: string): CrimeIncident[] {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map((line, idx) => {
    const values = line.split(',').map(v => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return {
      id: row.id || `INC${String(idx + 1).padStart(3, '0')}`,
      date: row.date || '',
      // Fallback center is India's geographic centroid, not any one city —
      // used only when a row's coordinates are missing/unparseable.
      latitude: parseFloat(row.latitude) || 22.3511,
      longitude: parseFloat(row.longitude) || 78.6677,
      crime_type: row.crime_type || 'Unknown',
      severity_score: parseInt(row.severity_score) || 5,
      crime_hour: parseInt(row.crime_hour) || 12,
      suspect_name: row.suspect_name || 'Unknown',
      phone_number: row.phone_number || undefined,
      vehicle_number: row.vehicle_number || undefined,
      gang_affiliation: row.gang_affiliation || 'Unknown',
      evidence_found: row.evidence_found || 'None',
      case_status: (row.case_status as CrimeIncident['case_status']) || 'Open',
      station: row.station || undefined,
    }
  })
}