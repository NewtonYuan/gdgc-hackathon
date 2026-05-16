import { useEffect, useState } from 'react'
import AdminSubmissionOverview from './AdminSubmissionOverview'
import AdminLayout from './AdminLayout'

type SubmissionSummary = {
  id: string
  name: string
  phone: string
  occupation: string
  cardId: string
  createdAt: string
  decision: 'pending' | 'verified' | 'invalid'
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'invalid'>('all')
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

  const decide = async (decision: 'verified' | 'invalid') => {
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

  const stats = {
    total: rows.length,
    pending: rows.filter((r) => r.decision === 'pending').length,
    accepted: rows.filter((r) => r.decision === 'verified').length,
    declined: rows.filter((r) => r.decision === 'invalid').length,
  }
  const filteredRows = statusFilter === 'all' ? rows : rows.filter((r) => r.decision === statusFilter)

  const deleteSubmission = async () => {
    if (!detail) {
      return
    }

    const confirmed = window.confirm('Delete this submission permanently?')
    if (!confirmed) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      const json = await fetchJsonOrThrow<{ ok: boolean; error?: string }>(`/api/admin/submissions/${encodeURIComponent(detail.id)}`, {
        method: 'DELETE',
      })
      if (!json.ok) {
        throw new Error(json.error ?? 'Failed to delete submission')
      }
      setRows((prev) => prev.filter((row) => row.id !== detail.id))
      backToList()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete submission')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout active="submissions">
        <article className="panel">
          <h2>Loading Admin View...</h2>
        </article>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout active="submissions">
      <section className="admin-page-shell">
        <section className="admin-header-grid">
          <div className="admin-header-left">
            <div className="admin-breadcrumbs">Dashboard &gt; Submissions</div>
            <header className="admin-page-head">
              <h1>Submissions</h1>
            </header>
            <div className="panel admin-toolbar">
              <label className="admin-field">
                <span>Status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'pending' | 'verified' | 'invalid')}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="invalid">Invalid</option>
                </select>
              </label>
            </div>
          </div>
          <aside className="panel admin-summary-card">
            <h3>Submission Summary</h3>
            <div className="admin-summary-card-body">
              <div
                className="admin-pie"
                aria-label="Submissions by status"
                style={{ background: '#2f9f49' }}
              />
              <ul className="admin-legend">
                <li><span className="dot verified-dot" />Verified: {stats.accepted}</li>
                <li><span className="dot pending-dot" />Pending: {stats.pending}</li>
                <li><span className="dot invalid-dot" />Invalid: {stats.declined}</li>
                <li><span className="dot total-dot" />Total: {stats.total}</li>
              </ul>
            </div>
          </aside>
        </section>
      </section>

      {error && (
        <article className="panel" role="alert">
          <p className="tagline">{error}</p>
        </article>
      )}

      {!selectedId ? (
        <section className="admin-table-panel">
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Occupation</th>
                  <th scope="col">Card ID</th>
                  <th scope="col" className="status-col">Status</th>
                  <th scope="col" className="status-col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No submissions yet.</td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.phone}</td>
                      <td>{row.occupation}</td>
                      <td>{row.cardId}</td>
                      <td className="status-col">
                        <span className={`status-badge ${row.decision}`}>
                          {row.decision === 'verified' ? 'Verified' : row.decision === 'pending' ? 'Pending' : 'Invalid'}
                        </span>
                      </td>
                      <td className="status-col">
                        <button type="button" className="verify" onClick={() => openVerify(row.id)}>
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : detail ? (
        <AdminSubmissionOverview
          detail={detail}
          saving={saving}
          onBack={backToList}
          onDecide={decide}
          onDelete={deleteSubmission}
        />
      ) : null}
    </AdminLayout>
  )
}
