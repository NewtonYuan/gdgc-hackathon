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
    lineWidth: 0.18 + emphasis * 2.7,
    opacity: 0.24 + normalized * 0.68,
  }
}

type SpaceNodeProps = {
  node: PositionedNode
  focusMode: boolean
  isFocused: boolean
  isHighlighted: boolean
  onSelect: (node: GraphNodeData) => void
}

function SpaceNode({ node, focusMode, isFocused, isHighlighted, onSelect }: SpaceNodeProps) {
  const bodyRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null)
  const haloInnerRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null)
  const haloOuterRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null)
  const sparkMaterialRef = useRef<THREE.PointsMaterial>(null)
  const sparkRef = useRef<THREE.Points>(null)
  const statusStyle = STATUS_STYLES[node.statusBucket]
  const emphasisOpacity = focusMode && !isHighlighted ? 0.18 : 1
  const showLabel = !focusMode || isHighlighted
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

  useFrame((state, delta) => {
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.3 + node.position[2]) * 0.12
    const transition = 1 - Math.exp(-delta * 10)

    if (bodyRef.current) {
      bodyRef.current.rotation.z = state.clock.elapsedTime * 0.12
      bodyRef.current.scale.setScalar(pulse)
      bodyRef.current.position.y = Math.sin(state.clock.elapsedTime + node.position[0]) * 0.05
    }

    if (coreRef.current) {
      const targetOpacity = (0.9 + Math.sin(state.clock.elapsedTime * 2.8 + node.position[1]) * 0.08) * emphasisOpacity
      coreRef.current.material.opacity = THREE.MathUtils.lerp(coreRef.current.material.opacity, targetOpacity, transition)
    }

    if (haloInnerRef.current) {
      const targetOpacity = (0.24 + Math.sin(state.clock.elapsedTime * 2.1 + node.position[0]) * 0.05) * emphasisOpacity
      haloInnerRef.current.material.opacity = THREE.MathUtils.lerp(
        haloInnerRef.current.material.opacity,
        targetOpacity,
        transition,
      )
    }

    if (haloOuterRef.current) {
      const targetOpacity =
        (0.12 + Math.sin(state.clock.elapsedTime * 1.7 + node.position[2]) * 0.04 + (isFocused ? 0.08 : 0)) *
        emphasisOpacity
      const targetScale = isFocused ? 1.2 : 1
      haloOuterRef.current.material.opacity = THREE.MathUtils.lerp(
        haloOuterRef.current.material.opacity,
        targetOpacity,
        transition,
      )
      haloOuterRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), transition)
    }

    if (sparkMaterialRef.current) {
      const targetOpacity = (0.48 + Math.sin(state.clock.elapsedTime * 3.1 + node.position[0]) * 0.18) * emphasisOpacity
      sparkMaterialRef.current.opacity = THREE.MathUtils.lerp(
        sparkMaterialRef.current.opacity,
        targetOpacity,
        transition,
      )
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
      {showLabel ? (
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
      ) : null}
    </group>
  )
}

type GraphEdgeProps = {
  edge: GraphPayload['edges'][number]
  points: [[number, number, number], [number, number, number]]
  isConnectedToFocus: boolean
  focusMode: boolean
}

function GraphEdge({ edge, points, isConnectedToFocus, focusMode }: GraphEdgeProps) {
  const lineRef = useRef<any>(null)
  const visual = connectionVisuals(edge.overlapScore)
  const targetOpacity = focusMode && !isConnectedToFocus ? 0.1 : Math.min(1, visual.opacity + (isConnectedToFocus ? 0.08 : 0))

  useFrame((_, delta) => {
    if (!lineRef.current?.material || typeof lineRef.current.material.opacity !== 'number') {
      return
    }

    const transition = 1 - Math.exp(-delta * 10)
    lineRef.current.material.opacity = THREE.MathUtils.lerp(
      lineRef.current.material.opacity,
      targetOpacity,
      transition,
    )
  })

  return (
    <Line
      ref={lineRef}
      points={points}
      color={visual.color}
      lineWidth={visual.lineWidth}
      transparent
      opacity={targetOpacity}
    />
  )
}

type GraphSceneProps = {
  graph: GraphPayload
  focusedNodeId: string | null
  highlightedNodeIds: Set<string> | null
  onSelectNode: (node: GraphNodeData) => void
}

