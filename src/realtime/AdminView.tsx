import { useEffect, useMemo, useState } from 'react'

type SubmissionSummary = {
  id: string
  name: string
  phone: string
  occupation: string
  cardId: string
  createdAt: string
  decision: 'ACCEPTED' | 'DECLINED' | null
}

type SubmissionDetail = SubmissionSummary & {
  cardPayload: string
  documentPath: string | null
  decidedAt: string | null
}

function readSelectedIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('id')
}

export default function AdminView() {
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelectedIdFromUrl())
  const [rows, setRows] = useState<SubmissionSummary[]>([])
  const [detail, setDetail] = useState<SubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cardPayloadPretty = useMemo(() => {
    if (!detail) {
      return ''
    }
    try {
      return JSON.stringify(JSON.parse(detail.cardPayload), null, 2)
    } catch {
      return detail.cardPayload
    }
  }, [detail])

  const parseJsonSafe = async <T,>(res: Response): Promise<T | null> => {
    const text = await res.text()
    try {
      return JSON.parse(text) as T
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (selectedId) {
      return
    }

    let active = true
    fetch('/api/admin/submissions')
      .then((res) => parseJsonSafe<{ ok: boolean; submissions: SubmissionSummary[]; error?: string }>(res))
      .then((json) => {
        if (!active) {
          return
        }
        if (!json || !json.ok) {
          setRows([])
          setError(null)
          return
        }
        setRows(json.submissions)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Failed to load submissions')
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
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) {
      return
    }

    let active = true
    fetch(`/api/admin/submissions/${encodeURIComponent(selectedId)}`)
      .then((res) => parseJsonSafe<{ ok: boolean; submission?: SubmissionDetail; error?: string }>(res))
      .then((json) => {
        if (!active) {
          return
        }
        if (!json || !json.ok || !json.submission) {
          setDetail(null)
          setError(null)
          return
        }
        setDetail(json.submission)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Failed to load submission')
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
  }, [selectedId])

  const openVerify = (id: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('id', id)
    window.history.pushState({}, '', url)
    setLoading(true)
    setSelectedId(id)
    setError(null)
  }

  const backToList = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('id')
    window.history.pushState({}, '', url)
    setLoading(true)
    setSelectedId(null)
    setDetail(null)
    setError(null)
  }

  const decide = async (decision: 'ACCEPTED' | 'DECLINED') => {
    if (!detail) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/submissions/${encodeURIComponent(detail.id)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const json = await parseJsonSafe<{ ok: boolean; error?: string }>(res)
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Failed to save decision')
      }
      setDetail((prev) => (prev ? { ...prev, decision, decidedAt: new Date().toISOString() } : prev))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save decision')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="terminal-shell">
        <article className="panel">
          <h2>Loading Admin View...</h2>
        </article>
      </main>
    )
  }

  return (
    <main className="terminal-shell">
      <div className="actions">
        <button type="button" onClick={() => window.location.assign('/')}>Back</button>
      </div>
      <header className="topbar">
        <h1>Admin View</h1>
      </header>

      {error && (
        <article className="panel">
          <p className="tagline">{error}</p>
        </article>
      )}

      {!selectedId ? (
        <article className="panel">
          <h2>Applicant Database</h2>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Occupation</th>
                  <th>cardID</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No submissions yet.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.phone}</td>
                      <td>{row.occupation}</td>
                      <td>{row.cardId}</td>
                      <td>{row.decision ?? 'PENDING'}</td>
                      <td>
                        <button type="button" className="verify" onClick={() => openVerify(row.id)}>
                          Verify
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      ) : detail ? (
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
            <button type="button" onClick={backToList}>Back</button>
            <button type="button" className="accept" disabled={saving} onClick={() => decide('ACCEPTED')}>
              Accept
            </button>
            <button type="button" className="decline" disabled={saving} onClick={() => decide('DECLINED')}>
              Decline
            </button>
          </div>
        </article>
      ) : null}
    </main>
  )
}
