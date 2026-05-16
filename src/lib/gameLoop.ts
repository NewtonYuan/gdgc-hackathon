import { type Dispatch, useEffect, useReducer, useState } from 'react'
import type { RecordEntry } from '../components/DatabaseTab'
import { NPC_POOL, type Npc, type NpcTip } from './gameData'
import { fetchRecords } from './sqlite'

export const STABILITY_STEP = 20
export const MAX_STABILITY = 100
export const STARTING_LIVES = 3

export type DecisionType = 'ACCEPT' | 'DECLINE'
export type GamePhase = 'playing' | 'won' | 'lost'

export type AnsweredQuestion = {
  questionId: string
  answerText: string
  contradictsDatabase: boolean
}

export type DecisionOutcome = {
  npcName: string
  decision: DecisionType
  correct: boolean
  message: string
}

export type GameState = {
  phase: GamePhase
  database: RecordEntry[]
  npcIndex: number
  stability: number
  lives: number
  answered: AnsweredQuestion[]
  outcome: DecisionOutcome | null
  correctCount: number
  mistakeCount: number
}

export type GameAction =
  | { type: 'INIT'; database: RecordEntry[] }
  | { type: 'ASK_QUESTION'; questionId: string }
  | { type: 'DECIDE'; decision: DecisionType }
  | { type: 'CONTINUE' }

export function getCurrentNpc(state: GameState): Npc | null {
  return NPC_POOL[state.npcIndex] ?? null
}

export function createInitialState(database: RecordEntry[]): GameState {
  return {
    phase: 'playing',
    database,
    npcIndex: 0,
    stability: 0,
    lives: STARTING_LIVES,
    answered: [],
    outcome: null,
    correctCount: 0,
    mistakeCount: 0,
  }
}

// ACCEPT writes the NPC's own claim into the database as Trusted and lands
// each of their tips as an Unverified record — filling gaps on people who
// already exist, or adding brand-new entries for people not yet on file.
function ingestClaim(database: RecordEntry[], npc: Npc): RecordEntry[] {
  let next = database.map((row) =>
    row.name === npc.name
      ? { ...row, role: npc.claim.role, district: npc.claim.district, status: 'Trusted' as const }
      : row,
  )

  if (!next.some((row) => row.name === npc.name)) {
    next = [...next, { name: npc.name, role: npc.claim.role, district: npc.claim.district, status: 'Trusted' }]
  }

  for (const tip of npc.tips) {
    next = applyTip(next, tip)
  }

  return next
}

function applyTip(database: RecordEntry[], tip: NpcTip): RecordEntry[] {
  const index = database.findIndex((row) => row.name === tip.name)

  if (index === -1) {
    return [...database, { name: tip.name, role: tip.role, district: tip.district, status: 'Unverified' }]
  }

  const row = database[index]
  if (row.status === 'Verified' || row.status === 'Trusted') {
    return database
  }

  return database.map((entry, entryIndex) =>
    entryIndex === index ? { name: row.name, role: tip.role, district: tip.district, status: 'Unverified' } : entry,
  )
}

export function gameReducer(state: GameState | null, action: GameAction): GameState | null {
  if (action.type === 'INIT') {
    return createInitialState(action.database)
  }

  if (!state || state.phase !== 'playing' || state.outcome) {
    // Awaiting feedback acknowledgement or the game is over: only CONTINUE proceeds.
    if (state && action.type === 'CONTINUE' && state.outcome && state.phase === 'playing') {
      return advance(state)
    }
    return state
  }

  const npc = getCurrentNpc(state)
  if (!npc) {
    return state
  }

  switch (action.type) {
    case 'ASK_QUESTION': {
      if (state.answered.some((entry) => entry.questionId === action.questionId)) {
        return state
      }
      const answer = npc.answers.find((entry) => entry.questionId === action.questionId)
      if (!answer) {
        return state
      }
      return {
        ...state,
        answered: [
          ...state.answered,
          {
            questionId: answer.questionId,
            answerText: answer.text,
            contradictsDatabase: answer.contradictsDatabase,
          },
        ],
      }
    }

    case 'DECIDE': {
      const correct = (action.decision === 'ACCEPT') === npc.isLegitimate
      const database = action.decision === 'ACCEPT' ? ingestClaim(state.database, npc) : state.database

      const stability = correct
        ? Math.min(MAX_STABILITY, state.stability + STABILITY_STEP)
        : state.stability < STABILITY_STEP
          ? 0
          : state.stability - STABILITY_STEP
      const lives = correct ? state.lives : state.lives - 1

      const phase: GamePhase = lives <= 0 ? 'lost' : stability >= MAX_STABILITY ? 'won' : 'playing'

      return {
        ...state,
        database,
        stability,
        lives,
        correctCount: state.correctCount + (correct ? 1 : 0),
        mistakeCount: state.mistakeCount + (correct ? 0 : 1),
        phase,
        outcome: {
          npcName: npc.name,
          decision: action.decision,
          correct,
          message: outcomeMessage(npc, action.decision, correct),
        },
      }
    }

    default:
      return state
  }
}

function advance(state: GameState): GameState {
  const nextIndex = state.npcIndex + 1

  if (nextIndex >= NPC_POOL.length) {
    return { ...state, outcome: null, phase: 'lost' }
  }

  return { ...state, npcIndex: nextIndex, answered: [], outcome: null }
}

function outcomeMessage(npc: Npc, decision: DecisionType, correct: boolean): string {
  if (decision === 'ACCEPT') {
    return correct
      ? `${npc.name} checks out. Record written as trusted; their testimony seeds the database.`
      : `${npc.name} was a fraud. Their lie is now trusted in the records — society fractures.`
  }
  return correct
    ? `${npc.name} was lying. Denied entry; no record added.`
    : `${npc.name} was telling the truth. A genuine citizen turned away — society fractures.`
}

type UseGameLoop = {
  state: GameState | null
  dispatch: Dispatch<GameAction>
  loading: boolean
  error: string | null
}

export function useGameLoop(): UseGameLoop {
  const [state, dispatch] = useReducer(gameReducer, null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    fetchRecords()
      .then((rows) => {
        if (active) {
          dispatch({ type: 'INIT', database: rows })
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unknown SQLite error')
        }
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

  return { state, dispatch, loading, error }
}
