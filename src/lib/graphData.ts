import type { RecordEntry } from '../components/DatabaseTab'

export type GraphNodeData = {
  id: string
  label: string
  role: string
  district: string
  status: RecordEntry['status']
  statusBucket: 'verified' | 'in-process' | 'not-verified'
}

export type GraphEdgeData = {
  id: string
  source: string
  target: string
  weight: number
  reason: string
}

export function toStatusBucket(status: RecordEntry['status']): GraphNodeData['statusBucket'] {
  if (status === 'Verified' || status === 'Trusted') {
    return 'verified'
  }

  if (status === 'Corrupted') {
    return 'not-verified'
  }

  return 'in-process'
}

export function buildGraphFromRecords(database: RecordEntry[]): {
  nodes: GraphNodeData[]
  edges: GraphEdgeData[]
} {
  const nodes = database.map((row) => ({
    id: row.name,
    label: row.name,
    role: row.role,
    district: row.district,
    status: row.status,
    statusBucket: toStatusBucket(row.status),
  }))

  const edges: GraphEdgeData[] = []

  for (let index = 0; index < database.length; index += 1) {
    const left = database[index]

    for (let nextIndex = index + 1; nextIndex < database.length; nextIndex += 1) {
      const right = database[nextIndex]
      const sharedDistrict = left.district !== '???' && left.district === right.district
      const sharedRole = left.role === right.role

      if (!sharedDistrict && !sharedRole) {
        continue
      }

      let weight = 1
      const reasons: string[] = []

      if (sharedDistrict) {
        weight += 2
        reasons.push(`Shared district: ${left.district}`)
      }

      if (sharedRole) {
        weight += 1
        reasons.push(`Shared role: ${left.role}`)
      }

      edges.push({
        id: `${left.name}--${right.name}`,
        source: left.name,
        target: right.name,
        weight,
        reason: reasons.join(' | '),
      })
    }
  }

  return { nodes, edges }
}
