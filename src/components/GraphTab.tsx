import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Billboard, Line, OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { GraphNodeData, GraphPayload } from '../lib/graphData'

type GraphTabProps = {
  graph: GraphPayload
}

type PositionedNode = GraphNodeData & {
  position: [number, number, number]
}

const STATUS_STYLES = {
  verified: {
    color: '#38d96b',
    emissive: '#0c5f2a',
    label: '#c8ffd8',
  },
  'in-process': {
    color: '#e5b85d',
    emissive: '#5e3a0c',
    label: '#fff2b8',
  },
  'not-verified': {
    color: '#ff4c86',
    emissive: '#6f1233',
    label: '#ffd1df',
  },
} satisfies Record<GraphNodeData['statusBucket'], { color: string; emissive: string; label: string }>

function seededValue(seed: string, index: number) {
  let value = 0

  for (let charIndex = 0; charIndex < seed.length; charIndex += 1) {
    value = (value * 31 + seed.charCodeAt(charIndex) + index * 17) % 9973
  }

  return (value % 1000) / 1000
}

function buildNodePositions(nodes: GraphNodeData[]): PositionedNode[] {
  const rankedNodes = [...nodes].sort((left, right) => right.person.trustScore - left.person.trustScore)
  const shellCapacity = 10
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  return rankedNodes.map((node, index) => {
    const shellIndex = Math.floor(index / shellCapacity)
    const shellStart = shellIndex * shellCapacity
    const shellNodes = rankedNodes.slice(shellStart, shellStart + shellCapacity)
    const localIndex = index - shellStart
    const shellCount = shellNodes.length
    const radius = 2.8 + shellIndex * 1.9 + seededValue(node.id, 77) * 0.18
    const shellRotation = seededValue(`shell-${shellIndex}`, 3) * Math.PI * 2

    const yUnit = shellCount === 1 ? 0 : 1 - (localIndex / (shellCount - 1)) * 2
    const ringRadius = Math.sqrt(Math.max(0, 1 - yUnit * yUnit))
    const theta = localIndex * goldenAngle + shellRotation
    const x = Math.cos(theta) * ringRadius * radius
    const y = yUnit * radius
    const z = Math.sin(theta) * ringRadius * radius

    return {
      ...node,
      position: [x, y, z],
    }
  })
}

function connectionVisuals(weight: number) {
  const normalized = Math.min(Math.max(weight, 0), 100) / 100
  const emphasis = normalized ** 1.7

  return {
    color: normalized >= 0.75 ? '#ffffff' : normalized >= 0.45 ? '#b8f3ff' : '#4aa8d8',
    lineWidth: 0.55 + emphasis * 8.5,
    opacity: 0.24 + normalized * 0.68,
  }
}

type SpaceNodeProps = {
  node: PositionedNode
  onSelect: (node: GraphNodeData) => void
}

function SpaceNode({ node, onSelect }: SpaceNodeProps) {
  const bodyRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null)
  const haloInnerRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null)
  const haloOuterRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null)
  const sparkMaterialRef = useRef<THREE.PointsMaterial>(null)
  const sparkRef = useRef<THREE.Points>(null)
  const statusStyle = STATUS_STYLES[node.statusBucket]
  const sparkGeometry = useMemo(() => {
    const positions: number[] = []
    const particleCount = 72

    for (let index = 0; index < particleCount; index += 1) {
      const theta = seededValue(node.id, index) * Math.PI * 2
      const phi = Math.acos(2 * seededValue(node.id, index + particleCount) - 1)
      const radius = 0.356 + seededValue(node.id, index + particleCount * 2) * 0.012

      positions.push(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(theta) * radius,
      )
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geometry
  }, [node.id])

  useFrame((state) => {
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.3 + node.position[2]) * 0.12

    if (bodyRef.current) {
      bodyRef.current.rotation.z = state.clock.elapsedTime * 0.12
      bodyRef.current.scale.setScalar(pulse)
      bodyRef.current.position.y = Math.sin(state.clock.elapsedTime + node.position[0]) * 0.05
    }

    if (coreRef.current) {
      coreRef.current.material.opacity = 0.9 + Math.sin(state.clock.elapsedTime * 2.8 + node.position[1]) * 0.08
    }

    if (haloInnerRef.current) {
      haloInnerRef.current.material.opacity = 0.24 + Math.sin(state.clock.elapsedTime * 2.1 + node.position[0]) * 0.05
    }

    if (haloOuterRef.current) {
      haloOuterRef.current.material.opacity = 0.12 + Math.sin(state.clock.elapsedTime * 1.7 + node.position[2]) * 0.04
    }

    if (sparkMaterialRef.current) {
      sparkMaterialRef.current.opacity = 0.48 + Math.sin(state.clock.elapsedTime * 3.1 + node.position[0]) * 0.18
    }
  })

  return (
    <group position={node.position}>
      <group
        ref={bodyRef}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(node)
        }}
      >
        <mesh ref={haloOuterRef}>
          <sphereGeometry args={[0.62, 36, 36]} />
          <meshBasicMaterial
            color={statusStyle.color}
            transparent
            opacity={0.14}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={haloInnerRef}>
          <sphereGeometry args={[0.46, 36, 36]} />
          <meshBasicMaterial
            color={statusStyle.color}
            transparent
            opacity={0.26}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={coreRef}>
          <sphereGeometry args={[0.12, 32, 32]} />
          <meshBasicMaterial
            color={statusStyle.color}
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <points ref={sparkRef} geometry={sparkGeometry}>
          <pointsMaterial
            ref={sparkMaterialRef}
            color={statusStyle.label}
            size={0.018}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      </group>
      <Billboard position={[0, -0.72, 0]} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          fontSize={0.14}
          maxWidth={2.3}
          anchorX="center"
          anchorY="middle"
          color={statusStyle.label}
          outlineWidth={0.018}
          outlineColor="#020612"
        >
          {node.person.fullName}
        </Text>
      </Billboard>
    </group>
  )
}

