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
}

function NpcTab({ incomingClaim, decision, setDecision, analysis }: NpcTabProps) {
  return (
    <article className="panel" role="tabpanel" aria-label="Incoming NPC panel">
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
  )
}

export default NpcTab