function GraphScene({ graph, focusedNodeId, highlightedNodeIds, onSelectNode }: GraphSceneProps) {
  const { nodes, edges } = graph
  const focusMode = Boolean(focusedNodeId && highlightedNodeIds)
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

          if (!source || !target) {
            return null
          }

          return (
            <GraphEdge
              key={edge.id}
              edge={edge}
              points={[source, target]}
              focusMode={focusMode}
              isConnectedToFocus={Boolean(focusedNodeId && (edge.source === focusedNodeId || edge.target === focusedNodeId))}
            />
          )
        })}

        {positionedNodes.map((node) => {
          const isHighlighted = highlightedNodeIds?.has(node.id) ?? false

          return (
            <SpaceNode
              key={node.id}
              node={node}
              focusMode={focusMode}
              isFocused={node.id === focusedNodeId}
              isHighlighted={isHighlighted}
              onSelect={onSelectNode}
            />
          )
        })}
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

type ProfileModalProps = {
  graph: GraphPayload
  node: GraphNodeData
  onClose: () => void
  onSelectNode: (node: GraphNodeData) => void
}

type CloseButtonProps = {
  ariaLabel: string
  className?: string
  onClick: () => void
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function CloseButton({ ariaLabel, className = '', onClick }: CloseButtonProps) {
  return (
    <button
      type="button"
      className={`graph-icon-close ${className}`.trim()}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  )
}

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return <span className="graph-muted-value">—</span>
  }

  return value
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return <span className="graph-muted-value">—</span>
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString()
}

function statusLabel(statusBucket: GraphNodeData['statusBucket']) {
  if (statusBucket === 'in-process') {
    return 'pending'
  }

  if (statusBucket === 'not-verified') {
    return 'not verified'
  }

  return 'verified'
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const isEmpty = value === null || value === undefined || value === ''

  return (
    <div className={`graph-modal-row ${isEmpty ? 'empty' : ''}`}>
      <dt>{label}</dt>
      <dd>{formatValue(value)}</dd>
    </div>
  )
}

