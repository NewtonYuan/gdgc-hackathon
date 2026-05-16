import { useState } from 'react'
import './App.css'
import DatabaseTab from './components/DatabaseTab'
import NpcTab from './components/NpcTab'
import { INITIAL_QUESTIONS, NPC_POOL } from './lib/gameData'
import { STARTING_LIVES, getCurrentNpc, useGameLoop } from './lib/gameLoop'

function App() {
  const [activeTab, setActiveTab] = useState<'database' | 'npc'>('database')
  const { state, dispatch, loading, error } = useGameLoop()

  return (
    <main className="terminal-shell">
      <div className="scanlines" aria-hidden="true" />

      <header className="topbar">
        <p className="eyebrow">Recovered Government Terminal // Session 04</p>
        <h1>VERIFY//DENY</h1>
        <p className="tagline">The database remembers fragments. You decide what survives.</p>
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
              </div>

              {activeTab === 'database' ? (
                <DatabaseTab database={state.database} />
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
