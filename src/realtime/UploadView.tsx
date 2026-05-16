import { useMemo, useState } from 'react'

type SubmissionResponse = {
  ok: boolean
  id: string
  stored: {
    name: string
    phone: string
    occupation: string
    cardId: string
    documentPath: string | null
    createdAt: string
  }
}

type UploadFormState = {
  name: string
  phone: string
  occupation: string
  cardID: string
}

function createGuid(): string {
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

  return `guid-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function supportsWebNfc(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

export default function UploadView() {
  const [form, setForm] = useState<UploadFormState>({
    name: '',
    phone: '',
    occupation: '',
    cardID: createGuid(),
  })
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string>('')

  const cardPayload = useMemo(
    () => ({
      pid: form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      card_id: form.cardID,
      name: form.name,
      phone: form.phone,
      occupation: form.occupation,
      ts: new Date().toISOString(),
    }),
    [form],
  )

  const onChange = (key: keyof UploadFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onWriteCard = async () => {
    if (!supportsWebNfc()) {
      setMessage('Web NFC not available on this phone/browser. Use Android Chrome.')
      return
    }

    try {
      const ReaderCtor = (window as unknown as { NDEFReader: new () => { write: (data: string) => Promise<void> } }).NDEFReader
      const ndef = new ReaderCtor()
      await ndef.write(JSON.stringify(cardPayload))
      setMessage('NFC card written successfully.')
    } catch (cause) {
      setMessage(cause instanceof Error ? `NFC write failed: ${cause.message}` : 'NFC write failed')
    }
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')

    const body = new FormData()
    body.set('name', form.name)
    body.set('phone', form.phone)
    body.set('occupation', form.occupation)
    body.set('cardID', form.cardID)
    body.set('cardPayload', JSON.stringify(cardPayload))
    if (file) {
      body.set('documents', file)
    }

    try {
      const res = await fetch('/api/upload', { method: 'POST', body })
      const json = (await res.json()) as SubmissionResponse
      if (!res.ok || !json.ok) {
        throw new Error('Server rejected upload')
      }
      setMessage(`Saved to Upload DB (id: ${json.id}).`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="terminal-shell">
      <header className="topbar">
        <h1>Upload</h1>
        <p className="tagline">Write card + store applicant details in separate database.</p>
      </header>

      <article className="panel">
        <form className="upload-form" onSubmit={onSubmit}>
          <label>
            Name
            <input value={form.name} onChange={(e) => onChange('name', e.target.value)} required />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => onChange('phone', e.target.value)} required />
          </label>
          <label>
            Occupation
            <input value={form.occupation} onChange={(e) => onChange('occupation', e.target.value)} required />
          </label>
          <label>
            cardID
            <input value={form.cardID} readOnly required />
          </label>
          <label>
            documents
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </label>

          <div className="actions">
            <button type="button" onClick={() => onChange('cardID', createGuid())}>Regenerate cardID</button>
            <button type="button" onClick={onWriteCard}>Write NFC Card</button>
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save to Upload DB'}</button>
          </div>
        </form>

        <pre className="upload-json">{JSON.stringify(cardPayload, null, 2)}</pre>
        {message && <p className="tagline">{message}</p>}
      </article>
    </main>
  )
}
