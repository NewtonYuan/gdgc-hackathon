import type { ReactNode } from 'react'

type AdminLayoutProps = {
  active: 'submissions' | 'desktop'
  children: ReactNode
  stats?: {
    total: number
    pending: number
    accepted: number
    declined: number
  }
}

export default function AdminLayout({ active, children, stats }: AdminLayoutProps) {
  return (
    <main className="admin-shell">
      <div className="admin-layout">
        <aside className="admin-sidebar panel">
          <div className="admin-brand">
            <strong>records.io</strong>
          </div>

          <nav className="admin-nav" aria-label="Admin sections">
            <button
              type="button"
              className={`admin-nav-item ${active === 'submissions' ? 'active' : ''}`}
              onClick={() => window.location.assign('/admin')}
            >
              Submissions
            </button>
            <button
              type="button"
              className={`admin-nav-item ${active === 'desktop' ? 'active' : ''}`}
              onClick={() => window.location.assign('/desktop')}
            >
              Desktop View
            </button>
          </nav>

          {stats && (
            <div className="admin-stats">
              <p><span>Total</span> {stats.total}</p>
              <p><span>Pending</span> {stats.pending}</p>
              <p><span>Accepted</span> {stats.accepted}</p>
              <p><span>Declined</span> {stats.declined}</p>
            </div>
          )}

          <div className="actions">
            <button type="button" onClick={() => window.location.assign('/')}>Back</button>
          </div>
        </aside>

        <section className="admin-main">{children}</section>
      </div>
    </main>
  )
}
