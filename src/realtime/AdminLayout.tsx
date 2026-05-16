import type { ReactNode } from "react";
import { AdminRealtimeBridge } from "./RealtimeViews";

type AdminLayoutProps = {
  active: "submissions" | "desktop" | "citizens" | "graph";
  breadcrumbExtra?: string | null;
  children: ReactNode;
};

export default function AdminLayout({
  active,
  breadcrumbExtra = null,
  children,
}: AdminLayoutProps) {
  const isSubmissionOverview = active === "submissions" && Boolean(breadcrumbExtra);
  const activeLabel =
    active === "submissions"
      ? "Submissions"
      : active === "desktop"
        ? "Realtime"
        : active === "graph"
          ? "Graph"
        : "Submissions";

  return (
    <main className="admin-shell">
      <AdminRealtimeBridge />
      <section className="admin-window">
        <div className="admin-layout">
          <aside className="admin-sidebar panel border-y-0 border-l-0">
            <div className="admin-brand flex gap-2 p-5">
              <img
                src="/icons/logo.svg"
                alt="App logo"
                className="app-logo w-8 h-8"
              />
              <strong className="text-xl">Verified</strong>
            </div>
            <div className="p-1">
              <p className="admin-section-label">Overview</p>
              <nav className="admin-nav" aria-label="Admin sections">
                <a
                  href="/admin"
                  className={`admin-nav-item ${active === "submissions" ? "active" : ""}`}
                  aria-current={active === "submissions" ? "page" : undefined}
                >
                  <img
                    src="/icons/database.svg"
                    alt=""
                    aria-hidden="true"
                    className="admin-nav-icon"
                  />
                  Submissions
                </a>
                <a
                  href="/admin/realtime"
                  className={`admin-nav-item ${active === "desktop" ? "active" : ""}`}
                  aria-current={active === "desktop" ? "page" : undefined}
                >
                  <img
                    src="/icons/timelapse.svg"
                    alt=""
                    aria-hidden="true"
                    className="admin-nav-icon"
                  />
                  Realtime
                </a>
              </nav>
              <p className="admin-section-label mt-4">Advanced</p>
              <nav className="admin-nav" aria-label="Admin data sections">
                <a
                  href="/admin/graph"
                  className={`admin-nav-item ${active === "graph" ? "active" : ""}`}
                  aria-current={active === "graph" ? "page" : undefined}
                >
                  <img
                    src="/icons/graph-nav.svg"
                    alt=""
                    aria-hidden="true"
                    className="admin-nav-icon"
                  />
                  Graph
                </a>
              </nav>
            </div>
            <div className="actions">
              <a className="admin-nav-item" href="/">
                <img
                  src="/icons/back-nav.svg"
                  alt=""
                  aria-hidden="true"
                  className="admin-nav-icon"
                />
                Back
              </a>
            </div>
          </aside>

          <section className="admin-content">
            <header className="admin-content-top">
              <div className="admin-window-title pl-4 text-[15px]">
                <span className="text-zinc-400">Admin</span>
                <span className="px-4 text-zinc-500">/</span>
                <span className={isSubmissionOverview ? "text-zinc-400" : "text-white"}>
                  {activeLabel}
                </span>
                {breadcrumbExtra ? (
                  <>
                    <span className="px-4 text-zinc-500">/</span>
                    <span className="text-white">{breadcrumbExtra}</span>
                  </>
                ) : null}
              </div>
            </header>
            <section className="admin-main">{children}</section>
          </section>
        </div>
      </section>
    </main>
  )
}
