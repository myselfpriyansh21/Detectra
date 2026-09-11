import { useTheme } from '../context/ThemeContext'
import type { AISuggestion, SuggestionType } from '../types'

const TYPE_CONFIG: Record<SuggestionType, {
  icon: string
  colorDark: string; colorLight: string
  bgDark: string; bgLight: string
  label: string
}> = {
  alert:   { icon: '🚨', colorDark: 'text-red-400',    colorLight: 'text-red-600',    bgDark: 'bg-red-900/30 border-red-800',       bgLight: 'bg-red-50 border-red-200',       label: 'ALERT' },
  pattern: { icon: '📊', colorDark: 'text-yellow-400', colorLight: 'text-yellow-700', bgDark: 'bg-yellow-900/30 border-yellow-800', bgLight: 'bg-yellow-50 border-yellow-200', label: 'PATTERN' },
  link:    { icon: '🔗', colorDark: 'text-blue-400',   colorLight: 'text-blue-600',   bgDark: 'bg-blue-900/30 border-blue-800',     bgLight: 'bg-blue-50 border-blue-200',     label: 'LINK' },
}

export default function AISuggestions({ suggestions, totalIncidents }: { suggestions: AISuggestion[]; totalIncidents: number }) {
  const { isDark } = useTheme()

  const pageBg      = isDark ? 'bg-slate-950' : 'bg-brand-bg'
  const titleColor  = isDark ? 'text-white' : 'text-slate-900'
  const subText     = isDark ? 'text-slate-500' : 'text-slate-500'
  const descText    = isDark ? 'text-slate-300' : 'text-slate-600'
  const barTrack    = isDark ? 'bg-slate-700' : 'bg-slate-200'
  const chipBg      = isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
  const chipBorder  = isDark ? 'border-slate-700/50' : 'border-slate-200'
  const emptyText   = isDark ? 'text-slate-500' : 'text-slate-400'

  // ── Sidebar theme tokens ──
  const asideBg     = isDark ? 'bg-slate-900 border-slate-700' : 'bg-[#F3EAD6] border-[#DCC9A0]'
  const panelBg     = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-[#DCC9A0]'
  const sectionBd   = isDark ? 'border-slate-700' : 'border-[#DCC9A0]'
  const labelMuted  = isDark ? 'text-slate-400' : 'text-[#9C8355]'
  const valueDefault= isDark ? 'text-slate-200' : 'text-[#5C4526]'
  const patternColor= isDark ? 'text-yellow-400' : 'text-amber-600'

  if (totalIncidents === 0) return (
    <div className={`flex-1 flex items-center justify-center text-sm ${emptyText} ${pageBg}`}>
      Load a dataset to generate AI insights
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Sidebar — theme-aware: beige/white in light mode, slate in dark mode */}
      <aside className={`w-64 shrink-0 border-r flex flex-col overflow-y-auto ${asideBg}`}>

        <div className={`p-4 border-b ${sectionBd} ${panelBg}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${labelMuted}`}>Analysis Summary</p>
          {[
            { label: 'Total Insights', value: suggestions.length, color: valueDefault },
            { label: 'Alerts', value: suggestions.filter(s => s.type === 'alert').length, color: isDark ? 'text-red-400' : 'text-red-500' },
            { label: 'Patterns', value: suggestions.filter(s => s.type === 'pattern').length, color: patternColor },
            { label: 'Linked Cases', value: suggestions.filter(s => s.type === 'link').length, color: isDark ? 'text-blue-400' : 'text-blue-500' },
            { label: 'Incidents Analysed', value: totalIncidents, color: valueDefault },
          ].map(s => (
            <div key={s.label} className="flex justify-between items-center mb-2.5">
              <span className={`text-xs ${labelMuted}`}>{s.label}</span>
              <span className={`font-bold text-sm ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        <div className={`p-4 border-b ${sectionBd}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${labelMuted}`}>Type Legend</p>
          {(Object.entries(TYPE_CONFIG) as [SuggestionType, typeof TYPE_CONFIG[SuggestionType]][]).map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-2 mb-2">
              <span>{cfg.icon}</span>
              <div>
                <p className={`text-xs font-bold ${isDark ? cfg.colorDark : cfg.colorLight}`}>{cfg.label}</p>
                <p className={`text-xs capitalize ${labelMuted}`}>{type}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto p-4">
          <p className={`text-xs leading-relaxed ${labelMuted}`}>
            AI insights are generated from pattern analysis. Confidence scores indicate detection strength.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 overflow-y-auto p-6 ${pageBg}`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className={`font-semibold text-base ${titleColor}`}>🤖 AI-Generated Insights</h2>
          <span className={`text-xs ${subText}`}>{suggestions.length} insights · sorted by confidence</span>
        </div>
        {suggestions.length === 0
          ? <div className={`text-center py-20 text-sm ${emptyText}`}>No significant patterns detected.</div>
          : <div className="space-y-4 max-w-3xl">
              {suggestions.map((s, i) => {
                const cfg = TYPE_CONFIG[s.type]
                const color = isDark ? cfg.colorDark : cfg.colorLight
                const bg = isDark ? cfg.bgDark : cfg.bgLight
                return (
                  <div key={s.id} className={`border rounded-xl p-5 ${bg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cfg.icon}</span>
                        <div>
                          <span className={`text-xs font-bold ${color} tracking-wider`}>{cfg.label} #{i + 1}</span>
                          <h3 className={`font-semibold text-sm ${titleColor}`}>{s.title}</h3>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-lg font-bold ${color}`}>{s.confidence}%</p>
                        <p className={`text-xs ${subText}`}>confidence</p>
                      </div>
                    </div>
                    <p className={`text-sm mt-3 leading-relaxed ${descText}`}>{s.description}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${barTrack}`}>
                        <div className={`h-full rounded-full ${s.confidence >= 80 ? 'bg-red-500' : s.confidence >= 60 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                          style={{ width: `${s.confidence}%` }} />
                      </div>
                      <span className={`text-xs ${descText}`}>{s.confidence}%</span>
                    </div>
                    <div className={`flex flex-wrap gap-1.5 mt-3 pt-3 border-t ${chipBorder}`}>
                      {s.related_incidents.slice(0, 5).map((id: string) => (
                        <span key={id} className={`text-xs px-2 py-0.5 rounded font-mono ${chipBg}`}>{id}</span>
                      ))}
                      {s.related_incidents.length > 5 && <span className={`text-xs ${subText}`}>+{s.related_incidents.length - 5} more</span>}
                    </div>
                  </div>
                )
              })}
            </div>
        }
      </div>
    </div>
  )
}
