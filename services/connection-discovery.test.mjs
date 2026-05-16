import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'
import {
  ensureConnectionDiscoverySchema,
  scoreProfilePair,
  upsertDiscoveredConnection,
} from './connection-discovery.mjs'

function score(a, b, options) {
  return scoreProfilePair(a, b, options).breakdown
}

{
  const breakdown = score(
    { address: '12 Riverside Street, Auckland', employment: { employer: 'Aurora General Hospital' }, phone: '+64 21 555 0101' },
    { address: '12 Riverside St, Auckland', employment: { employer: 'aurora general hospital' }, phone: '+64 21 555 0101' },
  )
  assert.equal(breakdown.current_address, 35)
  assert.equal(breakdown.current_employer, 25)
  assert.equal(breakdown.phone_number, 30)
}

{
  const breakdown = score(
    {
      address: '1 Queen St, Auckland',
      pastAddresses: ['77 Old Road, Hamilton'],
      employmentHistory: [{ employer: 'Civic Works', startDate: '2020-01-01', endDate: '2021-01-01' }],
    },
    {
      address: '9 High St, Auckland',
      pastAddresses: ['77 Old Rd, Hamilton'],
      employmentHistory: [{ employer: 'civic works', startDate: '2020-06-01', endDate: '2022-01-01' }],
    },
  )
  assert.equal(breakdown.current_city, 20)
  assert.equal(breakdown.past_address, 20)
  assert.equal(breakdown.past_employer, 15)
}

{
  const closeYears = score(
    { schools: [{ institution: 'University of Auckland', year: 2030 }] },
    { schools: [{ institution: 'university of auckland', year: 2032 }] },
  )
  const differentYears = score(
    { schools: [{ institution: 'University of Auckland', year: 2020 }] },
    { schools: [{ institution: 'university of auckland', year: 2032 }] },
  )
  assert.equal(closeYears.school, 20)
  assert.equal(differentYears.school, 10)
}

{
  const breakdown = score(
    { phone: '+64 21 555 0101', email: 'a@gmail.com' },
    { phone: '+64 21 555 9999', email: 'b@gmail.com' },
  )
  assert.equal(breakdown.phone_area_code, 5)
  assert.equal(breakdown.email_domain, undefined)
}

{
  const breakdown = score(
    { email: 'ana@verified.example', fullName: 'Ana Patel' },
    { email: 'noah@verified.example', fullName: 'Noah Patel' },
    { mutualConnectionCount: 5 },
  )
  assert.equal(breakdown.email_domain, 5)
  assert.equal(breakdown.family_name, 10)
  assert.equal(breakdown.mutual_connections, 45)
}

{
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(`
    CREATE TABLE connections (
      citizen_a_id TEXT NOT NULL,
      citizen_b_id TEXT NOT NULL,
      relationship TEXT NOT NULL,
      strength INTEGER NOT NULL,
      PRIMARY KEY (citizen_a_id, citizen_b_id),
      CHECK (citizen_a_id < citizen_b_id)
    );
  `)
  ensureConnectionDiscoverySchema(db)
  upsertDiscoveredConnection(db, 'profile-b', 'profile-a', 72, { current_address: 35, current_employer: 25, family_name: 10 })
  upsertDiscoveredConnection(db, 'profile-a', 'profile-b', 65, { current_address: 35, current_city: 20, family_name: 10 })
  const rows = db.exec('SELECT citizen_a_id, citizen_b_id, status, confidence FROM connections;')[0].values
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], ['profile-a', 'profile-b', 'suggested', 65])
}

console.log('connection-discovery tests passed')
