import type { ReactNode } from 'react'

type AdminLayoutProps = {
  active: 'submissions' | 'desktop' | 'citizens'
  children: ReactNode
}

export default function AdminLayout({ active, children }: AdminLayoutProps) {
  return (
    <main className="admin-shell">
      <div className="admin-layout">
        <aside className="admin-sidebar panel">
          <div className="admin-brand">
            <strong>VERIFY//DENY</strong>
            <span>Records terminal</span>
          </div>

          <nav className="admin-nav" aria-label="Admin sections">
            <a
              href="/admin"
              className={`admin-nav-item ${active === 'submissions' ? 'active' : ''}`}
              aria-current={active === 'submissions' ? 'page' : undefined}
            >
              <img src="/icons/database.svg" alt="" aria-hidden="true" className="admin-nav-icon" />
              Submissions
            </a>
            <a
              href="/desktop"
              className={`admin-nav-item ${active === 'desktop' ? 'active' : ''}`}
              aria-current={active === 'desktop' ? 'page' : undefined}
            >
              <img src="/icons/timelapse.svg" alt="" aria-hidden="true" className="admin-nav-icon" />
              Desktop View
            </a>
            <a
              href="/citizens"
              className={`admin-nav-item ${active === 'citizens' ? 'active' : ''}`}
              aria-current={active === 'citizens' ? 'page' : undefined}
            >
              <img src="/icons/database.svg" alt="" aria-hidden="true" className="admin-nav-icon" />
              Citizens DB
            </a>
          </nav>

          <div className="actions">
            <a className="button secondary" href="/">Back</a>
          </div>
        </aside>

        <section className="admin-main">{children}</section>
      </div>
    </main>
  )
}
