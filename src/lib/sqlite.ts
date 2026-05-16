import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import initSql from '../db/init.sql?raw'
import type { RecordEntry } from '../components/DatabaseTab'

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
  nextDb.exec(initSql)

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
