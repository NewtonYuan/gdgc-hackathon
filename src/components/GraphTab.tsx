import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import type { RecordEntry } from './DatabaseTab'
import { buildGraphFromRecords, type GraphNodeData } from '../lib/graphData'

type GraphTabProps = {
  database: RecordEntry[]
}

function GraphTab({ database }: GraphTabProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { nodes, edges } = useMemo(() => buildGraphFromRecords(database), [database])
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(nodes[0] ?? null)

  useEffect(() => {
    setSelectedNode((current) => current ?? nodes[0] ?? null)
  }, [nodes])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const graph = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map((node) => ({
          data: node,
        })),
        ...edges.map((edge) => ({
          data: edge,
        })),
      ],
      layout: {
        name: 'cose',
        animate: false,
        padding: 36,
        nodeRepulsion: 900000,
        idealEdgeLength: 180,
      },
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(shortLabel)',
            color: '#f0f0f0',
            'font-family': 'JetBrains Mono, Consolas, Courier New, monospace',
            'font-size': '14',
            'font-weight': '700',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#dfb463',
            'border-width': '3',
            'border-color': '#130707',
            width: '82',
            height: '82',
            'text-outline-width': '1',
            'text-outline-color': '#130707',
          },
        },
        {
          selector: 'node[statusBucket = "verified"]',
          style: {
            'background-color': '#2f9f49',
          },
        },
        {
          selector: 'node[statusBucket = "in-process"]',
          style: {
            'background-color': '#dfb463',
          },
        },
        {
          selector: 'node[statusBucket = "not-verified"]',
          style: {
            'background-color': '#e12b2b',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'overlay-opacity': 0,
            'border-color': '#f2f2f2',
            'border-width': '4',
          },
        },
        {
          selector: 'edge',
          style: {
            width: (element: cytoscape.EdgeSingular) => {
              const weight = element.data('weight') as number
              return 1.5 + (weight / 100) * 10
            },
            'line-color': '#8d8d8d',
            opacity: 0.75,
            'curve-style': 'bezier',
          },
        },
      ] as any,
    })

    graph.on('tap', 'node', (event) => {
      const data = event.target.data() as GraphNodeData
      const matched = nodes.find((node) => node.id === data.id) ?? null
      setSelectedNode(matched)
    })

    return () => {
      graph.destroy()
    }
  }, [edges, nodes])

  return (
    <article className="panel" role="tabpanel" aria-label="Relationship graph panel">
      <div className="graph-header">
        <div>
          <h2>People Graph</h2>
          <p className="tagline">Each person is one node. Labels use `F.L`, and thicker lines mean more overlap.</p>
        </div>
        <div className="graph-legend" aria-label="Graph legend">
          <span className="legend-item">
            <i className="legend-swatch verified-node" aria-hidden="true" />
            Verified
          </span>
          <span className="legend-item">
            <i className="legend-swatch inprocess-node" aria-hidden="true" />
            In Process
          </span>
          <span className="legend-item">
            <i className="legend-swatch denied-node" aria-hidden="true" />
            Not Verified
          </span>
        </div>
      </div>

      <div className="graph-layout">
        <div ref={containerRef} className="graph-canvas" />

        <aside className="graph-inspector" aria-label="Selected person details">
          {selectedNode ? (
            <>
              <p className={`graph-status-pill ${selectedNode.statusBucket}`}>{selectedNode.person.graphStatus}</p>
              <h3 className="graph-person-code">{selectedNode.shortLabel}</h3>
              <p className="graph-person-name">{selectedNode.person.name}</p>

              <dl className="graph-person-meta">
                <div>
                  <dt>Role</dt>
                  <dd>{selectedNode.person.role}</dd>
                </div>
                <div>
                  <dt>District</dt>
                  <dd>{selectedNode.person.district}</dd>
                </div>
                <div>
                  <dt>Database Status</dt>
                  <dd>{selectedNode.person.status}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="tagline">Select a node to inspect the person object.</p>
          )}
        </aside>
      </div>

      <div className="graph-notes">
        <p>
          <span>Node</span> Every person is stored as one object with `name`, `role`, `district`, and `status`.
        </p>
        <p>
          <span>Label</span> Names are shortened to `F.L`.
        </p>
        <p>
          <span>Connection</span> Line thickness grows when role, district, or status overlap more strongly.
        </p>
      </div>
    </article>
  )
}

export default GraphTab
