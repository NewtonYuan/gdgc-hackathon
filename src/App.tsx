import { useState } from 'react'
import './App.css'

type RecordEntry = {
  name: string
  role: string
  district: string
  status: 'Verified' | 'Missing' | 'Corrupted'
}

const DATABASE: RecordEntry[] = [
  { name: 'Sarah Chen', role: 'Nurse', district: 'Sector 4', status: 'Verified' },
  { name: 'Marcus Hale', role: 'Engineer', district: 'Sector 2', status: 'Missing' },
  { name: 'Lina Torres', role: 'Security', district: '???', status: 'Corrupted' },
]

const incomingClaim = {
  name: 'Marcus Hale',
  role: 'Power engineer',
  district: 'Sector 2',
  statement: "I'm Marcus Hale. Power engineer from Sector 2.",
}

function App() {
  const [decision, setDecision] = useState<'VERIFY' | 'DENY' | null>(null)

  const match = DATABASE.find((entry) => entry.name === incomingClaim.name)

  const analysis = (() => {
    if (!match) {
      return {
        shouldVerify: false,
        reason: 'No matching identity found in surviving records.',
      }
    }

    const roleLooksValid = incomingClaim.role.toLowerCase().includes(match.role.toLowerCase())
    const districtMatches = incomingClaim.district === match.district
    const statusAllowsVerification = match.status !== 'Corrupted'

    const shouldVerify = roleLooksValid && districtMatches && statusAllowsVerification

    if (shouldVerify) {
      return {
        shouldVerify: true,
        reason: 'Claim aligns with known role fragment and district.',
      }
    }

    return {
      shouldVerify: false,
      reason: 'Fragments conflict or are too damaged to trust this claim.',
    }
  })()

  return (
    <main className="terminal-shell">
      <div className="scanlines" aria-hidden="true" />

      <header className="topbar">
        <p className="eyebrow">Recovered Government Terminal // Session 04</p>
        <h1>VERIFY//DENY</h1>
        <p className="tagline">The database remembers fragments. You decide what survives.</p>
      </header>

      <section className="grid">
        <article className="panel">
          <h2>Database Snapshot</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>District</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {DATABASE.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.role}</td>
                  <td>{row.district}</td>
                  <td className={row.status.toLowerCase()}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="panel">
          <h2>Incoming NPC Claim</h2>
          <blockquote>{incomingClaim.statement}</blockquote>
          <div className="facts">
            <p>
              <span>Name:</span> {incomingClaim.name}
            </p>
            <p>
              <span>Role:</span> {incomingClaim.role}
            </p>
            <p>
              <span>District:</span> {incomingClaim.district}
            </p>
          </div>

          <div className="actions">
            <button type="button" className="verify" onClick={() => setDecision('VERIFY')}>
              VERIFY
            </button>
            <button type="button" className="deny" onClick={() => setDecision('DENY')}>
              DENY
            </button>
          </div>

          {decision && (
            <p className={`result ${decision === (analysis.shouldVerify ? 'VERIFY' : 'DENY') ? 'correct' : 'wrong'}`}>
              Decision: {decision} // {decision === (analysis.shouldVerify ? 'VERIFY' : 'DENY') ? 'CORRECT' : 'INCORRECT'}
              <br />
              <span>{analysis.reason}</span>
            </p>
          )}
        </article>
      </section>
    </main>
  )
}

export default App
