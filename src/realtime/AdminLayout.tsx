import type { ReactNode } from 'react'

type AdminLayoutProps = {
  active: 'submissions' | 'desktop' | 'citizens' | 'graph'
  children: ReactNode
}

export default function AdminLayout({ active, children }: AdminLayoutProps) {
  return (
    <main className="admin-shell">
      <section className="admin-window">
        <div className="admin-layout">
          <aside className="admin-sidebar panel border-y-0 border-l-0">
            <div className="admin-brand flex gap-2 p-5">
              <img src="/icons/logo.svg" alt="App logo" className="app-logo w-8 h-8" />
              <strong className='text-xl'>records.io</strong>
            </div>

            <div className="admin-search" aria-label="Search">
              Search
            </div>
            <p className="admin-section-label">Main menu</p>
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
            </nav>
            <p className="admin-section-label">Managements</p>
            <nav className="admin-nav" aria-label="Admin data sections">
              <a
                href="/citizens"
                className={`admin-nav-item ${active === 'citizens' ? 'active' : ''}`}
                aria-current={active === 'citizens' ? 'page' : undefined}
              >
                <img src="/icons/database.svg" alt="" aria-hidden="true" className="admin-nav-icon" />
                Citizens DB
              </a>
              <a
                href="/admin/graph"
                className={`admin-nav-item ${active === 'graph' ? 'active' : ''}`}
                aria-current={active === 'graph' ? 'page' : undefined}
              >
                <img src="/icons/database.svg" alt="" aria-hidden="true" className="admin-nav-icon" />
                Graph
              </a>
            </nav>

            <div className="actions">
              <a className="button secondary" href="/">Back</a>
            </div>
          </aside>

          <section className="admin-content">
            <header className="admin-content-top">
              <div className="admin-window-title">Home page&nbsp;&nbsp;/&nbsp;&nbsp;Reports</div>
            </header>
            <section className="admin-main">{children}</section>
          </section>
        </div>
      </section>
    </main>
  )
}
