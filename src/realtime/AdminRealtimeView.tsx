import AdminLayout from './AdminLayout'
import { DesktopRealtimeView } from './RealtimeViews'

function AdminRealtimeView() {
  return (
    <section className="admin-page-shell">
      <section className="admin-header-grid">
        <div className="admin-header-left">
          <DesktopRealtimeView
            embedded
            showSnackbars={false}
            title="Realtime"
            adminHeader
          />
        </div>
      </section>
    </section>
  )
}

export default function DesktopAdminView() {
  return (
    <AdminLayout active="desktop">
      <AdminRealtimeView />
    </AdminLayout>
  )
}