type GraphSceneProps = {
  graph: GraphPayload
  onSelectNode: (node: GraphNodeData) => void
}

function GraphScene({ graph, onSelectNode }: GraphSceneProps) {
  const { nodes, edges } = graph
  const positionedNodes = useMemo(() => buildNodePositions(nodes), [nodes])
  const positionById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node.position])),
    [positionedNodes],
  )

  return (
    <>
      <color attach="background" args={['#02050f']} />
      <ambientLight intensity={0.42} />
      <pointLight position={[0, 4.5, 4]} intensity={42} color="#7be2ff" />
      <pointLight position={[-4, -2, -3]} intensity={18} color="#ff4c86" />
      <Stars radius={80} depth={48} count={1800} factor={3.4} saturation={0.35} fade speed={0.25} />

      <group>
        {edges.map((edge) => {
          const source = positionById.get(edge.source)
          const target = positionById.get(edge.target)
          const visual = connectionVisuals(edge.overlapScore)

          if (!source || !target) {
            return null
          }

          return (
            <Line
              key={edge.id}
              points={[source, target]}
              color={visual.color}
              lineWidth={visual.lineWidth}
              transparent
              opacity={visual.opacity}
            />
          )
        })}

        {positionedNodes.map((node) => (
          <SpaceNode key={node.id} node={node} onSelect={onSelectNode} />
        ))}
      </group>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, 0, 0]}
        minDistance={5.2}
        maxDistance={15}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
  )
}

