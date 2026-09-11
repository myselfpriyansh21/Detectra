// Client-side DBSCAN implementation
// Runs entirely in the browser — no Python backend needed

export interface Point {
  latitude: number
  longitude: number
  severity_score: number
}

export interface ClusterResult {
  cluster_id: number
  center_lat: number
  center_lon: number
  incident_count: number
  avg_severity: number
}

function distance(a: Point, b: Point): number {
  const dx = a.latitude - b.latitude
  const dy = a.longitude - b.longitude
  return Math.sqrt(dx * dx + dy * dy)
}

function rangeQuery(points: Point[], idx: number, eps: number): number[] {
  return points.reduce<number[]>((neighbors, _, i) => {
    if (i !== idx && distance(points[idx], points[i]) <= eps) neighbors.push(i)
    return neighbors
  }, [])
}

export function runDBSCAN(points: Point[], eps: number, minSamples: number): ClusterResult[] {
  const labels = new Array(points.length).fill(-1) // -1 = noise
  let clusterId = 0

  for (let i = 0; i < points.length; i++) {
    if (labels[i] !== -1) continue // already visited

    const neighbors = rangeQuery(points, i, eps)
    if (neighbors.length < minSamples) continue // noise point

    // Start a new cluster
    labels[i] = clusterId
    const queue = [...neighbors]

    while (queue.length > 0) {
      const j = queue.shift()!
      if (labels[j] === -1) labels[j] = clusterId // convert noise to border point
      if (labels[j] !== undefined && labels[j] < clusterId) continue // already in another cluster
      if (labels[j] === clusterId) continue

      labels[j] = clusterId
      const jNeighbors = rangeQuery(points, j, eps)
      if (jNeighbors.length >= minSamples) queue.push(...jNeighbors)
    }

    clusterId++
  }

  // Build cluster results
  const results: ClusterResult[] = []
  for (let c = 0; c < clusterId; c++) {
    const clusterPoints = points.filter((_, i) => labels[i] === c)
    if (clusterPoints.length === 0) continue
    results.push({
      cluster_id: c,
      center_lat: clusterPoints.reduce((s, p) => s + p.latitude, 0) / clusterPoints.length,
      center_lon: clusterPoints.reduce((s, p) => s + p.longitude, 0) / clusterPoints.length,
      incident_count: clusterPoints.length,
      avg_severity: clusterPoints.reduce((s, p) => s + p.severity_score, 0) / clusterPoints.length,
    })
  }

  return results.sort((a, b) => b.incident_count - a.incident_count)
}