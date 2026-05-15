import { useState } from 'react'
import './App.css'
import DatabaseTab, { type RecordEntry } from './components/DatabaseTab'
import NpcTab from './components/NpcTab'

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
  const [activeTab, setActiveTab] = useState<'database' | 'npc'>('database')

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

      <div className="tabs" role="tablist" aria-label="Terminal panels">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'database'}
          className={`tab-button ${activeTab === 'database' ? 'active' : ''}`}
          onClick={() => setActiveTab('database')}
        >
          Database
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'npc'}
          className={`tab-button ${activeTab === 'npc' ? 'active' : ''}`}
          onClick={() => setActiveTab('npc')}
        >
          Incoming NPC
        </button>
      </div>

      {activeTab === 'database' ? (
        <DatabaseTab database={DATABASE} />
      ) : (
        <NpcTab incomingClaim={incomingClaim} decision={decision} setDecision={setDecision} analysis={analysis} />
      )}
    </main>
  )
}

export default App
