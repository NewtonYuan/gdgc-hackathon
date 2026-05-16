export type VerificationStatus = 'verified' | 'unverified' | 'pending' | 'denied'

export type GraphStatusBucket = 'verified' | 'in-process' | 'not-verified'

export type PersonObject = {
  id: string
  firstName: string
  lastName: string
  fullName: string
  age: number
  gender: string
  photoUrl: string
  street: string
  city: string
  country: string
  occupationType: string
  verificationStatus: VerificationStatus
  trustScore: number
  createdAt: string
  employment: {
    jobTitle: string
    employer: string
    workAddress: string
  } | null
  student: {
    institution: string
    studentId: string
    fieldOfStudy: string
    yearOfStudy: number
  } | null
  retired: {
    formerOccupation: string | null
  } | null
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
  relationship: string
  strength: number
  overlapScore: number
  overlapSummary: string
}

export type GraphPayload = {
  nodes: GraphNodeData[]
  edges: GraphEdgeData[]
}

export function toStatusBucket(status: VerificationStatus): GraphStatusBucket {
  if (status === 'verified') {
    return 'verified'
  }

  if (status === 'pending') {
    return 'in-process'
  }

  return 'not-verified'
}
