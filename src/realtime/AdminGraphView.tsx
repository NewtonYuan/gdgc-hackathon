import { useEffect, useState } from 'react'
import GraphTab from '../components/GraphTab'
import type { GraphPayload } from '../lib/graphData'
import AdminLayout from './AdminLayout'

export default function AdminGraphView() {
  const focusNodeId = new URLSearchParams(window.location.search).get('focus')
  const [graph, setGraph] = useState<GraphPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/admin/graph')
      .then((res) => res.json())
      .then((json: { ok: boolean; graph?: GraphPayload; error?: string }) => {
        if (!active) {
          return
        }
        if (!json.ok) {
          throw new Error(json.error ?? 'Failed to load graph')
        }
        setGraph(json.graph ?? { nodes: [], edges: [] })
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Failed to load graph')
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <AdminLayout active="graph">
      <section className="admin-page-shell">
        <header className="admin-page-head">
          <h1>Graph</h1>
        </header>
      </section>
      {loading ? (
        <article className="panel">
          <p className="tagline">Loading graph...</p>
        </article>
      ) : error ? (
        <article className="panel">
          <p className="tagline">{error}</p>
        </article>
      ) : (
        <GraphTab graph={graph ?? { nodes: [], edges: [] }} initialFocusNodeId={focusNodeId} />
      )}
    </AdminLayout>
  )
}

