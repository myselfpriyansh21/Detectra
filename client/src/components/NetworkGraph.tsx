/**
 * NetworkGraph.tsx  -  Case-Centric Criminal Network
 *
 * Police work ONE case at a time. This graph reflects that:
 *
 *   1. SINGLE CASE mode (default)
 *      Shows only the selected incident's network:
 *      Suspect -> Gang, Suspect -> Crime Scene, Suspect -> Evidence
 *
 *   2. FIND RELATED mode
 *      Expands to show OTHER cases that share the same:
 *        - Suspect   - Gang   - Evidence   - Vehicle
 *      Highlighting those links so the officer can see cross-case connections.
 *
 *   3. ALL [CRIME TYPE] mode
 *      Shows every case of the same crime type (e.g. all Burglaries)
 *      so the officer can spot serial patterns.
 *
 *   4. FULL NETWORK mode
 *      Shows all cases - used for strategic overview.
 *
 * Officers can also upload a suspect or evidence photo that appears
 * inside the node circle in the graph.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../context/ThemeContext'
import type { CrimeIncident, NetworkNode, NetworkEdge, NodeType, CaseImage, GraphNode, GraphLink } from '../types'
import { computePageRank, detectCommunities } from '../utils/graphAnalytics'
import { STATIONS } from '../utils/jurisdiction'

const COMMUNITY_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

const TYPE_COLORS: Record<NodeType, { fill: string; stroke: string; text: string; textLight: string }> = {
  Suspect:        { fill: '#7F1D1D', stroke: '#EF4444', text: '#FCA5A5', textLight: '#B91C1C' },
  Gang:           { fill: '#4C1D95', stroke: '#8B5CF6', text: '#C4B5FD', textLight: '#6D28D9' },
  'Crime Scene':  { fill: '#1E3A5F', stroke: '#3B82F6', text: '#93C5FD', textLight: '#1D4ED8' },
  Evidence:       { fill: '#713F12', stroke: '#F59E0B', text: '#FDE68A', textLight: '#B45309' },
}

type ViewMode = 'single' | 'related' | 'type' | 'all'

interface PhysicsNode extends NetworkNode { x: number; y: number; vx: number; vy: number }

function buildGraph(
  incidents: CrimeIncident[],
  images: CaseImage[],
  highlightIds: Set<string>
): { nodes: PhysicsNode[]; edges: NetworkEdge[] } {
  const nodeMap = new Map<string, PhysicsNode & { isRelated?: boolean; photoUrl?: string }>()
  const edges: NetworkEdge[] = []
  const edgeSet = new Set<string>()

  const addNode = (id: string, label: string, type: NodeType, extra?: Partial<PhysicsNode & { isRelated?: boolean; photoUrl?: string }>) => {
    if (!nodeMap.has(id)) nodeMap.set(id, { id, label, type, x:0, y:0, vx:0, vy:0, ...extra })
  }
  const addEdge = (source: string, target: string, rel: string) => {
    const key = [source, target].sort().join('|')
    if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ source, target, relationship: rel }) }
  }

  incidents.forEach(inc => {
    const isRelated = highlightIds.has(inc.id) && highlightIds.size > 0
    const sId = `S:${inc.suspect_name}`
    const gId = `G:${inc.gang_affiliation}`
    const cId = `C:${inc.id}`
    const eId = `E:${inc.evidence_found}`

    const suspectPhoto = images.find(img => img.incidentId === inc.id && img.imageType === 'suspect')?.dataUrl
    const evidencePhoto = images.find(img => img.incidentId === inc.id && img.imageType === 'evidence')?.dataUrl

    if (inc.suspect_name !== 'Unknown') addNode(sId, inc.suspect_name, 'Suspect', { isRelated, photoUrl: suspectPhoto })
    if (inc.gang_affiliation !== 'Unknown') addNode(gId, inc.gang_affiliation, 'Gang', { isRelated })
    addNode(cId, `${inc.crime_type}\n${inc.id}`, 'Crime Scene', { isRelated })
    if (inc.evidence_found !== 'None') addNode(eId, inc.evidence_found, 'Evidence', { isRelated, photoUrl: evidencePhoto })

    if (inc.suspect_name !== 'Unknown' && inc.gang_affiliation !== 'Unknown') addEdge(sId, gId, 'affiliated with')
    if (inc.suspect_name !== 'Unknown') addEdge(sId, cId, 'present at')
    if (inc.gang_affiliation !== 'Unknown') addEdge(gId, cId, 'operates in')
    if (inc.evidence_found !== 'None' && inc.suspect_name !== 'Unknown') addEdge(sId, eId, 'linked to')
  })

  return { nodes: Array.from(nodeMap.values()) as PhysicsNode[], edges }
}

function useForceLayout(nodes: NetworkNode[], edges: NetworkEdge[], w: number, h: number): PhysicsNode[] {
  const [positions, setPositions] = useState<PhysicsNode[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (nodes.length === 0 || w === 0) return
    const typeOrder: NodeType[] = ['Gang', 'Suspect', 'Crime Scene', 'Evidence']
    const byType: Record<string, string[]> = {}
    typeOrder.forEach(t => { byType[t] = [] })
    nodes.forEach(n => byType[n.type]?.push(n.id))

    const vW = w * 1.6, vH = h * 1.6
    let current: PhysicsNode[] = nodes.map(n => {
      const ti = typeOrder.indexOf(n.type as NodeType)
      const r  = ((ti + 1) / (typeOrder.length + 1)) * Math.min(vW, vH) * 0.42
      const grp = byType[n.type] ?? []
      const pos = grp.indexOf(n.id)
      const angle = (pos / Math.max(grp.length, 1)) * Math.PI * 2 + ti * 0.3
      return { ...n, x: vW/2 + r * Math.cos(angle), y: vH/2 + r * Math.sin(angle), vx:0, vy:0 }
    })

    let frame = 0
    const tick = () => {
      if (frame++ > 220) { setPositions([...current]); return }
      current = current.map((node, i) => {
        let fx = 0, fy = 0
        current.forEach((other, j) => {
          if (i === j) return
          const dx = node.x - other.x, dy = node.y - other.y
          const d = Math.sqrt(dx*dx + dy*dy) || 1
          if (d < 350) { const f = 7000/(d*d); fx += (dx/d)*f; fy += (dy/d)*f }
        })
        edges.forEach(e => {
          const isSrc = e.source === node.id, isTgt = e.target === node.id
          if (!isSrc && !isTgt) return
          const other = current.find(n => n.id === (isSrc ? e.target : e.source))
          if (!other) return
          const dx = other.x - node.x, dy = other.y - node.y
          fx += dx * 0.003; fy += dy * 0.003
        })
        fx += (vW/2 - node.x) * 0.007; fy += (vH/2 - node.y) * 0.007
        const vx = (node.vx + fx*0.1)*0.86, vy = (node.vy + fy*0.1)*0.86
        return { ...node, x: Math.max(60, Math.min(vW-60, node.x+vx)), y: Math.max(60, Math.min(vH-60, node.y+vy)), vx, vy }
      })
      setPositions([...current])
      rafRef.current = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [nodes.length, edges.length, w, h]) // eslint-disable-line

  return positions
}

interface Props {
  incidents: CrimeIncident[]
  images: CaseImage[]
  focusCaseId?: string | null
}

export default function NetworkGraph({ incidents, images, focusCaseId }: Props) {
  const { isDark } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 1200, h: 700 })
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('single')
  const [areaFilter, setAreaFilter] = useState<string>('All')
  const [crimeTypeFilter, setCrimeTypeFilter] = useState<string>('All')
  const [linkBy, setLinkBy] = useState<Set<string>>(new Set(['suspect', 'gang', 'evidence']))
  const [selected, setSelected] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ node: PhysicsNode; x: number; y: number } | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  // ── Louvain community detection (graph analytics) ──
  const [showCommunities, setShowCommunities] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [communityResult, setCommunityResult] = useState<{
    partition: Record<string, number>
    pageRank: Record<string, number>
    method: string
    communityCount: number
  } | null>(null)

  const canvasBg    = isDark ? 'bg-slate-950' : 'bg-brand-bg'
  const edgeColor   = isDark ? '#2D3748' : '#C9BC9D'
  const loadingText = isDark ? 'text-slate-500' : 'text-slate-500'
  const tooltipBg   = isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
  const tooltipSub  = isDark ? 'text-slate-400' : 'text-slate-500'
  const tooltipSub2 = isDark ? 'text-slate-500' : 'text-slate-400'

  // ── Sidebar theme tokens (same pattern as AISuggestions.tsx) ──
  const asideBg      = isDark ? 'bg-slate-900 border-slate-700' : 'bg-[#F3EAD6] border-[#DCC9A0]'
  const panelBg      = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-[#DCC9A0]'
  const sectionBd    = isDark ? 'border-slate-700' : 'border-[#DCC9A0]'
  const labelMuted   = isDark ? 'text-slate-400' : 'text-[#9C8355]'
  const valueDefault = isDark ? 'text-slate-200' : 'text-[#5C4526]'
  const inputBg       = isDark ? 'bg-slate-900 border-slate-600 text-slate-200' : 'bg-white border-[#DCC9A0] text-[#5C4526]'
  const infoBoxBg      = isDark ? 'bg-slate-900 border-slate-700' : 'bg-[#F3EAD6] border-[#DCC9A0]'
  const infoAccent      = isDark ? 'text-amber-400' : 'text-amber-600'
  const modeActive      = isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500' : 'bg-amber-500/20 text-amber-700 border border-amber-500'
  const modeInactive    = isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-[#5C4526] hover:bg-[#EADFC2]'
  const checkboxLabel   = isDark ? 'text-slate-300' : 'text-[#5C4526]'
  const resetBtn         = isDark
    ? 'border-slate-600 text-slate-300 hover:border-amber-500 hover:text-amber-400'
    : 'border-[#DCC9A0] text-[#5C4526] hover:border-amber-500 hover:text-amber-600'
  const footerMuted     = isDark ? 'text-slate-500' : 'text-[#9C8355]'
  const footerMuted2    = isDark ? 'text-slate-600' : 'text-[#B8A576]'

  useEffect(() => {
    if (focusCaseId) { setSelectedCaseId(focusCaseId); setViewMode('single') }
  }, [focusCaseId])

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: Math.floor(width), h: Math.floor(height) })
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const selectedIncident = incidents.find(i => i.id === selectedCaseId) ?? null

  const relatedIds = useCallback((): Set<string> => {
    if (!selectedIncident || viewMode !== 'related') return new Set()
    const rel = new Set<string>()
    incidents.forEach(i => {
      if (i.id === selectedIncident.id) return
      if (linkBy.has('suspect') && i.suspect_name === selectedIncident.suspect_name && i.suspect_name !== 'Unknown') rel.add(i.id)
      if (linkBy.has('gang') && i.gang_affiliation === selectedIncident.gang_affiliation && i.gang_affiliation !== 'Unknown') rel.add(i.id)
      if (linkBy.has('evidence') && i.evidence_found === selectedIncident.evidence_found && i.evidence_found !== 'None') rel.add(i.id)
    })
    return rel
  }, [selectedIncident, incidents, viewMode, linkBy])

  const workingIncidents = (() => {
    let base: CrimeIncident[]
    if (!selectedIncident) base = incidents
    else if (viewMode === 'single') base = [selectedIncident]
    else if (viewMode === 'related') {
      const rids = relatedIds()
      base = incidents.filter(i => i.id === selectedIncident.id || rids.has(i.id))
    }
    else if (viewMode === 'type') base = incidents.filter(i => i.crime_type === selectedIncident.crime_type)
    else base = incidents

    // Area / crime-type search — independent of case selection, so an
    // investigator can browse "all financial fraud in Station Gamma"
    // without first picking a specific suspect.
    return base.filter(i =>
      (areaFilter === 'All' || i.station === areaFilter) &&
      (crimeTypeFilter === 'All' || i.crime_type === crimeTypeFilter)
    )
  })()

  const highlightIds = viewMode === 'related' ? relatedIds() : new Set<string>()
  const { nodes, edges } = buildGraph(workingIncidents, images, highlightIds)
  const positions = useForceLayout(nodes, edges, dims.w, dims.h)

  const runCommunityDetection = useCallback(async () => {
    setDetecting(true)
    // Always run on the FULL network (every loaded case), not just the
    // currently filtered view — communities/gangs only make sense
    // computed across the whole dataset.
    const { nodes: fullNodes, edges: fullEdges } = buildGraph(incidents, images, new Set())
    const payload = {
      nodes: fullNodes.map(n => ({ id: n.id })),
      edges: fullEdges.map(e => ({ source: e.source, target: e.target, weight: 1 })),
    }
    try {
      const res = await fetch('/api/community', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.status === 'success') {
        setCommunityResult({ partition: data.communities, pageRank: data.page_rank, method: data.method, communityCount: data.community_count })
        setShowCommunities(true)
        setDetecting(false)
        return
      }
      throw new Error('backend returned error')
    } catch {
      // Client-side fallback: label-propagation communities + PageRank,
      // computed entirely in the browser (see utils/graphAnalytics.ts).
      const pr = computePageRank(fullNodes as unknown as GraphNode[], fullEdges as unknown as GraphLink[])
      const comm = detectCommunities(fullNodes as unknown as GraphNode[], fullEdges as unknown as GraphLink[])
      const partition: Record<string, number> = {}
      comm.forEach((v, k) => { partition[k] = v })
      const pageRank: Record<string, number> = {}
      pr.forEach((v, k) => { pageRank[k] = v })
      setCommunityResult({ partition, pageRank, method: 'client-fallback', communityCount: new Set(Object.values(partition)).size })
      setShowCommunities(true)
      setDetecting(false)
    }
  }, [incidents, images])

  const topInfluencerId = communityResult
    ? Object.entries(communityResult.pageRank).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null

  const isConnected = useCallback((id: string) =>
    edges.some(e => (e.source === selected && e.target === id) || (e.target === selected && e.source === id))
  , [selected, edges])

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest('g')) return
    isPanning.current = true
    panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return
    setTransform(t => ({ ...t, x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }))
  }
  const onMouseUp = () => { isPanning.current = false }
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setTransform(t => ({ ...t, scale: Math.max(0.2, Math.min(4, t.scale * (e.deltaY > 0 ? 0.9 : 1.1))) }))
  }

  const rIds = relatedIds()
  const relatedCount = rIds.size

  return (
    <div className="flex h-full">
      {/* Sidebar — theme-aware: beige/white in light mode, slate in dark mode */}
      <aside className={`w-64 shrink-0 border-r flex flex-col overflow-y-auto ${asideBg}`}>

        {/* Case selector - white/slate panel, like Live Stats on Map page */}
        <div className={`p-4 border-b ${sectionBd} ${panelBg}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${labelMuted}`}>
            Select Case to Investigate
          </p>
          <select
            value={selectedCaseId ?? ''}
            onChange={e => { setSelectedCaseId(e.target.value || null); setViewMode('single'); setSelected(null) }}
            className={`w-full rounded-lg px-3 py-2 text-xs border focus:outline-none focus:border-amber-500 ${inputBg}`}>
            <option value="">- Full Network (all cases) -</option>
            {incidents.map(inc => (
              <option key={inc.id} value={inc.id}>
                {inc.id} - {inc.crime_type} - {inc.suspect_name}
              </option>
            ))}
          </select>

          {selectedIncident && (
            <div className={`mt-3 border rounded-lg p-3 text-xs space-y-1 ${infoBoxBg}`}>
              <p className={`font-bold ${infoAccent}`}>{selectedIncident.id}</p>
              <p className={valueDefault}>{selectedIncident.crime_type}</p>
              <p className={labelMuted}>Suspect: {selectedIncident.suspect_name}</p>
              <p className={labelMuted}>Gang: {selectedIncident.gang_affiliation}</p>
              <p className={labelMuted}>Evidence: {selectedIncident.evidence_found}</p>
            </div>
          )}
        </div>

        {/* Search by area / crime type — independent of case selection */}
        <div className={`p-4 border-b ${sectionBd} ${panelBg}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${labelMuted}`}>
            Search by Area &amp; Crime Type
          </p>
          <select
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
            className={`w-full rounded-lg px-3 py-2 text-xs border mb-2 focus:outline-none focus:border-amber-500 ${inputBg}`}>
            <option value="All">All Areas</option>
            {STATIONS.map(s => (
              <option key={s.id} value={s.id}>{s.name} — {s.district}</option>
            ))}
          </select>
          <select
            value={crimeTypeFilter}
            onChange={e => setCrimeTypeFilter(e.target.value)}
            className={`w-full rounded-lg px-3 py-2 text-xs border focus:outline-none focus:border-amber-500 ${inputBg}`}>
            <option value="All">All Crime Types</option>
            {[...new Set(incidents.map(i => i.crime_type))].sort().map(ct => (
              <option key={ct} value={ct}>{ct}</option>
            ))}
          </select>
          {(areaFilter !== 'All' || crimeTypeFilter !== 'All') && (
            <button
              onClick={() => { setAreaFilter('All'); setCrimeTypeFilter('All') }}
              className={`w-full mt-2 py-1.5 rounded-lg text-xs border ${inputBg} ${labelMuted}`}>
              Clear search
            </button>
          )}
        </div>

        {/* View mode */}
        {selectedIncident && (
          <div className={`p-4 border-b ${sectionBd}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${labelMuted}`}>
              View Mode
            </p>
            <div className="space-y-1.5">
              {[
                { mode:'single',  label:`This Case Only`,                 icon:'🔍' },
                { mode:'related', label:`Find Related Cases (${relatedCount})`, icon:'🔗' },
                { mode:'type',    label:`All ${selectedIncident.crime_type}`,   icon:'📂' },
                { mode:'all',     label:'Full Network',                    icon:'🌐' },
              ].map(m => (
                <button key={m.mode} onClick={() => { setViewMode(m.mode as ViewMode); setSelected(null) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left ${
                    viewMode === m.mode ? modeActive : modeInactive}`}>
                  <span>{m.icon}</span><span>{m.label}</span>
                </button>
              ))}
            </div>

            {viewMode === 'related' && (
              <div className="mt-3">
                <p className={`text-xs mb-2 ${labelMuted}`}>Link cases by:</p>
                {[
                  { key:'suspect', label:'Same Suspect' },
                  { key:'gang',    label:'Same Gang' },
                  { key:'evidence',label:'Same Evidence' },
                ].map(lb => (
                  <label key={lb.key} className="flex items-center gap-2 cursor-pointer mb-1.5">
                    <input type="checkbox" checked={linkBy.has(lb.key)}
                      onChange={() => {
                        const next = new Set(linkBy)
                        if (next.has(lb.key)) next.delete(lb.key); else next.add(lb.key)
                        setLinkBy(next)
                      }}
                      className="w-3.5 h-3.5 accent-amber-500" />
                    <span className={`text-xs ${checkboxLabel}`}>{lb.label}</span>
                  </label>
                ))}
                {relatedCount > 0 && (
                  <p className={`text-xs mt-2 font-medium ${infoAccent}`}>
                    ⚠ {relatedCount} related case{relatedCount !== 1 ? 's' : ''} found
                  </p>
                )}
                {relatedCount === 0 && (
                  <p className={`text-xs mt-2 ${labelMuted}`}>No related cases found with current link criteria.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Graph Analytics — Louvain community detection */}
        <div className={`p-4 border-b ${sectionBd}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${labelMuted}`}>Graph Analytics</p>
          <button
            onClick={runCommunityDetection}
            disabled={detecting}
            className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors ${
              detecting ? 'opacity-50 cursor-wait' : ''} bg-amber-500 text-slate-900 hover:bg-amber-400`}>
            {detecting ? 'Detecting…' : '🔎 Detect Communities (Louvain)'}
          </button>

          {communityResult && (
            <div className="mt-3 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showCommunities}
                  onChange={() => setShowCommunities(s => !s)}
                  className="w-3.5 h-3.5 accent-amber-500" />
                <span className={`text-xs ${checkboxLabel}`}>Show community rings</span>
              </label>
              <p className={`text-xs ${labelMuted}`}>
                {communityResult.communityCount} communities detected
                <span className={footerMuted2}> · {communityResult.method === 'louvain' ? 'Louvain (server)' : communityResult.method === 'greedy_modularity' ? 'Modularity (server)' : 'Client fallback'}</span>
              </p>
              {topInfluencerId && (
                <p className={`text-xs font-medium ${infoAccent}`}>
                  ⭐ Key influencer: {positions.find(n => n.id === topInfluencerId)?.label ?? topInfluencerId}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className={`p-4 border-b ${sectionBd}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${labelMuted}`}>Legend</p>
          {(Object.entries(TYPE_COLORS) as [NodeType, typeof TYPE_COLORS[NodeType]][]).map(([type, c]) => (
            <div key={type} className="flex items-center gap-2 mb-1.5">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.stroke }} />
              <span className={`text-xs ${valueDefault}`}>{type}</span>
            </div>
          ))}
          {viewMode === 'related' && relatedCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="w-3 h-3 rounded-full shrink-0 border-2 border-amber-500 bg-transparent" />
              <span className={`text-xs ${infoAccent}`}>Related case node</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4">
          <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${labelMuted}`}>Controls</p>
          <p className={`text-xs ${labelMuted}`}>🖱 Scroll to zoom</p>
          <p className={`text-xs ${labelMuted}`}>✋ Drag background to pan</p>
          <p className={`text-xs ${labelMuted}`}>🔵 Click node to select</p>
          <button onClick={() => setTransform({ x:0, y:0, scale:1 })}
            className={`mt-2 w-full py-1.5 rounded-lg border text-xs transition-colors ${resetBtn}`}>
            Reset View
          </button>
        </div>

        <div className={`mt-auto p-4 border-t ${sectionBd}`}>
          <p className={`text-xs ${footerMuted}`}>{positions.length} nodes - {edges.length} connections</p>
          <p className={`text-xs mt-1 ${footerMuted2}`}>{workingIncidents.length} cases shown</p>
        </div>
      </aside>

      {/* SVG canvas */}
      <div ref={containerRef} className={`flex-1 overflow-hidden cursor-grab active:cursor-grabbing ${canvasBg}`}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp} onWheel={onWheel}>

        {positions.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className={`text-sm ${loadingText}`}>Building network...</p>
            </div>
          </div>
        )}

        <svg width={dims.w} height={dims.h}>
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="glow2"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            {edges.map((edge, i) => {
              const src = positions.find(n => n.id === edge.source)
              const tgt = positions.find(n => n.id === edge.target)
              if (!src || !tgt) return null
              const hi = selected === src.id || selected === tgt.id
              return (
                <line key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={hi ? '#F59E0B' : edgeColor} strokeWidth={hi ? 2.5 : 1}
                  strokeOpacity={selected && !hi ? 0.08 : 0.65}>
                  <title>{edge.relationship}</title>
                </line>
              )
            })}

            {positions.map(node => {
              const c = TYPE_COLORS[node.type as NodeType] ?? TYPE_COLORS.Suspect
              const isSel  = selected === node.id
              const isConn = isConnected(node.id)
              const dim    = !!selected && !isSel && !isConn
              const isRel  = (node as any).isRelated
              const photo  = (node as any).photoUrl as string | undefined
              const lines  = node.label.split('\n')
              const r      = isSel ? 18 : 13
              const labelColor = isDark ? c.text : c.textLight

              return (
                <g key={node.id}
                  onClick={() => setSelected(s => s === node.id ? null : node.id)}
                  onMouseEnter={e => setTooltip({ node, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor:'pointer' }}
                  opacity={dim ? 0.1 : 1}
                  filter={isSel ? 'url(#glow)' : isConn ? 'url(#glow2)' : undefined}>

                  {isRel && (
                    <circle cx={node.x} cy={node.y} r={r + 8}
                      fill="none" stroke="#FBBF24" strokeWidth={1.5} strokeDasharray="4 3" />
                  )}
                  {(isSel || isConn) && (
                    <circle cx={node.x} cy={node.y} r={r + 5}
                      fill="none" stroke={isSel ? '#FBBF24' : c.stroke} strokeWidth={1} strokeOpacity={0.4} />
                  )}
                  {showCommunities && communityResult && communityResult.partition[node.id] !== undefined && (
                    <circle cx={node.x} cy={node.y} r={r + 4}
                      fill="none"
                      stroke={COMMUNITY_COLORS[communityResult.partition[node.id] % COMMUNITY_COLORS.length]}
                      strokeWidth={2.5} strokeOpacity={0.85} />
                  )}
                  {showCommunities && node.id === topInfluencerId && (
                    <text x={node.x} y={node.y - r - 10} textAnchor="middle" fontSize={13} style={{ pointerEvents: 'none' }}>⭐</text>
                  )}

                  <circle cx={node.x} cy={node.y} r={r}
                    fill={c.fill} stroke={isSel ? '#FBBF24' : c.stroke}
                    strokeWidth={isSel ? 3 : isConn ? 2 : 1.5} />

                  {photo && (
                    <image href={photo} x={node.x - r + 2} y={node.y - r + 2}
                      width={r*2-4} height={r*2-4}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`circle(${r-2}px at ${r-2}px ${r-2}px)`} />
                  )}

                  {lines.map((line, li) => (
                    <text key={li} x={node.x} y={node.y + r + 12 + li * 11}
                      textAnchor="middle" fontSize={9}
                      fill={dim ? (isDark ? '#374151' : '#CBD5E1') : labelColor}
                      style={{ pointerEvents:'none', userSelect:'none' }}>
                      {line.length > 16 ? line.slice(0, 15) + '…' : line}
                    </text>
                  ))}
                </g>
              )
            })}
          </g>
        </svg>

        {tooltip && !selected && (
          <div className={`fixed z-50 border rounded-lg px-3 py-2 text-xs pointer-events-none ${tooltipBg}`}
            style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
            <p className="font-bold">{tooltip.node.label.replace('\n', ' ')}</p>
            <p className={tooltipSub}>{tooltip.node.type}</p>
            <p className={tooltipSub2}>
              {edges.filter(e => e.source === tooltip.node.id || e.target === tooltip.node.id).length} connections
            </p>
          </div>
        )}
      </div>
    </div>
  )
}