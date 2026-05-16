import { useMemo } from 'react'

type SubmissionDetail = {
  id: string
  name: string
  phone: string
  occupation: string
  cardId: string
  createdAt: string
  decision: 'ACCEPTED' | 'DECLINED' | null
  cardPayload: string
  documentPath: string | null
  decidedAt: string | null
}

type AdminSubmissionOverviewProps = {
  detail: SubmissionDetail
  saving: boolean
  onBack: () => void
  onDecide: (decision: 'ACCEPTED' | 'DECLINED') => void
}

export default function AdminSubmissionOverview({
  detail,
  saving,
  onBack,
  onDecide,
}: AdminSubmissionOverviewProps) {
  const cardPayloadPretty = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(detail.cardPayload), null, 2)
    } catch {
      return detail.cardPayload
    }
  }, [detail.cardPayload])

  return (
    <article className="panel">
      <h2>Verification Overview</h2>
      <div className="facts">
        <p><span>Name:</span> {detail.name}</p>
        <p><span>Phone:</span> {detail.phone}</p>
        <p><span>Occupation:</span> {detail.occupation}</p>
        <p><span>cardID:</span> {detail.cardId}</p>
        <p><span>Current decision:</span> {detail.decision ?? 'PENDING'}</p>
      </div>

      <h3>Card Payload</h3>
      <pre className="upload-json">{cardPayloadPretty}</pre>

      <h3>Document Preview</h3>
      {detail.documentPath ? (
        <div className="doc-preview">
          {detail.documentPath.toLowerCase().endsWith('.pdf') ? (
            <iframe title="document-preview" src={detail.documentPath} className="doc-frame" />
          ) : (
            <img src={detail.documentPath} alt="Uploaded document" className="doc-image" />
          )}
        </div>
      ) : (
        <p className="tagline">No document uploaded.</p>
      )}

      <div className="actions">
        <button type="button" onClick={onBack}>Back</button>
        <button type="button" className="accept" disabled={saving} onClick={() => onDecide('ACCEPTED')}>
          Accept
        </button>
        <button type="button" className="decline" disabled={saving} onClick={() => onDecide('DECLINED')}>
          Decline
        </button>
      </div>
    </article>
  )
}
