import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { RecordEntry } from './DatabaseTab'
import { buildGraphFromRecords, type GraphNodeData } from '../lib/graphData'

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
      position: [
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius,
      ],
    }
  })
}

function SpaceNode({ node }: { node: PositionedNode }) {
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null)
  const sparkRef = useRef<THREE.Points>(null)
  const statusStyle = STATUS_STYLES[node.statusBucket]
  const sparkGeometry = useMemo(() => {
    const positions: number[] = []
    const particleCount = 34

    for (let index = 0; index < particleCount; index += 1) {
      const theta = seededValue(node.id, index) * Math.PI * 2
      const phi = Math.acos(2 * seededValue(node.id, index + particleCount) - 1)
      const radius = 0.48 + seededValue(node.id, index + particleCount * 2) * 0.42

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

    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.28
      meshRef.current.scale.setScalar(pulse)
      meshRef.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime + node.position[0]) * 0.05
      meshRef.current.material.emissiveIntensity = 0.75 + pulse * 0.42
    }

    if (sparkRef.current) {
      sparkRef.current.rotation.y = state.clock.elapsedTime * 0.22
      sparkRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.45 + node.position[0]) * 0.16
      const sparkPulse = 1 + Math.sin(state.clock.elapsedTime * 2.8 + node.position[0]) * 0.08
      sparkRef.current.scale.setScalar(sparkPulse)
    }
  })

  return (
    <group position={node.position}>
      <points ref={sparkRef} geometry={sparkGeometry}>
        <pointsMaterial
          color={statusStyle.color}
          size={0.045}
          transparent
          opacity={0.82}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
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
      <Text
        position={[0, -0.72, 0]}
        fontSize={0.16}
        maxWidth={1.9}
        anchorX="center"
        anchorY="middle"
        color={statusStyle.label}
        outlineWidth={0.018}
        outlineColor="#020612"
      >
        {node.label}
      </Text>
    </group>
  )
}

function GraphScene({ database }: GraphTabProps) {
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
          const strength = Math.min(edge.weight, 4)

          if (!source || !target) {
            return null
          }

          return (
            <Line
              key={edge.id}
              points={[source, target]}
              color={strength >= 3 ? '#b8f3ff' : '#62d7ff'}
              lineWidth={0.7 + strength * 0.9}
              transparent
              opacity={0.26 + strength * 0.13}
            />
          )
        })}

        {positionedNodes.map((node) => (
          <SpaceNode key={node.id} node={node} />
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

      <div className="graph-stage star-map" aria-label="Recovered people graph visualization">
        <Canvas
          className="graph-canvas"
          camera={{ position: [0, 2.8, 8.4], fov: 52 }}
          style={{ width: '100%', height: '100%' }}
        >
          <GraphScene key={databaseSignature} database={database} />
        </Canvas>
      </div>

      <div className="graph-notes">
        <p>
          <span>Node rule</span> 3D spheres represent people from the database.
        </p>
        <p>
          <span>Color rule</span> Verified records glow green, unresolved records glow amber, corrupted records glow red.
        </p>
        <p>
          <span>Control rule</span> Drag to rotate the star map. Scroll to zoom between record clusters.
        </p>
      </div>
    </article>
  )
}

export default GraphTab
