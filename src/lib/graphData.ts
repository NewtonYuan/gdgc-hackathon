export type RecordEntry = {
  name: string
  role: string
  district: string
  status: 'Verified' | 'Missing' | 'Corrupted' | 'Trusted' | 'Unverified'
}

export type GraphStatusBucket = 'verified' | 'in-process' | 'not-verified'

export type PersonObject = {
  name: string
  role: string
  district: string
  status: RecordEntry['status']
  graphStatus: GraphStatusBucket
}

export type GraphNodeData = {
  id: string
  label: string
  shortLabel: string
  person: PersonObject
  statusBucket: GraphStatusBucket
}

export type GraphEdgeData = {
  id: string
  source: string
  target: string
  weight: number
  overlapScore: number
  overlapSummary: string
}

export function toStatusBucket(status: RecordEntry['status']): GraphStatusBucket {
  if (status === 'Verified' || status === 'Trusted') {
    return 'verified'
  }

  if (status === 'Missing' || status === 'Unverified') {
    return 'in-process'
  }

  return 'not-verified'
}

export function toInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return '?.?'
  }

  const first = parts[0]?.[0]?.toUpperCase() ?? '?'
  const last = (parts[parts.length - 1]?.[0] ?? '?').toUpperCase()
  return `${first}.${last}`
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function tokenize(value: string): string[] {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function uniqueOverlap(left: string[], right: string[]): string[] {
  const rightSet = new Set(right)
  return [...new Set(left.filter((token) => rightSet.has(token)))]
}

function computeOverlap(left: RecordEntry, right: RecordEntry): { score: number; summary: string } {
  let score = 0
  const reasons: string[] = []

  if (normalize(left.role) === normalize(right.role)) {
    score += 45
    reasons.push(`role: ${left.role}`)
  } else {
    const sharedRoleTokens = uniqueOverlap(tokenize(left.role), tokenize(right.role))
    if (sharedRoleTokens.length > 0) {
      score += Math.min(25, sharedRoleTokens.length * 12)
      reasons.push(`role tokens: ${sharedRoleTokens.join(', ')}`)
    }
  }

  if (left.district !== '???' && right.district !== '???' && normalize(left.district) === normalize(right.district)) {
    score += 35
    reasons.push(`district: ${left.district}`)
  }

  const leftStatus = toStatusBucket(left.status)
  const rightStatus = toStatusBucket(right.status)
  if (leftStatus === rightStatus) {
    score += 20
    reasons.push(`status: ${leftStatus}`)
  }

  return {
    score,
    summary: reasons.join(' | '),
  }
}

export function buildGraphFromRecords(database: RecordEntry[]): {
  nodes: GraphNodeData[]
  edges: GraphEdgeData[]
} {
  const nodes = database.map((row) => {
    const statusBucket = toStatusBucket(row.status)

    return {
      id: row.name,
      label: toInitials(row.name),
      shortLabel: toInitials(row.name),
      person: {
        name: row.name,
        role: row.role,
        district: row.district,
        status: row.status,
        graphStatus: statusBucket,
      },
      statusBucket,
    }
  })

  const edges: GraphEdgeData[] = []

  for (let index = 0; index < database.length; index += 1) {
    const left = database[index]

    for (let nextIndex = index + 1; nextIndex < database.length; nextIndex += 1) {
      const right = database[nextIndex]
      const overlap = computeOverlap(left, right)

      if (overlap.score <= 0) {
        continue
      }

      edges.push({
        id: `${left.name}--${right.name}`,
        source: left.name,
        target: right.name,
        weight: overlap.score,
        overlapScore: overlap.score,
        overlapSummary: overlap.summary,
      })
    }
  }

  return { nodes, edges }
}
