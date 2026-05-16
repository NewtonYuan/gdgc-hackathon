import AdminLayout from './AdminLayout'
import { DesktopRealtimeView } from './RealtimeViews'

export default function DesktopAdminView() {
  return (
    <AdminLayout active="desktop">
      <DesktopRealtimeView embedded />
    </AdminLayout>
  )
}
