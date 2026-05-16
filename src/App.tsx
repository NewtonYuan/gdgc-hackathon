import './App.css'
import { DesktopRealtimeView, PhoneRealtimeView } from './realtime/RealtimeViews'
import UploadView from './realtime/UploadView'
import AdminView from './realtime/AdminView'

function App() {
  const path = window.location.pathname.toLowerCase()

  if (path === '/desktop') {
    return <DesktopRealtimeView />
  }

  if (path === '/phone') {
    return <PhoneRealtimeView />
  }

  if (path === '/upload') {
    return <UploadView />
  }

  if (path === '/admin') {
    return <AdminView />
  }

  return <LandingView />
}

function LandingView() {
  return (
    <main className="boot-screen start-screen">
      <div className="caution-tape tape-one" aria-hidden="true" />
      <div className="caution-tape tape-two" aria-hidden="true" />
      <div className="start-actions">
        <button type="button" className="start-button" onClick={() => window.location.assign('/upload')}>
          UPLOAD
        </button>
        <button type="button" className="start-button" onClick={() => window.location.assign('/admin')}>
          ADMIN VIEW
        </button>
        <button type="button" className="start-button" onClick={() => window.location.assign('/desktop')}>
          DESKTOP VIEW
        </button>
      </div>
    </main>
  )
}

export default App
