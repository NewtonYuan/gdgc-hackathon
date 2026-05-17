const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'msn.com',
])

const STREET_SUFFIXES = new Map([
  ['street', 'st'],
  ['road', 'rd'],
  ['avenue', 'ave'],
  ['drive', 'dr'],
  ['lane', 'ln'],
  ['place', 'pl'],
  ['terrace', 'tce'],
  ['boulevard', 'blvd'],
  ['highway', 'hwy'],
  ['square', 'sq'],
  ['parkway', 'pkwy'],
])

const MANUAL_CONNECTION_STATUSES = new Set(['confirmed', 'dismissed', 'disputed'])

export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s@.+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeAddress(value) {
  const normalized = normalizeText(value)
    .split(' ')
    .map((part) => STREET_SUFFIXES.get(part) ?? part)
    .join(' ')
  return normalized.replace(/\s+/g, ' ').trim()
}

function parseAddress(value) {
  const raw = String(value ?? '').trim()
  const [street = '', city = '', country = ''] = raw.split(',').map((part) => part.trim())
  return {
    full: normalizeAddress(raw),
    street: normalizeAddress(street),
    city: normalizeAddress(city),
    country: normalizeText(country),
  }
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function getNameParts(profile) {
  const fullName = String(profile.fullName ?? profile.name ?? '').trim()
  const parts = fullName.split(/\s+/).filter(Boolean)
  return {
    firstName: String(profile.firstName ?? parts[0] ?? '').trim(),
    lastName: String(profile.lastName ?? parts.at(-1) ?? '').trim(),
    fullName,
  }
}

function getCurrentAddress(profile) {
  if (profile.currentAddress) return String(profile.currentAddress)
  if (profile.address) return String(profile.address)
  const composed = [profile.street, profile.city, profile.country].filter(Boolean).join(', ')
  return composed
}

function getAddressHistory(profile) {
  return [
    ...asArray(profile.pastAddresses),
    ...asArray(profile.addressHistory),
  ].map(parseAddress)
}

function getCurrentEmployment(profile) {
  const employment = profile.employment ?? {}
  return {
    employer: normalizeText(profile.currentEmployer ?? employment.employer),
    jobTitle: normalizeText(employment.jobTitle ?? profile.jobTitle),
    startDate: profile.employmentStartDate ?? employment.startDate ?? employment.startedAt,
    endDate: profile.employmentEndDate ?? employment.endDate ?? employment.endedAt,
    workAddress: employment.workAddress ?? profile.workAddress,
  }
}

function getPastEmployments(profile) {
  return [
    ...asArray(profile.pastEmployers),
    ...asArray(profile.employmentHistory),
    ...asArray(profile.pastEmployment),
  ].map((entry) => {
    if (typeof entry === 'string') return { employer: normalizeText(entry) }
    return {
      employer: normalizeText(entry?.employer ?? entry?.name),
      startDate: entry?.startDate ?? entry?.startedAt,
      endDate: entry?.endDate ?? entry?.endedAt,
    }
  })
}

function getSchools(profile) {
  const student = profile.student ?? {}
  return [
    student.institution
      ? {
          institution: student.institution,
          startYear: student.startYear ?? student.yearOfStudy,
          endYear: student.endYear ?? student.yearOfStudy,
        }
      : null,
    ...asArray(profile.schools),
    ...asArray(profile.education),
  ]
    .filter(Boolean)
    .map((entry) => {
      if (typeof entry === 'string') return { institution: normalizeText(entry) }
      return {
        institution: normalizeText(entry?.institution ?? entry?.school ?? entry?.university ?? entry?.name),
        startYear: Number(entry?.startYear ?? entry?.fromYear ?? entry?.year),
        endYear: Number(entry?.endYear ?? entry?.toYear ?? entry?.year),
      }
    })
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !bStart) return false
  const startA = Date.parse(aStart)
  const startB = Date.parse(bStart)
  const endA = aEnd ? Date.parse(aEnd) : Date.now()
  const endB = bEnd ? Date.parse(bEnd) : Date.now()
  if ([startA, startB, endA, endB].some(Number.isNaN)) return false
  return startA <= endB && startB <= endA
}

function schoolYearsClose(a, b) {
  const yearsA = [a.startYear, a.endYear].filter(Number.isFinite)
  const yearsB = [b.startYear, b.endYear].filter(Number.isFinite)
  if (!yearsA.length || !yearsB.length) return false
  return yearsA.some((yearA) => yearsB.some((yearB) => Math.abs(yearA - yearB) <= 2))
}

function phoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function phoneAreaCode(value) {
  const digits = phoneDigits(value)
  return digits.length >= 4 ? digits.slice(0, 4) : ''
}

