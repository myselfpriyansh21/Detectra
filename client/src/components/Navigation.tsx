import { useState } from 'react'
import { Network, Link2, Globe2, ClipboardList, FilePlus2, Bot, BarChart3, Lightbulb, ShieldCheck, LogOut, ChevronLeft, MapPin } from 'lucide-react'
import type { ActiveTab } from '../types'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { useDirectory } from '../context/DirectoryContext'
import { jurisdictionLabel } from '../utils/jurisdiction'
import RequestAccessModal from './RequestAccessModal'
import detectraLogo from '../assets/detectra.png'

interface NavigationProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  incidentCount: number
  onGoHome: () => void
  onBack?: () => void
  canGoBack?: boolean
  onOpenAdmin?: () => void
}

const TAB_ICONS: { key: ActiveTab; Icon: typeof Network }[] = [
  { key: 'network',    Icon: Network },
  { key: 'resolution', Icon: Link2 },
  { key: 'map',        Icon: Globe2 },
  { key: 'cases',      Icon: ClipboardList },
  { key: 'addcase',    Icon: FilePlus2 },
  { key: 'assistant',  Icon: Bot },
  { key: 'analytics',  Icon: BarChart3 },
  { key: 'ai',         Icon: Lightbulb },
]

export default function Navigation({ activeTab, onTabChange, incidentCount, onGoHome, onBack, canGoBack, onOpenAdmin }: NavigationProps) {
  const { t } = useLanguage()
  const { user, logout } = useAuth()
  const { currentUserRecord } = useDirectory()
  const [showRequestModal, setShowRequestModal] = useState(false)
  const TABS = TAB_ICONS.map(tab => ({
    ...tab,
    label: tab.key === 'addcase' ? 'Add / Import Case' : t.tabs[tab.key as keyof typeof t.tabs],
  }))

  const navBg       = 'bg-white border-slate-200'
  const navBorder   = 'border-slate-100'
  const textPrimary = 'text-slate-900'
  const textSub     = 'text-slate-500'
  const badgeBg     = 'bg-slate-100'
  const tabInactive = 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'

  const showJurisdiction = user && (user.role === 'Officer' || user.role === 'State Analyst')

  return (
    <nav className={`shrink-0 border-b ${navBg} transition-colors duration-200`}>

      {/* ── Top brand bar ── */}
      <div className={`flex items-center justify-between px-6 py-3 border-b ${navBorder}`}>

        {/* Back + Logo + brand */}
        <div className="flex items-center gap-2">
          {canGoBack && (
            <button onClick={onBack} title="Back"
              className="flex items-center justify-center w-8 h-8 rounded-full transition-colors text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <ChevronLeft size={18} />
            </button>
          )}
          <button onClick={onGoHome}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={detectraLogo} alt="Detectra"
              className="w-10 h-10 object-contain rounded-lg drop-shadow-sm" />
            <div className={`w-px h-9 bg-slate-200`} />
            <div className="text-left">
              <h1 className={`font-black text-lg tracking-widest ${textPrimary}`}>DETECTRA</h1>
              <p className="text-amber-500 text-xs font-semibold tracking-widest uppercase">
                {t.brandTagline}
              </p>
            </div>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">

          {/* Incident counter */}
          <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 ${badgeBg}`}>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className={`text-xs font-medium ${textSub}`}>
              <span className="text-amber-500 font-bold">{incidentCount}</span> {t.cases}
            </span>
          </div>

          {/* Jurisdiction + request access (Officer / State Analyst only) */}
          {showJurisdiction && currentUserRecord && (
            <button onClick={() => setShowRequestModal(true)}
              title="Request expanded jurisdiction access"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-slate-200 hover:border-amber-400 transition-colors text-xs font-medium ${textSub}`}>
              <MapPin size={13} className="text-amber-500" />
              {jurisdictionLabel(currentUserRecord)}
            </button>
          )}

          {/* User badge + admin link + logout */}
          {user && (
            <div className="flex items-center gap-2">
              {user.role === 'Admin' && onOpenAdmin && (
                <button onClick={onOpenAdmin}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors">
                  <ShieldCheck size={14} /> Admin
                </button>
              )}
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${badgeBg}`}>
                <span className={`text-xs font-medium ${textSub}`}>{user.name}</span>
                <span className="text-[10px] font-bold text-amber-500 uppercase">{user.role}</span>
              </div>
              <button onClick={logout} title="Log out"
                className="text-xs font-medium p-1.5 rounded-full transition-colors text-slate-500 hover:text-red-500 hover:bg-slate-100">
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center px-4 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2
              whitespace-nowrap transition-all duration-150 rounded-t-lg
              ${activeTab === tab.key
                ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                : `border-transparent ${tabInactive}`}`}>
            <tab.Icon size={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {showRequestModal && <RequestAccessModal onClose={() => setShowRequestModal(false)} />}
    </nav>
  )
}