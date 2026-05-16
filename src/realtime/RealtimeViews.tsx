import { useEffect, useMemo, useState } from 'react'

type RecordEntry = {
  name: string
  occupation: string
  decision: 'ACCEPTED' | 'DECLINED' | null
}

type ScanEvent = {
  type: 'scan'
  personId: string
  phoneId: string
  cardData?: Record<string, unknown>
}

type VerdictEvent = {
  type: 'verdict'
  personId: string
  phoneId: string
  verified: boolean
  name: string
  status: string
}

function createClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toPersonId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function socketUrl(role: 'desktop' | 'phone', deviceId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws?role=${role}&deviceId=${encodeURIComponent(deviceId)}`
}

type DesktopRealtimeViewProps = {
  embedded?: boolean
}

export function DesktopRealtimeView({ embedded = false }: DesktopRealtimeViewProps) {
  const [records, setRecords] = useState<RecordEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connection, setConnection] = useState('connecting')
  const [lastScan, setLastScan] = useState<{ personId: string; phoneId: string; cardData?: Record<string, unknown> } | null>(null)

  const personMap = useMemo(() => {
    const map = new Map<string, RecordEntry>()
    for (const row of records) {
      map.set(toPersonId(row.name), row)
    }
    return map
  }, [records])

  useEffect(() => {
    let active = true
    fetch('/api/admin/submissions')
      .then((res) => res.json())
      .then((json: { ok: boolean; submissions?: Array<{ name: string; occupation: string; decision: 'ACCEPTED' | 'DECLINED' | null }> }) => {
        if (active) {
          if (json.ok && Array.isArray(json.submissions)) {
            setRecords(
              json.submissions.map((item) => ({
                name: item.name,
                occupation: item.occupation,
                decision: item.decision ?? null,
              })),
            )
          } else {
            setRecords([])
          }
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Failed to load records')
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const desktopId = createClientId()
    const ws = new WebSocket(socketUrl('desktop', desktopId))

    ws.onopen = () => setConnection('connected')
    ws.onclose = () => setConnection('disconnected')
    ws.onerror = () => setConnection('error')
    ws.onmessage = (event) => {
      const payload = JSON.parse(String(event.data)) as ScanEvent
      if (payload.type !== 'scan') {
        return
      }

      setLastScan({ personId: payload.personId, phoneId: payload.phoneId, cardData: payload.cardData })
      const person = personMap.get(payload.personId)
      const verified = person?.decision === 'ACCEPTED'

      const verdict: VerdictEvent = {
        type: 'verdict',
        personId: payload.personId,
        phoneId: payload.phoneId,
        verified: Boolean(verified),
        name: person?.name ?? 'Unknown Person',
        status: person?.decision ?? 'UNKNOWN',
      }
      ws.send(JSON.stringify(verdict))
    }

    return () => ws.close()
  }, [personMap])

  const activeRecord = lastScan ? personMap.get(lastScan.personId) : null

  const content = (
    <>
      <header className="topbar">
        <h1>Desktop Verifier</h1>
        <p className="tagline">Connection: {connection}</p>
      </header>

      {error && <article className="panel">DB Error: {error}</article>}

      <article className="panel">
        <h2>Last Scan</h2>
        {lastScan ? (
          <div className="facts">
            <p><span>Phone:</span> {lastScan.phoneId}</p>
            <p><span>Card Person ID:</span> {lastScan.personId}</p>
            <p><span>Name:</span> {activeRecord?.name ?? 'Unknown Person'}</p>
            <p><span>Status:</span> {activeRecord?.decision ?? 'UNKNOWN'}</p>
            {lastScan.cardData && (
              <p>
                <span>Card JSON:</span>
                <pre>{JSON.stringify(lastScan.cardData, null, 2)}</pre>
              </p>
            )}
          </div>
        ) : (
          <p className="tagline">Waiting for phone tap events...</p>
        )}
      </article>

      <article className="panel">
        <h2>Known IDs</h2>
        <div className="facts">
          {records.map((row) => (
            <p key={row.name}><span>{row.name}:</span> {toPersonId(row.name)}</p>
          ))}
        </div>
      </article>
    </>
  )

  if (embedded) {
    return content
  }

  return <main className="terminal-shell">{content}</main>
}

export function PhoneRealtimeView() {
  const [deviceId] = useState(() => createClientId())
  const [personId, setPersonId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('pid') ?? ''
  })
  const [cardData] = useState<Record<string, unknown> | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('card')
    if (!raw) {
      return null
    }
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  })
  const [connection, setConnection] = useState('connecting')
  const [result, setResult] = useState<{ verified: boolean; name: string; status: string } | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(socketUrl('phone', deviceId))
    ws.onopen = () => setConnection('connected')
    ws.onclose = () => setConnection('disconnected')
    ws.onerror = () => setConnection('error')
    ws.onmessage = (event) => {
      const payload = JSON.parse(String(event.data)) as VerdictEvent
      if (payload.type !== 'verdict' || payload.phoneId !== deviceId) {
        return
      }
      setResult({ verified: payload.verified, name: payload.name, status: payload.status })
      setSent(false)
    }

    ;(window as unknown as { __scanSocket?: WebSocket }).__scanSocket = ws
    return () => ws.close()
  }, [deviceId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('pid')
    const effectivePid = pid ?? (typeof cardData?.pid === 'string' ? cardData.pid : null)
    if (effectivePid) {
      window.setTimeout(() => {
        const ws = (window as unknown as { __scanSocket?: WebSocket }).__scanSocket
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'scan', personId: effectivePid, phoneId: deviceId, cardData: cardData ?? undefined }))
          setSent(true)
        }
      }, 250)
    }
  }, [deviceId, cardData])

  const bgClass = result ? (result.verified ? 'phone-ok' : 'phone-bad') : 'phone-neutral'

  const onSend = () => {
    const ws = (window as unknown as { __scanSocket?: WebSocket }).__scanSocket
    if (!personId || ws?.readyState !== WebSocket.OPEN) {
      return
    }
    ws.send(JSON.stringify({ type: 'scan', personId, phoneId: deviceId, cardData: cardData ?? undefined }))
    setSent(true)
  }

  return (
    <main className={`phone-screen ${bgClass}`}>
      <div className="phone-card">
        <p className="tagline">Connection: {connection}</p>
        {!result ? (
          <>
            <h1>Tap Card</h1>
            <input
              className="phone-input"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              placeholder="person id (e.g. sarah-chen)"
            />
            <button type="button" onClick={onSend} disabled={!personId || sent}>
              {sent ? 'Waiting...' : 'Send Scan'}
            </button>
          </>
        ) : (
          <>
            <h1>{result.verified ? 'VERIFIED' : 'DENIED'}</h1>
            <p>{result.name}</p>
            <p>{result.status}</p>
          </>
        )}
      </div>
    </main>
  )
}
