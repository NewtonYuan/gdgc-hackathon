import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import fs from 'node:fs/promises'
import multer from 'multer'
import initSqlJs from 'sql.js'
import { WebSocketServer } from 'ws'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)
const wss = new WebSocketServer({ noServer: true })

const clients = new Map()

const dataDir = path.join(__dirname, 'data')
const uploadsDir = path.join(__dirname, 'uploads')
const recordsDbPath = path.join(dataDir, 'records.db')
let recordsDb = null
let SQL = null

function createServerId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `srv-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function sendJson(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function mapSubmissionRow(row) {
  let status = row[9] ? String(row[9]).toLowerCase() : 'pending'
  if (status === 'denied') {
    status = 'invalid'
  }
  if (status === 'unverified') {
    status = 'pending'
  }
  if (status !== 'pending' && status !== 'verified' && status !== 'invalid') {
    status = 'pending'
  }
  let documentPath = null
  if (row[7]) {
    const rawDocumentPath = String(row[7])
    try {
      const parsed = JSON.parse(rawDocumentPath)
      documentPath = Array.isArray(parsed) && parsed.length > 0 ? rawDocumentPath : null
    } catch {
      documentPath = rawDocumentPath
    }
  }

  return {
    id: String(row[0]),
    citizenId: String(row[0]),
    name: String(row[1] ?? ''),
    phone: String(row[2] ?? ''),
    occupation: String(row[3] ?? ''),
    address: String(row[4] ?? ''),
    cardId: String(row[5]),
    cardPayload: String(row[6] ?? '{}'),
    documentPath,
    createdAt: String(row[8]),
    decision: status,
    decidedAt: row[10] ? String(row[10]) : null,
  }
}

function mapCitizenRow(row, realtimeTrustScores = null) {
  const id = String(row[0])
  return {
    id,
    cardId: String(row[1]),
    name: String(row[2]),
    phone: String(row[3]),
    age: row[4] == null ? null : Number(row[4]),
    gender: row[5] == null ? null : String(row[5]),
    address: String(row[6]),
    occupation: String(row[7]),
    verificationStatus: String(row[8]),
    trustScore: realtimeTrustScores?.get(id) ?? Number(row[9]),
    createdAt: String(row[10]),
  }
}

function clampTrustScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function countUploadedDocuments(documentPath) {
  if (!documentPath) {
    return 0
  }

  const rawDocumentPath = String(documentPath)
  try {
    const parsed = JSON.parse(rawDocumentPath)
    return Array.isArray(parsed) ? parsed.filter(Boolean).length : 0
  } catch {
    return rawDocumentPath.trim() ? 1 : 0
  }
}

function countCardPayloadFields(cardPayload) {
  if (!cardPayload) {
    return 0
  }

  try {
    const payload = JSON.parse(String(cardPayload))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return 0
    }

    return Object.values(payload).filter((value) => {
      if (value == null) {
        return false
      }
      if (typeof value === 'string') {
        return value.trim().length > 0
      }
      if (Array.isArray(value)) {
        return value.length > 0
      }
      return true
    }).length
  } catch {
    return 0
  }
}

function calculateRealtimeTrustScores() {
  const result = recordsDb.exec(`
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

  const edgeResult = recordsDb.exec(`
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

    const weightedTrust = (
      connectionStrength * 0.5
      + documentCompleteness * 0.3
      + personalInfoCompleteness * 0.2
    )

    scores.set(person.id, clampTrustScore((weightedTrust ** 1.35) * 96))
  }

  return scores
}

function mapDocumentRow(row) {
  return {
    type: String(row[0]),
    documentNumber: String(row[1]),
    issuedDate: String(row[2]),
    expiryDate: row[3] ? String(row[3]) : null,
    issuingAuthority: String(row[4]),
  }
}

async function persistRecordsDb() {
  if (!recordsDb) {
    return
  }
  const bytes = recordsDb.export()
  await fs.writeFile(recordsDbPath, Buffer.from(bytes))
}

async function initRecordsDb() {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.mkdir(uploadsDir, { recursive: true })

  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file),
    })
  }

  let bytes = null
  try {
    bytes = await fs.readFile(recordsDbPath)
  } catch {
    bytes = null
  }

  recordsDb = bytes ? new SQL.Database(new Uint8Array(bytes)) : new SQL.Database()

  await persistRecordsDb()
}

function mapGraphStatus(status) {
  if (status === 'verified') {
    return 'verified'
  }

  if (status === 'pending') {
    return 'in-process'
  }

  return 'not-verified'
}

function splitName(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { firstName: 'Unknown', lastName: 'Citizen' }
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function splitAddress(address) {
  const parts = String(address ?? '').split(',').map((part) => part.trim()).filter(Boolean)
  return {
    street: parts[0] ?? '',
    city: parts[1] ?? '',
    country: parts.slice(2).join(', '),
  }
}

function initials(firstName, lastName) {
  const first = firstName.charAt(0).toUpperCase() || '?'
  const last = lastName.charAt(0).toUpperCase() || first
  return `${first}.${last}`
}

function loadRecordsGraph() {
  const realtimeTrustScores = calculateRealtimeTrustScores()
  const citizenResult = recordsDb.exec(`
    SELECT
      c.id,
      c.card_id,
      c.name,
      c.phone,
      c.age,
      c.gender,
      c.address,
      c.occupation,
      c.verification_status,
      0 AS trust_score,
      c.created_at,
      c.profile_source,
      c.card_payload,
      c.document_path,
      c.decided_at,
      ed.job_title,
      ed.employer,
      ed.work_address,
      sd.institution,
      sd.student_id,
      sd.field_of_study,
      sd.year_of_study,
      rd.former_occupation
    FROM citizens c
    LEFT JOIN employment_details ed ON ed.citizen_id = c.id
    LEFT JOIN student_details sd ON sd.citizen_id = c.id
    LEFT JOIN retired_details rd ON rd.citizen_id = c.id
    ORDER BY c.name COLLATE NOCASE, c.card_id COLLATE NOCASE;
  `)

  const documentResult = recordsDb.exec(`
    SELECT citizen_id, type, document_number, issued_date, expiry_date, issuing_authority
    FROM documents
    ORDER BY citizen_id, type;
  `)

  const edgeResult = recordsDb.exec(`
    SELECT citizen_a_id, citizen_b_id, relationship, strength
    FROM connections
    ORDER BY strength DESC, citizen_a_id, citizen_b_id;
  `)

  const documentsByCitizen = new Map()
  for (const row of documentResult[0]?.values ?? []) {
    const citizenId = String(row[0])
    const docs = documentsByCitizen.get(citizenId) ?? []
    docs.push({
      type: String(row[1] ?? ''),
      documentNumber: String(row[2] ?? ''),
      issuedDate: String(row[3] ?? ''),
      expiryDate: row[4] == null ? null : String(row[4]),
      issuingAuthority: String(row[5] ?? ''),
    })
    documentsByCitizen.set(citizenId, docs)
  }

  const nodes = (citizenResult[0]?.values ?? []).map((row) => {
    const citizenId = String(row[0])
    const name = String(row[2] ?? '').trim() || String(row[1])
    const { firstName, lastName } = splitName(name)
    const { street, city, country } = splitAddress(row[6])
    const verificationStatus = String(row[8])
    const label = initials(firstName, lastName)

    return {
      id: String(row[0]),
      label,
      shortLabel: label,
      statusBucket: mapGraphStatus(verificationStatus),
      person: {
        id: citizenId,
        cardId: String(row[1]),
        firstName,
        lastName,
        fullName: name,
        phone: String(row[3] ?? ''),
        age: row[4] == null ? null : Number(row[4]),
        gender: row[5] == null ? '' : String(row[5]),
        photoUrl: '/images/profile-placeholder.png',
        street,
        city,
        country,
        occupationType: String(row[7] ?? ''),
        verificationStatus,
        trustScore: realtimeTrustScores.get(citizenId) ?? Number(row[9] ?? 0),
        createdAt: String(row[10] ?? ''),
        profileSource: String(row[11] ?? ''),
        cardPayload: row[12] == null ? null : String(row[12]),
        documentPath: row[13] == null ? null : String(row[13]),
        decidedAt: row[14] == null ? null : String(row[14]),
        documents: documentsByCitizen.get(citizenId) ?? [],
        employment: row[15]
          ? {
              jobTitle: String(row[15]),
              employer: String(row[16]),
              workAddress: String(row[17]),
            }
          : null,
        student: row[18]
          ? {
              institution: String(row[18]),
              studentId: String(row[19]),
              fieldOfStudy: String(row[20]),
              yearOfStudy: Number(row[21]),
            }
          : null,
        retired: row[22]
          ? {
              formerOccupation: String(row[22]),
            }
          : null,
      },
    }
  })

  const edges = (edgeResult[0]?.values ?? []).map((row) => ({
    id: `${String(row[0])}--${String(row[1])}`,
    source: String(row[0]),
    target: String(row[1]),
    weight: Number(row[3]),
    relationship: String(row[2]),
    strength: Number(row[3]),
    overlapScore: Number(row[3]) * 10,
    overlapSummary: `${String(row[2])} (${String(row[3])}/10)`,
  }))

  return { nodes, edges }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (_req, file, cb) => {
    const safeBase = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}-${safeBase}`)
  },
})

