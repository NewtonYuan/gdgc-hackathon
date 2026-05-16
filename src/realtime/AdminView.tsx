import { useEffect, useState } from 'react'
import AdminSubmissionOverview from './AdminSubmissionOverview'

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

async function fetchJsonOrThrow<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const text = await res.text()
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Admin API returned non-JSON response. Ensure node server is running on :3000.')
  }

  if (!res.ok) {
    const msg = typeof parsed === 'object' && parsed !== null && 'error' in parsed ? String((parsed as { error: unknown }).error) : `Request failed: ${res.status}`
    throw new Error(msg)
  }

  return parsed as T
}

export default function AdminView() {
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelectedIdFromUrl())
  const [rows, setRows] = useState<SubmissionSummary[]>([])
  const [detail, setDetail] = useState<SubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedId) {
      return
    }

    let active = true
    fetchJsonOrThrow<{ ok: boolean; submissions: SubmissionSummary[]; error?: string }>('/api/admin/submissions')
      .then((json) => {
        if (!active) {
          return
        }
        if (!json.ok) {
          throw new Error(json.error ?? 'Failed to load submissions')
        }
        setRows(json.submissions)
      })
      .catch((cause: unknown) => {
        if (active) {
          setRows([])
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
    fetchJsonOrThrow<{ ok: boolean; submission?: SubmissionDetail; error?: string }>(`/api/admin/submissions/${encodeURIComponent(selectedId)}`)
      .then((json) => {
        if (!active) {
          return
        }
        if (!json.ok || !json.submission) {
          throw new Error(json.error ?? 'Submission not found')
        }
        setDetail(json.submission)
      })
      .catch((cause: unknown) => {
        if (active) {
          setDetail(null)
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
      const json = await fetchJsonOrThrow<{ ok: boolean; error?: string }>(`/api/admin/submissions/${encodeURIComponent(detail.id)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })

      if (!json.ok) {
        throw new Error(json.error ?? 'Failed to save decision')
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
        <AdminSubmissionOverview
          detail={detail}
          saving={saving}
          onBack={backToList}
          onDecide={decide}
        />
      ) : null}
    </main>
  )
}
