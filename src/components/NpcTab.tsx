import type { AnsweredQuestion, DecisionOutcome, DecisionType } from '../lib/gameLoop'
import type { Npc, Question } from '../lib/gameData'

type NpcTabProps = {
  npc: Npc
  questions: Question[]
  answered: AnsweredQuestion[]
  outcome: DecisionOutcome | null
  personNumber: number
  totalPeople: number
  onAsk: (questionId: string) => void
  onDecide: (decision: DecisionType) => void
  onContinue: () => void
}

function NpcTab({
  npc,
  questions,
  answered,
  outcome,
  personNumber,
  totalPeople,
  onAsk,
  onDecide,
  onContinue,
}: NpcTabProps) {
  return (
    <article className="panel" role="tabpanel" aria-label="Incoming NPC panel">
      <h2>
        Incoming NPC // Person {personNumber} of {totalPeople}
      </h2>
      <blockquote>{npc.claim.statement}</blockquote>
      <div className="facts">
        <p>
          <span>Name:</span> {npc.name}
        </p>
        <p>
          <span>Role:</span> {npc.claim.role}
        </p>
        <p>
          <span>District:</span> {npc.claim.district}
        </p>
      </div>

      {outcome ? (
        <>
          <p className={`result ${outcome.correct ? 'correct' : 'wrong'}`}>
            Decision: {outcome.decision} // {outcome.correct ? 'CORRECT' : 'INCORRECT'}
            <br />
            <span>{outcome.message}</span>
          </p>
          <div className="actions">
            <button type="button" className="continue" onClick={onContinue}>
              NEXT PERSON &gt;
            </button>
          </div>
        </>
      ) : (
        <>
          <section className="interrogation">
            <h3>Interrogation // Fixed Question Set</h3>
            <div className="question-list">
              {questions.map((question) => {
                const asked = answered.some((entry) => entry.questionId === question.id)
                return (
                  <button
                    key={question.id}
                    type="button"
                    disabled={asked}
                    onClick={() => onAsk(question.id)}
                  >
                    {question.text}
                  </button>
                )
              })}
            </div>

            {answered.length > 0 && (
              <ul className="answer-log">
                {answered.map((entry) => {
                  const question = questions.find((item) => item.id === entry.questionId)
                  return (
                    <li key={entry.questionId} className="answer-item">
                      <p className="answer-question">{question?.text}</p>
                      <p className="answer-text">&ldquo;{entry.answerText}&rdquo;</p>
                      <span
                        className={`flag ${entry.contradictsDatabase ? 'contradiction' : 'consistent'}`}
                      >
                        {entry.contradictsDatabase
                          ? 'CONTRADICTS DATABASE'
                          : 'CONSISTENT WITH DATABASE'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="actions">
            <button type="button" className="accept" onClick={() => onDecide('ACCEPT')}>
              ACCEPT
            </button>
            <button type="button" className="decline" onClick={() => onDecide('DECLINE')}>
              DECLINE
            </button>
          </div>
        </>
      )}
    </article>
  )
}

export default NpcTab
