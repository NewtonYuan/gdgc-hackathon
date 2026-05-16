import './App.css'
import { PhoneRealtimeView } from './realtime/RealtimeViews'
import UploadView from './realtime/UploadView'
import AdminView from './realtime/AdminView'
import AdminRealtimeView from './realtime/AdminRealtimeView'
import CitizensView from './realtime/CitizensView'
import AdminGraphView from './realtime/AdminGraphView'

function App() {
  const path = window.location.pathname.toLowerCase()

  if (path === '/admin/realtime' || path === '/admin/desktop' || path === '/desktop') {
    return <AdminRealtimeView />
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
      <div className="landing-brand">
        <img src="/icons/logo.svg" alt="App logo" className="app-logo" />
        <span>records.io</span>
      </div>
      <div className="start-actions">
        <a className="start-icon-button button" href="/upload" aria-label="Upload">
          <img src="/icons/upload-home.svg" alt="" aria-hidden="true" className="start-icon" />
          <span className="start-icon-label">Upload</span>
        </a>
        <a className="start-icon-button button" href="/admin" aria-label="Admin">
          <img src="/icons/admin-home.svg" alt="" aria-hidden="true" className="start-icon" />
          <span className="start-icon-label">Admin</span>
        </a>
        <a className="start-icon-button button" href="/checker" aria-label="Checker">
          <img src="/icons/checker-home.svg" alt="" aria-hidden="true" className="start-icon" />
          <span className="start-icon-label">Checker</span>
        </a>
      </div>
    </main>
  )
}

export default App
