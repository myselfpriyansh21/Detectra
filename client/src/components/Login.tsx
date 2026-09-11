import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import detectraLogo from '../assets/detectra.png'

export default function Login() {
  const { login } = useAuth()
  const { isDark } = useTheme()
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const res = await login(employeeId.trim(), password)
    setSubmitting(false)
    if (!res.success) setError(res.error ?? 'Login failed')
  }

  const bg = isDark ? 'bg-slate-950' : 'bg-slate-100'
  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
  const input = isDark
    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500'
    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
  const label = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`min-h-screen w-full flex items-center justify-center ${bg} px-4`}>
      <div className={`w-full max-w-sm rounded-2xl border shadow-xl p-8 ${card}`}>
        <div className="flex flex-col items-center mb-6">
          <img src={detectraLogo} alt="Detectra" className="w-14 h-14 rounded-xl object-contain shadow mb-3" />
          <h1 className={`font-black text-xl tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>DETECTRA</h1>
          <p className="text-amber-500 text-xs font-semibold tracking-widest uppercase mt-1">
            AI-Powered Criminal Network Analysis
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-medium mb-1 ${label}`}>Employee ID</label>
            <input
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              placeholder="e.g. ADMIN001"
              autoComplete="username"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${input}`}
              required
            />
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${label}`}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${input}`}
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold text-sm transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