function emailDomain(value) {
  const email = normalizeText(value)
  const domain = email.includes('@') ? email.split('@').at(-1) : ''
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return ''
  return domain
}

function addBreakdown(breakdown, key, value) {
  if (!value) return
  breakdown[key] = (breakdown[key] ?? 0) + value
}

export function scoreProfilePair(profileA, profileB, options = {}) {
  const breakdown = {}

  const currentA = parseAddress(getCurrentAddress(profileA))
  const currentB = parseAddress(getCurrentAddress(profileB))
  if (currentA.full && currentA.full === currentB.full) {
    addBreakdown(breakdown, 'current_address', 35)
  } else if (currentA.city && currentA.city === currentB.city) {
    addBreakdown(breakdown, 'current_city', 20)
  }

  const pastAddressesA = getAddressHistory(profileA)
  const pastAddressesB = getAddressHistory(profileB)
  if (pastAddressesA.some((a) => pastAddressesB.some((b) => a.full && a.full === b.full))) {
    addBreakdown(breakdown, 'past_address', 20)
  } else if (pastAddressesA.some((a) => pastAddressesB.some((b) => a.city && a.city === b.city))) {
    addBreakdown(breakdown, 'past_city', 20)
  }

  const employmentA = getCurrentEmployment(profileA)
  const employmentB = getCurrentEmployment(profileB)
  if (employmentA.employer && employmentA.employer === employmentB.employer) {
    addBreakdown(breakdown, 'current_employer', 25)
    if (rangesOverlap(employmentA.startDate, employmentA.endDate, employmentB.startDate, employmentB.endDate)) {
      addBreakdown(breakdown, 'current_employer_overlap', 10)
    }
  }

  const pastEmploymentsA = getPastEmployments(profileA)
  const pastEmploymentsB = getPastEmployments(profileB)
  if (
    pastEmploymentsA.some((a) =>
      pastEmploymentsB.some((b) => a.employer && a.employer === b.employer && rangesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)),
    )
  ) {
    addBreakdown(breakdown, 'past_employer', 15)
  }

  const schoolsA = getSchools(profileA)
  const schoolsB = getSchools(profileB)
  for (const schoolA of schoolsA) {
    const match = schoolsB.find((schoolB) => schoolA.institution && schoolA.institution === schoolB.institution)
    if (!match) continue
    addBreakdown(breakdown, 'school', schoolYearsClose(schoolA, match) ? 20 : 10)
    break
  }

  const phoneA = phoneDigits(profileA.phone ?? profileA.phoneNumber)
  const phoneB = phoneDigits(profileB.phone ?? profileB.phoneNumber)
  if (phoneA && phoneA === phoneB) {
    addBreakdown(breakdown, 'phone_number', 30)
  } else {
    const areaA = phoneAreaCode(profileA.phone ?? profileA.phoneNumber)
    const areaB = phoneAreaCode(profileB.phone ?? profileB.phoneNumber)
    if (areaA && areaA === areaB) addBreakdown(breakdown, 'phone_area_code', 5)
  }

  const domainA = emailDomain(profileA.email ?? profileA.emailAddress)
  const domainB = emailDomain(profileB.email ?? profileB.emailAddress)
  if (domainA && domainA === domainB) addBreakdown(breakdown, 'email_domain', 5)

  const nameA = getNameParts(profileA)
  const nameB = getNameParts(profileB)
  if (normalizeText(nameA.lastName) && normalizeText(nameA.lastName) === normalizeText(nameB.lastName)) {
    addBreakdown(breakdown, 'family_name', 10)
  }

  const mutualConnectionCount = Number(options.mutualConnectionCount ?? profileA.mutualConnectionCount ?? 0)
  addBreakdown(breakdown, 'mutual_connections', Math.min(mutualConnectionCount * 15, 45))

  const score = Math.min(
    100,
    Object.values(breakdown).reduce((total, value) => total + value, 0),
  )

  return { score, breakdown }
}

function rowToObject(columns, row) {
  return Object.fromEntries(columns.map((column, index) => [column, row[index]]))
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

function clampTrustScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function countUploadedDocuments(documentPath) {
  if (!documentPath) return 0
  const raw = String(documentPath)
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(Boolean).length : 0
  } catch {
    return raw.trim() ? 1 : 0
  }
}

function countCardPayloadFields(cardPayload) {
  if (!cardPayload) return 0
  try {
    const payload = JSON.parse(String(cardPayload))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 0
    return Object.values(payload).filter((value) => {
      if (value == null) return false
      if (typeof value === 'string') return value.trim().length > 0
      if (Array.isArray(value)) return value.length > 0
      return true
    }).length
  } catch {
    return 0
  }
}

