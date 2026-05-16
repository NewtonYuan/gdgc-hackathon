import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'

type CitizenSummary = {
  id: string
  name: string
  phone: string
  age: number | null
  gender: string | null
  occupation: string
  verificationStatus: string
  trustScore: number
}

type OccupationDetail =
  | { jobTitle: string; employer: string; workAddress: string }
  | { institution: string; studentId: string; fieldOfStudy: string; yearOfStudy: number }
  | { formerOccupation: string | null }
  | null

type Document = {
  type: string
  documentNumber: string
  issuedDate: string
  expiryDate: string | null
  issuingAuthority: string
}

type CitizenDetail = CitizenSummary & {
  address: string
  createdAt: string
  occupationDetail: OccupationDetail
  documents: Document[]
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status}`}>{status}</span>
}

async function fetchJsonOrThrow<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Server returned non-JSON. Ensure the node server is running on :3000.')
  }
  if (!res.ok) {
    const msg =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : `Request failed: ${res.status}`
    throw new Error(msg)
  }
  return parsed as T
}

function readSelectedIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('id')
}

function OccupationDetails({ detail }: { detail: OccupationDetail }) {
  if (!detail) return null
  if ('jobTitle' in detail) {
    return (
      <>
        <p><span>Job title:</span> {detail.jobTitle}</p>
        <p><span>Employer:</span> {detail.employer}</p>
        <p><span>Work address:</span> {detail.workAddress}</p>
      </>
    )
  }
  if ('institution' in detail) {
    return (
      <>
        <p><span>Institution:</span> {detail.institution}</p>
        <p><span>Student ID:</span> {detail.studentId}</p>
        <p><span>Field of study:</span> {detail.fieldOfStudy}</p>
        <p><span>Year of study:</span> {detail.yearOfStudy}</p>
      </>
    )
  }
  if ('formerOccupation' in detail) {
    return <p><span>Former occupation:</span> {detail.formerOccupation ?? '-'}</p>
  }
  return null
}

export default function CitizensView() {
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelectedIdFromUrl())
  const [rows, setRows] = useState<CitizenSummary[]>([])
  const [detail, setDetail] = useState<CitizenDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedId) return
    let active = true
    fetchJsonOrThrow<{ ok: boolean; citizens: CitizenSummary[]; error?: string }>('/api/citizens')
      .then((json) => {
        if (!active) return
        if (!json.ok) throw new Error(json.error ?? 'Failed to load citizens')
        setRows(json.citizens)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Failed to load citizens')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    fetchJsonOrThrow<{ ok: boolean; citizen?: CitizenSummary & { address: string; createdAt: string }; occupationDetail?: OccupationDetail; documents?: Document[]; error?: string }>(`/api/citizens/${encodeURIComponent(selectedId)}`)
      .then((json) => {
        if (!active) return
        if (!json.ok || !json.citizen) throw new Error(json.error ?? 'Citizen not found')
        setDetail({ ...json.citizen, occupationDetail: json.occupationDetail ?? null, documents: json.documents ?? [] })
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Failed to load citizen')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedId])

  const openDetail = (id: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('id', id)
    window.history.pushState({}, '', url)
    setSelectedId(id)
    setDetail(null)
    setError(null)
  }

  const backToList = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('id')
    window.history.pushState({}, '', url)
    setSelectedId(null)
    setDetail(null)
    setError(null)
  }

  if (loading) {
    return (
      <AdminLayout active="citizens">
        <article className="panel"><h2>Loading Citizens DB...</h2></article>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout active="citizens">
      <header className="topbar"><h1>Citizens DB</h1></header>

      {error && <article className="panel" role="alert"><p className="tagline">{error}</p></article>}

      {!selectedId ? (
        <article className="panel">
          <h2>Registered Citizens</h2>
          <div className="admin-table-wrap">
            <table>
              <caption>Registered citizens and verification status</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Age</th>
                  <th scope="col">Occupation</th>
                  <th scope="col">Status</th>
                  <th scope="col">Trust Score</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7}>No citizens found.</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name || '-'}</td>
                      <td>{row.phone || '-'}</td>
                      <td>{row.age ?? '-'}</td>
                      <td>{row.occupation || '-'}</td>
                      <td>
                        <StatusBadge status={row.verificationStatus} />
                      </td>
                      <td>{row.trustScore}</td>
                      <td>
                        <button type="button" className="verify" onClick={() => openDetail(row.id)}>View</button>
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
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>{detail.name || 'Unnamed citizen'}</h2>
              <p className="tagline" style={{ margin: '0.25rem 0 0' }}>{detail.address || 'No address recorded'}</p>
            </div>
          </div>

          <div className="facts">
            <p><span>Phone:</span> {detail.phone || '-'}</p>
            <p><span>Age:</span> {detail.age ?? '-'}</p>
            <p><span>Gender:</span> {detail.gender ?? '-'}</p>
            <p><span>Address:</span> {detail.address || '-'}</p>
            <p><span>Occupation:</span> {detail.occupation || '-'}</p>
            <p><span>Verification status:</span> <StatusBadge status={detail.verificationStatus} /></p>
            <p><span>Trust score:</span> {detail.trustScore} / 100</p>
          </div>

          {detail.occupationDetail && (
            <>
              <h3>Occupation Details</h3>
              <div className="facts">
                <OccupationDetails detail={detail.occupationDetail} />
              </div>
            </>
          )}

          {detail.documents.length > 0 && (
            <>
              <h3>Documents</h3>
              <div className="admin-table-wrap">
                <table>
                  <caption>Documents recorded for {detail.name || 'unnamed citizen'}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">Number</th>
                      <th scope="col">Issued</th>
                      <th scope="col">Expires</th>
                      <th scope="col">Authority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.documents.map((doc) => (
                      <tr key={doc.documentNumber}>
                        <td>{doc.type.replace(/_/g, ' ')}</td>
                        <td>{doc.documentNumber}</td>
                        <td>{doc.issuedDate}</td>
                        <td>{doc.expiryDate ?? '-'}</td>
                        <td>{doc.issuingAuthority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="actions">
            <button type="button" onClick={backToList}>Back</button>
          </div>
        </article>
      ) : null}
    </AdminLayout>
  )
}
