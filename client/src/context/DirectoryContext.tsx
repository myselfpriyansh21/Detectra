import { createContext, useContext, useState, type ReactNode } from 'react'
import type { AppUser, AccessRequest } from '../types'
import { DEMO_USERS } from '../utils/syntheticData'
import { useAuth } from './AuthContext'
import { useAudit } from './AuditContext'

interface DirectoryCtx {
  users: AppUser[]
  addUser: (u: AppUser) => void
  toggleUserActive: (userId: string) => void
  requests: AccessRequest[]
  submitAccessRequest: (reason: string, scopeRequested: string) => void
  resolveAccessRequest: (requestId: string, decision: 'Approved' | 'Denied') => void
  /** Live copy of the signed-in user, including any overrides granted since login. */
  currentUserRecord: AppUser | null
}

const Ctx = createContext<DirectoryCtx>({
  users: [], addUser: () => {}, toggleUserActive: () => {},
  requests: [], submitAccessRequest: () => {}, resolveAccessRequest: () => {},
  currentUserRecord: null,
})

export function DirectoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { logAction } = useAudit()
  const [users, setUsers] = useState<AppUser[]>(DEMO_USERS.map(({ password: _pw, ...u }) => u))
  const [requests, setRequests] = useState<AccessRequest[]>([])

  function addUser(u: AppUser) {
    setUsers(prev => [...prev, u])
  }

  function toggleUserActive(userId: string) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u))
  }

  function submitAccessRequest(reason: string, scopeRequested: string) {
    if (!user) return
    const req: AccessRequest = {
      id: `REQ${requests.length + 1}`, userId: user.id, userName: user.name,
      reason, scopeRequested, status: 'Pending', requestedAt: new Date().toISOString(),
    }
    setRequests(prev => [req, ...prev])
    logAction('REQUEST_ACCESS', `User: ${user.employeeId}`, `Requested access to ${scopeRequested}: ${reason}`)
  }

  function resolveAccessRequest(requestId: string, decision: 'Approved' | 'Denied') {
    const req = requests.find(r => r.id === requestId)
    if (!req) return
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: decision, resolvedAt: new Date().toISOString(), resolvedBy: user?.name } : r))
    if (decision === 'Approved') {
      setUsers(prev => prev.map(u => u.id === req.userId ? { ...u, grantedOverrides: [...(u.grantedOverrides ?? []), req.scopeRequested] } : u))
    }
    logAction('RESOLVE_ACCESS_REQUEST', `Request: ${requestId}`, `${decision} access to ${req.scopeRequested} for ${req.userName}`)
  }

  const currentUserRecord = user ? (users.find(u => u.id === user.id) ?? user) : null

  return (
    <Ctx.Provider value={{ users, addUser, toggleUserActive, requests, submitAccessRequest, resolveAccessRequest, currentUserRecord }}>
      {children}
    </Ctx.Provider>
  )
}

export const useDirectory = () => useContext(Ctx)
