import React, { useMemo, useState } from 'react';
import { Shield, Users, MapPin, Cpu, ZoomIn, ZoomOut, RotateCcw, AlertCircle } from 'lucide-react';

export default function DeploymentTacticalMap({
  nodes = [],
  phase = 1,
  currentPhase = {},
  safehouseCities = new Set(),
  safehouseCount = 3,
  agentPlacements = {},
  teamPlacements = {},
  droneBaseCity = null,
  agents = [],
  teams = [],
  selected = null,
  dragging = null,
  dragOver = null,
  setDragOver,
  onCityDrop,
  onCityTap,
  onRemoveSafehouse,
  onRemoveAgent,
  onRemoveTeam,
  onRemoveDroneBase,
  isMobile = false
}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);

  // Calculate SVG coordinates for each node
  const nodePositions = useMemo(() => {
    if (!nodes || nodes.length === 0) return {};

    let hasLatLng = nodes.every(n => n.coordinates?.lat !== undefined && n.coordinates?.lng !== undefined);
    
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    nodes.forEach(n => {
      if (n.coordinates) {
        if (n.coordinates.lat !== undefined) {
          minLat = Math.min(minLat, n.coordinates.lat);
          maxLat = Math.max(maxLat, n.coordinates.lat);
        }
        if (n.coordinates.lng !== undefined) {
          minLng = Math.min(minLng, n.coordinates.lng);
          maxLng = Math.max(maxLng, n.coordinates.lng);
        }
        if (n.coordinates.x !== undefined) {
          minX = Math.min(minX, n.coordinates.x);
          maxX = Math.max(maxX, n.coordinates.x);
        }
        if (n.coordinates.y !== undefined) {
          minY = Math.min(minY, n.coordinates.y);
          maxY = Math.max(maxY, n.coordinates.y);
        }
      }
    });

    const positions = {};
    const width = 900;
    const height = 580;
    const padding = 70;

    nodes.forEach(n => {
      let cx = width / 2;
      let cy = height / 2;

      if (hasLatLng && maxLng > minLng && maxLat > minLat) {
        const lngRatio = (n.coordinates.lng - minLng) / (maxLng - minLng);
        const latRatio = (n.coordinates.lat - minLat) / (maxLat - minLat);
        cx = padding + lngRatio * (width - 2 * padding);
        cy = (height - padding) - latRatio * (height - 2 * padding);
      } else if (n.coordinates?.x !== undefined && n.coordinates?.y !== undefined) {
        const xRatio = (n.coordinates.x - (minX < maxX ? minX : 0)) / ((maxX > minX ? maxX - minX : 100) || 1);
        const yRatio = (n.coordinates.y - (minY < maxY ? minY : 0)) / ((maxY > minY ? maxY - minY : 100) || 1);
        cx = padding + xRatio * (width - 2 * padding);
        cy = padding + yRatio * (height - 2 * padding);
      }
      positions[n.id] = { x: cx, y: cy };
    });

    return positions;
  }, [nodes]);

  // Compute connections (lines) between nodes
  const connectionsList = useMemo(() => {
    const list = [];
    const drawnPairs = new Set();

    nodes.forEach(n => {
      if (n.connections && Array.isArray(n.connections)) {
        n.connections.forEach(targetId => {
          const pairKey = [n.id, targetId].sort().join('--');
          if (!drawnPairs.has(pairKey) && nodePositions[n.id] && nodePositions[targetId]) {
            drawnPairs.add(pairKey);
            list.push({
              id: pairKey,
              fromId: n.id,
              toId: targetId,
              from: nodePositions[n.id],
              to: nodePositions[targetId]
            });
          }
        });
      }
    });

    return list;
  }, [nodes, nodePositions]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: isMobile ? '380px' : '480px',
      background: 'radial-gradient(circle at 50% 50%, rgba(6,16,36,0.95) 0%, rgba(2,6,16,0.98) 100%)',
      borderRadius: '8px',
      border: '1px solid rgba(0,240,255,0.2)',
      boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8), 0 0 20px rgba(0,240,255,0.08)',
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      {/* Grid Pattern Background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.15 }}>
        <defs>
          <pattern id="deploy-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00f0ff" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#deploy-grid)" />
      </svg>

      {/* Map Control Buttons */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        display: 'flex',
        gap: 6,
        background: 'rgba(0,10,24,0.85)',
        padding: 4,
        borderRadius: 6,
        border: '1px solid rgba(0,240,255,0.3)',
        backdropFilter: 'blur(4px)'
      }}>
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          style={{ background: 'transparent', border: 'none', color: '#00f0ff', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          style={{ background: 'transparent', border: 'none', color: '#00f0ff', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleResetZoom}
          title="Reset View"
          style={{ background: 'transparent', border: 'none', color: '#00f0ff', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Map Legend */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 10,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'rgba(0,10,24,0.85)',
        padding: '6px 12px',
        borderRadius: 6,
        border: '1px solid rgba(0,240,255,0.2)',
        fontSize: isMobile ? '8px' : '9px',
        fontFamily: "'Share Tech Mono', monospace",
        color: '#888',
        backdropFilter: 'blur(4px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 6px #00f0ff' }} />
          <span>FRIENDLY</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3b30', boxShadow: '0 0 6px #ff3b30' }} />
          <span>HOSTILE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Shield size={10} color="#00f0ff" />
          <span>SAFEHOUSE</span>
        </div>
      </div>

      {/* Main Interactive Map SVG */}
      <div style={{
        width: '100%',
        height: '100%',
        transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
        transformOrigin: 'center center',
        transition: 'transform 0.2s ease-out'
      }}>
        <svg viewBox="0 0 900 580" style={{ width: '100%', height: '100%' }}>
          <defs>
            <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="green-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="amber-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Connection Lines */}
          <g className="connections-layer">
            {connectionsList.map(conn => {
              const isFromSH = safehouseCities.has(conn.fromId);
              const isToSH = safehouseCities.has(conn.toId);
              const activeConn = isFromSH && isToSH;

              return (
                <line
                  key={conn.id}
                  x1={conn.from.x}
                  y1={conn.from.y}
                  x2={conn.to.x}
                  y2={conn.to.y}
                  stroke={activeConn ? '#00f0ff' : 'rgba(0, 240, 255, 0.18)'}
                  strokeWidth={activeConn ? 2 : 1.2}
                  strokeDasharray={activeConn ? 'none' : '4 4'}
                  opacity={activeConn ? 0.8 : 0.4}
                />
              );
            })}
          </g>

          {/* City Nodes */}
          <g className="nodes-layer">
            {nodes.map(node => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const hasSH = safehouseCities.has(node.id);
              const myAgents = agents.filter(a => agentPlacements[a.id] === node.id);
              const myTeams = teams.filter(t => teamPlacements[t.id] === node.id);
              const isDroneBase = droneBaseCity === node.id;
              const isHostile = node.territory === 'HOSTILE_TERRITORY';
              const isHome = node.territory === 'HOME_TERRITORY';

              // Valid drop / placement logic
              const isValidDrop =
                phase === 1 ? (!hasSH && safehouseCities.size < safehouseCount) :
                phase === 2 ? (hasSH && (dragging?.type === 'agent' || selected?.type === 'agent')) :
                phase === 3 ? (hasSH && (dragging?.type === 'team' || selected?.type === 'team')) :
                phase === 4 ? isHome : false;

              const isDimmed =
                (phase === 2 || phase === 3) ? !hasSH :
                (phase === 4 && droneBaseCity) ? (node.id !== droneBaseCity) :
                (phase === 4) ? !isHome : false;

              const isHovered = dragOver === node.id && isValidDrop;
              const nodeColor = isHome ? '#00f0ff' : isHostile ? '#ff3b30' : '#f59e0b';

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: isValidDrop || hasSH || isDroneBase ? 'pointer' : 'default', opacity: isDimmed ? 0.35 : 1 }}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onDragOver={e => {
                    e.preventDefault();
                    if (setDragOver) setDragOver(node.id);
                  }}
                  onDragLeave={() => setDragOver && setDragOver(null)}
                  onDrop={() => onCityDrop && onCityDrop(node.id)}
                  onClick={() => onCityTap && onCityTap(node.id)}
                >
                  {/* Pulsing Highlight Ring for Valid Drop Targets */}
                  {isValidDrop && (
                    <circle
                      r={24}
                      fill="none"
                      stroke={currentPhase.color || '#00f0ff'}
                      strokeWidth={2}
                      opacity={0.7}
                    >
                      <animate attributeName="r" values="18;28;18" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Outer Glow Circle */}
                  <circle
                    r={hasSH || isDroneBase ? 16 : 12}
                    fill={hasSH ? 'rgba(0,240,255,0.15)' : isDroneBase ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.6)'}
                    stroke={isHovered ? '#ffffff' : hasSH ? '#00f0ff' : isDroneBase ? '#10b981' : nodeColor}
                    strokeWidth={isHovered ? 2.5 : hasSH ? 2 : 1.5}
                    filter={hasSH ? 'url(#cyan-glow)' : 'none'}
                  />

                  {/* Inner Pin Point */}
                  <circle
                    r={5}
                    fill={nodeColor}
                  />

                  {/* Safehouse Shield Icon on Node */}
                  {hasSH && (
                    <g transform="translate(0, -18)">
                      <rect x="-10" y="-9" width="20" height="18" rx="3" fill="#001428" stroke="#00f0ff" strokeWidth="1" />
                      <path d="M0 -5 L5 -1 L5 4 L0 7 L-5 4 L-5 -1 Z" fill="#00f0ff" />
                    </g>
                  )}

                  {/* Drone Base Hangar Icon */}
                  {isDroneBase && (
                    <g transform="translate(0, -18)">
                      <rect x="-12" y="-9" width="24" height="18" rx="3" fill="#062419" stroke="#10b981" strokeWidth="1" />
                      <text x="0" y="3" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">🚁</text>
                    </g>
                  )}

                  {/* Unit Badges Pill below Node */}
                  {(myAgents.length > 0 || myTeams.length > 0) && (
                    <g transform="translate(0, 18)">
                      <rect x="-24" y="-7" width="48" height="14" rx="4" fill="#030a16" stroke="#00f0ff66" strokeWidth="1" />
                      <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="8" fontFamily="'Share Tech Mono', monospace">
                        {myAgents.length > 0 ? `👤${myAgents.length}` : ''} {myTeams.length > 0 ? `⚔️${myTeams.length}` : ''}
                      </text>
                    </g>
                  )}

                  {/* City Label */}
                  <text
                    y={hasSH || isDroneBase ? 32 : (myAgents.length > 0 || myTeams.length > 0 ? 32 : 22)}
                    textAnchor="middle"
                    fill={hasSH || isDroneBase ? '#e0f8ff' : '#a0b0c0'}
                    fontSize={isMobile ? "9" : "10"}
                    fontFamily="'Share Tech Mono', monospace"
                    fontWeight={hasSH ? 'bold' : 'normal'}
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                  >
                    {(node.name || node.id).replace(/_/g, ' ').toUpperCase()}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Hovered Node Info Overlay */}
      {hoveredNode && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 20,
          background: 'rgba(2,10,24,0.92)',
          border: '1px solid rgba(0,240,255,0.4)',
          borderRadius: 6,
          padding: '8px 12px',
          maxWidth: '220px',
          boxShadow: '0 0 20px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#00f0ff', letterSpacing: '0.08em', marginBottom: 4 }}>
            {(hoveredNode.name || hoveredNode.id).replace(/_/g, ' ').toUpperCase()}
          </div>
          <div style={{ fontSize: 8, color: hoveredNode.territory === 'HOME_TERRITORY' ? '#00f0ff' : '#ff3b30', letterSpacing: '0.1em', marginBottom: 6 }}>
            {hoveredNode.territory === 'HOME_TERRITORY' ? 'FRIENDLY HOME TERRITORY' : 'HOSTILE TERRITORY'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 9, color: '#aaa', fontFamily: "'Share Tech Mono', monospace" }}>
            <div>Safehouse: <span style={{ color: safehouseCities.has(hoveredNode.id) ? '#00f0ff' : '#666' }}>{safehouseCities.has(hoveredNode.id) ? 'ACTIVE SAFEHOUSE' : 'NONE'}</span></div>
            <div>Agents: <span style={{ color: '#10b981' }}>{agents.filter(a => agentPlacements[a.id] === hoveredNode.id).map(a => a.codename).join(', ') || 'None'}</span></div>
            <div>Teams: <span style={{ color: '#f59e0b' }}>{teams.filter(t => teamPlacements[t.id] === hoveredNode.id).map(t => t.name).join(', ') || 'None'}</span></div>
            {droneBaseCity === hoveredNode.id && <div style={{ color: '#10b981', fontWeight: 'bold' }}>🏭 Drone Base Established</div>}
          </div>
        </div>
      )}
    </div>
  );
}
