import { useEffect, useMemo, useRef } from 'react'
import cytoscape from 'cytoscape'
import type { RecordEntry } from './DatabaseTab'
import { buildGraphFromRecords } from '../lib/graphData'

type GraphTabProps = {
  database: RecordEntry[]
}

function GraphTab({ database }: GraphTabProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { nodes, edges } = useMemo(() => buildGraphFromRecords(database), [database])

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
        padding: 28,
      },
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#f0f0f0',
            'font-family': 'JetBrains Mono, Consolas, Courier New, monospace',
            'font-size': '10',
            'text-wrap': 'wrap',
            'text-max-width': '96',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#dfb463',
            'border-width': '2',
            'border-color': '#1a0a0a',
            width: '56',
            height: '56',
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
          selector: 'edge',
          style: {
            width: (element: cytoscape.EdgeSingular) => {
              const weight = element.data('weight') as number
              return 1.5 + (weight - 1) * 1.8
            },
            'line-color': '#7d1111',
            opacity: 0.8,
            'curve-style': 'bezier',
          },
        },
      ],
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
          <p className="tagline">
            Nodes come from the recovered records. Links are inferred from shared district or shared role.
          </p>
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

      <div ref={containerRef} className="graph-canvas" />

      <div className="graph-notes">
        <p>
          <span>Node rule</span> Person name from the database.
        </p>
        <p>
          <span>Color rule</span> `Verified` and `Trusted` map to green, `Missing` and `Unverified` map to yellow,
          `Corrupted` maps to red.
        </p>
        <p>
          <span>Edge rule</span> Thicker lines mean stronger inferred overlap in the current records.
        </p>
      </div>
    </article>
  )
}

export default GraphTab
