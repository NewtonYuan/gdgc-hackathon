import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { RecordEntry } from '../components/DatabaseTab'

const seedRows: RecordEntry[] = [
  { name: 'Sarah Chen', role: 'Nurse', district: 'Sector 4', status: 'Verified' },
  { name: 'Marcus Hale', role: 'Engineer', district: 'Sector 2', status: 'Missing' },
  { name: 'Lina Torres', role: 'Security', district: '???', status: 'Corrupted' },
  { name: 'James Rowe', role: 'Engineer', district: 'Sector 2', status: 'Verified' },
  { name: 'Owen Liu', role: 'Security', district: 'Sector 2', status: 'Missing' },
  { name: 'Petra Hale', role: 'Medic', district: 'Sector 3', status: 'Verified' },
]

let sqlJs: SqlJsStatic | null = null
let db: Database | null = null

async function getDatabase(): Promise<Database> {
  if (db) {
    return db
  }

  if (!sqlJs) {
    sqlJs = await initSqlJs({
      locateFile: () => wasmUrl,
    })
  }

  const nextDb = new sqlJs.Database()

  nextDb.exec(`
    CREATE TABLE records (
      name TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      district TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `)

  const insertStmt = nextDb.prepare(
    'INSERT INTO records (name, role, district, status) VALUES (?, ?, ?, ?);',
  )

  for (const row of seedRows) {
    insertStmt.run([row.name, row.role, row.district, row.status])
  }

  insertStmt.free()
  db = nextDb
  return nextDb
}

export async function fetchRecords(): Promise<RecordEntry[]> {
  const database = await getDatabase()
  const result = database.exec('SELECT name, role, district, status FROM records ORDER BY name ASC;')

  if (!result[0]) {
    return []
  }

  return result[0].values.map((value: SqlValue[]) => ({
    name: String(value[0]),
    role: String(value[1]),
    district: String(value[2]),
    status: value[3] as RecordEntry['status'],
  }))
}