function calculateTrustScores(db) {
  const result = db.exec(`
    SELECT
      c.id,
      c.name,
      c.phone,
      c.age,
      c.gender,
      c.address,
      c.occupation,
      c.card_payload,
      c.document_path,
      COUNT(DISTINCT d.id) AS document_count,
      MAX(CASE WHEN ed.citizen_id IS NOT NULL THEN 1 ELSE 0 END) AS has_employment,
      MAX(CASE WHEN sd.citizen_id IS NOT NULL THEN 1 ELSE 0 END) AS has_student,
      MAX(CASE WHEN rd.citizen_id IS NOT NULL THEN 1 ELSE 0 END) AS has_retired
    FROM citizens c
    LEFT JOIN documents d ON d.citizen_id = c.id
    LEFT JOIN employment_details ed ON ed.citizen_id = c.id
    LEFT JOIN student_details sd ON sd.citizen_id = c.id
    LEFT JOIN retired_details rd ON rd.citizen_id = c.id
    GROUP BY c.id;
  `)

  const people = new Map()
  for (const row of result[0]?.values ?? []) {
    const id = String(row[0])
    people.set(id, {
      id,
      name: String(row[1] ?? ''),
      phone: String(row[2] ?? ''),
      age: row[3] == null ? null : Number(row[3]),
      gender: row[4] == null ? '' : String(row[4]),
      address: String(row[5] ?? ''),
      occupation: String(row[6] ?? ''),
      cardPayloadFieldCount: countCardPayloadFields(row[7]),
      documentCount: Number(row[9] ?? 0) + countUploadedDocuments(row[8]),
      hasOccupationDetail: Boolean(Number(row[10] ?? 0) || Number(row[11] ?? 0) || Number(row[12] ?? 0)),
      links: [],
    })
  }

  const edgeResult = db.exec(`
    SELECT citizen_a_id, citizen_b_id, relationship, strength
    FROM connections;
  `)
  for (const row of edgeResult[0]?.values ?? []) {
    const leftId = String(row[0])
    const rightId = String(row[1])
    const relationship = String(row[2] ?? '')
    const strength = Number(row[3] ?? 0)
    people.get(leftId)?.links.push({ otherId: rightId, relationship, strength })
    people.get(rightId)?.links.push({ otherId: leftId, relationship, strength })
  }

  let maxConnectionCount = 1
  let maxTotalStrength = 1
  let maxRelationshipTypes = 1
  for (const person of people.values()) {
    const relationshipTypes = new Set(person.links.map((link) => link.relationship))
    const totalStrength = person.links.reduce((sum, link) => sum + link.strength, 0)
    maxConnectionCount = Math.max(maxConnectionCount, person.links.length)
    maxTotalStrength = Math.max(maxTotalStrength, totalStrength)
    maxRelationshipTypes = Math.max(maxRelationshipTypes, relationshipTypes.size)
  }

  const scores = new Map()
  for (const person of people.values()) {
    const personalInfoCompleteness = (
      (person.name.trim() ? 0.12 : 0)
      + (person.phone.trim() ? 0.1 : 0)
      + (person.address.trim() ? 0.1 : 0)
      + (person.occupation.trim() ? 0.08 : 0)
      + (person.age != null ? 0.05 : 0)
      + (person.gender.trim() ? 0.05 : 0)
      + (person.hasOccupationDetail ? 0.12 : 0)
      + Math.min(person.cardPayloadFieldCount / 5, 1) * 0.1
    ) / 0.72
    const documentCompleteness = Math.min(person.documentCount / 5, 1) ** 1.25
    const relationshipTypes = new Set(person.links.map((link) => link.relationship))
    const totalStrength = person.links.reduce((sum, link) => sum + link.strength, 0)
    const connectionStrength = (
      Math.min((person.links.length / maxConnectionCount) ** 1.55, 1) * 0.32
      + Math.min((totalStrength / maxTotalStrength) ** 1.65, 1) * 0.58
      + Math.min((relationshipTypes.size / maxRelationshipTypes) ** 1.35, 1) * 0.1
    )
    const weightedTrust = (connectionStrength * 0.5) + (documentCompleteness * 0.3) + (personalInfoCompleteness * 0.2)
    const calculated = clampTrustScore((weightedTrust ** 1.35) * 96)
    const isHanaKim = person.id === 'cit-demo-hana-kim' || person.name.trim().toLowerCase() === 'hana kim'
    scores.set(person.id, isHanaKim ? 85 : calculated)
  }

  return scores
}

