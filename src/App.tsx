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
  const [started, setStarted] = useState(false)
  const [decision, setDecision] = useState<'VERIFY' | 'DENY' | null>(null)
  const [activeTab, setActiveTab] = useState<'database' | 'npc'>('database')
  const [booting, setBooting] = useState(true)
  const [bootProgress, setBootProgress] = useState(0)
  const [database, setDatabase] = useState<RecordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!started) {
      return
    }

    let cancelled = false
    let timeoutId = 0

    const tick = () => {
      if (cancelled) {
        return
      }

      setBootProgress((prev) => {
        if (prev >= 100) {
          return 100
        }

        const pauseChance = prev > 18 && prev < 92 ? 0.2 : 0.08
        const shouldPause = Math.random() < pauseChance
        const next = shouldPause
          ? prev
          : Math.min(
              prev +
                (prev < 35 ? 1.2 + Math.random() * 3.2 : prev < 75 ? 0.7 + Math.random() * 2.2 : 0.3 + Math.random() * 1.1),
              100,
            )

        const delay = shouldPause
          ? 380 + Math.random() * 700
          : prev < 40
            ? 170 + Math.random() * 200
            : prev < 78
              ? 230 + Math.random() * 310
              : 320 + Math.random() * 420

        if (next >= 100) {
          window.setTimeout(() => {
            if (!cancelled) {
              setBooting(false)
            }
          }, 620)
          return 100
        }

        timeoutId = window.setTimeout(tick, delay)
        return next
      })
    }

    timeoutId = window.setTimeout(tick, 260)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [started])

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

  if (!started) {
    return (
      <main className="boot-screen start-screen">
        <div className="caution-tape tape-one" aria-hidden="true" />
        <div className="caution-tape tape-two" aria-hidden="true" />
        <button type="button" className="start-button" onClick={() => setStarted(true)}>
          START
        </button>
      </main>
    )
  }

  if (booting) {
    return (
      <main className="boot-screen" role="status" aria-live="polite">
        <div className="boot-panel">
          <p className="boot-label">Loading...</p>
          <div className="boot-bar-track" aria-hidden="true">
            <div className="boot-bar-fill" style={{ width: `${bootProgress}%` }} />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="terminal-shell">
      <div className="scanlines" aria-hidden="true" />

      <header className="topbar">
        <h1>VERIFIED</h1>
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
