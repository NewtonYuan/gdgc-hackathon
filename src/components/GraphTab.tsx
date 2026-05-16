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
  layoutNodes: GraphNodeData[]
  focusedNodeId: string | null
  highlightedNodeIds: Set<string> | null
  onSelectNode: (node: GraphNodeData) => void
}

function GraphScene({ graph, layoutNodes, focusedNodeId, highlightedNodeIds, onSelectNode }: GraphSceneProps) {
  const { nodes, edges } = graph
  const focusMode = Boolean(focusedNodeId && highlightedNodeIds)
  const positionedNodes = useMemo(() => buildNodePositions(layoutNodes), [layoutNodes])
  const positionById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node.position])),
    [positionedNodes],
  )
  const visibleNodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes])

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

        {positionedNodes.filter((node) => visibleNodeIds.has(node.id)).map((node) => {
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

const SIDEBAR_EXIT_MS = 250
const MODAL_EXIT_MS = 150

type CloseButtonProps = {
  ariaLabel: string
  className?: string
  onClick: () => void
}

type FilterState = {
  statuses: GraphNodeData['statusBucket'][]
  trustMin: number
  trustMax: number
  cities: string[]
  occupationTypes: string[]
  ageMin: number
  ageMax: number
  includeMissingAge: boolean
  employers: string[]
  hasConnections: boolean
}

type SearchMatch = {
  field: string
  value: string
}

type SavedGraphView = {
  name: string
  search: string
  filters: FilterState
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

const DEFAULT_FILTERS: FilterState = {
  statuses: [],
  trustMin: 0,
  trustMax: 100,
  cities: [],
  occupationTypes: [],
  ageMin: 0,
  ageMax: 100,
  includeMissingAge: true,
  employers: [],
  hasConnections: false,
}

const SAVED_GRAPH_VIEWS_KEY = 'records-graph-saved-views'

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

function normalizeSearchValue(value: string | number | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function getSearchFields(node: GraphNodeData): SearchMatch[] {
  const fullAddress = [node.person.street, node.person.city, node.person.country].filter(Boolean).join(', ')

  return [
    { field: 'First name', value: node.person.firstName },
    { field: 'Last name', value: node.person.lastName },
    { field: 'Name', value: node.person.fullName },
    { field: 'Record ID', value: node.person.id },
    { field: 'Street', value: node.person.street },
    { field: 'City', value: node.person.city },
    { field: 'Address', value: fullAddress },
    { field: 'Employer', value: node.person.employment?.employer ?? '' },
    { field: 'Job title', value: node.person.employment?.jobTitle ?? '' },
    { field: 'Card ID', value: node.person.cardId },
  ]
}

function getSearchMatch(node: GraphNodeData, searchQuery: string): SearchMatch | null {
  const query = normalizeSearchValue(searchQuery)

  if (!query) {
    return null
  }

  return getSearchFields(node).find((item) => normalizeSearchValue(item.value).includes(query)) ?? null
}

function nodeMatchesSearch(node: GraphNodeData, searchQuery: string) {
  return !normalizeSearchValue(searchQuery) || Boolean(getSearchMatch(node, searchQuery))
}

function nodePassesFilters(node: GraphNodeData, filters: FilterState, connectionCounts: Map<string, number>) {
  const age = node.person.age
  const statusPasses = filters.statuses.length === 0 || filters.statuses.includes(node.statusBucket)
  const cityPasses = filters.cities.length === 0 || filters.cities.includes(node.person.city)
  const occupationPasses =
    filters.occupationTypes.length === 0 || filters.occupationTypes.includes(node.person.occupationType)
  const employer = node.person.employment?.employer ?? ''
  const employerPasses = filters.employers.length === 0 || filters.employers.includes(employer)
  const agePasses =
    age == null ? filters.includeMissingAge : age >= filters.ageMin && age <= filters.ageMax

  return (
    statusPasses &&
    node.person.trustScore >= filters.trustMin &&
    node.person.trustScore <= filters.trustMax &&
    cityPasses &&
    occupationPasses &&
    agePasses &&
    employerPasses &&
    (!filters.hasConnections || (connectionCounts.get(node.id) ?? 0) > 0)
  )
}

function applyFilters(
  people: GraphNodeData[],
  filters: FilterState,
  searchQuery: string,
  connectionCounts: Map<string, number>,
) {
  return people.filter((node) => nodePassesFilters(node, filters, connectionCounts) && nodeMatchesSearch(node, searchQuery))
}

function parseListParam(params: URLSearchParams, key: string) {
  return (params.get(key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function readFiltersFromUrl(): { filters: FilterState; search: string } {
  const params = new URLSearchParams(window.location.search)

  return {
    search: params.get('search') ?? '',
    filters: {
      statuses: parseListParam(params, 'status') as GraphNodeData['statusBucket'][],
      trustMin: Number(params.get('trustMin') ?? DEFAULT_FILTERS.trustMin),
      trustMax: Number(params.get('trustMax') ?? DEFAULT_FILTERS.trustMax),
      cities: parseListParam(params, 'city'),
      occupationTypes: parseListParam(params, 'occupation'),
      ageMin: Number(params.get('ageMin') ?? DEFAULT_FILTERS.ageMin),
      ageMax: Number(params.get('ageMax') ?? DEFAULT_FILTERS.ageMax),
      includeMissingAge: params.get('includeMissingAge') !== 'false',
      employers: parseListParam(params, 'employer'),
      hasConnections: params.get('hasConnections') === 'true',
    },
  }
}

function writeFiltersToUrl(filters: FilterState, search: string) {
  const params = new URLSearchParams()

  if (search.trim()) params.set('search', search.trim())
  if (filters.statuses.length > 0) params.set('status', filters.statuses.join(','))
  if (filters.trustMin !== 0) params.set('trustMin', String(filters.trustMin))
  if (filters.trustMax !== 100) params.set('trustMax', String(filters.trustMax))
  if (filters.cities.length > 0) params.set('city', filters.cities.join(','))
  if (filters.occupationTypes.length > 0) params.set('occupation', filters.occupationTypes.join(','))
  if (filters.ageMin !== 0) params.set('ageMin', String(filters.ageMin))
  if (filters.ageMax !== 100) params.set('ageMax', String(filters.ageMax))
  if (!filters.includeMissingAge) params.set('includeMissingAge', 'false')
  if (filters.employers.length > 0) params.set('employer', filters.employers.join(','))
  if (filters.hasConnections) params.set('hasConnections', 'true')

  const query = params.toString()
  window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
}

function readSavedViews() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_GRAPH_VIEWS_KEY) ?? '[]') as SavedGraphView[]
  } catch {
    return []
  }
}

function buildHistogram(values: number[], min: number, max: number, bucketCount = 10) {
  const buckets = Array.from({ length: bucketCount }, () => 0)
  const span = max - min || 1

  for (const value of values) {
    const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor(((value - min) / span) * bucketCount)))
    buckets[bucketIndex] += 1
  }

  const peak = Math.max(...buckets, 1)
  return buckets.map((count) => (count / peak) * 100)
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
  const [isClosing, setIsClosing] = useState(false)
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
        requestClose()
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
  }, [])

  function requestClose() {
    if (isClosing) {
      return
    }

    setIsClosing(true)
    window.setTimeout(onClose, MODAL_EXIT_MS)
  }

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
    <div className={`graph-modal-backdrop ${isClosing ? 'closing' : ''}`} onMouseDown={requestClose}>
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
          <CloseButton ariaLabel="Close profile" className="graph-modal-close" onClick={requestClose} />
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
  const initialUrlState = useMemo(() => readFiltersFromUrl(), [])
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null)
  const [sidebarNode, setSidebarNode] = useState<GraphNodeData | null>(null)
  const [isSidebarClosing, setIsSidebarClosing] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [rawSearchQuery, setRawSearchQuery] = useState(initialUrlState.search)
  const [searchQuery, setSearchQuery] = useState(initialUrlState.search)
  const [filters, setFilters] = useState<FilterState>(initialUrlState.filters)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [cityFilterSearch, setCityFilterSearch] = useState('')
  const [employerFilterSearch, setEmployerFilterSearch] = useState('')
  const [savedViews, setSavedViews] = useState<SavedGraphView[]>(() => readSavedViews())
  const viewProfileButtonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sidebarExitTimeoutRef = useRef<number | null>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const filterPopoverRef = useRef<HTMLDivElement>(null)
  const databaseSignature = useMemo(
    () =>
      `${graph.nodes.map((node) => `${node.id}:${node.person.verificationStatus}:${node.person.trustScore}`).join('|')}::${graph.edges.map((edge) => `${edge.source}:${edge.target}:${edge.strength}`).join('|')}`,
    [graph],
  )
  const adjacencyByNodeId = useMemo(() => {
    const adjacency = new Map<string, Set<string>>()

    for (const node of graph.nodes) {
      adjacency.set(node.id, new Set())
    }

    for (const edge of graph.edges) {
      adjacency.get(edge.source)?.add(edge.target)
      adjacency.get(edge.target)?.add(edge.source)
    }

    return adjacency
  }, [graph])
  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>()

    for (const node of graph.nodes) {
      counts.set(node.id, 0)
    }

    for (const edge of graph.edges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1)
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1)
    }

    return counts
  }, [graph])
  const filterOptions = useMemo(() => {
    const cities = [...new Set(graph.nodes.map((node) => node.person.city).filter(Boolean))].sort()
    const occupationTypes = [...new Set(graph.nodes.map((node) => node.person.occupationType).filter(Boolean))].sort()
    const employers = [
      ...new Set(graph.nodes.map((node) => node.person.employment?.employer ?? '').filter(Boolean)),
    ].sort()

    return { cities, occupationTypes, employers }
  }, [graph.nodes])
  const filteredNodes = useMemo(
    () => applyFilters(graph.nodes, filters, searchQuery, connectionCounts),
    [connectionCounts, filters, graph.nodes, searchQuery],
  )
  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes])
  const filteredGraph = useMemo(
    () => ({
      nodes: filteredNodes,
      edges: graph.edges.filter((edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)),
    }),
    [filteredNodeIds, filteredNodes, graph.edges],
  )
  const searchMatchesAll = useMemo(
    () => graph.nodes.filter((node) => nodeMatchesSearch(node, searchQuery)),
    [graph.nodes, searchQuery],
  )
  const searchResults = useMemo(
    () => filteredNodes.filter((node) => nodeMatchesSearch(node, searchQuery)).slice(0, 8),
    [filteredNodes, searchQuery],
  )
  const hiddenSearchMatchesCount = Math.max(0, searchMatchesAll.length - searchResults.length)
  const statusCounts = useMemo(
    () =>
      filteredNodes.reduce(
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
    [filteredNodes],
  )
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = []

    for (const status of filters.statuses) {
      chips.push({
        key: `status-${status}`,
        label: `Status: ${statusLabel(status)}`,
        clear: () => setFilters((current) => ({ ...current, statuses: current.statuses.filter((item) => item !== status) })),
      })
    }
    if (filters.trustMin !== 0 || filters.trustMax !== 100) {
      chips.push({
        key: 'trust',
        label: `Trust score: ${filters.trustMin}-${filters.trustMax}`,
        clear: () => setFilters((current) => ({ ...current, trustMin: 0, trustMax: 100 })),
      })
    }
    for (const city of filters.cities) {
      chips.push({
        key: `city-${city}`,
        label: `City: ${city}`,
        clear: () => setFilters((current) => ({ ...current, cities: current.cities.filter((item) => item !== city) })),
      })
    }
    for (const occupationType of filters.occupationTypes) {
      chips.push({
        key: `occupation-${occupationType}`,
        label: `Occupation: ${occupationType}`,
        clear: () =>
          setFilters((current) => ({
            ...current,
            occupationTypes: current.occupationTypes.filter((item) => item !== occupationType),
          })),
      })
    }
    if (filters.ageMin !== 0 || filters.ageMax !== 100) {
      chips.push({
        key: 'age',
        label: `Age: ${filters.ageMin}-${filters.ageMax}`,
        clear: () => setFilters((current) => ({ ...current, ageMin: 0, ageMax: 100 })),
      })
    }
    if (!filters.includeMissingAge) {
      chips.push({
        key: 'missing-age',
        label: 'Age: recorded only',
        clear: () => setFilters((current) => ({ ...current, includeMissingAge: true })),
      })
    }
    for (const employer of filters.employers) {
      chips.push({
        key: `employer-${employer}`,
        label: `Employer: ${employer}`,
        clear: () =>
          setFilters((current) => ({ ...current, employers: current.employers.filter((item) => item !== employer) })),
      })
    }
    if (filters.hasConnections) {
      chips.push({
        key: 'connections',
        label: 'Has connections',
        clear: () => setFilters((current) => ({ ...current, hasConnections: false })),
      })
    }

    return chips
  }, [filters])
  const trustHistogram = useMemo(
    () => buildHistogram(graph.nodes.map((node) => node.person.trustScore), 0, 100),
    [graph.nodes],
  )
  const ageHistogram = useMemo(
    () => buildHistogram(graph.nodes.map((node) => node.person.age).filter((age): age is number => age != null), 0, 100),
    [graph.nodes],
  )

  const activeSelectedNode = selectedNode && filteredNodeIds.has(selectedNode.id) ? selectedNode : null
  const visibleSidebarNode = activeSelectedNode ?? sidebarNode
  const focusedNodeId = activeSelectedNode?.id ?? null
  const highlightedNodeIds = useMemo(() => {
    if (!focusedNodeId) {
      return null
    }

    return new Set([focusedNodeId, ...(adjacencyByNodeId.get(focusedNodeId) ?? [])])
  }, [adjacencyByNodeId, focusedNodeId])

  useEffect(() => {
    return () => {
      if (sidebarExitTimeoutRef.current) {
        window.clearTimeout(sidebarExitTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearchQuery(rawSearchQuery), 150)
    return () => window.clearTimeout(timeoutId)
  }, [rawSearchQuery])

  useEffect(() => {
    writeFiltersToUrl(filters, rawSearchQuery)
  }, [filters, rawSearchQuery])

  useEffect(() => {
    if (selectedNode && !filteredNodeIds.has(selectedNode.id)) {
      closeInspector(selectedNode)
    }
  }, [filteredNodeIds, selectedNode])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchInputRef.current?.focus()
        setIsSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    if (!isFilterOpen) {
      return
    }

    function handleDismiss(event: MouseEvent) {
      const target = event.target as Node | null
      if (
        target &&
        (filterPopoverRef.current?.contains(target) || filterButtonRef.current?.contains(target))
      ) {
        return
      }

      setIsFilterOpen(false)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFilterOpen(false)
        filterButtonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleDismiss)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleDismiss)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isFilterOpen])

  function selectNode(node: GraphNodeData) {
    if (selectedNode?.id === node.id) {
      return
    }

    if (sidebarExitTimeoutRef.current) {
      window.clearTimeout(sidebarExitTimeoutRef.current)
      sidebarExitTimeoutRef.current = null
    }

    setIsSidebarClosing(false)
    setSidebarNode(node)
    setSelectedNode(node)
  }

  function clearAllFilters() {
    setFilters(DEFAULT_FILTERS)
    setRawSearchQuery('')
    setSearchQuery('')
  }

  function toggleFilterListValue(key: 'statuses' | 'cities' | 'occupationTypes' | 'employers', value: string) {
    setFilters((current) => {
      const currentValues = current[key] as string[]
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value]

      return { ...current, [key]: nextValues }
    })
  }

  function selectSearchResult(node: GraphNodeData) {
    selectNode(node)
    setRawSearchQuery(node.person.fullName)
    setSearchQuery(node.person.fullName)
    setIsSearchOpen(false)
  }

  function saveCurrentView() {
    const name = window.prompt('Name this graph view')
    if (!name?.trim()) {
      return
    }

    const nextViews = [...savedViews.filter((view) => view.name !== name.trim()), { name: name.trim(), search: rawSearchQuery, filters }]
    setSavedViews(nextViews)
    localStorage.setItem(SAVED_GRAPH_VIEWS_KEY, JSON.stringify(nextViews))
  }

  function loadSavedView(name: string) {
    const view = savedViews.find((item) => item.name === name)
    if (!view) {
      return
    }

    setFilters(view.filters)
    setRawSearchQuery(view.search)
    setSearchQuery(view.search)
  }

  function closeInspector(nodeForExit?: GraphNodeData) {
    if (sidebarExitTimeoutRef.current) {
      window.clearTimeout(sidebarExitTimeoutRef.current)
    }

    setSidebarNode(nodeForExit ?? activeSelectedNode ?? sidebarNode)
    setIsSidebarClosing(true)
    setSelectedNode(null)
    setIsProfileModalOpen(false)
    sidebarExitTimeoutRef.current = window.setTimeout(() => {
      setSidebarNode(null)
      setIsSidebarClosing(false)
      sidebarExitTimeoutRef.current = null
    }, SIDEBAR_EXIT_MS)
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

      <div className="graph-filter-toolbar" aria-label="Graph search and filters">
        <div className="graph-search-wrap">
          <span className="graph-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
            </svg>
          </span>
          <input
            ref={searchInputRef}
            type="search"
            className="graph-search-input"
            aria-label="Search people"
            aria-controls="graph-search-results"
            aria-expanded={isSearchOpen}
            placeholder="Search by name, ID, address, or employer..."
            value={rawSearchQuery}
            onChange={(event) => {
              setRawSearchQuery(event.target.value)
              setIsSearchOpen(true)
              setActiveSearchIndex(0)
            }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setRawSearchQuery('')
                setSearchQuery('')
                setIsSearchOpen(false)
                event.currentTarget.blur()
              } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveSearchIndex((current) => Math.min(current + 1, Math.max(searchResults.length - 1, 0)))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveSearchIndex((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Enter' && searchResults[activeSearchIndex]) {
                event.preventDefault()
                selectSearchResult(searchResults[activeSearchIndex])
              }
            }}
          />
          {rawSearchQuery ? (
            <button
              type="button"
              className="graph-search-clear"
              aria-label="Clear search"
              onClick={() => {
                setRawSearchQuery('')
                setSearchQuery('')
                searchInputRef.current?.focus()
              }}
            >
              ×
            </button>
          ) : null}
          {isSearchOpen && rawSearchQuery.trim() ? (
            <div className="graph-search-results" id="graph-search-results" role="listbox">
              {searchResults.length > 0 ? (
                searchResults.map((node, index) => {
                  const match = getSearchMatch(node, searchQuery)

                  return (
                    <button
                      key={node.id}
                      type="button"
                      role="option"
                      aria-selected={index === activeSearchIndex}
                      className={`graph-search-result ${index === activeSearchIndex ? 'active' : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSearchResult(node)}
                    >
                      <span className="graph-search-avatar" aria-hidden="true">
                        {node.shortLabel}
                      </span>
                      <span>
                        <strong>{node.person.fullName}</strong>
                        <small>{match ? `${match.field}: ${match.value}` : node.person.city}</small>
                      </span>
                      <i className={`graph-status-pill ${node.statusBucket}`}>{statusLabel(node.statusBucket)}</i>
                    </button>
                  )
                })
              ) : (
                <p>No people match this search</p>
              )}
              {hiddenSearchMatchesCount > 0 ? (
                <p className="graph-search-hidden-note">
                  {hiddenSearchMatchesCount} more results hidden by filters{' '}
                  <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)}>
                    Clear filters
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="graph-filter-center">
          <button
            ref={filterButtonRef}
            type="button"
            className="graph-filter-button"
            aria-expanded={isFilterOpen}
            onClick={() => setIsFilterOpen((current) => !current)}
          >
            Filters
          </button>
          {savedViews.length > 0 ? (
            <select
              className="graph-saved-views"
              aria-label="Saved graph views"
              defaultValue=""
              onChange={(event) => {
                loadSavedView(event.target.value)
                event.currentTarget.value = ''
              }}
            >
              <option value="">Saved views</option>
              {savedViews.map((view) => (
                <option key={view.name} value={view.name}>
                  {view.name}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" className="graph-save-view" onClick={saveCurrentView}>
            Save this view
          </button>
          <div className="graph-filter-chips" aria-label="Active filters">
            {activeFilterChips.map((chip) => (
              <button key={chip.key} type="button" className="graph-filter-chip" onClick={chip.clear}>
                {chip.label} ×
              </button>
            ))}
            {activeFilterChips.length > 0 || rawSearchQuery ? (
              <button type="button" className="graph-clear-all" onClick={clearAllFilters}>
                Clear all
              </button>
            ) : null}
          </div>

          {isFilterOpen ? (
            <div ref={filterPopoverRef} className="graph-filter-popover" role="dialog" aria-label="Graph filters">
              <section>
                <h3>Status</h3>
                {(['verified', 'in-process', 'not-verified'] as GraphNodeData['statusBucket'][]).map((status) => (
                  <label key={status}>
                    <input
                      type="checkbox"
                      checked={filters.statuses.length === 0 || filters.statuses.includes(status)}
                      onChange={() => {
                        if (filters.statuses.length === 0) {
                          setFilters((current) => ({
                            ...current,
                            statuses: (['verified', 'in-process', 'not-verified'] as GraphNodeData['statusBucket'][]).filter(
                              (item) => item !== status,
                            ),
                          }))
                        } else {
                          toggleFilterListValue('statuses', status)
                        }
                      }}
                    />
                    {statusLabel(status)}
                  </label>
                ))}
              </section>

              <section>
                <h3>Trust Score</h3>
                <div className="graph-histogram" aria-hidden="true">
                  {trustHistogram.map((height, index) => (
                    <i key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div className="graph-range-row">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.trustMin}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        trustMin: Math.min(Number(event.target.value), current.trustMax),
                      }))
                    }
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.trustMax}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        trustMax: Math.max(Number(event.target.value), current.trustMin),
                      }))
                    }
                  />
                </div>
                <div className="graph-number-pair">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.trustMin}
                    onChange={(event) => setFilters((current) => ({ ...current, trustMin: Number(event.target.value) }))}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.trustMax}
                    onChange={(event) => setFilters((current) => ({ ...current, trustMax: Number(event.target.value) }))}
                  />
                </div>
              </section>

              <section>
                <h3>District / City</h3>
                {filterOptions.cities.length > 10 ? (
                  <input
                    type="search"
                    className="graph-filter-search"
                    placeholder="Search cities"
                    value={cityFilterSearch}
                    onChange={(event) => setCityFilterSearch(event.target.value)}
                  />
                ) : null}
                <div className="graph-filter-list">
                  {filterOptions.cities
                    .filter((city) => normalizeSearchValue(city).includes(normalizeSearchValue(cityFilterSearch)))
                    .map((city) => (
                      <label key={city}>
                        <input
                          type="checkbox"
                          checked={filters.cities.includes(city)}
                          onChange={() => toggleFilterListValue('cities', city)}
                        />
                        {city}
                      </label>
                    ))}
                </div>
              </section>

              <section>
                <h3>Occupation Type</h3>
                <div className="graph-filter-list compact">
                  {filterOptions.occupationTypes.map((occupationType) => (
                    <label key={occupationType}>
                      <input
                        type="checkbox"
                        checked={filters.occupationTypes.includes(occupationType)}
                        onChange={() => toggleFilterListValue('occupationTypes', occupationType)}
                      />
                      {occupationType}
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <h3>Age Range</h3>
                <div className="graph-histogram" aria-hidden="true">
                  {ageHistogram.map((height, index) => (
                    <i key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div className="graph-range-row">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.ageMin}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        ageMin: Math.min(Number(event.target.value), current.ageMax),
                      }))
                    }
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.ageMax}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        ageMax: Math.max(Number(event.target.value), current.ageMin),
                      }))
                    }
                  />
                </div>
                <div className="graph-number-pair">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.ageMin}
                    onChange={(event) => setFilters((current) => ({ ...current, ageMin: Number(event.target.value) }))}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.ageMax}
                    onChange={(event) => setFilters((current) => ({ ...current, ageMax: Number(event.target.value) }))}
                  />
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.includeMissingAge}
                    onChange={(event) => setFilters((current) => ({ ...current, includeMissingAge: event.target.checked }))}
                  />
                  Include people with no age recorded
                </label>
              </section>

              <section>
                <h3>Employer</h3>
                {filterOptions.employers.length > 10 ? (
                  <input
                    type="search"
                    className="graph-filter-search"
                    placeholder="Search employers"
                    value={employerFilterSearch}
                    onChange={(event) => setEmployerFilterSearch(event.target.value)}
                  />
                ) : null}
                <div className="graph-filter-list">
                  {filterOptions.employers
                    .filter((employer) => normalizeSearchValue(employer).includes(normalizeSearchValue(employerFilterSearch)))
                    .map((employer) => (
                      <label key={employer}>
                        <input
                          type="checkbox"
                          checked={filters.employers.includes(employer)}
                          onChange={() => toggleFilterListValue('employers', employer)}
                        />
                        {employer}
                      </label>
                    ))}
                </div>
              </section>

              <section>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.hasConnections}
                    onChange={(event) => setFilters((current) => ({ ...current, hasConnections: event.target.checked }))}
                  />
                  Only show people with at least one connection
                </label>
              </section>
            </div>
          ) : null}
        </div>

        <p className="graph-result-count" aria-live="polite">
          Showing {filteredNodes.length} of {graph.nodes.length} people
        </p>
      </div>

      <div className={`graph-layout ${visibleSidebarNode ? 'sidebar-open' : ''}`}>
        <div className="graph-stage star-map" aria-label="Recovered people graph visualization">
          {filteredNodes.length === 0 ? (
            <div className="graph-empty-state">
              <p>No people match the current filters</p>
              <button type="button" onClick={clearAllFilters}>
                Clear all filters
              </button>
            </div>
          ) : null}
          <Canvas
            className="graph-canvas"
            camera={{ position: [0, 2.8, 8.4], fov: 52 }}
            style={{ width: '100%', height: '100%' }}
            onPointerMissed={() => closeInspector()}
          >
            <GraphScene
              key={databaseSignature}
              graph={filteredGraph}
              layoutNodes={graph.nodes}
              focusedNodeId={focusedNodeId}
              highlightedNodeIds={highlightedNodeIds}
              onSelectNode={selectNode}
            />
          </Canvas>
        </div>

        {visibleSidebarNode ? (
          <aside
            className={`graph-inspector ${isProfileModalOpen ? 'modal-open' : ''} ${isSidebarClosing ? 'closing' : ''}`}
            aria-label="Selected person details"
          >
            <div className="graph-inspector-content" key={visibleSidebarNode.id}>
              <div className="graph-inspector-head">
                <p className={`graph-status-pill ${visibleSidebarNode.statusBucket}`}>
                  {visibleSidebarNode.person.verificationStatus.replace('-', ' ')}
                </p>
                <CloseButton
                  ariaLabel="Close panel"
                  className="graph-close-button"
                  onClick={() => closeInspector(visibleSidebarNode)}
                />
              </div>
              <p className="graph-person-name">{visibleSidebarNode.person.fullName}</p>
              <button
                ref={viewProfileButtonRef}
                type="button"
                className="graph-more-button"
                onClick={() => setIsProfileModalOpen(true)}
                disabled={!activeSelectedNode}
              >
                View Full Profile
              </button>

              <dl className="graph-person-meta">
                <div>
                  <dt>Age</dt>
                  <dd>{visibleSidebarNode.person.age}</dd>
                </div>
                <div>
                  <dt>Gender</dt>
                  <dd>{visibleSidebarNode.person.gender}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{visibleSidebarNode.person.verificationStatus}</dd>
                </div>
                <div>
                  <dt>Trust Score</dt>
                  <dd>{visibleSidebarNode.person.trustScore}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{`${visibleSidebarNode.person.street}, ${visibleSidebarNode.person.city}, ${visibleSidebarNode.person.country}`}</dd>
                </div>
                <div>
                  <dt>Occupation Type</dt>
                  <dd>{visibleSidebarNode.person.occupationType}</dd>
                </div>
                {visibleSidebarNode.person.employment ? (
                  <div>
                    <dt>Employment</dt>
                    <dd>
                      {visibleSidebarNode.person.employment.jobTitle}
                      <br />
                      {visibleSidebarNode.person.employment.employer}
                    </dd>
                  </div>
                ) : null}
                {visibleSidebarNode.person.student ? (
                  <div>
                    <dt>Student</dt>
                    <dd>
                      {visibleSidebarNode.person.student.institution}
                      <br />
                      {visibleSidebarNode.person.student.fieldOfStudy}
                    </dd>
                  </div>
                ) : null}
                {visibleSidebarNode.person.retired ? (
                  <div>
                    <dt>Former Occupation</dt>
                    <dd>{visibleSidebarNode.person.retired.formerOccupation ?? 'Unknown'}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
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
