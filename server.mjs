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
  let status = row[10] ? String(row[10]).toLowerCase() : 'pending'
  if (status === 'accepted') {
    status = 'verified'
  }
  if (status === 'declined') {
    status = 'invalid'
  }
  if (status !== 'pending' && status !== 'verified' && status !== 'invalid') {
    status = 'pending'
  }
  let documentPath = null
  if (row[8]) {
    const rawDocumentPath = String(row[8])
    try {
      const parsed = JSON.parse(rawDocumentPath)
      documentPath = Array.isArray(parsed) && parsed.length > 0 ? String(parsed[0]) : null
    } catch {
      documentPath = rawDocumentPath
    }
  }

  return {
    id: String(row[0]),
    citizenId: row[1] ? String(row[1]) : null,
    name: String(row[2] ?? ''),
    phone: String(row[3] ?? ''),
    occupation: String(row[4] ?? ''),
    address: String(row[5] ?? ''),
    cardId: String(row[6]),
    cardPayload: String(row[7] ?? '{}'),
    documentPath,
    createdAt: String(row[9]),
    decision: status,
    decidedAt: row[11] ? String(row[11]) : null,
  }
}

function mapCitizenRow(row) {
  return {
    id: String(row[0]),
    name: String(row[1]),
    phone: String(row[2]),
    age: row[3] == null ? null : Number(row[3]),
    gender: row[4] == null ? null : String(row[4]),
    address: String(row[5]),
    occupation: String(row[6]),
    verificationStatus: String(row[7]),
    trustScore: Number(row[8]),
    createdAt: String(row[9]),
  }
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

function calculateInitialTrustScore({ name, phone, occupation, address, documentCount }) {
  let score = 8
  if (name.trim()) score += 4
  if (phone.trim()) score += 4
  if (occupation.trim()) score += 3
  if (address.trim()) score += 4
  score += Math.min(documentCount, 3) * 5
  return Math.min(score, 35)
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

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file),
  })

  let bytes = null
  try {
    bytes = await fs.readFile(recordsDbPath)
  } catch {
    bytes = null
  }

  recordsDb = bytes ? new SQL.Database(new Uint8Array(bytes)) : new SQL.Database()

  recordsDb.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      citizen_id TEXT REFERENCES citizens(id) ON DELETE SET NULL,
      name TEXT,
      phone TEXT,
      occupation TEXT,
      address TEXT,
      card_id TEXT NOT NULL,
      card_payload TEXT,
      document_path TEXT,
      created_at TEXT NOT NULL,
      decision TEXT,
      decided_at TEXT
    );
  `)

  // Migrations for older DB files.
  const columns = recordsDb.exec('PRAGMA table_info(submissions);')
  const colNames = columns.length > 0 ? columns[0].values.map((row) => String(row[1])) : []
  if (!colNames.includes('citizen_id')) {
    recordsDb.exec('ALTER TABLE submissions ADD COLUMN citizen_id TEXT;')
  }
  if (!colNames.includes('address')) {
    recordsDb.exec("ALTER TABLE submissions ADD COLUMN address TEXT DEFAULT '';")
  }
  if (!colNames.includes('decision')) {
    recordsDb.exec('ALTER TABLE submissions ADD COLUMN decision TEXT;')
  }
  if (!colNames.includes('decided_at')) {
    recordsDb.exec('ALTER TABLE submissions ADD COLUMN decided_at TEXT;')
  }
  recordsDb.exec("UPDATE submissions SET decision = 'verified' WHERE lower(decision) = 'accepted';")
  recordsDb.exec("UPDATE submissions SET decision = 'invalid' WHERE lower(decision) = 'declined';")
  recordsDb.exec("UPDATE submissions SET decision = 'pending' WHERE decision IS NULL OR trim(decision) = '';")

  await persistRecordsDb()
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

    const id = `sub-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const citizenId = `cit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const createdAt = new Date().toISOString()
    const documentPaths = Array.isArray(req.files)
      ? req.files.map((f) => `/uploads/${f.filename}`)
      : []
    const trustScore = calculateInitialTrustScore({
      name,
      phone,
      occupation,
      address,
      documentCount: documentPaths.length,
    })

    const citizenStmt = recordsDb.prepare(
      'INSERT INTO citizens (id, name, phone, age, gender, address, occupation, verification_status, trust_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    )
    citizenStmt.run([citizenId, name, phone, null, null, address, occupation, 'pending', trustScore, createdAt])
    citizenStmt.free()

    const stmt = recordsDb.prepare(
      'INSERT INTO submissions (id, citizen_id, name, phone, occupation, address, card_id, card_payload, document_path, created_at, decision, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    )
    stmt.run([id, citizenId, name, phone, occupation, address, cardId, cardPayload, JSON.stringify(documentPaths), createdAt, 'pending', null])
    stmt.free()

    await persistRecordsDb()

    res.json({
      ok: true,
      id,
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

    const result = recordsDb.exec(
      'SELECT id, citizen_id, name, phone, occupation, address, card_id, card_payload, document_path, created_at, decision, decided_at FROM submissions ORDER BY created_at DESC;',
    )
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

app.get('/api/citizens', async (_req, res) => {
  try {
    if (!recordsDb) {
      res.status(500).json({ ok: false, error: 'Records DB not initialized' })
      return
    }

    const result = recordsDb.exec(`
      SELECT id, name, phone, age, gender, address, occupation,
             verification_status, trust_score, created_at
      FROM citizens
      ORDER BY name COLLATE NOCASE;
    `)
    const citizens = (result[0]?.values ?? []).map(mapCitizenRow)
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
      SELECT id, name, phone, age, gender, address, occupation,
             verification_status, trust_score, created_at
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
    const citizen = mapCitizenRow(citizenStmt.get())
    citizenStmt.free()

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
      'SELECT id, citizen_id, name, phone, occupation, address, card_id, card_payload, document_path, created_at, decision, decided_at FROM submissions WHERE id = ? LIMIT 1;',
    )
    stmt.bind([String(req.params.id)])
    if (!stmt.step()) {
      stmt.free()
      res.status(404).json({ ok: false, error: 'Submission not found' })
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
    const lookupStmt = recordsDb.prepare('SELECT citizen_id FROM submissions WHERE id = ? LIMIT 1;')
    lookupStmt.bind([String(req.params.id)])
    const citizenId = lookupStmt.step() ? lookupStmt.get()[0] : null
    lookupStmt.free()

    const stmt = recordsDb.prepare('UPDATE submissions SET decision = ?, decided_at = ? WHERE id = ?;')
    stmt.run([decision, decidedAt, String(req.params.id)])
    stmt.free()

    if (citizenId) {
      const status = decision === 'verified' ? 'verified' : 'denied'
      const trustScore = decision === 'verified' ? 55 : 10
      const citizenStmt = recordsDb.prepare('UPDATE citizens SET verification_status = ?, trust_score = ? WHERE id = ?;')
      citizenStmt.run([status, trustScore, String(citizenId)])
      citizenStmt.free()
    }

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

    const lookupStmt = recordsDb.prepare('SELECT citizen_id FROM submissions WHERE id = ? LIMIT 1;')
    lookupStmt.bind([String(req.params.id)])
    const citizenId = lookupStmt.step() ? lookupStmt.get()[0] : null
    lookupStmt.free()

    const stmt = recordsDb.prepare('DELETE FROM submissions WHERE id = ?;')
    stmt.run([String(req.params.id)])
    stmt.free()

    if (citizenId) {
      const citizenStmt = recordsDb.prepare('DELETE FROM citizens WHERE id = ?;')
      citizenStmt.run([String(citizenId)])
      citizenStmt.free()
    }

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
