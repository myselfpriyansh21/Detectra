import React, { useState, useCallback } from 'react'
import { useLanguage } from '../context/LanguageContext'

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import type { CrimeIncident, Hotspot } from '../types'

// Fallback map center when no incidents are loaded yet — India's geographic centroid.
const DEFAULT_MAP_CENTER: [number, number] = [22.3511, 78.6677]

const CRIME_TYPES = [
  'Chain Snatching',
  'Burglary',
  'Assault',
  'Vehicle Theft',
  'Financial Fraud',
  'Social Media Fraud',
]

const STATUS_COLORS: Record<string, string> = {
  Open: '#EF4444',
  Closed: '#22C55E',
  'Under Investigation': '#F59E0B',
}

const ZONE_POPULATION_DENSITY: {
  center: [number, number]
  density: number
  label: string
}[] = [
  {
    center: [13.02, 77.58],
    density: 22000,
    label: 'Zone 1 (Census est.)',
  },
  {
    center: [12.9, 77.6],
    density: 31000,
    label: 'Zone 2 (Census est.)',
  },
  {
    center: [12.97, 77.68],
    density: 18000,
    label: 'Zone 3 (Census est.)',
  },
  {
    center: [12.97, 77.52],
    density: 15000,
    label: 'Zone 4 (Census est.)',
  },
  {
    center: [12.97, 77.59],
    density: 42000,
    label: 'Zone 5 (Census est.)',
  },
]

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap()

  React.useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12)
      return
    }
    const bounds = points.map(p => [p.lat, p.lng]) as [number, number][]
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 })
  }, [points, map])

  return null
}