function GraphTab({ graph }: GraphTabProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null)
  const [hiddenNodeIds, setHiddenNodeIds] = useState<string[]>([])
  const visibleGraph = useMemo(() => {
    const hiddenSet = new Set(hiddenNodeIds)

    return {
      nodes: graph.nodes.filter((node) => !hiddenSet.has(node.id)),
      edges: graph.edges.filter((edge) => !hiddenSet.has(edge.source) && !hiddenSet.has(edge.target)),
    }
  }, [graph, hiddenNodeIds])
  const databaseSignature = useMemo(
    () =>
      `${visibleGraph.nodes.map((node) => `${node.id}:${node.person.verificationStatus}:${node.person.trustScore}`).join('|')}::${visibleGraph.edges.map((edge) => `${edge.source}:${edge.target}:${edge.strength}`).join('|')}`,
    [visibleGraph],
  )
  const hiddenNodes = useMemo(
    () => graph.nodes.filter((node) => hiddenNodeIds.includes(node.id)),
    [graph.nodes, hiddenNodeIds],
  )

  useEffect(() => {
    if (selectedNode && hiddenNodeIds.includes(selectedNode.id)) {
      setSelectedNode(null)
    }
  }, [hiddenNodeIds, selectedNode])

  function hideNode(nodeId: string) {
    setHiddenNodeIds((current) => (current.includes(nodeId) ? current : [...current, nodeId]))
  }

  function showNode(nodeId: string) {
    setHiddenNodeIds((current) => current.filter((id) => id !== nodeId))
  }

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

      <section className="graph-visibility-panel" aria-label="Node visibility controls">
        <div>
          <h3>Visibility Controls</h3>
          <p className="tagline">Hide nodes you do not want to inspect right now. Their connections disappear too.</p>
        </div>
        <div className="graph-visibility-actions">
          <span className="graph-visibility-count">{visibleGraph.nodes.length} visible</span>
          <span className="graph-visibility-count">{hiddenNodes.length} hidden</span>
          <button
            type="button"
            className="graph-restore-button"
            onClick={() => setHiddenNodeIds([])}
            disabled={hiddenNodes.length === 0}
          >
            Show All
          </button>
        </div>
        {hiddenNodes.length > 0 ? (
          <div className="graph-hidden-list">
            {hiddenNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className="graph-hidden-chip"
                onClick={() => showNode(node.id)}
              >
                {node.person.fullName}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className={`graph-layout ${selectedNode ? 'sidebar-open' : ''}`}>
        <div className="graph-stage star-map" aria-label="Recovered people graph visualization">
          <Canvas
            className="graph-canvas"
            camera={{ position: [0, 2.8, 8.4], fov: 52 }}
            style={{ width: '100%', height: '100%' }}
            onPointerMissed={() => setSelectedNode(null)}
          >
            <GraphScene key={databaseSignature} graph={visibleGraph} onSelectNode={setSelectedNode} />
          </Canvas>
        </div>

        {selectedNode ? (
          <aside className="graph-inspector" aria-label="Selected person details">
            <p className={`graph-status-pill ${selectedNode.statusBucket}`}>
              {selectedNode.person.verificationStatus.replace('-', ' ')}
            </p>
            <h3 className="graph-person-code">{selectedNode.shortLabel}</h3>
            <p className="graph-person-name">{selectedNode.person.fullName}</p>

            <dl className="graph-person-meta">
              <div>
                <dt>Age</dt>
                <dd>{selectedNode.person.age}</dd>
              </div>
              <div>
                <dt>Gender</dt>
                <dd>{selectedNode.person.gender}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selectedNode.person.verificationStatus}</dd>
              </div>
              <div>
                <dt>Trust Score</dt>
                <dd>{selectedNode.person.trustScore}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{`${selectedNode.person.street}, ${selectedNode.person.city}, ${selectedNode.person.country}`}</dd>
              </div>
              <div>
                <dt>Occupation Type</dt>
                <dd>{selectedNode.person.occupationType}</dd>
              </div>
              {selectedNode.person.employment ? (
                <div>
                  <dt>Employment</dt>
                  <dd>
                    {selectedNode.person.employment.jobTitle}
                    <br />
                    {selectedNode.person.employment.employer}
                  </dd>
                </div>
              ) : null}
              {selectedNode.person.student ? (
                <div>
                  <dt>Student</dt>
                  <dd>
                    {selectedNode.person.student.institution}
                    <br />
                    {selectedNode.person.student.fieldOfStudy}
                  </dd>
                </div>
              ) : null}
              {selectedNode.person.retired ? (
                <div>
                  <dt>Former Occupation</dt>
                  <dd>{selectedNode.person.retired.formerOccupation ?? 'Unknown'}</dd>
                </div>
              ) : null}
              <div>
                <dt>Visibility</dt>
                <dd>
                  <button type="button" className="graph-hide-button" onClick={() => hideNode(selectedNode.id)}>
                    Hide This Node
                  </button>
                </dd>
              </div>
              <div>
                <dt>Database Object</dt>
                <dd>{JSON.stringify(selectedNode.person)}</dd>
              </div>
            </dl>
          </aside>
        ) : null}
      </div>

      <div className="graph-notes">
        <p>
          <span>Node rule</span> 3D spheres represent citizens loaded from `verify_deny.db`.
        </p>
        <p>
          <span>Color rule</span> Colors come from each citizen's `verification_status`.
        </p>
        <p>
          <span>Connection rule</span> Line thickness comes from `connections.strength` in the database.
        </p>
        <p>
          <span>Inspector rule</span> Click a node to open the sidebar. Click empty space to close it.
        </p>
        <p>
          <span>Visibility rule</span> Hidden nodes and their connected lines are removed until you restore them.
        </p>
      </div>
    </article>
  )
}

export default GraphTab
