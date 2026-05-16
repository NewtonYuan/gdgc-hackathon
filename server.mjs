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
const uploadDbPath = path.join(dataDir, 'upload_records.db')
let uploadDb = null
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

async function persistUploadDb() {
  if (!uploadDb) {
    return
  }
  const bytes = uploadDb.export()
  await fs.writeFile(uploadDbPath, Buffer.from(bytes))
}

async function initUploadDb() {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.mkdir(uploadsDir, { recursive: true })

  SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file),
  })

  let bytes = null
  try {
    bytes = await fs.readFile(uploadDbPath)
  } catch {
    bytes = null
  }

  uploadDb = bytes ? new SQL.Database(new Uint8Array(bytes)) : new SQL.Database()

  uploadDb.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      occupation TEXT NOT NULL,
      address TEXT NOT NULL,
      card_id TEXT NOT NULL,
      card_payload TEXT NOT NULL,
      document_path TEXT,
      created_at TEXT NOT NULL
    );
  `)

  // Migration: add the address column to databases created before it existed.
  const columns = uploadDb.exec('PRAGMA table_info(submissions);')
  const hasAddress =
    columns.length > 0 && columns[0].values.some((row) => row[1] === 'address')
  if (!hasAddress) {
    uploadDb.exec("ALTER TABLE submissions ADD COLUMN address TEXT NOT NULL DEFAULT '';")
  }

  await persistUploadDb()
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
    if (!uploadDb) {
      res.status(500).json({ ok: false, error: 'Upload DB not initialized' })
      return
    }

    const name = String(req.body.name ?? '')
    const phone = String(req.body.phone ?? '')
    const occupation = String(req.body.occupation ?? '')
    const address = String(req.body.address ?? '')
    const cardId = String(req.body.cardID ?? '')
    const cardPayload = String(req.body.cardPayload ?? '{}')

    if (!name || !phone || !occupation || !address || !cardId) {
      res.status(400).json({ ok: false, error: 'Missing required fields' })
      return
    }

    const id = `sub-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const createdAt = new Date().toISOString()
    const documentPaths = Array.isArray(req.files)
      ? req.files.map((f) => `/uploads/${f.filename}`)
      : []

    const stmt = uploadDb.prepare(
      'INSERT INTO submissions (id, name, phone, occupation, address, card_id, card_payload, document_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
    )
    stmt.run([id, name, phone, occupation, address, cardId, cardPayload, JSON.stringify(documentPaths), createdAt])
    stmt.free()

    await persistUploadDb()

    res.json({
      ok: true,
      id,
      stored: {
        name,
        phone,
        occupation,
        address,
        cardId,
        documentPaths,
        createdAt,
      },
    })
  } catch (cause) {
    res.status(500).json({ ok: false, error: cause instanceof Error ? cause.message : 'Upload failed' })
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

await initUploadDb()
httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