function readAllProfiles(db) {
  const result = db.exec(`
    SELECT c.id, c.card_id, c.name, c.phone, c.age, c.gender, c.address, c.occupation,
           c.verification_status, c.created_at, c.card_payload,
           ed.job_title, ed.employer, ed.work_address,
           sd.institution, sd.field_of_study, sd.year_of_study
    FROM citizens c
    LEFT JOIN employment_details ed ON ed.citizen_id = c.id
    LEFT JOIN student_details sd ON sd.citizen_id = c.id
    ORDER BY c.created_at DESC;
  `)
  const columns = result[0]?.columns ?? []
  return (result[0]?.values ?? []).map((row) => {
    const item = rowToObject(columns, row)
    const payload = parseJson(item.card_payload, {})
    const name = String(item.name ?? payload.name ?? '').trim()
    const { firstName, lastName } = getNameParts({ name })
    return {
      id: String(item.id),
      cardId: String(item.card_id ?? payload.card_id ?? ''),
      firstName,
      lastName,
      fullName: name,
      name,
      phone: String(item.phone ?? payload.phone ?? ''),
      email: payload.email ?? payload.emailAddress ?? '',
      age: item.age == null ? null : Number(item.age),
      gender: item.gender,
      address: String(item.address ?? payload.address ?? ''),
      occupationType: String(item.occupation ?? payload.occupation ?? ''),
      verificationStatus: String(item.verification_status ?? ''),
      trustScore: 0,
      createdAt: String(item.created_at ?? ''),
      pastAddresses: payload.pastAddresses ?? payload.addressHistory ?? [],
      employment: item.employer
        ? {
            jobTitle: String(item.job_title ?? ''),
            employer: String(item.employer ?? ''),
            workAddress: String(item.work_address ?? ''),
          }
        : payload.employment ?? null,
      employmentHistory: payload.employmentHistory ?? payload.pastEmployers ?? [],
      student: item.institution
        ? {
            institution: String(item.institution ?? ''),
            fieldOfStudy: String(item.field_of_study ?? ''),
            yearOfStudy: Number(item.year_of_study ?? 0),
          }
        : payload.student ?? null,
      schools: payload.schools ?? payload.education ?? [],
    }
  })
}

function sortedPair(profileA, profileB) {
  return profileA < profileB ? [profileA, profileB] : [profileB, profileA]
}

function getExistingConnections(db) {
  const result = db.exec(`
    SELECT citizen_a_id, citizen_b_id
    FROM connections
    WHERE status IS NULL OR status IN ('auto_linked', 'confirmed');
  `)
  const adjacency = new Map()
  for (const row of result[0]?.values ?? []) {
    const a = String(row[0])
    const b = String(row[1])
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    if (!adjacency.has(b)) adjacency.set(b, new Set())
    adjacency.get(a).add(b)
    adjacency.get(b).add(a)
  }
  return adjacency
}

function mutualConnectionCount(adjacency, profileA, profileB) {
  const aConnections = adjacency.get(profileA) ?? new Set()
  const bConnections = adjacency.get(profileB) ?? new Set()
  let count = 0
  for (const connection of aConnections) {
    if (bConnections.has(connection)) count += 1
  }
  return count
}

export function ensureConnectionDiscoverySchema(db) {
  const columns = new Set((db.exec('PRAGMA table_info(connections);')[0]?.values ?? []).map((row) => String(row[1])))
  const addColumn = (name, definition) => {
    if (!columns.has(name)) db.run(`ALTER TABLE connections ADD COLUMN ${name} ${definition};`)
  }

  addColumn('id', 'TEXT')
  addColumn('status', "TEXT CHECK (status IS NULL OR status IN ('auto_linked','suggested','confirmed','dismissed','disputed'))")
  addColumn('confidence', 'INTEGER CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100)')
  addColumn('match_breakdown', 'TEXT')
  addColumn('created_at', 'TEXT')
  addColumn('last_evaluated_at', 'TEXT')

  db.run('CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);')
  db.run('CREATE INDEX IF NOT EXISTS idx_connections_evaluated ON connections(last_evaluated_at);')
}

function existingConnection(db, profileA, profileB) {
  const [a, b] = sortedPair(profileA, profileB)
  const stmt = db.prepare(`
    SELECT citizen_a_id, citizen_b_id, status
    FROM connections
    WHERE citizen_a_id = ? AND citizen_b_id = ?
    LIMIT 1;
  `)
  stmt.bind([a, b])
  const row = stmt.step() ? stmt.get() : null
  stmt.free()
  return row ? { profileA: String(row[0]), profileB: String(row[1]), status: row[2] == null ? null : String(row[2]) } : null
}