function ProfileModal({ graph, node, onClose, onSelectNode }: ProfileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLElement>(null)
  const confirmActionRef = useRef<'deny' | null>(null)
  const [confirmAction, setConfirmAction] = useState<'deny' | null>(null)
  const [confirmNote, setConfirmNote] = useState('')
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const linkedNodes = useMemo(() => {
    return graph.edges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .map((edge) => {
        const linkedId = edge.source === node.id ? edge.target : edge.source
        const linkedNode = graph.nodes.find((candidate) => candidate.id === linkedId)
        return linkedNode ? { node: linkedNode, edge } : null
      })
      .filter((item): item is { node: GraphNodeData; edge: GraphPayload['edges'][number] } => item !== null)
  }, [graph.edges, graph.nodes, node.id])
  const connectionCounts = linkedNodes.reduce(
    (counts, item) => ({
      ...counts,
      [item.node.statusBucket]: counts[item.node.statusBucket] + 1,
    }),
    {
      verified: 0,
      'in-process': 0,
      'not-verified': 0,
    } satisfies Record<GraphNodeData['statusBucket'], number>,
  )
  const fullAddress = [node.person.street, node.person.city, node.person.country].filter(Boolean).join(', ')
  const trustScore = Math.min(Math.max(node.person.trustScore, 0), 100)
  const hasEmploymentData = Boolean(
    node.person.employment ||
      node.person.student ||
      node.person.retired?.formerOccupation,
  )
  const confirmVerb = 'Deny'
  const confirmStatus = 'not verified'

  useEffect(() => {
    confirmActionRef.current = confirmAction
  }, [confirmAction])

  useEffect(() => {
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (confirmActionRef.current) {
          setConfirmAction(null)
          setConfirmNote('')
          return
        }
        onClose()
        return
      }

      const focusContainer = confirmActionRef.current ? confirmRef.current : modalRef.current

      if (event.key !== 'Tab' || !focusContainer) {
        return
      }

      const focusableElements = Array.from(
        focusContainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute('disabled'))

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousActiveElement?.focus()
    }
  }, [onClose])

  function openConfirm(action: 'deny') {
    setConfirmAction(action)
    setConfirmNote('')
    window.setTimeout(() => {
      const firstFocusable = confirmRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      firstFocusable?.focus()
    }, 0)
  }

  function closeConfirm() {
    setConfirmAction(null)
    setConfirmNote('')
  }

  function confirmVerifierAction() {
    setConfirmAction(null)
    setConfirmNote('')
  }

  return (
    <div className="graph-modal-backdrop" onMouseDown={onClose}>
      <section
        ref={modalRef}
        className="graph-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="graph-profile-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="graph-modal-header">
          <div className="graph-modal-title-row">
            <h2 id="graph-profile-title">{node.person.fullName}</h2>
            <span className={`graph-status-pill ${node.statusBucket}`}>{statusLabel(node.statusBucket)}</span>
          </div>
          <CloseButton ariaLabel="Close profile" className="graph-modal-close" onClick={onClose} />
        </header>

        <div className="graph-modal-body">
          <section className="graph-modal-section">
            <h3>Identity</h3>
            <dl className="graph-modal-grid">
              <DetailRow label="Full name" value={node.person.fullName} />
              <DetailRow label="Age" value={node.person.age} />
              <DetailRow label="Gender" value={node.person.gender} />
              <DetailRow label="Date of birth" value={null} />
              <DetailRow label="Phone" value={node.person.phone} />
            </dl>
          </section>

          <section className="graph-modal-section">
            <h3>Verification</h3>
            <dl className="graph-modal-grid">
              <DetailRow label="Status" value={node.person.verificationStatus} />
              <div className="graph-modal-row graph-trust-row">
                <dt>Trust score</dt>
                <dd>
                  <span>{trustScore} / 100</span>
                  <i aria-hidden="true">
                    <b style={{ width: `${trustScore}%` }} />
                  </i>
                </dd>
              </div>
              <div className="graph-modal-row">
                <dt>Verification date</dt>
                <dd>{formatDate(node.person.decidedAt)}</dd>
              </div>
              <DetailRow label="Verifier ID" value={null} />
            </dl>
          </section>

          <section className="graph-modal-section">
            <h3>Address</h3>
            <dl className="graph-modal-grid">
              <DetailRow label="Street" value={node.person.street} />
              <DetailRow label="City" value={node.person.city} />
              <DetailRow label="Country" value={node.person.country} />
              <DetailRow label="Full address" value={fullAddress} />
            </dl>
          </section>

          <section className="graph-modal-section">
            <h3>Employment</h3>
            {!hasEmploymentData ? <p className="graph-empty-section-note">No employment data</p> : null}
            <dl className="graph-modal-grid">
              <DetailRow label="Occupation type" value={node.person.occupationType} />
              <DetailRow label="Job title" value={node.person.employment?.jobTitle} />
              <DetailRow label="Employer" value={node.person.employment?.employer} />
              <DetailRow label="Work address" value={node.person.employment?.workAddress} />
              <DetailRow label="Institution" value={node.person.student?.institution} />
              <DetailRow label="Student ID" value={node.person.student?.studentId} />
              <DetailRow label="Field of study" value={node.person.student?.fieldOfStudy} />
              <DetailRow label="Year of study" value={node.person.student?.yearOfStudy} />
              <DetailRow label="Former occupation" value={node.person.retired?.formerOccupation} />
            </dl>
          </section>

          <section className="graph-modal-section">
            <h3>Connections</h3>
            <p className="graph-connection-summary">
              {linkedNodes.length} linked people · {connectionCounts.verified} verified,{' '}
              {connectionCounts['in-process']} pending, {connectionCounts['not-verified']} not verified
            </p>
            <div className="graph-connection-chips">
              {linkedNodes.length > 0 ? (
                linkedNodes.map((item) => (
                  <button
                    key={item.node.id}
                    type="button"
                    className={`graph-connection-chip ${item.node.statusBucket}`}
                    onClick={() => onSelectNode(item.node)}
                    title={item.edge.overlapSummary}
                  >
                    {item.node.person.fullName}
                  </button>
                ))
              ) : (
                <span className="graph-muted-value">—</span>
              )}
            </div>
          </section>

          <section className="graph-modal-section">
            <h3>Documents</h3>
            <dl className="graph-modal-grid">
              {node.person.documents.length > 0 ? (
                node.person.documents.map((document) => (
                  <div className="graph-modal-row" key={`${document.type}-${document.documentNumber}`}>
                    <dt>{document.type.replace(/_/g, ' ')}</dt>
                    <dd>
                      {document.documentNumber}
                      <br />
                      <span className="graph-document-meta">
                        Issued {formatDate(document.issuedDate)} · Expires {formatDate(document.expiryDate)} ·{' '}
                        {formatValue(document.issuingAuthority)}
                      </span>
                    </dd>
                  </div>
                ))
              ) : (
                <DetailRow label="Documents" value={null} />
              )}
            </dl>
          </section>

          <section className="graph-modal-section">
            <h3>Record Metadata</h3>
            <dl className="graph-modal-grid">
              <DetailRow label="Profile source" value={node.person.profileSource} />
              <div className="graph-modal-row">
                <dt>Created date</dt>
                <dd>{formatDate(node.person.createdAt)}</dd>
              </div>
              <DetailRow label="Last updated" value={null} />
            </dl>
            <button
              type="button"
              className="graph-tech-toggle"
              aria-expanded={showTechnicalDetails}
              onClick={() => setShowTechnicalDetails((current) => !current)}
            >
              {showTechnicalDetails ? 'Hide Technical Details' : 'Show Technical Details'}
            </button>
            {showTechnicalDetails ? (
              <dl className="graph-modal-grid graph-tech-grid">
                <DetailRow label="Card ID" value={node.person.cardId} />
                <DetailRow label="Record ID" value={node.person.id} />
                <DetailRow label="Uploaded document path" value={node.person.documentPath} />
              </dl>
            ) : null}
          </section>
        </div>

        <footer className="graph-modal-footer">
          <button type="button" className="graph-modal-action verify">
            Verify
          </button>
          <button type="button" className="graph-modal-action deny" onClick={() => openConfirm('deny')}>
            Deny
          </button>
        </footer>

        {confirmAction ? (
          <div className="graph-confirm-layer" role="alertdialog" aria-modal="true" aria-labelledby="graph-confirm-title">
            <section className="graph-confirm-dialog" ref={confirmRef}>
              <h3 id="graph-confirm-title">
                {confirmVerb} this verification?
              </h3>
              <p>
                This will mark {node.person.fullName} as {confirmStatus}.
              </p>
              <label>
                <span>Reason or note</span>
                <textarea
                  value={confirmNote}
                  onChange={(event) => setConfirmNote(event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <div className="graph-confirm-actions">
                <button type="button" className="graph-modal-secondary" onClick={closeConfirm}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="graph-modal-action deny"
                  onClick={confirmVerifierAction}
                >
                  {confirmVerb}
                </button>
              </div>
            </section>
          </div>
          ) : null}
      </section>
    </div>
  )
}

function GraphTab({ graph }: GraphTabProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null)
  const [hiddenNodeIds, setHiddenNodeIds] = useState<string[]>([])
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const viewProfileButtonRef = useRef<HTMLButtonElement>(null)
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
  const adjacencyByNodeId = useMemo(() => {
    const adjacency = new Map<string, Set<string>>()

    for (const node of visibleGraph.nodes) {
      adjacency.set(node.id, new Set())
    }

    for (const edge of visibleGraph.edges) {
      adjacency.get(edge.source)?.add(edge.target)
      adjacency.get(edge.target)?.add(edge.source)
    }

    return adjacency
  }, [visibleGraph])
  const statusCounts = useMemo(
    () =>
      visibleGraph.nodes.reduce(
        (counts, node) => ({
          ...counts,
          [node.statusBucket]: counts[node.statusBucket] + 1,
        }),
        {
          verified: 0,
          'in-process': 0,
          'not-verified': 0,
        } satisfies Record<GraphNodeData['statusBucket'], number>,
      ),
    [visibleGraph.nodes],
  )

  const activeSelectedNode =
    selectedNode && !hiddenNodeIds.includes(selectedNode.id) ? selectedNode : null
  const focusedNodeId = activeSelectedNode?.id ?? null
  const highlightedNodeIds = useMemo(() => {
    if (!focusedNodeId) {
      return null
    }

    return new Set([focusedNodeId, ...(adjacencyByNodeId.get(focusedNodeId) ?? [])])
  }, [adjacencyByNodeId, focusedNodeId])

  function selectNode(node: GraphNodeData) {
    if (selectedNode?.id === node.id) {
      return
    }

    setSelectedNode(node)
  }

  function showNode(nodeId: string) {
    setHiddenNodeIds((current) => current.filter((id) => id !== nodeId))
  }

  function closeInspector() {
    setSelectedNode(null)
    setIsProfileModalOpen(false)
  }

  function closeProfileModal() {
    setIsProfileModalOpen(false)
    window.setTimeout(() => viewProfileButtonRef.current?.focus(), 0)
  }

  return (
    <>
    <article className="panel" role="tabpanel" aria-label="Relationship graph panel">
      <div className="graph-header">
        <div className="graph-title-group">
          <h2>People Graph</h2>
        </div>
        <div className="graph-toolbar">
          <div className="graph-legend" aria-label="Graph status distribution">
            <span className="legend-item">
              <i className="legend-swatch verified-node" aria-hidden="true" />
              Verified <strong>{statusCounts.verified}</strong>
            </span>
            <span className="legend-item">
              <i className="legend-swatch inprocess-node" aria-hidden="true" />
              In Process <strong>{statusCounts['in-process']}</strong>
            </span>
            <span className="legend-item">
              <i className="legend-swatch denied-node" aria-hidden="true" />
              Not Verified <strong>{statusCounts['not-verified']}</strong>
            </span>
          </div>
          <div className="graph-visibility-actions" aria-label="Node visibility controls">
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
          <div className="graph-help">
            <button
              type="button"
              className="graph-help-button"
              aria-label="Graph help"
              aria-expanded={isHelpOpen}
              onClick={() => setIsHelpOpen((current) => !current)}
            >
              ?
            </button>
            {isHelpOpen ? (
              <div className="graph-help-popover" role="note">
                <p>Colors track verification status. Thicker lines mean stronger inferred connections.</p>
                <p>Click a node to inspect it, or hide it from the sidebar.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={`graph-layout ${activeSelectedNode ? 'sidebar-open' : ''}`}>
        <div className="graph-stage star-map" aria-label="Recovered people graph visualization">
          {hiddenNodes.length > 0 ? (
            <div className="graph-hidden-list" aria-label="Hidden nodes">
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
          <Canvas
            className="graph-canvas"
            camera={{ position: [0, 2.8, 8.4], fov: 52 }}
            style={{ width: '100%', height: '100%' }}
            onPointerMissed={closeInspector}
          >
            <GraphScene
              key={databaseSignature}
              graph={visibleGraph}
              focusedNodeId={focusedNodeId}
              highlightedNodeIds={highlightedNodeIds}
              onSelectNode={selectNode}
            />
          </Canvas>
        </div>

        {activeSelectedNode ? (
          <aside
            className={`graph-inspector ${isProfileModalOpen ? 'modal-open' : ''}`}
            aria-label="Selected person details"
          >
            <div className="graph-inspector-head">
              <p className={`graph-status-pill ${activeSelectedNode.statusBucket}`}>
                {activeSelectedNode.person.verificationStatus.replace('-', ' ')}
              </p>
              <CloseButton ariaLabel="Close panel" className="graph-close-button" onClick={closeInspector} />
            </div>
            <p className="graph-person-name">{activeSelectedNode.person.fullName}</p>
            <button
              ref={viewProfileButtonRef}
              type="button"
              className="graph-more-button"
              onClick={() => setIsProfileModalOpen(true)}
            >
              View Full Profile
            </button>

            <dl className="graph-person-meta">
              <div>
                <dt>Age</dt>
                <dd>{activeSelectedNode.person.age}</dd>
              </div>
              <div>
                <dt>Gender</dt>
                <dd>{activeSelectedNode.person.gender}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{activeSelectedNode.person.verificationStatus}</dd>
              </div>
              <div>
                <dt>Trust Score</dt>
                <dd>{activeSelectedNode.person.trustScore}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{`${activeSelectedNode.person.street}, ${activeSelectedNode.person.city}, ${activeSelectedNode.person.country}`}</dd>
              </div>
              <div>
                <dt>Occupation Type</dt>
                <dd>{activeSelectedNode.person.occupationType}</dd>
              </div>
              {activeSelectedNode.person.employment ? (
                <div>
                  <dt>Employment</dt>
                  <dd>
                    {activeSelectedNode.person.employment.jobTitle}
                    <br />
                    {activeSelectedNode.person.employment.employer}
                  </dd>
                </div>
              ) : null}
              {activeSelectedNode.person.student ? (
                <div>
                  <dt>Student</dt>
                  <dd>
                    {activeSelectedNode.person.student.institution}
                    <br />
                    {activeSelectedNode.person.student.fieldOfStudy}
                  </dd>
                </div>
              ) : null}
              {activeSelectedNode.person.retired ? (
                <div>
                  <dt>Former Occupation</dt>
                  <dd>{activeSelectedNode.person.retired.formerOccupation ?? 'Unknown'}</dd>
                </div>
              ) : null}
            </dl>
          </aside>
        ) : null}
      </div>
    </article>
    {activeSelectedNode && isProfileModalOpen ? (
      <ProfileModal
        graph={graph}
        node={activeSelectedNode}
        onClose={closeProfileModal}
        onSelectNode={selectNode}
      />
    ) : null}
    </>
  )
}

export default GraphTab
