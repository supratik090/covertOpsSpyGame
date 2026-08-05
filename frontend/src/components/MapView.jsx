import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CityActionDrawer from './CityActionDrawer';
import CIAIntelBox from './CIAIntelBox';
import AttackerIntelBox from './AttackerIntelBox';
import GodModeOverlay, { GodModePanel } from './GodModeOverlay';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

export default function MapView({
  session,
  isTacticalView = false,
  activeScenario,
  selectedAgent,
  selectedTeam,
  selectedCityNode,
  setSelectedCityNode,
  onRelocateAgent,
  onRelocateTacticalTeam,
  localAgentMoves,
  localTeamMoves,
  localAgentTasks = {},
  onBuildSafehouse,
  onDeployTech,
  onAssignAgentTask,
  showGodMode,
  replayPlan,
  replayTurn,
  covertActions,
  onToggleCovertAction,
  localTechDeploys = [],
  localSafehouseBuilds = [],
  addToast,
  isWaiting,
  localSuspectMove,
  setLocalSuspectMove,
  localTargetSafehouseCode,
  setLocalTargetSafehouseCode,
  localBuiltSafehouses = [],
  localBuiltSecureSafehouses = [],
  localActiveJammerTarget,
  localDecoyDeployments = [],
  localRequestFinance,
  setLocalRequestFinance,
  localCollectFinance,
  setLocalCollectFinance,
  localRequestLogistics,
  setLocalRequestLogistics,
  localCollectLogistics,
  setLocalCollectLogistics,
  localBeginHandover,
  setLocalBeginHandover,
  setReplayTurn
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Dynamically build coordinates and connections from activeScenario
  const CITY_COORDINATES = React.useMemo(() => {
    const coords = {};
    if (activeScenario && activeScenario.nodes) {
      activeScenario.nodes.forEach(node => {
        if (node.coordinates) {
          if (node.coordinates.lat !== undefined && node.coordinates.lng !== undefined) {
            coords[node.id] = [node.coordinates.lat, node.coordinates.lng];
          } else if (node.coordinates.x !== undefined && node.coordinates.y !== undefined) {
            // Increased spacing multipliers for cleaner layout
            const lat = 36.0 - (node.coordinates.y * 0.24);
            const lng = 65.0 + (node.coordinates.x * 0.3);
            coords[node.id] = [lat, lng];
          }
        }
      });

      // Relaxation pass to ensure no nodes overlap or are too close
      const minDistance = 1.2; // degrees threshold
      const keys = Object.keys(coords);
      for (let iter = 0; iter < 12; iter++) {
        let shifted = false;
        for (let i = 0; i < keys.length; i++) {
          for (let j = i + 1; j < keys.length; j++) {
            const idA = keys[i];
            const idB = keys[j];
            const [latA, lngA] = coords[idA];
            const [latB, lngB] = coords[idB];
            const dLat = latA - latB;
            const dLng = lngA - lngB;
            const dist = Math.sqrt(dLat * dLat + dLng * dLng);
            if (dist < minDistance && dist > 0.0001) {
              const diff = minDistance - dist;
              const forceX = (dLng / dist) * (diff / 2);
              const forceY = (dLat / dist) * (diff / 2);
              coords[idA] = [latA + forceY, lngA + forceX];
              coords[idB] = [latB - forceY, lngB - forceX];
              shifted = true;
            }
          }
        }
        if (!shifted) break;
      }
    } else {
      Object.assign(coords, {
        karachi: [24.8607, 67.0011],
        quetta: [30.1798, 66.9750],
        peshawar: [34.0151, 71.5249],
        islamabad: [33.6844, 73.0479],
        lahore: [31.5204, 74.3587],
        srinagar: [34.0837, 74.7973],
        jammu: [32.7266, 74.8570],
        amritsar: [31.6340, 74.8723],
        chandigarh: [30.7333, 76.7794],
        new_delhi: [28.6139, 77.2090]
      });
    }
    return coords;
  }, [activeScenario]);

  const CONNECTIONS = React.useMemo(() => {
    const conns = [];
    if (activeScenario && activeScenario.nodes) {
      activeScenario.nodes.forEach(node => {
        if (node.connections) {
          node.connections.forEach(connId => {
            const exists = conns.some(([c1, c2]) => (c1 === node.id && c2 === connId) || (c1 === connId && c2 === node.id));
            if (!exists) {
              conns.push([node.id, connId]);
            }
          });
        }
      });
    } else {
      conns.push(
        ['karachi', 'quetta'], ['karachi', 'lahore'], ['quetta', 'peshawar'],
        ['peshawar', 'lahore'], ['peshawar', 'islamabad'], ['islamabad', 'lahore'],
        ['lahore', 'srinagar'], ['lahore', 'jammu'], ['lahore', 'amritsar'],
        ['srinagar', 'jammu'], ['jammu', 'amritsar'], ['amritsar', 'chandigarh'],
        ['chandigarh', 'new_delhi']
      );
    }
    return conns;
  }, [activeScenario]);

  // Normalize node coordinate points for Tactical View
  const scaledCoords = React.useMemo(() => {
    if (!activeScenario || !activeScenario.nodes) return {};
    const xCoords = activeScenario.nodes.map(n => n.coordinates?.x || 50);
    const yCoords = activeScenario.nodes.map(n => n.coordinates?.y || 50);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;

    const coords = {};
    activeScenario.nodes.forEach(node => {
      if (node.coordinates) {
        const scaledX = 12 + ((node.coordinates.x - minX) / xRange) * 76;
        const scaledY = 12 + ((node.coordinates.y - minY) / yRange) * 76;
        coords[node.id] = { x: scaledX, y: scaledY };
      } else {
        coords[node.id] = { x: 50, y: 50 };
      }
    });

    // Avoid overlaps: push nodes that are too close to each other apart
    const keys = Object.keys(coords);
    const minDistance = 7.0; // Minimum distance in % space to prevent overlapping labels
    for (let iter = 0; iter < 15; iter++) {
      let moved = false;
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const id1 = keys[i];
          const id2 = keys[j];
          const c1 = coords[id1];
          const c2 = coords[id2];
          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            moved = true;
            const overlap = minDistance - dist;
            const pushX = (dist === 0 ? 1 : dx / dist) * (overlap / 2);
            const pushY = (dist === 0 ? 0 : dy / dist) * (overlap / 2);
            
            c1.x -= pushX;
            c1.y -= pushY;
            c2.x += pushX;
            c2.y += pushY;
            
            // Keep nodes within bounds [5, 95]
            c1.x = Math.max(5, Math.min(95, c1.x));
            c1.y = Math.max(5, Math.min(95, c1.y));
            c2.x = Math.max(5, Math.min(95, c2.x));
            c2.y = Math.max(5, Math.min(95, c2.y));
          }
        }
      }
      if (!moved) break;
    }

    return coords;
  }, [activeScenario]);

  // Restore Leaflet bounds & dimensions smoothly when switching from Tactical back to Map View
  useEffect(() => {
    if (!isTacticalView && mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
        const coords = Object.values(CITY_COORDINATES);
        if (coords.length > 0) {
          const bounds = L.latLngBounds(coords);
          mapRef.current.fitBounds(bounds, { padding: [20, 20] });
        }
      }, 100);
    }
  }, [isTacticalView]);

  // Zoom and Pan states for Tactical View
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e) => {
    if (!isTacticalView) return;
    const zoomFactor = 0.08;
    let newScale = zoomScale - e.deltaY * zoomFactor * 0.01;
    newScale = Math.max(0.5, Math.min(3.0, newScale));
    setZoomScale(newScale);
  };

  const handleMouseDown = (e) => {
    if (!isTacticalView) return;
    if (e.target.closest('.city-marker-wrapper') || e.target.closest('.tab-content') || e.target.closest('.map-toolbar')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isTacticalView || !isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  const markersRef = useRef({});
  const polylinesRef = useRef([]);
  const godRouteRef = useRef(null);
  const godPulseRef = useRef(null);

  // Transition Animation States
  const prevSessionRef = useRef(session);
  const [movingUnits, setMovingUnits] = useState([]);
  const [buildingSafehouses, setBuildingSafehouses] = useState([]);
  const [exposingSafehouses, setExposingSafehouses] = useState([]);
  const [combatAlerts, setCombatAlerts] = useState([]);
  const [newSafehouses, setNewSafehouses] = useState([]);
  const [uncoveredSafehouses, setUncoveredSafehouses] = useState([]);
  const [newTechDeploys, setNewTechDeploys] = useState([]);
  const [expiredTechScans, setExpiredTechScans] = useState([]);
  const [confettiCities, setConfettiCities] = useState([]);
  const [lostCities, setLostCities] = useState([]);
  const [isShaking, setIsShaking] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);

  // Force re-render overlay coordinates when Leaflet map moves/zooms
  useEffect(() => {
    if (isTacticalView) return;
    const map = mapRef.current;
    if (!map) return;
    const handleMapUpdate = () => setMapVersion(v => v + 1);
    map.on('move zoom viewreset drag', handleMapUpdate);
    return () => {
      map.off('move zoom viewreset drag', handleMapUpdate);
    };
  }, [session, isTacticalView]);

  // Initialize Map
  useEffect(() => {
    if (isTacticalView) return;
    if (!mapContainerRef.current) return;

    // Calculate bounding box containing all cities to maximize screen space usage
    const coords = Object.values(CITY_COORDINATES);
    const bounds = L.latLngBounds(coords);

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    });

    map.fitBounds(bounds, { padding: [20, 20] });

    mapRef.current = map;

    // Satellite view tile layer (ESRI World Imagery)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 17,
      minZoom: 4
    }).addTo(map);

    const gridCanvas = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{y}/{x}.png', {
      opacity: 0.5
    }).addTo(map);

    map.on('click', (e) => {
      // Check if click was directly on the map container/background (not inside a marker/path)
      if (e.originalEvent.target.classList.contains('leaflet-container') || e.originalEvent.target.tagName === 'path') {
        if (window.innerWidth > 768) {
          setSelectedCityNode(null);
        }
      }
    });

    const handleResize = () => {
      map.invalidateSize();
      const currentCoords = Object.values(CITY_COORDINATES);
      if (currentCoords.length > 0) {
        const currentBounds = L.latLngBounds(currentCoords);
        map.fitBounds(currentBounds, { padding: [20, 20] });
      }
    };
    window.addEventListener('resize', handleResize);

    setTimeout(() => {
      map.invalidateSize();
      const currentCoords = Object.values(CITY_COORDINATES);
      if (currentCoords.length > 0) {
        const currentBounds = L.latLngBounds(currentCoords);
        map.fitBounds(currentBounds, { padding: [20, 20] });
      }
    }, 350);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
    };
  }, [isTacticalView]);

  // Handle updates to cities, connections, and markers
  useEffect(() => {
    if (isTacticalView) return;
    const map = mapRef.current;
    if (!map) return;

    // Clear old lines
    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = [];

    // Draw connection lines
    CONNECTIONS.forEach(([fromId, toId]) => {
      const fromCoords = CITY_COORDINATES[fromId];
      const toCoords = CITY_COORDINATES[toId];
      if (fromCoords && toCoords) {
        const fromNode = activeScenario?.nodes?.find(n => n.id === fromId);
        const toNode = activeScenario?.nodes?.find(n => n.id === toId);
        const fromFriendly = fromNode ? fromNode.territory === 'HOME_TERRITORY' : ['srinagar', 'jammu', 'amritsar', 'chandigarh', 'new_delhi'].includes(fromId);
        const toFriendly = toNode ? toNode.territory === 'HOME_TERRITORY' : ['srinagar', 'jammu', 'amritsar', 'chandigarh', 'new_delhi'].includes(toId);
        const isCrossBorder = fromFriendly !== toFriendly;

        const polyline = L.polyline([fromCoords, toCoords], {
          color: isCrossBorder ? '#ff3b30' : '#00f0ff',
          weight: 2,
          opacity: 0.4,
          dashArray: '5, 8'
        }).addTo(map);
        polylinesRef.current.push(polyline);
      }
    });

    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    // Render city nodes
    const sweepCities = session.hostilePatrolCities || [];
    const isAttacker = session.playerRole === 'ATTACKER';

    Object.entries(CITY_COORDINATES).forEach(([cityId, coords]) => {
      const nodeData = activeScenario?.nodes?.find(n => n.id === cityId);
      const isFriendlyRaw = nodeData ? nodeData.territory === 'HOME_TERRITORY' : ['srinagar', 'jammu', 'amritsar', 'chandigarh', 'new_delhi'].includes(cityId);
      const isFriendly = isAttacker ? !isFriendlyRaw : isFriendlyRaw;
      const isTarget = activeScenario?.targetCity ? cityId === activeScenario.targetCity : cityId === 'new_delhi';
      
      const hasDefenderSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'DEFENDER');
      const hasHostileSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE');
      const hasExposedNormalSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.uncovered && !s.secure);
      const hasExposedSecureSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.uncovered && s.secure);
      
      const isSecureSafehouse = hasHostileSafehouse && session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.secure);
      const showSafehouseIcon = isAttacker ? (hasHostileSafehouse ? (isSecureSafehouse ? '🛡️' : '🏠') : '') : (hasDefenderSafehouse ? '🏠' : '');
      const showExposedNormalIcon = !isAttacker && hasExposedNormalSH;
      const showExposedSecureIcon = !isAttacker && hasExposedSecureSH;
      
      const isSweptZone = sweepCities.includes(cityId);

      // Render suspect if we are Attacker, or if God Mode is on for Defender
      const isSuspectHere = isAttacker 
        ? (session.suspectLocation === cityId)
        : (showGodMode && session.suspectLocation === cityId);

      // Calculate counts dynamically by factoring in local buffered turn moves (only show if not Attacker or if God Mode is enabled)
      const agentsCount = (isAttacker && !showGodMode) ? 0 : session.agents.filter(a => {
        const plannedDest = localAgentMoves[a.id];
        if (plannedDest) return plannedDest === cityId;
        return a.currentCity === cityId;
      }).length;

      const teamsCount = (isAttacker && !showGodMode) ? 0 : session.tacticalTeams.filter(t => {
        const plannedDest = localTeamMoves[t.id];
        if (plannedDest) return plannedDest === cityId;
        return t.currentCity === cityId;
      }).length;

      // Extract tech resources
      const cityTech = session.espionageResources.filter(r => r.cityNode === cityId);
      const techIcons = [];
      cityTech.forEach(r => {
        let icon;
        switch (r.type) {
          case 'SATELLITE': icon = '🛰️'; break;
          case 'CCTV': icon = '📹'; break;
          case 'WIRE_TAP': icon = '🔍'; break;
          case 'PHONE_TAP': icon = '📞'; break;
          case 'FINANCE_MONITOR': icon = '💰'; break;
          case 'BIOMETRIC_SCAN': icon = '🔴'; break;
          case 'BORDER_GUARD': icon = '🚧'; break;
          case 'SIGNAL_JAMMER': icon = '📡'; break;
          case 'ATTACKER_JAMMER': icon = '⚡'; break;
          default: icon = '🛰️';
        }
        techIcons.push(`<span class="city-marker-tech-icon">${icon}</span>`);
      });

      // Extract decoys & jammers for Attacker
      const cityDecoys = session.activeDecoys ? session.activeDecoys.filter(d => d.cityNode === cityId) : [];
      const attackerTechIcons = [];
      cityDecoys.forEach(d => {
        attackerTechIcons.push(`<span class="city-marker-tech-icon">${d.type === 'CCTV' ? '📹' : '🛰️'}</span>`);
      });
      cityTech.filter(r => r.type === 'ATTACKER_JAMMER').forEach(() => {
        attackerTechIcons.push(`<span class="city-marker-tech-icon">⚡</span>`);
      });

      const combinedTech = (isAttacker && showGodMode)
        ? [...attackerTechIcons, ...techIcons]
        : (isAttacker ? attackerTechIcons : techIcons);

      const techMarkersHtml = combinedTech.length > 0
        ? `<div class="city-marker-tech">${combinedTech.join('')}</div>`
        : '';

      const isSelected = selectedCityNode === cityId;

      // Determine if any agent at this city is idle (no task or NONE)
      const cityAgents = session.agents.filter(a => {
        const plannedDest = localAgentMoves[a.id];
        if (plannedDest) return plannedDest === cityId;
        return a.currentCity === cityId;
      });
      const hasIdleAgent = !isAttacker && cityAgents.some(a => {
        const effectiveTask = localAgentTasks[a.id] || a.activeTask;
        return !effectiveTask || effectiveTask === 'NONE' || effectiveTask === '';
      });

      // Construct dynamic HTML for Leaflet markers matching the index.css styling
      const markerHtml = `
        <div class="city-marker-wrapper ${isSelected ? 'selected' : ''} ${hasIdleAgent ? 'has-idle' : ''} ${isSweptZone ? 'swept-zone' : ''} ${isSuspectHere ? 'suspect-here-wrapper' : ''}">
          ${isSweptZone ? '<div class="city-marker-sweep-ring"></div>' : ''}
          ${isSuspectHere ? '<div class="suspect-radar-ring"></div>' : ''}
          <div class="city-marker-outer ${isFriendly ? 'friendly' : 'hostile'} ${isSweptZone ? 'sweep-alert' : ''}"></div>
          <div class="city-marker-inner ${isFriendly ? 'friendly' : 'hostile'} ${isTarget ? 'target' : ''}"></div>
          ${showSafehouseIcon ? `<div class="city-marker-safehouse" style="display: flex; align-items: center; justify-content: center; font-size: 11px;">${showSafehouseIcon}</div>` : ''}
          ${showExposedNormalIcon ? `<div class="city-marker-exposed-hostile">👁️</div>` : ''}
          ${showExposedSecureIcon ? `<div class="city-marker-exposed-secure">🛡️</div>` : ''}
          ${isSuspectHere ? `<div class="city-marker-badge suspect pulse-badge" style="background: #ff3b30; box-shadow: 0 0 15px #ff3b30; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; border: 2px solid white; border-radius: 50%; width: 22px; height: 22px; transform: translate(12px, -24px); z-index: 1000;">🎯</div>` : ''}
          ${agentsCount > 0 ? `<div class="city-marker-badge agents">${agentsCount}</div>` : ''}
          ${teamsCount > 0 ? `<div class="city-marker-badge teams">${teamsCount}</div>` : ''}
          ${techMarkersHtml}
          ${hasIdleAgent ? `<div class="city-marker-idle">⚠</div>` : ''}
          ${isSweptZone ? '<div class="city-marker-sweep-label">⚠ SWEEP</div>' : ''}
          <div class="city-marker-label ${isSelected ? 'active' : ''} ${isSweptZone ? 'sweep-text' : ''}">${cityId.replace('_', ' ').toUpperCase()}</div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const marker = L.marker(coords, { icon: customIcon })
        .addTo(map)
        .on('click', () => {
          setSelectedCityNode(cityId);
          // Zoom into the clicked city smoothly
          map.setView(coords, 8, { animate: true });
        });

      markersRef.current[cityId] = marker;
    });

    // Helper to add minor geographical offset to coordinate pairs
    const getOffsetCoords = (c1, c2, offsetAmount) => {
      // Calculate normal vector to offset path sideways
      const dy = c2[0] - c1[0];
      const dx = c2[1] - c1[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return [c1, c2];
      const nx = -dy / len;
      const ny = dx / len;
      return [
        [c1[0] + nx * offsetAmount, c1[1] + ny * offsetAmount],
        [c2[0] + nx * offsetAmount, c2[1] + ny * offsetAmount]
      ];
    };

    // NOTE: Pre-turn dotted movement lines removed intentionally.
    // Movement is communicated via city badge counts and the post-turn SVG animation overlay.

  }, [session, selectedCityNode, selectedAgent, localAgentMoves, localTeamMoves, localAgentTasks, session.hostilePatrolCities, isTacticalView]);

  // Handle God Mode Replay Routes
  useEffect(() => {
    if (isTacticalView) return;
    const map = mapRef.current;
    if (!map) return;

    if (godRouteRef.current) {
      godRouteRef.current.remove();
      godRouteRef.current = null;
    }
    if (godPulseRef.current) {
      godPulseRef.current.remove();
      godPulseRef.current = null;
    }

    if (showGodMode && replayPlan && replayPlan.primaryPlan) {
      const activeSteps = replayPlan.primaryPlan.slice(0, replayTurn);
      const points = activeSteps
        .map(step => CITY_COORDINATES[step.suspectLocation])
        .filter(Boolean);

      if (points.length > 1) {
        godRouteRef.current = L.polyline(points, {
          color: '#bd00ff',
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 6'
        }).addTo(map);
      }

      // Add pulsing marker on current location
      const currentStep = replayPlan.primaryPlan[replayTurn - 1];
      if (currentStep) {
        const currentCoord = CITY_COORDINATES[currentStep.suspectLocation];
        if (currentCoord) {
          const pulseIcon = L.divIcon({
            html: `
              <div class="god-pulse-marker">
                <div class="god-pulse-ping"></div>
                <div class="god-pulse-core"></div>
              </div>
            `,
            className: 'god-leaflet-pulse',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          godPulseRef.current = L.marker(currentCoord, { icon: pulseIcon }).addTo(map);
        }
      }
    }
  }, [showGodMode, replayPlan, replayTurn, isTacticalView]);

  // Center and zoom map smoothly when selectedCityNode changes
  useEffect(() => {
    if (isTacticalView) return;
    const map = mapRef.current;
    if (map && selectedCityNode) {
      const coords = CITY_COORDINATES[selectedCityNode];
      if (coords) {
        map.setView(coords, 8, { animate: true });
      }
    }
  }, [selectedCityNode, isTacticalView]);

  // Turn Change Transition & Delta Animations Trigger
  useEffect(() => {
    const prevSession = prevSessionRef.current;
    prevSessionRef.current = session;

    if (!prevSession || prevSession.id !== session.id) {
      // Direct load: fit to bounds, no animation
      handleFit();
      return;
    }

    if (session.currentTurn !== prevSession.currentTurn) {
      // 1. Zoom out map to full bounds automatically on turn end
      handleFit();

      const newMoving = [];
      const newBuilding = [];
      const newExposing = [];
      const newCombat = [];

      // 2. Identify Agent moves
      session.agents.forEach(agent => {
        const prevAgent = prevSession.agents.find(a => a.id === agent.id);
        if (prevAgent && prevAgent.currentCity !== agent.currentCity) {
          newMoving.push({
            type: 'agent',
            fromCity: prevAgent.currentCity,
            toCity: agent.currentCity,
            progress: 0,
            color: '#00f0ff'
          });
        }
      });

      // 3. Identify Combat Team moves
      session.tacticalTeams.forEach(team => {
        const prevTeam = prevSession.tacticalTeams.find(t => t.id === team.id);
        if (prevTeam && prevTeam.currentCity !== team.currentCity) {
          newMoving.push({
            type: 'team',
            fromCity: prevTeam.currentCity,
            toCity: team.currentCity,
            progress: 0,
            color: '#ff3b30'
          });
        }
      });

      // 4. Identify Safehouses built this turn (Defender & Hostile)
      session.safehouses.forEach(sh => {
        const wasPresent = prevSession.safehouses.some(psh => 
          psh.cityNode === sh.cityNode && psh.ownerFaction === sh.ownerFaction
        );
        if (!wasPresent) {
          newBuilding.push({ cityId: sh.cityNode, progress: 0 });
        }
      });

      // 5. Identify newly exposed hostile safehouses
      session.safehouses.forEach(sh => {
        if (sh.ownerFaction === 'HOSTILE' && sh.uncovered) {
          const wasExposed = prevSession.safehouses.some(psh =>
            psh.cityNode === sh.cityNode && psh.ownerFaction === 'HOSTILE' && psh.uncovered
          );
          if (!wasExposed) {
            newExposing.push({ cityId: sh.cityNode, progress: 0 });
          }
        }
      });

      // 6. Identify Combat Raids (by looking at new tactical clues this turn)
      const lastTurnClues = session.discoveredClues.filter(c => c.turnDiscovered === prevSession.currentTurn);
      const wasCombatEncountered = lastTurnClues.some(c => 
        c.source === 'TACTICAL_FORCE' || c.clueText.includes('COMBAT') || c.clueText.includes('raided')
      );
      if (wasCombatEncountered) {
        const step = session.aiMasterPlan?.primaryPlan?.find(s => s.turn === prevSession.currentTurn);
        if (step && step.suspectLocation) {
          newCombat.push({ cityId: step.suspectLocation, progress: 0 });
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 1200); // Shake map for 1.2s
        }
      }

      // 7. Identify newly deployed tech scans
      const newTechDeploysList = [];
      session.espionageResources.forEach(res => {
        const wasPresent = prevSession.espionageResources.some(pr => pr.id === res.id);
        if (!wasPresent) {
          newTechDeploysList.push({ cityId: res.cityNode, type: res.type });
        }
      });

      // 8. Identify expired tech scans
      const expiredTechList = [];
      prevSession.espionageResources.forEach(res => {
        const isStillPresent = session.espionageResources.some(r => r.id === res.id);
        if (!isStillPresent) {
          expiredTechList.push({ cityId: res.cityNode, type: res.type });
        }
      });

      // 9. Identify lost safehouses and eliminated agents (representing combat/safehouse loss)
      const lostSafehouses = [];
      prevSession.safehouses.forEach(psh => {
        const isStillPresent = session.safehouses.some(sh =>
          sh.cityNode === psh.cityNode && sh.ownerFaction === psh.ownerFaction
        );
        if (!isStillPresent) {
          lostSafehouses.push({ cityId: psh.cityNode });
        }
      });

      const eliminatedAgents = [];
      prevSession.agents.forEach(pa => {
        const sa = session.agents.find(a => a.id === pa.id);
        if (pa.active && sa && !sa.active) {
          eliminatedAgents.push(sa.currentCity);
        }
      });

      const newLostCities = [
        ...lostSafehouses.map(l => l.cityId),
        ...eliminatedAgents
      ];

      if (newMoving.length > 0 || newBuilding.length > 0 || newExposing.length > 0 || newCombat.length > 0 || newTechDeploysList.length > 0 || expiredTechList.length > 0 || newLostCities.length > 0) {
        setMovingUnits(newMoving);
        setBuildingSafehouses(newBuilding);
        setExposingSafehouses(newExposing);
        setCombatAlerts(newCombat);

        setNewSafehouses(newBuilding.map(b => b.cityId));
        setUncoveredSafehouses(newExposing.map(e => e.cityId));
        setNewTechDeploys(newTechDeploysList);
        setExpiredTechScans(expiredTechList);

        // Trigger confetti shower on combat cities and newly discovered (exposed) safehouse cities
        const citiesToShower = [
          ...newCombat.map(c => c.cityId),
          ...newExposing.map(e => e.cityId)
        ];
        if (citiesToShower.length > 0) {
          setConfettiCities(citiesToShower);
          setTimeout(() => {
            setConfettiCities([]);
          }, 3000);
        }

        // Trigger sad/compromised horror warning particle burst on lost cities for 3 seconds
        if (newLostCities.length > 0) {
          setLostCities(newLostCities);
          setTimeout(() => {
            setLostCities([]);
          }, 3000);
        }

        // Run animation loop over 2.0 seconds
        const duration = 2000;
        const startTime = performance.now();
        let frameId;

        const loop = (time) => {
          const elapsed = time - startTime;
          const progress = Math.min(elapsed / duration, 1.0);

          setMovingUnits(prev => prev.map(m => ({ ...m, progress })));
          setBuildingSafehouses(prev => prev.map(b => ({ ...b, progress })));
          setExposingSafehouses(prev => prev.map(e => ({ ...e, progress })));
          setCombatAlerts(prev => prev.map(c => ({ ...c, progress })));

          if (progress < 1.0) {
            frameId = requestAnimationFrame(loop);
          } else {
            // End animations cleanly
            setTimeout(() => {
              setMovingUnits([]);
              setBuildingSafehouses([]);
              setExposingSafehouses([]);
              setCombatAlerts([]);
              setNewSafehouses([]);
              setUncoveredSafehouses([]);
              setNewTechDeploys([]);
              setExpiredTechScans([]);
            }, 600);
          }
        };
        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
      }
    }
  }, [session]);

  // Leaflet LatLng coordinates converter helper
  const getPixelCoords = (cityId) => {
    if (isTacticalView) {
      const coords = scaledCoords[cityId];
      if (!coords) return { x: 0, y: 0 };
      return { x: coords.x, y: coords.y };
    }
    const map = mapRef.current;
    if (!map) return { x: 0, y: 0 };
    const latLng = CITY_COORDINATES[cityId];
    if (!latLng) return { x: 0, y: 0 };
    const point = map.latLngToContainerPoint(latLng);
    return { x: point.x, y: point.y };
  };

  // Zoom control handlers
  const handleZoomIn = () => {
    if (isTacticalView) {
      setZoomScale(prev => Math.min(3.0, prev + 0.15));
    } else {
      mapRef.current?.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (isTacticalView) {
      setZoomScale(prev => Math.max(0.5, prev - 0.15));
    } else {
      mapRef.current?.zoomOut();
    }
  };

  const handleFit = () => {
    if (isTacticalView) {
      setZoomScale(1.0);
      setPanOffset({ x: 0, y: 0 });
    } else {
      const map = mapRef.current;
      if (map) {
        const coords = Object.values(CITY_COORDINATES);
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  };

  const renderAnimationsSVG = () => (
    <svg 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        pointerEvents: 'none', 
        zIndex: 400
      }}
      viewBox={isTacticalView ? "0 0 100 100" : undefined}
      preserveAspectRatio={isTacticalView ? "none" : undefined}
    >
      {movingUnits.map((m, idx) => {
        const start = getPixelCoords(m.fromCity);
        const end = getPixelCoords(m.toCity);
        if (start.x === 0 || end.x === 0) return null;
        const currentX = start.x + (end.x - start.x) * m.progress;
        const currentY = start.y + (end.y - start.y) * m.progress;
        return (
          <g key={`move-${idx}`}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={m.color} strokeWidth="2" strokeDasharray="5,5" opacity="0.3" />
            <line x1={start.x} y1={start.y} x2={currentX} y2={currentY} stroke={m.color} strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
            <circle cx={currentX} cy={currentY} r="7" fill={m.color} filter="drop-shadow(0 0 6px rgba(255,255,255,0.8))" />
            <circle cx={currentX} cy={currentY} r="14" fill="none" stroke={m.color} strokeWidth="1.5" opacity={1 - m.progress} className="animate-ping" />
          </g>
        );
      })}
      {buildingSafehouses.map((b, idx) => {
        const center = getPixelCoords(b.cityId);
        if (center.x === 0) return null;
        const radius = 10 + b.progress * 40;
        const opacity = 1.0 - b.progress;
        return (
          <g key={`build-${idx}`}>
            <circle cx={center.x} cy={center.y} r={radius} fill="none" stroke="#00f0ff" strokeWidth="1.5" strokeDasharray="4,4" opacity={opacity} />
            <circle cx={center.x} cy={center.y} r={radius - 5} fill="none" stroke="#00f0ff" strokeWidth="0.8" opacity={opacity} />
            <line x1={center.x - radius - 5} y1={center.y} x2={center.x + radius + 5} y2={center.y} stroke="#00f0ff" strokeWidth="0.8" opacity={opacity} />
            <line x1={center.x} y1={center.y - radius - 5} x2={center.x} y2={center.y + radius + 5} stroke="#00f0ff" strokeWidth="0.8" opacity={opacity} />
          </g>
        );
      })}
      {exposingSafehouses.map((e, idx) => {
        const center = getPixelCoords(e.cityId);
        if (center.x === 0) return null;
        const radius = 8 + e.progress * 50;
        const opacity = 1.0 - e.progress;
        return (
          <g key={`expose-${idx}`}>
            <circle cx={center.x} cy={center.y} r={radius} fill="none" stroke="#ffcc00" strokeWidth="2.5" strokeDasharray="6,3" opacity={opacity} />
            <circle cx={center.x} cy={center.y} r={radius * 0.5} fill="none" stroke="#ffcc00" strokeWidth="1.5" opacity={opacity * 0.6} />
            <line x1={center.x - radius - 8} y1={center.y} x2={center.x + radius + 8} y2={center.y} stroke="#ffcc00" strokeWidth="1.2" opacity={opacity} />
            <line x1={center.x} y1={center.y - radius - 8} x2={center.x} y2={center.y + radius + 8} stroke="#ffcc00" strokeWidth="1.2" opacity={opacity} />
            <text x={center.x} y={center.y - radius - 14} textAnchor="middle" fill="#ffcc00" fontSize="10" opacity={opacity} fontFamily="monospace" fontWeight="bold">EXPOSED</text>
          </g>
        );
      })}
      {combatAlerts.map((c, idx) => {
        const center = getPixelCoords(c.cityId);
        if (center.x === 0) return null;
        const opacity = Math.sin(c.progress * Math.PI * 4.5) * 0.4 + 0.6;
        return (
          <g key={`combat-${idx}`}>
            <circle cx={center.x} cy={center.y} r="24" fill="rgba(255, 59, 48, 0.08)" stroke="#ff3b30" strokeWidth="2.5" opacity={opacity} />
            <circle cx={center.x} cy={center.y} r="36" fill="none" stroke="#ff3b30" strokeWidth="1.2" strokeDasharray="6,3" opacity={opacity} />
            <line x1={center.x - 48} y1={center.y} x2={center.x + 48} y2={center.y} stroke="#ff3b30" strokeWidth="1.5" opacity={opacity} />
            <line x1={center.x} y1={center.y - 48} x2={center.x} y2={center.y + 48} stroke="#ff3b30" strokeWidth="1.5" opacity={opacity} />
          </g>
        );
      })}
    </svg>
  );

  const selectedNodeData = activeScenario?.nodes?.find(n => n.id === selectedCityNode);
  const isAttacker = session?.playerRole === 'ATTACKER';
  const isFriendlyRaw = selectedNodeData ? selectedNodeData.territory === 'HOME_TERRITORY' : ['srinagar', 'jammu', 'amritsar', 'chandigarh', 'new_delhi'].includes(selectedCityNode);
  const isFriendly = isAttacker ? !isFriendlyRaw : isFriendlyRaw;
  const hasSafehouse = isAttacker
    ? session.safehouses.some(s => s.cityNode === selectedCityNode && s.ownerFaction === 'HOSTILE')
    : session.safehouses.some(s => s.cityNode === selectedCityNode && s.ownerFaction === 'DEFENDER');

  return (
    <div className={`map-container relative w-full h-full overflow-hidden ${isShaking ? 'shake-effect' : ''}`}>
      <style>{`
        @keyframes flowConnection {
          to {
            stroke-dashoffset: -20;
          }
        }
        .connection-line-anim {
          animation: flowConnection 4s linear infinite;
        }
        .tactical-border-coords {
          font-family: monospace;
          font-size: 8px;
          color: rgba(0, 240, 255, 0.35);
          pointer-events: none;
          user-select: none;
        }
        .hud-scan-line {
          position: absolute;
          left: 0;
          width: 100%;
          height: 100px;
          background: linear-gradient(to bottom, transparent, rgba(0, 240, 255, 0.04), transparent);
          opacity: 0.8;
          pointer-events: none;
          animation: scanline 8s linear infinite;
          z-index: 4;
        }
        @keyframes scanline {
          0% { top: -100px; }
          100% { top: 100%; }
        }
        .radar-sweep {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(0, 240, 255, 0.15) 0deg, transparent 90deg, transparent 360deg);
          border: 1px solid rgba(0, 240, 255, 0.08);
          box-shadow: inset 0 0 40px rgba(0, 240, 255, 0.03);
          pointer-events: none;
          animation: rotateRadar 15s linear infinite;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          transform-origin: center center;
          z-index: 1;
        }
        @keyframes rotateRadar {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes dropBounce {
          0% {
            transform: translateY(-80px) scale(0.3);
            opacity: 0;
          }
          50% {
            transform: translateY(0) scale(1.1);
            opacity: 1;
          }
          70% {
            transform: translateY(-15px) scale(0.9);
          }
          85% {
            transform: translateY(0) scale(1.03);
          }
          100% {
            transform: translateY(0) scale(1);
          }
        }
        .safehouse-drop-bounce {
          animation: dropBounce 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }

        @keyframes revealBounce {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          45% {
            transform: scale(1.4);
            opacity: 1;
          }
          70% {
            transform: scale(0.85);
          }
          100% {
            transform: scale(1);
          }
        }
        .safehouse-reveal-bounce {
          animation: revealBounce 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }

        @keyframes rotateCctv {
          0% { transform: rotate(-25deg); }
          50% { transform: rotate(25deg); }
          100% { transform: rotate(-25deg); }
        }
        .cctv-rotate {
          animation: rotateCctv 3s ease-in-out infinite;
          transform-origin: center bottom;
          display: inline-block;
        }

        @keyframes floatSatellite {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(3deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .satellite-float {
          animation: floatSatellite 4s ease-in-out infinite;
          display: inline-block;
        }

        @keyframes expireFlyOut {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-40px) scale(0.5);
            opacity: 0;
          }
        }
        .tech-expire-flyout {
          animation: expireFlyOut 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          color: #ff3b30;
          text-shadow: 0 0 8px rgba(255, 59, 48, 0.6);
        }

        @keyframes burstConfetti {
          0% {
            transform: translate(0, 0) scale(1) rotate(0deg);
            opacity: 1;
          }
          25% {
            transform: translate(var(--tx), var(--ty)) scale(1.1) rotate(180deg);
            opacity: 1;
          }
          100% {
            transform: translate(var(--fall-x), var(--fall-y)) scale(0) rotate(720deg);
            opacity: 0;
          }
        }
        .confetti-particle {
          position: absolute;
          width: var(--size);
          height: var(--size);
          background-color: var(--color);
          border-radius: 50%;
          animation: burstConfetti 2.5s cubic-bezier(0.1, 0.8, 0.3, 1) var(--delay) forwards;
          pointer-events: none;
          z-index: 100;
        }
        .confetti-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          pointer-events: none;
          z-index: 99;
        }

        .imminent-danger-badge {
          position: absolute;
          top: -32px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(239, 68, 68, 0.95);
          border: 1.5px solid #ef4444;
          box-shadow: 0 0 12px #ef4444, inset 0 0 4px rgba(255, 255, 255, 0.4);
          color: white;
          font-family: monospace;
          font-size: 8px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 3px;
          white-space: nowrap;
          z-index: 120;
          pointer-events: none;
        }

        @keyframes lossBurst {
          0% {
            transform: translate(0, 0) scale(0.5) rotate(0deg);
            opacity: 0;
            filter: blur(2px);
          }
          15% {
            opacity: 1;
            filter: blur(0);
          }
          50% {
            transform: translate(var(--tx), var(--ty)) scale(1.25) rotate(-45deg);
            filter: drop-shadow(0 0 8px #ff3b30);
          }
          100% {
            transform: translate(var(--fall-x), var(--fall-y)) scale(0.3) rotate(-180deg);
            opacity: 0;
          }
        }
        .loss-particle {
          position: absolute;
          font-size: var(--size);
          color: #ff3b30;
          text-shadow: 0 0 10px rgba(255, 59, 48, 0.9);
          animation: lossBurst 2.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) var(--delay) forwards;
          pointer-events: none;
          z-index: 101;
          font-family: monospace;
        }
        .loss-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          pointer-events: none;
          z-index: 99;
        }

        @keyframes rotateCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes rotateCCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        .rotate-clockwise {
          transform-origin: 50px 50px;
          animation: rotateCW 25s linear infinite;
        }
        .rotate-counter-clockwise {
          transform-origin: 50px 50px;
          animation: rotateCCW 30s linear infinite;
        }

        @keyframes slideWave {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -120; }
        }
        .oscilloscope-wave-1 {
          animation: slideWave 10s linear infinite;
        }
        .oscilloscope-wave-2 {
          animation: slideWave 15s linear infinite;
        }

        @media (max-width: 768px) {
          .hud-system-monitor,
          .hud-decryption-module,
          .tactical-border-coords,
          .map-toolbar {
            display: none !important;
          }
        }
      `}</style>

      {/* Title */}
      <div className="map-title z-10 pointer-events-none">
        <h2>{isTacticalView ? "Tactical Network Feed" : "Geographic Map Feed"}</h2>
      </div>

      {/* Toolbar */}
      {/* Toolbar */}
      <div className="map-toolbar z-10">
        <button onClick={handleZoomIn} title="Zoom In"><ZoomIn size={16} /></button>
        <button onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={16} /></button>
        <button onClick={handleFit} title="Fit to Screen"><Maximize2 size={16} /></button>
      </div>

      {/* Leaflet Map Target */}
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%', display: isTacticalView ? 'none' : 'block' }} 
        className="leaflet-map-element"
      ></div>

      {/* Abstract Tactical View Blueprint Grid */}
      {isTacticalView && (
        <div 
          className="tactical-view-blueprint" 
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ 
            position: 'absolute', 
            inset: 0, 
            overflow: 'hidden', 
            background: '#091124',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          {/* Cybernetic HUD elements (Fixed background/foreground accents) */}
          <div className="hud-scan-line"></div>

          {/* Concentric Rotating Cybernetic Compass Rings (Top-Left and Bottom-Right corner overlays) */}
          <div className="hud-compass top-left" style={{ position: 'absolute', top: '12%', left: '4%', zIndex: 2, pointerEvents: 'none', opacity: 0.75 }}>
            <svg width="80" height="80" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(0, 240, 255, 0.08)" strokeWidth="1" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(0, 240, 255, 0.16)" strokeWidth="1.5" strokeDasharray="8, 16" className="rotate-clockwise" />
              <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(0, 240, 255, 0.10)" strokeWidth="1" strokeDasharray="3, 6" className="rotate-counter-clockwise" />
              <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(0, 240, 255, 0.06)" strokeWidth="1" />
              <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(0, 240, 255, 0.06)" strokeWidth="1" />
            </svg>
          </div>

          <div className="hud-compass bottom-right" style={{ position: 'absolute', bottom: '12%', right: '4%', zIndex: 2, pointerEvents: 'none', opacity: 0.75 }}>
            <svg width="80" height="80" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(0, 240, 255, 0.08)" strokeWidth="1" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(0, 240, 255, 0.16)" strokeWidth="1.5" strokeDasharray="10, 10" className="rotate-clockwise" />
              <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(0, 240, 255, 0.10)" strokeWidth="1" strokeDasharray="2, 4" className="rotate-counter-clockwise" />
              <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(0, 240, 255, 0.06)" strokeWidth="1" />
              <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(0, 240, 255, 0.06)" strokeWidth="1" />
            </svg>
          </div>

          {/* Bottom Oscilloscope Frequency Wave Overlay */}
          <div className="hud-oscilloscope" style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', width: '260px', height: '30px', zIndex: 2, pointerEvents: 'none', opacity: 0.35 }}>
            <svg width="100%" height="100%" viewBox="0 0 300 40" preserveAspectRatio="none">
              <path 
                d="M 0,20 Q 25,5 50,20 T 100,20 T 150,20 T 200,20 T 250,20 T 300,20" 
                fill="none" 
                stroke="#00f0ff" 
                strokeWidth="1.5" 
                strokeDasharray="6, 6"
                className="oscilloscope-wave-1" 
              />
              <path 
                d="M 0,20 Q 25,35 50,20 T 100,20 T 150,20 T 200,20 T 250,20 T 300,20" 
                fill="none" 
                stroke="#00f0ff" 
                strokeWidth="0.8" 
                opacity="0.5"
                className="oscilloscope-wave-2" 
              />
            </svg>
          </div>

          {/* Vignette Shadow Overlay (gives a glowing monitors-edge CRT console feel) */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at center, transparent 35%, rgba(2, 6, 23, 0.45) 100%)',
            pointerEvents: 'none',
            zIndex: 3
          }}></div>

          {/* Border Telemetry Coordinates */}
          <div className="tactical-border-coords" style={{ position: 'absolute', left: '8px', top: '10%', bottom: '10%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 3 }}>
            <div>34.0837° N</div>
            <div>32.7266° N</div>
            <div>31.6340° N</div>
            <div>30.7333° N</div>
            <div>28.6139° N</div>
          </div>
          <div className="tactical-border-coords" style={{ position: 'absolute', right: '8px', top: '10%', bottom: '10%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 3, alignItems: 'flex-end' }}>
            <div>SYS_OK</div>
            <div>NET_SECURE</div>
            <div>SAT_LOCK</div>
            <div>SIG_EST</div>
            <div>LOC_REF</div>
          </div>
          <div className="tactical-border-coords" style={{ position: 'absolute', bottom: '8px', left: '10%', right: '10%', display: 'flex', justifyContent: 'space-between', zIndex: 3 }}>
            <div>67.0011° E</div>
            <div>71.5249° E</div>
            <div>73.0479° E</div>
            <div>74.3587° E</div>
            <div>74.8723° E</div>
            <div>77.2090° E</div>
          </div>

          {/* HUD Corner Decals */}
          <div className="hud-system-monitor" style={{ position: 'absolute', top: '24px', right: '24px', fontFamily: 'monospace', fontSize: '9px', color: 'rgba(0, 240, 255, 0.45)', textAlign: 'right', pointerEvents: 'none', borderRight: '1px solid rgba(0, 240, 255, 0.3)', paddingRight: '8px', zIndex: 3 }}>
            <div style={{ fontWeight: 'bold', color: 'rgba(0, 240, 255, 0.8)' }}>[ SYSTEM MONITOR ]</div>
            <div>FEED: SAT_NET_TACTICAL</div>
            <div>STATUS: ONLINE_SECURE</div>
            <div>PING: 14ms (STABLE)</div>
          </div>

          <div className="hud-decryption-module" style={{ position: 'absolute', bottom: '24px', left: '24px', fontFamily: 'monospace', fontSize: '9px', color: 'rgba(0, 240, 255, 0.45)', pointerEvents: 'none', borderLeft: '1px solid rgba(0, 240, 255, 0.3)', paddingLeft: '8px', zIndex: 3 }}>
            <div style={{ fontWeight: 'bold', color: 'rgba(0, 240, 255, 0.8)' }}>[ DECRYPTION MODULE ]</div>
            <div>ALGORITHM: AES_GCM_256</div>
            <div>KEY_STRENGTH: 4096-BIT</div>
            <div>LOG_STREAM: ENCRYPTED</div>
          </div>

          {/* Zoomable and Pannable inner container */}
          <div
            className="tactical-inner-transform"
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              width: '100%',
              height: '100%'
            }}
          >
            {/* Radar sweep inside the transform so it sweeps relative to the graph */}
            <div className="radar-sweep"></div>

            {/* Blueprint plan-grid backdrop */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `
                linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px),
                linear-gradient(rgba(0, 240, 255, 0.14) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 240, 255, 0.14) 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px, 24px 24px, 120px 120px, 120px 120px',
              backgroundPosition: '-1px -1px, -1px -1px, 0 0, 0 0',
              opacity: 0.5,
              zIndex: 1
            }}></div>

            {/* Connection Lines SVG */}
            <svg 
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2 }} 
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {CONNECTIONS.map(([fromId, toId], idx) => {
                const start = scaledCoords[fromId];
                const end = scaledCoords[toId];
                if (!start || !end) return null;

                const fromNode = activeScenario?.nodes?.find(n => n.id === fromId);
                const toNode = activeScenario?.nodes?.find(n => n.id === toId);
                const fromFriendly = fromNode ? fromNode.territory === 'HOME_TERRITORY' : ['srinagar', 'jammu', 'amritsar', 'chandigarh', 'new_delhi'].includes(fromId);
                const toFriendly = toNode ? toNode.territory === 'HOME_TERRITORY' : ['srinagar', 'jammu', 'amritsar', 'chandigarh', 'new_delhi'].includes(toId);
                const isCrossBorder = fromFriendly !== toFriendly;

                const color = isCrossBorder ? '#ff3b30' : '#00f0ff';

                return (
                  <g key={`conn-${idx}`}>
                    {/* Glowing background track */}
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke={color}
                      strokeWidth="0.8"
                      opacity="0.15"
                    />
                    {/* Flowing animated dashed foreground */}
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke={color}
                      strokeWidth="0.4"
                      strokeDasharray="1.5, 2.5"
                      className="connection-line-anim"
                      style={{ '--line-color': color }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Absolute Positioned City Node Markers */}
            {Object.entries(scaledCoords).map(([cityId, coords]) => {
              const nodeData = activeScenario?.nodes?.find(n => n.id === cityId);
              const isFriendlyRaw = nodeData ? nodeData.territory === 'HOME_TERRITORY' : ['srinagar', 'jammu', 'amritsar', 'chandigarh', 'new_delhi'].includes(cityId);
              const isFriendly = isAttacker ? !isFriendlyRaw : isFriendlyRaw;
              const isTarget = activeScenario?.targetCity ? cityId === activeScenario.targetCity : cityId === 'new_delhi';
              
              const hasDefenderSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'DEFENDER');
              const hasHostileSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE');
              const hasExposedNormalSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.uncovered && !s.secure);
              const hasExposedSecureSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.uncovered && s.secure);
              
              const isSecureSafehouse = hasHostileSafehouse && session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.secure);
              const showSafehouseIcon = isAttacker ? (hasHostileSafehouse ? (isSecureSafehouse ? '🛡️' : '🏠') : '') : (hasDefenderSafehouse ? '🏠' : '');
              const showExposedNormalIcon = !isAttacker && hasExposedNormalSH;
              const showExposedSecureIcon = !isAttacker && hasExposedSecureSH;
              
              const isSweptZone = (session.hostilePatrolCities || []).includes(cityId);
              const isSuspectHere = isAttacker 
                ? (session.suspectLocation === cityId)
                : (showGodMode && session.suspectLocation === cityId);

              const agentsCount = (isAttacker && !showGodMode) ? 0 : session.agents.filter(a => {
                const plannedDest = localAgentMoves[a.id];
                if (plannedDest) return plannedDest === cityId;
                return a.currentCity === cityId;
              }).length;

              const teamsCount = (isAttacker && !showGodMode) ? 0 : session.tacticalTeams.filter(t => {
                const plannedDest = localTeamMoves[t.id];
                if (plannedDest) return plannedDest === cityId;
                return t.currentCity === cityId;
              }).length;

              const cityTech = session.espionageResources.filter(r => r.cityNode === cityId);
              const techIcons = [];
              cityTech.forEach((r, rIdx) => {
                let icon;
                let animClass = '';
                switch (r.type) {
                  case 'CCTV': 
                    icon = '📹'; 
                    animClass = 'cctv-rotate';
                    break;
                  case 'SATELLITE': 
                    icon = '🛰️'; 
                    animClass = 'satellite-float';
                    break;
                  case 'WIRE_TAP': icon = '🔍'; break;
                  case 'PHONE_TAP': icon = '📞'; break;
                  case 'FINANCE_MONITOR': icon = '💰'; break;
                  case 'BIOMETRIC_SCAN': icon = '🔴'; break;
                  case 'BORDER_GUARD': icon = '🚧'; break;
                  case 'SIGNAL_JAMMER': icon = '📡'; break;
                  case 'ATTACKER_JAMMER': icon = '⚡'; break;
                  default: icon = '🛰️';
                }
                const isNewlyDeployed = newTechDeploys.some(t => t.cityId === cityId && t.type === r.type);
                const className = `city-marker-tech-icon ${animClass} ${isNewlyDeployed ? 'safehouse-reveal-bounce' : ''}`;
                techIcons.push(
                  <span key={`tech-${rIdx}`} className={className} style={{ display: 'inline-block' }}>
                    {icon}
                  </span>
                );
              });

              const cityDecoys = session.activeDecoys ? session.activeDecoys.filter(d => d.cityNode === cityId) : [];
              const attackerTechIcons = [];
              cityDecoys.forEach((d, dIdx) => {
                const icon = d.type === 'CCTV' ? '📹' : '🛰️';
                const animClass = d.type === 'CCTV' ? 'cctv-rotate' : 'satellite-float';
                const isNewlyDeployed = newTechDeploys.some(t => t.cityId === cityId && t.type === d.type);
                const className = `city-marker-tech-icon ${animClass} ${isNewlyDeployed ? 'safehouse-reveal-bounce' : ''}`;
                attackerTechIcons.push(
                  <span key={`dec-${dIdx}`} className={className} style={{ display: 'inline-block' }}>
                    {icon}
                  </span>
                );
              });

              cityTech.filter(r => r.type === 'ATTACKER_JAMMER').forEach((r, jIdx) => {
                const icon = '⚡';
                const isNewlyDeployed = newTechDeploys.some(t => t.cityId === cityId && t.type === 'ATTACKER_JAMMER');
                const className = `city-marker-tech-icon ${isNewlyDeployed ? 'safehouse-reveal-bounce' : ''}`;
                attackerTechIcons.push(
                  <span key={`jam-${jIdx}`} className={className} style={{ display: 'inline-block' }}>
                    {icon}
                  </span>
                );
              });

              const combinedTech = (isAttacker && showGodMode)
                ? [...attackerTechIcons, ...techIcons]
                : (isAttacker ? attackerTechIcons : techIcons);

              const isSelected = selectedCityNode === cityId;

              const cityAgents = session.agents.filter(a => {
                const plannedDest = localAgentMoves[a.id];
                if (plannedDest) return plannedDest === cityId;
                return a.currentCity === cityId;
              });
              const hasIdleAgent = !isAttacker && cityAgents.some(a => {
                const effectiveTask = localAgentTasks[a.id] || a.activeTask;
                return !effectiveTask || effectiveTask === 'NONE' || effectiveTask === '';
              });

              const isNewSafehouse = newSafehouses.includes(cityId);
              const isNewExposed = uncoveredSafehouses.includes(cityId);

              const cityHeat = session.cityHeat?.[cityId] || 0;
              const isSuspectLocation = session.suspectLocation === cityId;
              const hasHostileSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE');
              const isImminentDanger = cityHeat > 80 || (session.heatPercentage > 80 && (isSuspectLocation || hasHostileSH));

              return (
                <div
                  key={cityId}
                  onClick={() => setSelectedCityNode(cityId)}
                  style={{
                    position: 'absolute',
                    left: `${coords.x}%`,
                    top: `${coords.y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                    cursor: 'pointer'
                  }}
                >
                  <div className={`city-marker-wrapper ${isSelected ? 'selected' : ''} ${hasIdleAgent ? 'has-idle' : ''} ${isSweptZone ? 'swept-zone' : ''} ${isSuspectHere ? 'suspect-here-wrapper' : ''}`}>
                    {isImminentDanger && (
                      <div className="imminent-danger-badge animate-pulse">
                        <span className="danger-icon">⚠️</span>
                        <span className="danger-text">HEAT {Math.max(cityHeat, session.heatPercentage)}%</span>
                      </div>
                    )}
                    {lostCities.includes(cityId) && (
                      <div className="loss-container">
                        {Array.from({ length: 25 }).map((_, i) => {
                          const angle = Math.random() * Math.PI * 2;
                          const distance = 15 + Math.random() * 35;
                          const tx = Math.cos(angle) * distance;
                          const ty = Math.sin(angle) * distance;
                          const fallX = tx + (Math.random() * 20 - 10);
                          const fallY = ty + 40 + Math.random() * 20;
                          const size = 10 + Math.random() * 6;
                          const delay = Math.random() * 0.2;
                          const char = ['💀', '✖', '⚠', '⚡', '❗'][Math.floor(Math.random() * 5)];
                          return (
                            <div 
                              key={i} 
                              className="loss-particle" 
                              style={{
                                '--tx': `${tx}px`,
                                '--ty': `${ty}px`,
                                '--fall-x': `${fallX}px`,
                                '--fall-y': `${fallY}px`,
                                '--size': `${size}px`,
                                '--delay': `${delay}s`
                              }}
                            >
                              {char}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {confettiCities.includes(cityId) && (
                      <div className="confetti-container">
                        {Array.from({ length: 35 }).map((_, i) => {
                          const angle = Math.random() * Math.PI * 2;
                          const distance = 25 + Math.random() * 45;
                          const tx = Math.cos(angle) * distance;
                          const ty = Math.sin(angle) * distance;
                          const fallX = tx + (Math.random() * 30 - 15);
                          const fallY = ty + 60 + Math.random() * 40;
                          const size = 3 + Math.random() * 5;
                          const delay = Math.random() * 0.3;
                          const color = ['#ff007f', '#00f0ff', '#ffee00', '#7f00ff', '#ff3b30', '#39ff14'][Math.floor(Math.random() * 6)];
                          return (
                            <div 
                              key={i} 
                              className="confetti-particle" 
                              style={{
                                '--tx': `${tx}px`,
                                '--ty': `${ty}px`,
                                '--fall-x': `${fallX}px`,
                                '--fall-y': `${fallY}px`,
                                '--size': `${size}px`,
                                '--delay': `${delay}s`,
                                '--color': color
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                    {isSweptZone && <div className="city-marker-sweep-ring"></div>}
                    {isSuspectHere && <div className="suspect-radar-ring"></div>}
                    <div className={`city-marker-outer ${isFriendly ? 'friendly' : 'hostile'} ${isSweptZone ? 'sweep-alert' : ''}`}></div>
                    <div className={`city-marker-inner ${isFriendly ? 'friendly' : 'hostile'} ${isTarget ? 'target' : ''}`}></div>
                    {showSafehouseIcon && (
                      <div 
                        className={`city-marker-safehouse ${isNewSafehouse ? 'safehouse-drop-bounce' : ''}`} 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}
                      >
                        {showSafehouseIcon}
                      </div>
                    )}
                    {showExposedNormalIcon && (
                      <div className={`city-marker-exposed-hostile ${isNewExposed ? 'safehouse-reveal-bounce' : ''}`}>👁️</div>
                    )}
                    {showExposedSecureIcon && (
                      <div className={`city-marker-exposed-secure ${isNewExposed ? 'safehouse-reveal-bounce' : ''}`}>🛡️</div>
                    )}
                    {isSuspectHere && <div className="city-marker-badge suspect pulse-badge" style={{ background: '#ff3b30', boxShadow: '0 0 15px #ff3b30', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', border: '2px solid white', borderRadius: '50%', width: '22px', height: '22px', transform: 'translate(12px, -24px)', zIndex: 1000 }}>🎯</div>}
                    {agentsCount > 0 && <div className="city-marker-badge agents">{agentsCount}</div>}
                    {teamsCount > 0 && <div className="city-marker-badge teams">{teamsCount}</div>}
                    {combinedTech.length > 0 && (
                      <div className="city-marker-tech" style={{ display: 'flex', gap: '2px' }}>
                        {combinedTech}
                      </div>
                    )}
                    {hasIdleAgent && <div className="city-marker-idle">⚠</div>}
                    {isSweptZone && <div className="city-marker-sweep-label">⚠ SWEEP</div>}
                    <div className={`city-marker-label ${isSelected ? 'active' : ''} ${isSweptZone ? 'sweep-text' : ''}`}>{cityId.replace('_', ' ').toUpperCase()}</div>
                  </div>
                </div>
              );
            })}

            {/* Temporary Expired Tech Scan Flying Overlays */}
            {expiredTechScans.map((exp, idx) => {
              const coords = scaledCoords[exp.cityId];
              if (!coords) return null;

              let icon = '📹';
              if (exp.type === 'SATELLITE') icon = '🛰️';
              else if (exp.type === 'SIGNAL_JAMMER') icon = '📡';
              else if (exp.type === 'ATTACKER_JAMMER') icon = '⚡';

              return (
                <div
                  key={`expired-${idx}`}
                  className="tech-expire-flyout"
                  style={{
                    position: 'absolute',
                    left: `${coords.x}%`,
                    top: `${coords.y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20,
                    fontSize: '14px',
                    pointerEvents: 'none'
                  }}
                >
                  {icon}
                </div>
              );
            })}

            {/* Animations SVG layer scaled and translated together with nodes */}
            {renderAnimationsSVG()}
          </div>
        </div>
      )}

      {!isTacticalView && renderAnimationsSVG()}

      {/* City Intel Overlay (Left side) */}
      {selectedCityNode && (
        session.playerRole === 'ATTACKER' ? (
          <AttackerIntelBox
            cityId={selectedCityNode}
            session={session}
            activeScenario={activeScenario}
            onClose={() => setSelectedCityNode(null)}
            onBuildSafehouse={onBuildSafehouse}
            onDeployTech={onDeployTech}
            localBuiltSafehouses={localBuiltSafehouses}
            localBuiltSecureSafehouses={localBuiltSecureSafehouses}
            localActiveJammerTarget={localActiveJammerTarget}
            localDecoyDeployments={localDecoyDeployments}
            localSuspectMove={localSuspectMove}
            setLocalSuspectMove={setLocalSuspectMove}
            addToast={addToast}
            isWaiting={isWaiting}
            localTargetSafehouseCode={localTargetSafehouseCode}
            setLocalTargetSafehouseCode={setLocalTargetSafehouseCode}
            localRequestFinance={localRequestFinance}
            setLocalRequestFinance={setLocalRequestFinance}
            localCollectFinance={localCollectFinance}
            setLocalCollectFinance={setLocalCollectFinance}
            localRequestLogistics={localRequestLogistics}
            setLocalRequestLogistics={setLocalRequestLogistics}
            localCollectLogistics={localCollectLogistics}
            setLocalCollectLogistics={setLocalCollectLogistics}
            localBeginHandover={localBeginHandover}
            setLocalBeginHandover={setLocalBeginHandover}
            setSelectedCityNode={setSelectedCityNode}
          />
        ) : (
          <CIAIntelBox 
            cityId={selectedCityNode} 
            session={session} 
            nodesData={activeScenario?.nodes || []} 
            selectedAgent={selectedAgent}
            selectedTeam={selectedTeam}
            onAssignAgentTask={onAssignAgentTask}
            onRelocateAgent={onRelocateAgent}
            onRelocateTacticalTeam={onRelocateTacticalTeam}
            localAgentMoves={localAgentMoves}
            localTeamMoves={localTeamMoves}
            localAgentTasks={localAgentTasks}
            onDeployTech={onDeployTech}
            onBuildSafehouse={onBuildSafehouse}
            covertActions={covertActions}
            onToggleCovertAction={onToggleCovertAction}
            onClose={() => setSelectedCityNode(null)}
            setSelectedCityNode={setSelectedCityNode}
            localTechDeploys={localTechDeploys}
            localSafehouseBuilds={localSafehouseBuilds}
          />
        )
      )}

      {/* Drawer */}
      {selectedCityNode && session.playerRole !== 'ATTACKER' && (
        <CityActionDrawer
          cityId={selectedCityNode}
          isFriendly={isFriendly}
          hasSafehouse={hasSafehouse}
          onBuildSafehouse={onBuildSafehouse}
          onDeployTech={onDeployTech}
          onClose={() => setSelectedCityNode(null)}
          playerRole={session.playerRole}
          isWaiting={isWaiting}
        />
      )}

      {/* God Mode Panel */}
      {showGodMode && replayPlan && (
        <GodModePanel
          replayPlan={replayPlan}
          replayTurn={replayTurn}
          setReplayTurn={setReplayTurn}
        />
      )}
    </div>
  );
}
