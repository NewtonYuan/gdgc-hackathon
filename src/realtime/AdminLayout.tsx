import type { ReactNode } from 'react'

type AdminLayoutProps = {
  active: 'submissions' | 'desktop' | 'graph'
  children: ReactNode
}

export default function AdminLayout({ active, children }: AdminLayoutProps) {
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
              <img src="/icons/database.svg" alt="" aria-hidden="true" className="admin-nav-icon" />
              Submissions
            </button>
            <button
              type="button"
              className={`admin-nav-item ${active === 'desktop' ? 'active' : ''}`}
              onClick={() => window.location.assign('/desktop')}
            >
              <img src="/icons/timelapse.svg" alt="" aria-hidden="true" className="admin-nav-icon" />
              Desktop View
            </button>
            <button
              type="button"
              className={`admin-nav-item ${active === 'graph' ? 'active' : ''}`}
              onClick={() => window.location.assign('/admin/graph')}
            >
              <img src="/icons/database.svg" alt="" aria-hidden="true" className="admin-nav-icon" />
              Graph
            </button>
          </nav>

          <div className="actions">
            <button type="button" onClick={() => window.location.assign('/')}>Back</button>
          </div>
        </aside>

        <section className="admin-main">{children}</section>
      </div>
    </main>
  )
}
