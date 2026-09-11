import ReactECharts from 'echarts-for-react'
import { useTheme } from '../context/ThemeContext'
import type { CrimeIncident } from '../types'

const CRIME_TYPE_COLORS: Record<string, string> = {
  'Chain Snatching': '#F59E0B',
  'Burglary': '#EF4444',
  'Assault': '#8B5CF6',
  'Vehicle Theft': '#3B82F6',
  'Financial Fraud': '#10B981',
  'Social Media Fraud': '#EC4899',
}

const STATUS_COLORS: Record<string, string> = {
  'Open': '#EF4444',
  'Under Investigation': '#F59E0B',
  'Closed': '#22C55E',
}

function StatCard({
  label, value, sub, color, isDark,
}: { label: string; value: string | number; sub?: string; color: string; isDark: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  )
}

export default function Analytics({ incidents }: { incidents: CrimeIncident[] }) {
  const { isDark } = useTheme()

  const pageBg     = isDark ? 'bg-slate-950' : 'bg-brand-bg'
  const cardBg     = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
  const titleColor = isDark ? 'text-white' : 'text-slate-900'
  const subColor   = isDark ? 'text-slate-500' : 'text-slate-500'
  const footColor  = isDark ? 'text-slate-600' : 'text-slate-400'

  // Chart text/line colors — kept legible on both a dark and a light/beige background
  const axisLabelColor = isDark ? '#94A3B8' : '#64748B'
  const axisLineColor  = isDark ? '#334155' : '#CBD5E1'
  const splitLineColor = isDark ? '#1E293B' : '#E2E8F0'
  const legendColor    = isDark ? '#94A3B8' : '#475569'

  if (incidents.length === 0) {
    return (
      <div className={`flex-1 flex items-center justify-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'} ${pageBg}`}>
        Load a dataset to view crime analytics
      </div>
    )
  }

  const totalIncidents = incidents.length
  const openCases = incidents.filter(i => i.case_status === 'Open').length
  const avgSeverity = (incidents.reduce((s, i) => s + i.severity_score, 0) / totalIncidents).toFixed(1)
  const uniqueSuspects = new Set(incidents.map(i => i.suspect_name).filter(s => s !== 'Unknown')).size

  const hourCounts = Array(24).fill(0)
  incidents.forEach(i => { hourCounts[i.crime_hour]++ })

  const typeCounts: Record<string, number> = {}
  incidents.forEach(i => { typeCounts[i.crime_type] = (typeCounts[i.crime_type] ?? 0) + 1 })

  const dateCounts: Record<string, number> = {}
  incidents.forEach(i => { if (i.date) dateCounts[i.date] = (dateCounts[i.date] ?? 0) + 1 })
  const sortedDates = Object.keys(dateCounts).sort()

  const sevBuckets: Record<string, number> = { '1-2': 0, '3-4': 0, '5-6': 0, '7-8': 0, '9-10': 0 }
  incidents.forEach(i => {
    const s = i.severity_score
    if (s <= 2) sevBuckets['1-2']++
    else if (s <= 4) sevBuckets['3-4']++
    else if (s <= 6) sevBuckets['5-6']++
    else if (s <= 8) sevBuckets['7-8']++
    else sevBuckets['9-10']++
  })

  const suspectCounts: Record<string, number> = {}
  incidents.forEach(i => {
    if (i.suspect_name !== 'Unknown')
      suspectCounts[i.suspect_name] = (suspectCounts[i.suspect_name] ?? 0) + 1
  })
  const topSuspects = Object.entries(suspectCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const statusCounts: Record<string, number> = {}
  incidents.forEach(i => { statusCounts[i.case_status] = (statusCounts[i.case_status] ?? 0) + 1 })

  const chartBase = { backgroundColor: 'transparent' }

  const hourChart = {
    ...chartBase,
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLabel: { color: axisLabelColor, fontSize: 10, rotate: 45 },
      axisLine: { lineStyle: { color: axisLineColor } },
    },
    yAxis: { type: 'value', axisLabel: { color: axisLabelColor }, splitLine: { lineStyle: { color: splitLineColor } } },
    series: [{
      type: 'bar',
      data: hourCounts.map((v, i) => ({
        value: v,
        itemStyle: { color: i >= 20 || i <= 5 ? '#EF4444' : i >= 6 && i <= 9 ? '#F59E0B' : '#3B82F6' },
      })),
    }],
  }

  const typeChart = {
    ...chartBase,
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: '5%', top: 'center', textStyle: { color: legendColor, fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['45%', '72%'], center: ['38%', '50%'],
      data: Object.entries(typeCounts).map(([name, value]) => ({
        name, value, itemStyle: { color: CRIME_TYPE_COLORS[name] ?? '#6B7280' },
      })),
      label: { show: false },
    }],
  }

  const trendChart = {
    ...chartBase,
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category', data: sortedDates,
      axisLabel: { color: axisLabelColor, fontSize: 9, rotate: 45 },
      axisLine: { lineStyle: { color: axisLineColor } },
    },
    yAxis: { type: 'value', axisLabel: { color: axisLabelColor }, splitLine: { lineStyle: { color: splitLineColor } }, minInterval: 1 },
    series: [{
      type: 'line', smooth: true, data: sortedDates.map(d => dateCounts[d]),
      lineStyle: { color: '#F59E0B', width: 2 }, itemStyle: { color: '#F59E0B' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(245,158,11,0.3)' }, { offset: 1, color: 'rgba(245,158,11,0.02)' }],
        },
      },
    }],
  }

  const sevChart = {
    ...chartBase,
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: Object.keys(sevBuckets), axisLabel: { color: axisLabelColor }, axisLine: { lineStyle: { color: axisLineColor } } },
    yAxis: { type: 'value', axisLabel: { color: axisLabelColor }, splitLine: { lineStyle: { color: splitLineColor } }, minInterval: 1 },
    series: [{
      type: 'bar', barWidth: '50%',
      data: Object.entries(sevBuckets).map(([k, v]) => ({
        value: v,
        itemStyle: { color: k === '9-10' ? '#EF4444' : k === '7-8' ? '#F97316' : k === '5-6' ? '#F59E0B' : k === '3-4' ? '#3B82F6' : '#22C55E' },
      })),
    }],
  }

  const suspectChart = {
    ...chartBase,
    tooltip: { trigger: 'axis' },
    grid: { left: '18%', right: '4%', bottom: '3%', top: '3%', containLabel: false },
    xAxis: { type: 'value', axisLabel: { color: axisLabelColor }, splitLine: { lineStyle: { color: splitLineColor } }, minInterval: 1 },
    yAxis: { type: 'category', data: topSuspects.map(([n]) => n).reverse(), axisLabel: { color: '#F87171', fontSize: 10 }, axisLine: { lineStyle: { color: axisLineColor } } },
    series: [{ type: 'bar', data: topSuspects.map(([, c]) => c).reverse(), itemStyle: { color: '#EF4444', borderRadius: [0, 4, 4, 0] }, barWidth: '60%' }],
  }

  const statusChart = {
    ...chartBase,
    tooltip: { trigger: 'item' },
    legend: { bottom: '5%', textStyle: { color: legendColor, fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%', '65%'],
      data: Object.entries(statusCounts).map(([name, value]) => ({ name, value, itemStyle: { color: STATUS_COLORS[name] ?? '#6B7280' } })),
      label: { color: legendColor, fontSize: 10 },
    }],
  }

  return (
    <div className={`flex-1 overflow-y-auto p-5 space-y-5 ${pageBg}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Incidents" value={totalIncidents} color={titleColor} isDark={isDark} />
        <StatCard label="Open Cases" value={openCases} sub={`${Math.round(openCases / totalIncidents * 100)}% of total`} color="text-red-400" isDark={isDark} />
        <StatCard label="Avg Severity" value={avgSeverity} sub="out of 10" color="text-amber-500" isDark={isDark} />
        <StatCard label="Unique Suspects" value={uniqueSuspects} color="text-purple-400" isDark={isDark} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 rounded-xl p-4 border ${cardBg}`}>
          <p className={`text-sm font-semibold mb-1 ${titleColor}`}>Crime by Hour of Day</p>
          <p className={`text-xs mb-3 ${subColor}`}>🔴 Night (8PM–5AM) · 🟡 Morning rush · 🔵 Daytime</p>
          <ReactECharts option={hourChart} style={{ height: '220px' }} />
        </div>
        <div className={`rounded-xl p-4 border ${cardBg}`}>
          <p className={`text-sm font-semibold mb-3 ${titleColor}`}>Crime Type Breakdown</p>
          <ReactECharts option={typeChart} style={{ height: '220px' }} />
        </div>
      </div>

      <div className={`rounded-xl p-4 border ${cardBg}`}>
        <p className={`text-sm font-semibold mb-1 ${titleColor}`}>Crime Incident Trend</p>
        <p className={`text-xs mb-3 ${subColor}`}>Incidents recorded per day</p>
        <ReactECharts option={trendChart} style={{ height: '200px' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`rounded-xl p-4 border ${cardBg}`}>
          <p className={`text-sm font-semibold mb-3 ${titleColor}`}>Severity Distribution</p>
          <ReactECharts option={sevChart} style={{ height: '200px' }} />
        </div>
        <div className={`rounded-xl p-4 border ${cardBg}`}>
          <p className={`text-sm font-semibold mb-3 ${titleColor}`}>Most Active Suspects</p>
          <ReactECharts option={suspectChart} style={{ height: '200px' }} />
        </div>
        <div className={`rounded-xl p-4 border ${cardBg}`}>
          <p className={`text-sm font-semibold mb-3 ${titleColor}`}>Case Status Overview</p>
          <ReactECharts option={statusChart} style={{ height: '200px' }} />
        </div>
      </div>

      <p className={`text-xs text-center pb-2 ${footColor}`}>
        Analytics generated from {totalIncidents} loaded incidents
      </p>
    </div>
  )
}