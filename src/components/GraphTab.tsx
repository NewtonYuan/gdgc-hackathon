import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import { buildGraphFromRecords, type GraphNodeData, type RecordEntry } from '../lib/graphData'

type GraphTabProps = {
  database: RecordEntry[]
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
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  return nodes.map((node, index) => {
    const layer = index % 3
    const angle = index * goldenAngle
    const radius = 2.5 + layer * 1.15 + Math.floor(index / 3) * 0.15
    const y = (layer - 1) * 1.05 + Math.sin(index * 1.8) * 0.38

    return {
      ...node,
      position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
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
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null)
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
      bodyRef.current.rotation.y = state.clock.elapsedTime * 0.28
      bodyRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.42 + node.position[0]) * 0.08
      bodyRef.current.scale.setScalar(pulse)
      bodyRef.current.position.y = Math.sin(state.clock.elapsedTime + node.position[0]) * 0.05
    }

    if (meshRef.current) {
      meshRef.current.material.emissiveIntensity = 0.75 + pulse * 0.42
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
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.34, 48, 48]} />
          <meshStandardMaterial
            color={statusStyle.color}
            emissive={statusStyle.emissive}
            emissiveIntensity={1.05}
            roughness={0.34}
            metalness={0.12}
          />
        </mesh>
        <points ref={sparkRef} geometry={sparkGeometry}>
          <pointsMaterial
            ref={sparkMaterialRef}
            color="#fff6d2"
            size={0.022}
            transparent
            opacity={0.62}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      </group>
      <Text
        position={[0, -0.72, 0]}
        fontSize={0.14}
        maxWidth={2.3}
        anchorX="center"
        anchorY="middle"
        color={statusStyle.label}
        outlineWidth={0.018}
        outlineColor="#020612"
      >
        {node.person.name}
      </Text>
    </group>
  )
}

type GraphSceneProps = GraphTabProps & {
  onSelectNode: (node: GraphNodeData) => void
}

function GraphScene({ database, onSelectNode }: GraphSceneProps) {
  const { nodes, edges } = useMemo(() => buildGraphFromRecords(database), [database])
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

      <group rotation={[0.12, 0, 0]}>
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
        minDistance={4.2}
        maxDistance={11}
        autoRotate
        autoRotateSpeed={0.35}
      />
    </>
  )
}

function GraphTab({ database }: GraphTabProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null)
  const databaseSignature = useMemo(
    () => database.map((row) => `${row.name}:${row.role}:${row.district}:${row.status}`).join('|'),
    [database],
  )

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

      <div className={`graph-layout ${selectedNode ? 'sidebar-open' : ''}`}>
        <div className="graph-stage star-map" aria-label="Recovered people graph visualization">
          <Canvas
            className="graph-canvas"
            camera={{ position: [0, 2.8, 8.4], fov: 52 }}
            style={{ width: '100%', height: '100%' }}
            onPointerMissed={() => setSelectedNode(null)}
          >
            <GraphScene key={databaseSignature} database={database} onSelectNode={setSelectedNode} />
          </Canvas>
        </div>

        {selectedNode ? (
          <aside className="graph-inspector" aria-label="Selected person details">
            <p className={`graph-status-pill ${selectedNode.statusBucket}`}>
              {selectedNode.person.graphStatus.replace('-', ' ')}
            </p>
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
                <dt>Status</dt>
                <dd>{selectedNode.person.status}</dd>
              </div>
              <div>
                <dt>Database Object</dt>
                <dd>{`{ name: "${selectedNode.person.name}", role: "${selectedNode.person.role}", district: "${selectedNode.person.district}", status: "${selectedNode.person.status}" }`}</dd>
              </div>
            </dl>
          </aside>
        ) : null}
      </div>

      <div className="graph-notes">
        <p>
          <span>Node rule</span> 3D spheres represent people from the database.
        </p>
        <p>
          <span>Color rule</span> Verified records glow green, unresolved records glow amber, corrupted records glow red.
        </p>
        <p>
          <span>Connection rule</span> Role, district, and status overlap increase line thickness.
        </p>
        <p>
          <span>Inspector rule</span> Click a node to open the sidebar. Click empty space to close it.
        </p>
      </div>
    </article>
  )
}

export default GraphTab