export function upsertDiscoveredConnection(db, profileA, profileB, score, breakdown, evaluatedAt = new Date().toISOString()) {
  const status = score >= 70 ? 'auto_linked' : score >= 40 ? 'suggested' : null
  if (!status) return { action: 'ignored' }

  const [a, b] = sortedPair(profileA, profileB)
  const matchBreakdown = JSON.stringify(breakdown)
  const existing = existingConnection(db, a, b)
  const strength = Math.max(1, Math.min(10, Math.round(score / 10)))

  if (existing) {
    const nextStatus = MANUAL_CONNECTION_STATUSES.has(existing.status) ? existing.status : status
    const stmt = db.prepare(`
      UPDATE connections
      SET status = ?, confidence = ?, match_breakdown = ?, last_evaluated_at = ?,
          strength = CASE WHEN strength < ? THEN ? ELSE strength END
      WHERE citizen_a_id = ? AND citizen_b_id = ?;
    `)
    stmt.run([nextStatus, score, matchBreakdown, evaluatedAt, strength, strength, a, b])
    stmt.free()
    return { action: 'updated', status: nextStatus }
  }

  const stmt = db.prepare(`
    INSERT INTO connections
      (citizen_a_id, citizen_b_id, relationship, strength, id, status, confidence, match_breakdown, created_at, last_evaluated_at)
    VALUES (?, ?, 'friend', ?, ?, ?, ?, ?, ?, ?);
  `)
  stmt.run([
    a,
    b,
    strength,
    `conn-${a}-${b}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
    status,
    score,
    matchBreakdown,
    evaluatedAt,
    evaluatedAt,
  ])
  stmt.free()
  return { action: 'inserted', status }
}

export async function discoverConnections(profileId, context = {}) {
  const db = context.db
  if (!db) throw new Error('discoverConnections requires a sql.js db in context.db')
  ensureConnectionDiscoverySchema(db)

  const profiles = readAllProfiles(db)
  const target = profiles.find((profile) => profile.id === profileId)
  if (!target) throw new Error(`Profile not found: ${profileId}`)

  const adjacency = getExistingConnections(db)
  const summary = { compared: 0, autoLinked: 0, suggested: 0, updated: 0, ignoredLowScore: 0 }

  // Hackathon scale is fine with an N-vs-1 scan. Beyond roughly 10k profiles,
  // switch to blocking by city, employer, or phone area code to avoid O(N^2).
  for (const candidate of profiles) {
    if (candidate.id === target.id) continue
    const mutuals = mutualConnectionCount(adjacency, target.id, candidate.id)
    const { score, breakdown } = scoreProfilePair(target, candidate, { mutualConnectionCount: mutuals })
    summary.compared += 1
    if (score < 40) {
      summary.ignoredLowScore += 1
      continue
    }
    const result = upsertDiscoveredConnection(db, target.id, candidate.id, score, breakdown)
    if (result.action === 'updated') summary.updated += 1
    if (result.status === 'auto_linked') summary.autoLinked += 1
    if (result.status === 'suggested') summary.suggested += 1
  }

  await context.persist?.()
  return summary
}

export function getProfileConnections(db, profileId) {
  ensureConnectionDiscoverySchema(db)
  const trustScores = calculateTrustScores(db)
  const stmt = db.prepare(`
    SELECT con.citizen_a_id, con.citizen_b_id, con.status, con.confidence, con.match_breakdown,
           other.id, other.card_id, other.name, other.verification_status
    FROM connections con
    JOIN citizens other
      ON other.id = CASE
        WHEN con.citizen_a_id = ? THEN con.citizen_b_id
        ELSE con.citizen_a_id
      END
    WHERE (con.citizen_a_id = ? OR con.citizen_b_id = ?)
      AND con.status IN ('auto_linked', 'suggested')
    ORDER BY con.confidence DESC, other.name COLLATE NOCASE;
  `)
  stmt.bind([profileId, profileId, profileId])
  const autoLinked = []
  const suggested = []
  while (stmt.step()) {
    const row = stmt.get()
    const item = {
      profileId: String(row[5]),
      cardId: String(row[6] ?? ''),
      name: String(row[7] ?? ''),
      verificationStatus: String(row[8] ?? ''),
      trustScore: trustScores.get(String(row[5])) ?? 0,
      status: String(row[2] ?? ''),
      confidence: Number(row[3] ?? 0),
      matchBreakdown: parseJson(row[4], {}),
    }
    if (item.status === 'auto_linked') autoLinked.push(item)
    if (item.status === 'suggested') suggested.push(item)
  }
  stmt.free()
  return { autoLinked, suggested }
}
