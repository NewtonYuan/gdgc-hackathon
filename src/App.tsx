import './App.css'
import { PhoneRealtimeView } from './realtime/RealtimeViews'
import UploadView from './realtime/UploadView'
import AdminView from './realtime/AdminView'
import DesktopAdminView from './realtime/DesktopAdminView'
import CitizensView from './realtime/CitizensView'
import AdminGraphView from './realtime/AdminGraphView'

function App() {
  const path = window.location.pathname.toLowerCase()

  if (path === '/desktop') {
    return <DesktopAdminView />
  }

  if (path === '/checker') {
    return <PhoneRealtimeView />
  }

  if (path === '/upload') {
    return <UploadView />
  }

  if (path === '/admin') {
    return <AdminView />
  }

  if (path === '/citizens') {
    return <CitizensView />
  }

  if (path === '/admin/graph') {
    return <AdminGraphView />
  }

  return <LandingView />
}

function LandingView() {
  return (
    <main className="boot-screen start-screen">
      <div className="caution-tape tape-one" aria-hidden="true" />
      <div className="caution-tape tape-two" aria-hidden="true" />
      <div className="start-actions">
        <a className="start-button button" href="/upload">
          UPLOAD
        </a>
        <a className="start-button button" href="/admin">
          ADMIN VIEW
        </a>
        <a className="start-button button" href="/checker">
          CHECKER
        </a>
      </div>
    </main>
  )
}

export default App
