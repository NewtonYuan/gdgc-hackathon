import './App.css'
import { PhoneRealtimeView } from './realtime/RealtimeViews'
import UploadView from './realtime/UploadView'
import AdminView from './realtime/AdminView'
import DesktopAdminView from './realtime/DesktopAdminView'
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

  if (path === '/admin/graph') {
    return <AdminGraphView />
  }

  return <LandingView />
}

function LandingView() {
  return (
    <main className="boot-screen start-screen">
      <div className="landing-brand">
        <img src="/icons/logo.svg" alt="App logo" className="app-logo" />
        <span>records.io</span>
      </div>
      <div className="start-actions">
        <button type="button" className="start-button" onClick={() => window.location.assign('/upload')}>
          UPLOAD
        </button>
        <button type="button" className="start-button" onClick={() => window.location.assign('/admin')}>
          ADMIN VIEW
        </button>
        <button type="button" className="start-button" onClick={() => window.location.assign('/checker')}>
          CHECKER
        </button>
      </div>
    </main>
  )
}

export default App
