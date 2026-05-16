import { useEffect, useState } from 'react'
import './App.css'
import DatabaseTab from './components/DatabaseTab'
import GraphTab from './components/GraphTab'
import NpcTab from './components/NpcTab'
import { INITIAL_QUESTIONS, NPC_POOL } from './lib/gameData'
import { STARTING_LIVES, getCurrentNpc, useGameLoop } from './lib/gameLoop'
import { DesktopRealtimeView, PhoneRealtimeView } from './realtime/RealtimeViews'
import UploadView from './realtime/UploadView'

function App() {
  const path = window.location.pathname.toLowerCase()

  if (path === '/desktop') {
    return <DesktopRealtimeView />
  }

  if (path === '/phone') {
    return <PhoneRealtimeView />
  }

  if (path === '/upload') {
    return <UploadView />
  }

  return <GameApp />
}

function GameApp() {
  const [started, setStarted] = useState(false)
  const [activeTab, setActiveTab] = useState<'database' | 'graph' | 'npc'>('database')
  const [booting, setBooting] = useState(true)
  const [bootProgress, setBootProgress] = useState(0)
  const { state, dispatch, loading, error } = useGameLoop()

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
                (prev < 35
                  ? 2.5 + Math.random() * 5.2
                  : prev < 75
                    ? 1.4 + Math.random() * 3.4
                    : 0.8 + Math.random() * 1.8),
              100,
            )

        const delay = shouldPause
          ? 140 + Math.random() * 260
          : prev < 40
            ? 55 + Math.random() * 90
            : prev < 78
              ? 90 + Math.random() * 130
              : 120 + Math.random() * 180

        if (next >= 100) {
          window.setTimeout(() => {
            if (!cancelled) {
              setBooting(false)
            }
          }, 200)
          return 100
        }

        timeoutId = window.setTimeout(tick, delay)
        return next
      })
    }

    timeoutId = window.setTimeout(tick, 80)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [started])

  if (!started) {
    return (
      <main className="boot-screen start-screen">
        <div className="caution-tape tape-one" aria-hidden="true" />
        <div className="caution-tape tape-two" aria-hidden="true" />
        <div className="start-actions">
          <button type="button" className="start-button" onClick={() => setStarted(true)}>
            START
          </button>
          <button type="button" className="start-button" onClick={() => window.location.assign('/upload')}>
            UPLOAD
          </button>
        </div>
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

      {error ? (
        <article className="panel" role="alert">
          <h2>Database Error</h2>
          <p className="tagline">{error}</p>
        </article>
      ) : loading || !state ? (
        <article className="panel" role="status" aria-live="polite">
          <h2>Loading Database</h2>
          <p className="tagline">Initializing SQLite records...</p>
        </article>
      ) : (
        <>
          <section className="hud" aria-label="Society status">
            <div className="hud-meter">
              <div className="hud-label">
                <span>Society Stability</span>
                <span>{state.stability}%</span>
              </div>
              <div className="stability-bar">
                <div className="stability-fill" style={{ width: `${state.stability}%` }} />
              </div>
            </div>
            <div className="hud-lives">
              <span>Lives</span>
              <div className="life-pips">
                {Array.from({ length: STARTING_LIVES }).map((_, index) => (
                  <span
                    key={index}
                    className={`life-pip ${index < state.lives ? '' : 'lost'}`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </section>

          {state.phase !== 'playing' ? (
            <EndScreen
              won={state.phase === 'won'}
              lostByLives={state.lives <= 0}
              stability={state.stability}
              correctCount={state.correctCount}
              mistakeCount={state.mistakeCount}
              lives={state.lives}
            />
          ) : (
            <>
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
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'graph'}
                  className={`tab-button ${activeTab === 'graph' ? 'active' : ''}`}
                  onClick={() => setActiveTab('graph')}
                >
                  Graph
                </button>
              </div>

              {activeTab === 'database' ? (
                <DatabaseTab database={state.database} />
              ) : activeTab === 'graph' ? (
                <GraphTab database={state.database} />
              ) : (
                (() => {
                  const npc = getCurrentNpc(state)
                  if (!npc) {
                    return null
                  }
                  return (
                    <NpcTab
                      npc={npc}
                      questions={INITIAL_QUESTIONS}
                      answered={state.answered}
                      outcome={state.outcome}
                      personNumber={state.npcIndex + 1}
                      totalPeople={NPC_POOL.length}
                      onAsk={(questionId) => dispatch({ type: 'ASK_QUESTION', questionId })}
                      onDecide={(decision) => dispatch({ type: 'DECIDE', decision })}
                      onContinue={() => dispatch({ type: 'CONTINUE' })}
                    />
                  )
                })()
              )}
            </>
          )}
        </>
      )}
    </main>
  )
}

type EndScreenProps = {
  won: boolean
  lostByLives: boolean
  stability: number
  correctCount: number
  mistakeCount: number
  lives: number
}

function EndScreen({
  won,
  lostByLives,
  stability,
  correctCount,
  mistakeCount,
  lives,
}: EndScreenProps) {
  const summary = won
    ? 'You held the line. The recovered records describe a society worth trusting again.'
    : lostByLives
      ? 'Too many wrong calls. Trust collapsed and the terminal went dark.'
      : 'The records ran dry before order was restored. The session ends unresolved.'

  return (
    <article className={`panel endscreen ${won ? 'won' : 'lost'}`} role="status" aria-live="polite">
      <h2>{won ? 'Society Stabilized' : 'Society Collapsed'}</h2>
      <p className="tagline">{summary}</p>
      <div className="endscreen-stats">
        <p>
          <span>Final stability</span> {stability}%
        </p>
        <p>
          <span>Correct calls</span> {correctCount}
        </p>
        <p>
          <span>Mistakes</span> {mistakeCount}
        </p>
        <p>
          <span>Lives remaining</span> {lives}
        </p>
      </div>
      <div className="actions">
        <button type="button" onClick={() => window.location.reload()}>
          Reinitialize Terminal
        </button>
      </div>
    </article>
  )
}

export default App
