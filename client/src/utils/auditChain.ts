// Demo-mode hash chain for the audit log — mirrors the sha256 trigger in
// supabase/schema.sql (audit_log_hash_chain) so the "Verify Integrity"
// button in the Admin dashboard behaves identically whether the log
// lives in memory (demo mode) or in Postgres.
//
// Not cryptographically hardened by design — it's a client-side
// illustration of tamper-evidence for the prototype demo. The real
// guarantee comes from the append-only trigger + RLS in the schema.

function hash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i)
  }
  // to unsigned hex, padded
  return (h >>> 0).toString(16).padStart(8, '0')
}

export interface ChainableEntry {
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

export function appendToChain(
  chain: ChainableEntry[],
  entry: Omit<ChainableEntry, 'id' | 'prevHash' | 'hash' | 'timestamp'>
): ChainableEntry[] {
  const prevHash = chain.length ? chain[chain.length - 1].hash : 'GENESIS'
  const timestamp = new Date().toISOString()
  const payload = `${prevHash}|${entry.userId}|${entry.action}|${entry.resource}|${entry.details}|${timestamp}`
  const newEntry: ChainableEntry = {
    ...entry,
    id: `A${chain.length + 1}`,
    timestamp,
    prevHash,
    hash: hash(payload),
  }
  return [...chain, newEntry]
}

export interface IntegrityResult {
  valid: boolean
  brokenAtIndex: number | null
}

/** Recomputes every hash in order and checks it against the stored value —
 *  this is what "Verify Integrity" runs live in the Admin dashboard. */
export function verifyChain(chain: ChainableEntry[]): IntegrityResult {
  let prevHash = 'GENESIS'
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i]
    const payload = `${prevHash}|${e.userId}|${e.action}|${e.resource}|${e.details}|${e.timestamp}`
    const recomputed = hash(payload)
    if (recomputed !== e.hash || e.prevHash !== prevHash) {
      return { valid: false, brokenAtIndex: i }
    }
    prevHash = e.hash
  }
  return { valid: true, brokenAtIndex: null }
}
