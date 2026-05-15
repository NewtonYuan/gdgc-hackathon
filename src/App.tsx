import { useEffect, useMemo, useState } from 'react'
import './App.css'
import DatabaseTab, { type RecordEntry } from './components/DatabaseTab'
import NpcTab from './components/NpcTab'
import { fetchRecords } from './lib/sqlite'

const incomingClaim = {
  name: 'Marcus Hale',
  role: 'Power engineer',
  district: 'Sector 2',
  statement: "I'm Marcus Hale. Power engineer from Sector 2.",
}

function App() {
  const [decision, setDecision] = useState<'VERIFY' | 'DENY' | null>(null)
  const [activeTab, setActiveTab] = useState<'database' | 'npc'>('database')
  const [database, setDatabase] = useState<RecordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    fetchRecords()
      .then((rows) => {
        if (!active) {
          return
        }
        setDatabase(rows)
      })
      .catch((error: unknown) => {
        if (!active) {
          return
        }
        setLoadError(error instanceof Error ? error.message : 'Unknown SQLite error')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const analysis = useMemo(() => {
    const match = database.find((entry) => entry.name === incomingClaim.name)

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
  }, [database])

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

      {loading ? (
        <article className="panel" role="status" aria-live="polite">
          <h2>Loading Database</h2>
          <p className="tagline">Initializing SQLite records...</p>
        </article>
      ) : loadError ? (
        <article className="panel" role="alert">
          <h2>Database Error</h2>
          <p className="tagline">{loadError}</p>
        </article>
      ) : activeTab === 'database' ? (
        <DatabaseTab database={database} />
      ) : (
        <NpcTab incomingClaim={incomingClaim} decision={decision} setDecision={setDecision} analysis={analysis} />
      )}
    </main>
  )
}

export default App