const upload = multer({ storage })
app.use(express.json())

httpServer.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/ws')) {
    socket.destroy()
    return
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    const requestUrl = new URL(req.url, 'http://localhost')
    const role = requestUrl.searchParams.get('role') ?? 'unknown'
    const deviceId = requestUrl.searchParams.get('deviceId') ?? createServerId()

    clients.set(ws, { role, deviceId })

    ws.on('message', (raw) => {
      let payload
      try {
        payload = JSON.parse(String(raw))
      } catch {
        return
      }

      if (payload.type === 'scan') {
        for (const [client, meta] of clients.entries()) {
          if (meta.role === 'desktop') {
            sendJson(client, payload)
          }
        }
        return
      }

      if (payload.type === 'verdict') {
        for (const [client, meta] of clients.entries()) {
          if (meta.role === 'phone' && meta.deviceId === payload.phoneId) {
            sendJson(client, payload)
          }
        }
      }
    })

    ws.on('close', () => {
      clients.delete(ws)
    })
  })
})

app.use('/uploads', express.static(uploadsDir))

app.post('/api/upload', upload.array('documents'), async (req, res) => {
  try {
    if (!recordsDb) {
      res.status(500).json({ ok: false, error: 'Records DB not initialized' })
      return
    }

    const name = String(req.body.name ?? '').trim()
    const phone = String(req.body.phone ?? '').trim()
    const occupation = String(req.body.occupation ?? '').trim()
    const address = String(req.body.address ?? '').trim()
    const cardId = String(req.body.cardID ?? '').trim() || createServerId()
    const cardPayload = String(req.body.cardPayload ?? '{}')

    const citizenId = `cit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const createdAt = new Date().toISOString()
    const documentPaths = Array.isArray(req.files)
      ? req.files.map((f) => `/uploads/${f.filename}`)
      : []

    const citizenStmt = recordsDb.prepare(
      'INSERT INTO citizens (id, card_id, name, phone, age, gender, address, occupation, verification_status, trust_score, created_at, profile_source, card_payload, document_path, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    )
    citizenStmt.run([citizenId, cardId, name, phone, null, null, address, occupation, 'pending', 0, createdAt, 'upload', cardPayload, JSON.stringify(documentPaths), null])
    citizenStmt.free()

    await persistRecordsDb()
    const realtimeTrustScores = calculateRealtimeTrustScores()
    const trustScore = realtimeTrustScores.get(citizenId) ?? 0

    res.json({
      ok: true,
      id: citizenId,
      stored: {
        citizenId,
        name,
        phone,
        occupation,
        address,
        cardId,
        documentPaths,
        createdAt,
        trustScore,
      },
    })
  } catch (cause) {
    res.status(500).json({ ok: false, error: cause instanceof Error ? cause.message : 'Upload failed' })
  }
})

app.get('/api/admin/submissions', async (_req, res) => {
  try {
    if (!recordsDb) {
      res.status(500).json({ ok: false, error: 'Records DB not initialized' })
      return
    }

    const result = recordsDb.exec(`
      SELECT id, name, phone, occupation, address, card_id, card_payload,
             document_path, created_at, verification_status, decided_at
      FROM citizens
      WHERE profile_source = 'upload'
      ORDER BY created_at DESC;
    `)
    const rows = result[0]?.values ?? []
    const submissions = rows.map(mapSubmissionRow).map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      occupation: row.occupation,
      address: row.address,
      cardId: row.cardId,
      createdAt: row.createdAt,
      decision: row.decision,
    }))
    res.json({ ok: true, submissions })
  } catch (cause) {
    res.status(500).json({ ok: false, error: cause instanceof Error ? cause.message : 'Failed to list submissions' })
  }
})

app.get('/api/admin/graph', async (_req, res) => {
  try {
    if (!recordsDb) {
      res.status(500).json({ ok: false, error: 'Records DB not initialized' })
      return
    }

    res.json({ ok: true, graph: loadRecordsGraph() })
  } catch (cause) {
    res.status(500).json({ ok: false, error: cause instanceof Error ? cause.message : 'Failed to load graph' })
  }
})

app.get('/api/citizens', async (_req, res) => {
  try {
    if (!recordsDb) {
      res.status(500).json({ ok: false, error: 'Records DB not initialized' })
      return
    }

    const result = recordsDb.exec(`
      SELECT id, card_id, name, phone, age, gender, address, occupation,
             verification_status, 0 AS trust_score, created_at
      FROM citizens
      ORDER BY name COLLATE NOCASE;
    `)
    const realtimeTrustScores = calculateRealtimeTrustScores()
    const citizens = (result[0]?.values ?? []).map((row) => mapCitizenRow(row, realtimeTrustScores))
    res.json({ ok: true, citizens })
  } catch (cause) {
    res.status(500).json({ ok: false, error: cause instanceof Error ? cause.message : 'Failed to load citizens' })
  }
})

app.get('/api/citizens/:id', async (req, res) => {
  try {
    if (!recordsDb) {
      res.status(500).json({ ok: false, error: 'Records DB not initialized' })
      return
    }

    const citizenStmt = recordsDb.prepare(`
      SELECT id, card_id, name, phone, age, gender, address, occupation,
             verification_status, 0 AS trust_score, created_at
      FROM citizens
      WHERE id = ?
      LIMIT 1;
    `)
    citizenStmt.bind([String(req.params.id)])
    if (!citizenStmt.step()) {
      citizenStmt.free()
      res.status(404).json({ ok: false, error: 'Citizen not found' })
      return
    }
    const citizenRow = citizenStmt.get()
    citizenStmt.free()
    const realtimeTrustScores = calculateRealtimeTrustScores()
    const citizen = mapCitizenRow(citizenRow, realtimeTrustScores)

    let occupationDetail = null
    const employmentStmt = recordsDb.prepare('SELECT job_title, employer, work_address FROM employment_details WHERE citizen_id = ? LIMIT 1;')
    employmentStmt.bind([citizen.id])
    if (employmentStmt.step()) {
      const row = employmentStmt.get()
      occupationDetail = {
        jobTitle: String(row[0]),
        employer: String(row[1]),
        workAddress: String(row[2]),
      }
    }
    employmentStmt.free()

    if (!occupationDetail) {
      const stmt = recordsDb.prepare('SELECT institution, student_id, field_of_study, year_of_study FROM student_details WHERE citizen_id = ? LIMIT 1;')
      stmt.bind([citizen.id])
      if (stmt.step()) {
        const row = stmt.get()
        occupationDetail = {
          institution: String(row[0]),
          studentId: String(row[1]),
          fieldOfStudy: String(row[2]),
          yearOfStudy: Number(row[3]),
        }
      }
      stmt.free()
    }

    if (!occupationDetail) {
      const stmt = recordsDb.prepare('SELECT former_occupation FROM retired_details WHERE citizen_id = ? LIMIT 1;')
      stmt.bind([citizen.id])
      if (stmt.step()) {
        const row = stmt.get()
        occupationDetail = {
          formerOccupation: row[0] ? String(row[0]) : null,
        }
      }
      stmt.free()
    }

    const docsStmt = recordsDb.prepare(`
      SELECT type, document_number, issued_date, expiry_date, issuing_authority
      FROM documents
      WHERE citizen_id = ?
      ORDER BY issued_date DESC, type COLLATE NOCASE;
    `)
    docsStmt.bind([citizen.id])
    const documents = []
    while (docsStmt.step()) {
      documents.push(mapDocumentRow(docsStmt.get()))
    }
    docsStmt.free()

    res.json({ ok: true, citizen, occupationDetail, documents })
  } catch (cause) {
    res.status(500).json({ ok: false, error: cause instanceof Error ? cause.message : 'Failed to load citizen' })
  }
})

app.get('/api/admin/submissions/:id', async (req, res) => {
  try {
    if (!recordsDb) {
      res.status(500).json({ ok: false, error: 'Records DB not initialized' })
      return
    }

    const stmt = recordsDb.prepare(
      `SELECT id, name, phone, occupation, address, card_id, card_payload,
              document_path, created_at, verification_status, decided_at
       FROM citizens
       WHERE id = ?
       LIMIT 1;`,
    )
    stmt.bind([String(req.params.id)])
    if (!stmt.step()) {
      stmt.free()
      res.status(404).json({ ok: false, error: 'Citizen not found' })
      return
    }
    const row = stmt.get()
    stmt.free()
    const submission = mapSubmissionRow(row)
    res.json({ ok: true, submission })
  } catch (cause) {
    res.status(500).json({ ok: false, error: cause instanceof Error ? cause.message : 'Failed to load submission' })
  }
})

app.post('/api/admin/submissions/:id/decision', async (req, res) => {
  try {
    if (!recordsDb) {
      res.status(500).json({ ok: false, error: 'Records DB not initialized' })
      return
    }

    const decision = String(req.body?.decision ?? '').toLowerCase()
    if (decision !== 'verified' && decision !== 'invalid') {
      res.status(400).json({ ok: false, error: 'Invalid decision value' })
      return
    }

    const decidedAt = new Date().toISOString()
    const status = decision === 'verified' ? 'verified' : 'denied'
    const citizenStmt = recordsDb.prepare('UPDATE citizens SET verification_status = ?, decided_at = ? WHERE id = ?;')
    citizenStmt.run([status, decidedAt, String(req.params.id)])
    citizenStmt.free()

    await persistRecordsDb()

    res.json({ ok: true })
  } catch (cause) {
    res.status(500).json({ ok: false, error: cause instanceof Error ? cause.message : 'Failed to save decision' })
  }
})

app.delete('/api/admin/submissions/:id', async (req, res) => {
  try {
    if (!recordsDb) {
      res.status(500).json({ ok: false, error: 'Records DB not initialized' })
      return
    }

    const stmt = recordsDb.prepare('DELETE FROM citizens WHERE id = ?;')
    stmt.run([String(req.params.id)])
    stmt.free()

    await persistRecordsDb()

    res.json({ ok: true })
  } catch (cause) {
    res.status(500).json({ ok: false, error: cause instanceof Error ? cause.message : 'Failed to delete submission' })
  }
})

const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/{*any}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const port = Number(process.env.PORT ?? 3000)

await initRecordsDb()
httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