function HeatmapLayer({
  points,
}: {
  points: {
    lat: number
    lng: number
    intensity: number
  }[]
}) {
  const map = useMap()

  React.useEffect(() => {
    if (points.length === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400

    const ctx = canvas.getContext('2d')

    if (!ctx) return

    points.forEach((p) => {
      const pixel = map.latLngToContainerPoint([p.lat, p.lng])

      const radius = 60 * p.intensity

      const gradient = ctx.createRadialGradient(
        pixel.x,
        pixel.y,
        0,
        pixel.x,
        pixel.y,
        radius
      )

      gradient.addColorStop(0, `rgba(255,0,0,${0.4 * p.intensity})`)
      gradient.addColorStop(0.4, `rgba(255,80,0,${0.2 * p.intensity})`)
      gradient.addColorStop(1, 'rgba(255,0,0,0)')

      ctx.fillStyle = gradient
      ctx.fillRect(
        pixel.x - radius,
        pixel.y - radius,
        radius * 2,
        radius * 2
      )
    })

    return () => canvas.remove()
  }, [points, map])

  return null
}

function HotspotHeatRing({
  hotspot,
  rank,
}: {
  hotspot: Hotspot
  rank: number
}) {
  const baseRadius = Math.min(
    400 + hotspot.incident_count * 40,
    1200
  )

  return (
    <>
      <Circle
        center={[hotspot.center_lat, hotspot.center_lon]}
        radius={baseRadius}
        pathOptions={{
          color: '#FF0000',
          fillColor: '#FF0000',
          fillOpacity: 0.05,
          weight: 0,
        }}
      />

      <Circle
        center={[hotspot.center_lat, hotspot.center_lon]}
        radius={baseRadius * 0.65}
        pathOptions={{
          color: '#FF2200',
          fillColor: '#FF2200',
          fillOpacity: 0.1,
          weight: 0,
        }}
      />

      <Circle
        center={[hotspot.center_lat, hotspot.center_lon]}
        radius={baseRadius * 0.35}
        pathOptions={{
          color: '#FF4400',
          fillColor: '#FF4400',
          fillOpacity: 0.2,
          weight: 1,
        }}
      />

      <CircleMarker
        center={[hotspot.center_lat, hotspot.center_lon]}
        radius={12}
        pathOptions={{
          color: '#FF1A1A',
          fillColor: '#FF4444',
          fillOpacity: 0.95,
          weight: 2,
        }}
      >
        <Tooltip permanent direction="top" offset={[0, -16]}>
          <span
            style={{
              fontWeight: 'bold',
              color: '#FF4444',
            }}
          >
            ⚠ Hotspot #{rank + 1}
          </span>
        </Tooltip>

        <Popup>
          <div style={{ minWidth: 200 }}>
            <p
              style={{
                fontWeight: 'bold',
                color: '#dc2626',
                fontSize: 14,
              }}
            >
              🔴 AI Hotspot Center #{rank + 1}
            </p>

            <p>
              <b>Centre:</b>{' '}
              {hotspot.center_lat.toFixed(5)},
              {' '}
              {hotspot.center_lon.toFixed(5)}
            </p>

            <p>
              <b>Incidents:</b>{' '}
              {hotspot.incident_count}
            </p>

            <p>
              <b>Average Severity:</b>{' '}
              {hotspot.avg_severity.toFixed(1)} / 10
            </p>
          </div>
        </Popup>
      </CircleMarker>
    </>
  )
}

interface CrimeMapProps {
  incidents: CrimeIncident[]
  hotspots: Hotspot[]
  loading: boolean
  onRunAnalysis: (
    filtered: CrimeIncident[],
    eps: number,
    minSamples: number
  ) => void
}

export default function CrimeMap({
  incidents,
  hotspots,
  loading,
  onRunAnalysis,
}: CrimeMapProps) {
  const { t } = useLanguage()

  const [selectedTypes, setSelectedTypes] =
    useState<string[]>([...CRIME_TYPES])

  const [minSeverity, setMinSeverity] = useState(1)

  const [hourRange, setHourRange] =
    useState<[number, number]>([0, 23])

  const [eps, setEps] = useState(0.007)

  const [minSamples, setMinSamples] = useState(3)

  const [mlOpen, setMlOpen] = useState(false)

  const [showDensity, setShowDensity] =
    useState(false)

  const filtered = incidents.filter(
    (inc) =>
      selectedTypes.includes(inc.crime_type) &&
      inc.severity_score >= minSeverity &&
      inc.crime_hour >= hourRange[0] &&
      inc.crime_hour <= hourRange[1]
  )

  const fmtHour = (h: number) => {
    if (h === 0) return '12 AM'
    if (h < 12) return `${h} AM`
    if (h === 12) return '12 PM'
    return `${h - 12} PM`
  }

  const toggleType = useCallback((type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    )
  }, [])

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 bg-[#F3EAD6] border-r border-[#DCC9A0] flex flex-col overflow-y-auto">

        {/* Live Stats — now white, bordered stat tiles for contrast against beige sidebar */}
        <div className="p-4 border-b border-[#DCC9A0] bg-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#9C8355] mb-3">
            {t.liveStats}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: t.filtered,
                value: filtered.length,
                color: 'text-amber-600',
              },
              {
                label: t.total,
                value: incidents.length,
                color: 'text-[#5C4526]',
              },
              {
                label: t.hotspots,
                value: hotspots.length,
                color: 'text-red-500',
              },
              {
                label: t.open,
                value: filtered.filter(
                  (i) => i.case_status === 'Open'
                ).length,
                color: 'text-red-400',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-[#F3EAD6] rounded-lg p-2 border border-[#DCC9A0]"
              >
                <p className={`text-lg font-bold ${s.color}`}>
                  {s.value}
                </p>

                <p className="text-xs text-[#9C8355]">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-[#DCC9A0] space-y-4">

          <p className="text-xs font-semibold uppercase tracking-widest text-[#9C8355]">
            {t.filters}
          </p>

          <div>
            <p className="text-[#5C4526] text-xs font-medium mb-2">
              {t.crimeType}
            </p>

            {CRIME_TYPES.map((type) => {
              const checked = selectedTypes.includes(type)
              return (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer mb-1"
                >
                  <span
                    onClick={() => toggleType(type)}
                    className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                      checked
                        ? 'bg-white border-[#B99A5B]'
                        : 'bg-[#EADFC2] border-[#CBB37E]'
                    }`}
                  >
                    {checked && (
                      <span className="w-1.5 h-1.5 rounded-sm bg-red-500" />
                    )}
                  </span>

                  <span className="text-[#5C4526] text-xs">
                    {type}
                  </span>
                </label>
              )
            })}
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[#5C4526] text-xs">
                {t.minSeverity}
              </span>

              <span className="text-red-500 text-xs">
                {minSeverity}
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={10}
              value={minSeverity}
              onChange={(e) =>
                setMinSeverity(Number(e.target.value))
              }
              className="w-full accent-red-500"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[#5C4526] text-xs">
                {t.timeOfDay}
              </span>

              <span className="text-amber-600 text-xs">
                {fmtHour(hourRange[0])} - {fmtHour(hourRange[1])}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={23}
              value={hourRange[0]}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (v <= hourRange[1])
                  setHourRange([v, hourRange[1]])
              }}
              className="w-full accent-amber-500 mb-1"
            />

            <input
              type="range"
              min={0}
              max={23}
              value={hourRange[1]}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (v >= hourRange[0])
                  setHourRange([hourRange[0], v])
              }}
              className="w-full accent-amber-500"
            />
          </div>

        </div>

        <div className="p-4 border-b border-[#DCC9A0]">

          <button
            onClick={() => setMlOpen((o) => !o)}
            className="w-full flex justify-between text-[#5C4526] text-xs"
          >
            <span>🤖 {t.mlTuning}</span>
            <span>{mlOpen ? '▲' : '▼'}</span>
          </button>

          {mlOpen && (
            <div className="mt-3 space-y-3">

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-[#9C8355]">
                    {t.eps}
                  </span>

                  <span className="text-xs text-purple-500">
                    {eps.toFixed(3)}
                  </span>
                </div>

                <input
                  type="range"
                  min={0.001}
                  max={0.02}
                  step={0.001}
                  value={eps}
                  onChange={(e) =>
                    setEps(Number(e.target.value))
                  }
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-[#9C8355]">
                    {t.minSamples}
                  </span>

                  <span className="text-xs text-purple-500">
                    {minSamples}
                  </span>
                </div>

                <input
                  type="range"
                  min={2}
                  max={10}
                  value={minSamples}
                  onChange={(e) =>
                    setMinSamples(Number(e.target.value))
                  }
                  className="w-full accent-purple-500"
                />
              </div>

            </div>
          )}

        </div>

        <div className="p-4">

          <label className="flex items-center gap-2 text-sm text-[#5C4526] mb-4 cursor-pointer">

            <span
              onClick={() => setShowDensity(!showDensity)}
              className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                showDensity
                  ? 'bg-white border-[#B99A5B]'
                  : 'bg-[#EADFC2] border-[#CBB37E]'
              }`}
            >
              {showDensity && (
                <span className="w-1.5 h-1.5 rounded-sm bg-blue-500" />
              )}
            </span>

            {t.showDensity}
          </label>

          <button
            onClick={() =>
              onRunAnalysis(filtered, eps, minSamples)
            }
            disabled={
              loading || filtered.length === 0
            }
            className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-[#DCC9A0] disabled:text-[#9C8355] text-white font-semibold"
          >
            {loading
              ? t.runningAnalysis
              : t.runAnalysis}
          </button>

        </div>

      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">

        <div className="flex-1 relative">

          {loading && (
            <div className="absolute inset-0 z-[1000] bg-[#F3EAD6]/90 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[#5C4526] text-sm">
                {t.runningClustering}
              </p>
            </div>
          )}

          <MapContainer
            center={DEFAULT_MAP_CENTER}
            zoom={5}
            zoomSnap={0.5}
            zoomDelta={0.5}
            wheelDebounceTime={100}
            wheelPxPerZoomLevel={120}
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            <FitBounds points={filtered.map(i => ({ lat: i.latitude, lng: i.longitude }))} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
              maxZoom={19}
            />

            {/* Population Density Overlay */}
            {showDensity &&
              ZONE_POPULATION_DENSITY.map((zone, index) => (
                <Circle
                  key={index}
                  center={zone.center}
                  radius={Math.sqrt(zone.density) * 25}
                  pathOptions={{
                    color: '#2563EB',
                    fillColor: '#2563EB',
                    fillOpacity: 0.08,
                    weight: 1,
                    dashArray: '4',
                  }}
                >
                  <Tooltip sticky>
                    {zone.label}
                    <br />
                    ~{zone.density.toLocaleString()} people/km²
                  </Tooltip>
                </Circle>
              ))}

            {/* Optional Heatmap */}
            <HeatmapLayer
              points={hotspots.map((h) => ({
                lat: h.center_lat,
                lng: h.center_lon,
                intensity: Math.min(
                  h.incident_count / 10,
                  1
                ),
              }))}
            />

            {/* Crime Incident Markers */}
            {filtered.map((inc) => (
              <CircleMarker
                key={inc.id}
                center={[
                  inc.latitude,
                  inc.longitude,
                ]}
                radius={6}
                pathOptions={{
                  color:
                    STATUS_COLORS[
                      inc.case_status
                    ] ?? '#FFD700',

                  fillColor:
                    STATUS_COLORS[
                      inc.case_status
                    ] ?? '#FFFF00',

                  fillOpacity: 0.85,
                  weight: 1,
                }}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -6]}
                >
                  <span
                    style={{
                      fontSize: 11,
                    }}
                  >
                    {inc.suspect_name}
                    {' • '}
                    {inc.crime_type}
                  </span>
                </Tooltip>

                <Popup>
                  <div
                    style={{
                      minWidth: 220,
                      fontSize: 13,
                    }}
                  >
                    <p
                      style={{
                        fontWeight: 'bold',
                        fontSize: 15,
                      }}
                    >
                      {inc.crime_type}
                    </p>

                    <p>
                      <b>Case ID:</b> {inc.id}
                    </p>

                    <p>
                      <b>Date:</b> {inc.date}
                    </p>

                    <p>
                      <b>Time:</b>{' '}
                      {inc.crime_hour}:00
                    </p>

                    <p>
                      <b>Suspect:</b>{' '}
                      {inc.suspect_name}
                    </p>

                    <p>
                      <b>Gang:</b>{' '}
                      {inc.gang_affiliation}
                    </p>

                    <p>
                      <b>Evidence:</b>{' '}
                      {inc.evidence_found}
                    </p>

                    <p>
                      <b>Severity:</b>{' '}
                      {inc.severity_score}/10
                    </p>

                    <p>
                      <b>Status:</b>{' '}
                      <span
                        style={{
                          color:
                            STATUS_COLORS[
                              inc.case_status
                            ],
                        }}
                      >
                        {inc.case_status}
                      </span>
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* AI Hotspots */}
            {hotspots.map((hotspot, index) => (
              <HotspotHeatRing
                key={hotspot.cluster_id}
                hotspot={hotspot}
                rank={index}
              />
            ))}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="shrink-0 bg-[#F3EAD6] border-t border-[#DCC9A0] px-4 py-2 flex gap-6 text-xs text-[#9C8355] flex-wrap">

          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" />
            {t.openCase}
          </span>

          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5" />
            {t.closed}
          </span>

          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5" />
            {t.underInvestigation}
          </span>

          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5" />
            {t.populationDensity}
          </span>

          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-700 border border-red-400 mr-1.5" />
            {t.aiHotspot}
          </span>

          {hotspots.length > 0 && (
            <span className="ml-auto text-red-500 font-medium">
              {t.denseZones(hotspots.length)}
            </span>
          )}

        </div>


      </div>
    </div>
  )
}