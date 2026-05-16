import type { RecordEntry } from './DatabaseTab'

export type RelatedRecord = {
  entry: RecordEntry
  score: number
  matchedFields: string[]
}

type NpcTabProps = {
  incomingClaim: {
    name: string
    role: string
    district: string
    statement: string
  }
  decision: 'VERIFY' | 'DENY' | null
  setDecision: (value: 'VERIFY' | 'DENY') => void
  analysis: {
    shouldVerify: boolean
    reason: string
  }
  relatedRecords: RelatedRecord[]
}

function NpcTab({ incomingClaim, decision, setDecision, analysis, relatedRecords }: NpcTabProps) {
  return (
    <article className="panel npc-panel" role="tabpanel" aria-label="Incoming NPC panel">
      <div className="npc-main">
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
      </div>

      <div className="npc-sidebar">
        <h3 className="sidebar-heading">Possible Connections</h3>
        {relatedRecords.length === 0 ? (
          <p className="sidebar-empty">No matching records found.</p>
        ) : (
          relatedRecords.map(({ entry, matchedFields }) => (
            <div key={entry.name} className="related-card">
              <div className="related-header">
                <span className="related-name">{entry.name}</span>
                <span className={entry.status.toLowerCase()}>{entry.status}</span>
              </div>
              <div className="related-meta">
                {entry.role} // {entry.district}
              </div>
              <ul className="related-matches">
                {matchedFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </article>
  )
}

export default NpcTab
