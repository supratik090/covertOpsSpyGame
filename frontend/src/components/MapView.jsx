import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CityActionDrawer from './CityActionDrawer';
import CIAIntelBox from './CIAIntelBox';
import AttackerIntelBox from './AttackerIntelBox';
import GodModeOverlay, { GodModePanel } from './GodModeOverlay';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { safehouseIconHtml, safehouseAnimSvgGroup, SafehouseIcon, agentIconHtml, agentAnimSvgGroup, AgentIcon, combatTeamIconHtml, combatTeamAnimSvgGroup, CombatTeamIcon, droneBaseIconHtml, droneIconHtml, DroneBaseIcon, DroneIcon } from './GameSymbols';

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
  setReplayTurn,
  localDroneBaseBuilds = [],
  setLocalDroneBaseBuilds,
  localDroneDeployments = {},
  setLocalDroneDeployments,
  localDroneOperations = [],
  setLocalDroneOperations,
  onBuyDrone,
  onAnimationComplete
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
      const minDistance = 2.4; // Increased to 2.4 degrees threshold for spacious Leaflet layout
      const keys = Object.keys(coords);
      for (let iter = 0; iter < 25; iter++) {
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
              const forceX = (dLng / dist) * (diff * 0.45);
              const forceY = (dLat / dist) * (diff * 0.65);
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

  const struckCities = React.useMemo(() => {
    if (!session || !session.discoveredClues) return [];
    // Only show strike effects for the MOST RECENT TURN — clears after each turn
    const lastTurn = session.currentTurn - 1;
    return session.discoveredClues
      .filter(c => (c.source === 'STRIKE_EXECUTED' || c.source === 'SAFEHOUSE_ATTACK') && c.cityName && c.turnDiscovered === lastTurn)
      .map(c => c.cityName.toLowerCase());
  }, [session]);

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

  // Normalize node coordinate points for Tactical View with strong repulsion spacing
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
        // Expand bounds from 10% to 90% for maximum canvas utilization
        const scaledX = 10 + ((node.coordinates.x - minX) / xRange) * 80;
        const scaledY = 10 + ((node.coordinates.y - minY) / yRange) * 80;
        coords[node.id] = { x: scaledX, y: scaledY };
      } else {
        coords[node.id] = { x: 50, y: 50 };
      }
    });

    // Force-directed repulsion pass: push nodes that are too close to each other apart
    const keys = Object.keys(coords);
    const minDistance = 14.5; // Increased to 14.5% space to ensure clear breathing room around city nodes & badges
    for (let iter = 0; iter < 30; iter++) {
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
          if (dist < minDistance && dist > 0.0001) {
            moved = true;
            const overlap = minDistance - dist;
            const pushX = (dx / dist) * (overlap * 0.45);
            const pushY = (dy / dist) * (overlap * 0.65); // Stronger vertical push for stacked labels
            
            c1.x -= pushX;
            c1.y -= pushY;
            c2.x += pushX;
            c2.y += pushY;
            
            // Keep nodes within safe view bounds [6, 94]
            c1.x = Math.max(6, Math.min(94, c1.x));
            c1.y = Math.max(6, Math.min(94, c1.y));
            c2.x = Math.max(6, Math.min(94, c2.x));
            c2.y = Math.max(6, Math.min(94, c2.y));
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

  const handleTouchStart = (e) => {
    if (!isTacticalView || e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (e.target.closest('.city-marker-wrapper') || e.target.closest('.tab-content') || e.target.closest('.map-toolbar')) return;
    setIsDragging(true);
    setDragStart({ x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y });
  };

  const handleTouchMove = (e) => {
    if (!isTacticalView || !isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPanOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };
  const markersRef = useRef({});
  const polylinesRef = useRef([]);
  const godRouteRef = useRef(null);
  const godPulseRef = useRef(null);

  // Transition Animation States
  const prevSessionRef = useRef(session);
  const [movingUnits, setMovingUnits] = useState([]);
  const [droneAnimUnits, setDroneAnimUnits] = useState([]);
  const [buildingSafehouses, setBuildingSafehouses] = useState([]);
  const [exposingSafehouses, setExposingSafehouses] = useState([]);
  const [combatAlerts, setCombatAlerts] = useState([]);
  const [newSafehouses, setNewSafehouses] = useState([]);
  const [uncoveredSafehouses, setUncoveredSafehouses] = useState([]);
  const [newTechDeploys, setNewTechDeploys] = useState([]);
  const [expiredTechScans, setExpiredTechScans] = useState([]);
  const [confettiCities, setConfettiCities] = useState([]);
  const [lostCities, setLostCities] = useState([]);
  const [destroyedFriendlyCities, setDestroyedFriendlyCities] = useState([]);
  const [destroyedEnemyCities, setDestroyedEnemyCities] = useState([]);
  const [isShaking, setIsShaking] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const onAnimCompleteRef = useRef(onAnimationComplete);

  const isAnimating = movingUnits.length > 0 || droneAnimUnits.length > 0 || buildingSafehouses.length > 0 ||
    exposingSafehouses.length > 0 || combatAlerts.length > 0 || newSafehouses.length > 0 ||
    uncoveredSafehouses.length > 0 || newTechDeploys.length > 0 || destroyedFriendlyCities.length > 0 ||
    destroyedEnemyCities.length > 0;

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

  // Keep animation-complete callback ref in sync to avoid stale closures
  useEffect(() => { onAnimCompleteRef.current = onAnimationComplete; }, [onAnimationComplete]);

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
      // Build safehouse icon HTML string for Leaflet markers (SVG from GameSymbols)
      const shColor = isAttacker ? (isSecureSafehouse ? '#ffcc00' : '#ff3b30') : '#00f0ff';
      const showSafehouseIconHtml = isAttacker
        ? (hasHostileSafehouse ? safehouseIconHtml({ size: 13, color: shColor, secure: isSecureSafehouse, hostile: true }) : '')
        : (hasDefenderSafehouse ? safehouseIconHtml({ size: 13, color: '#00f0ff' }) : '');
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

       const isStruck = struckCities.includes(cityId.toLowerCase());

       const hasDroneBase = !isAttacker && (session.droneBases?.includes(cityId) || localDroneBaseBuilds.includes(cityId));
       const cityDronesCount = (isAttacker && !showGodMode) ? 0 : (session.drones || []).filter(d => {
         const plannedBase = localDroneDeployments[d.id];
         if (plannedBase) return plannedBase === cityId;
         return d.currentCity === cityId;
       }).length;

       const droneBaseHtml = hasDroneBase ? `
         <div class="city-marker-drone-base" title="Drone Base" style="position: absolute; bottom: -18px; left: -18px; background: rgba(0, 240, 255, 0.15); border: 1px solid #00f0ff; border-radius: 4px; padding: 2px; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; z-index: 10;">
           ${droneBaseIconHtml({ size: 12, color: '#00f0ff' })}
         </div>
       ` : '';

       const droneHtml = cityDronesCount > 0 ? `
         <div class="drone-orbit-container" style="position: absolute; top: 50%; left: 50%; width: 46px; height: 46px; margin-top: -23px; margin-left: -23px; pointer-events: none; animation: drone-circular-orbit 4.5s linear infinite; z-index: 12;">
           <div style="position: absolute; inset: 0; border: 1px dashed rgba(16, 185, 129, 0.45); border-radius: 50%;"></div>
           <div style="position: absolute; top: -6px; left: 16px; width: 14px; height: 14px;">
             ${droneIconHtml({ size: 14, color: '#10b981' })}
           </div>
         </div>
         <div class="city-marker-drone-count" title="${cityDronesCount} Drone(s) stationed" style="position: absolute; bottom: -18px; right: -18px; background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 4px; padding: 2px; height: 16px; display: flex; align-items: center; justify-content: center; gap: 2px; padding-left: 3px; padding-right: 4px; z-index: 10;">
           ${droneIconHtml({ size: 11, color: '#10b981' })}
           <span style="font-size: 8px; font-weight: bold; color: #10b981;">${cityDronesCount}</span>
         </div>
       ` : '';

       // Construct dynamic HTML for Leaflet markers matching the index.css styling
       const markerHtml = `
         <div class="city-marker-wrapper ${isSelected ? 'selected' : ''} ${hasIdleAgent ? 'has-idle' : ''} ${isSweptZone ? 'swept-zone' : ''} ${isSuspectHere ? 'suspect-here-wrapper' : ''} ${isStruck ? 'city-struck' : ''}">
           ${isSweptZone ? '<div class="city-marker-sweep-ring"></div>' : ''}
           ${isSuspectHere ? '<div class="suspect-radar-ring"></div>' : ''}
           ${destroyedFriendlyCities.includes(cityId) ? '<div class="safehouse-alert-badge compromised">🚨 SAFEHOUSE COMPROMISED</div>' : ''}
           ${destroyedEnemyCities.includes(cityId) ? '<div class="safehouse-alert-badge neutralized">🎯 ENEMY SAFEHOUSE NEUTRALIZED</div>' : ''}
           ${isStruck ? '<div class="smoke-fumes-container"><div class="fume-particle" style="--wind: -3px; --wind-far: -8px"></div><div class="fume-particle" style="--wind: 4px; --wind-far: 9px"></div><div class="fume-particle" style="--wind: -1px; --wind-far: -3px"></div></div><div class="fire-flame">🔥</div>' : ''}
           <div class="city-marker-outer ${isFriendly ? 'friendly' : 'hostile'} ${isSweptZone ? 'sweep-alert' : ''}"></div>
           <div class="city-marker-inner ${isFriendly ? 'friendly' : 'hostile'} ${isTarget ? 'target' : ''}"></div>
           ${showSafehouseIconHtml ? `<div class="city-marker-safehouse" style="display: flex; align-items: center; justify-content: center;">${showSafehouseIconHtml}</div>` : ''}
           ${showExposedNormalIcon ? `<div class="city-marker-exposed-hostile">${safehouseIconHtml({ size: 11, color: '#f59e0b' })}👁️</div>` : ''}
           ${showExposedSecureIcon ? `<div class="city-marker-exposed-secure">${safehouseIconHtml({ size: 11, color: '#ffcc00', secure: true })}🛡️</div>` : ''}
           ${isSuspectHere ? `<div class="city-marker-badge suspect pulse-badge" style="background: #ff3b30; box-shadow: 0 0 15px #ff3b30; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; border: 2px solid white; border-radius: 50%; width: 22px; height: 22px; transform: translate(12px, -24px); z-index: 1000;">🎯</div>` : ''}
           ${agentsCount > 0 ? `<div class="city-marker-badge agents-icon">${agentIconHtml({ size: 11, color: '#00f0ff' })}${agentsCount > 1 ? '<span class="badge-count">' + agentsCount + '</span>' : ''}</div>` : ''}
           ${teamsCount > 0 ? `<div class="city-marker-badge teams-icon">${combatTeamIconHtml({ size: 11, color: '#ff3b30' })}${teamsCount > 1 ? '<span class="badge-count">' + teamsCount + '</span>' : ''}</div>` : ''}
           ${techMarkersHtml}
           ${droneBaseHtml}
           ${droneHtml}
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

  // Sequential Turn Animation System
  useEffect(() => {
    const prevSession = prevSessionRef.current;
    prevSessionRef.current = session;

    if (!prevSession || prevSession.id !== session.id) {
      handleFit();
      return;
    }

    if (session.currentTurn === prevSession.currentTurn) return;

    handleFit();
    setSelectedCityNode(null);

    // ── Collect all deltas ──────────────────────────────────────
    const newMoving = [];
    const newDroneAnims = [];
    session.agents.forEach(agent => {
      const prevAgent = prevSession.agents.find(a => a.id === agent.id);
      if (prevAgent && prevAgent.currentCity !== agent.currentCity) {
        newMoving.push({ type: 'agent', fromCity: prevAgent.currentCity, toCity: agent.currentCity, progress: 0, color: '#00f0ff' });
      }
    });
    session.tacticalTeams.forEach(team => {
      const prevTeam = prevSession.tacticalTeams.find(t => t.id === team.id);
      if (prevTeam && prevTeam.currentCity !== team.currentCity) {
        newMoving.push({ type: 'team', fromCity: prevTeam.currentCity, toCity: team.currentCity, progress: 0, color: '#ff3b30' });
      }
    });

    const isAttackerRole = session?.playerRole === 'ATTACKER';

    const newBuilds = [];
    session.safehouses.forEach(sh => {
      const isMySafehouse = isAttackerRole ? (sh.ownerFaction === 'HOSTILE') : (sh.ownerFaction === 'DEFENDER');
      if (isMySafehouse) {
        const wasPresent = prevSession.safehouses.some(psh => psh.cityNode === sh.cityNode && psh.ownerFaction === sh.ownerFaction);
        if (!wasPresent) newBuilds.push({ cityId: sh.cityNode, ownerFaction: sh.ownerFaction, progress: 0 });
      }
    });

    const newExposes = [];
    session.safehouses.forEach(sh => {
      if (sh.ownerFaction === 'HOSTILE' && sh.uncovered) {
        const wasExposed = prevSession.safehouses.some(psh => psh.cityNode === sh.cityNode && psh.ownerFaction === 'HOSTILE' && psh.uncovered);
        if (!wasExposed) newExposes.push({ cityId: sh.cityNode, progress: 0 });
      }
    });

    const lastTurnClues = session.discoveredClues.filter(c => c.turnDiscovered === prevSession.currentTurn);
    const newCombat = [];
    const wasCombatEncountered = lastTurnClues.some(c => c.source === 'TACTICAL_FORCE' || c.clueText?.includes('COMBAT') || c.clueText?.includes('raided'));
    if (wasCombatEncountered) {
      const step = session.aiMasterPlan?.primaryPlan?.find(s => s.turn === prevSession.currentTurn);
      if (step?.suspectLocation) newCombat.push({ cityId: step.suspectLocation, progress: 0 });
    }

    // ── Drone animations: multi-phase RECON / ATTACK / MOVE / DESTROYED ─────
    lastTurnClues.forEach(c => {
      if (c.source === 'DRONE_RECON' || c.source === 'DRONE_ATTACK') {
        const droneMatch = c.clueText?.match(/Drone (\d+)/i);
        if (droneMatch) {
          const droneId = parseInt(droneMatch[1]);
          const targetNode = activeScenario?.nodes?.find(n => c.clueText?.toLowerCase().includes(n.id.toLowerCase()) || (n.name && c.clueText?.toLowerCase().includes(n.name.toLowerCase())));
          if (targetNode) {
            const toCity = targetNode.id;
            const prevDrone = prevSession.drones?.find(d => d.id === droneId);
            const fromCity = prevDrone ? prevDrone.currentCity : null;
            const isDestroyed = !!(c.clueText?.includes('SHOT DOWN') || c.clueText?.includes('DRONE DOWN'));
            const droneAction = c.source === 'DRONE_RECON' ? 'RECON' : 'ATTACK';
            if (fromCity) {
              newDroneAnims.push({
                fromCity,
                toCity,
                baseCity: fromCity, // ATTACK drones return here
                droneAction,
                isDestroyed,
                phase: 0,
                progress: 0,
                color: '#10b981'
              });
            }
          }
        }
      }
    });
    // Detect drone relocations (MOVE action — city changed without a clue)
    (session.drones || []).forEach(drone => {
      const prevDrone = prevSession.drones?.find(d => d.id === drone.id);
      if (prevDrone && prevDrone.currentCity !== drone.currentCity) {
        const alreadyAnimated = newDroneAnims.some(d => d.fromCity === prevDrone.currentCity && d.toCity === drone.currentCity);
        if (!alreadyAnimated) {
          newDroneAnims.push({
            fromCity: prevDrone.currentCity,
            toCity: drone.currentCity,
            baseCity: drone.currentCity,
            droneAction: 'MOVE',
            isDestroyed: false,
            phase: 0,
            progress: 0,
            color: '#10b981'
          });
        }
      }
    });

    const newTechDeploysList = [];
    session.espionageResources.forEach(res => {
      if (!prevSession.espionageResources.some(pr => pr.id === res.id)) newTechDeploysList.push({ cityId: res.cityNode, type: res.type });
    });
    const expiredTechList = [];
    prevSession.espionageResources.forEach(res => {
      if (!session.espionageResources.some(r => r.id === res.id)) expiredTechList.push({ cityId: res.cityNode, type: res.type });
    });

    const friendlyLostSafehouses = [];
    const enemyLostSafehouses = [];
    prevSession.safehouses.forEach(psh => {
      if (!session.safehouses.some(sh => sh.cityNode === psh.cityNode && sh.ownerFaction === psh.ownerFaction)) {
        const isFriendly = isAttackerRole ? psh.ownerFaction === 'HOSTILE' : psh.ownerFaction === 'DEFENDER';
        if (isFriendly) {
          friendlyLostSafehouses.push(psh.cityNode);
        } else {
          // Only animate enemy safehouse destruction if it was exposed/uncovered
          if (psh.uncovered || isAttackerRole) {
            enemyLostSafehouses.push(psh.cityNode);
          }
        }
      }
    });
    const lostAgentCities = [];
    prevSession.agents.forEach(pa => {
      const sa = session.agents.find(a => a.id === pa.id);
      if (pa.active && sa && !sa.active) lostAgentCities.push(sa.currentCity);
    });

    const lossData = {
      friendly: [...friendlyLostSafehouses, ...lostAgentCities],
      enemy: enemyLostSafehouses
    };

    // ── Sequential phase runner ──────────────────────────────────
    let rafId;

    const finishAll = () => {
      cancelAnimationFrame(rafId);
      setBuildingSafehouses([]); setExposingSafehouses([]); setCombatAlerts([]);
      setNewSafehouses([]); setUncoveredSafehouses([]); setNewTechDeploys([]);
      setExpiredTechScans([]); setMovingUnits([]); setDroneAnimUnits([]); setLostCities([]);
      setDestroyedFriendlyCities([]); setDestroyedEnemyCities([]); setConfettiCities([]);
      setIsShaking(false);
      setTimeout(() => { onAnimCompleteRef.current?.(); }, 300);
    };

    const runLossPhase = (loss) => {
      const friendlyCount = loss?.friendly?.length || 0;
      const enemyCount = loss?.enemy?.length || 0;
      if (friendlyCount === 0 && enemyCount === 0) { finishAll(); return; }
      // Use progress-driven animation instead of a static timeout
      if (friendlyCount > 0) setDestroyedFriendlyCities(loss.friendly.map(c => ({ cityId: c, progress: 0 })));
      if (enemyCount > 0) setDestroyedEnemyCities(loss.enemy.map(c => ({ cityId: c, progress: 0 })));
      const start = performance.now(); const dur = 2200;
      const loop = (t) => {
        const p = Math.min((t - start) / dur, 1.0);
        setDestroyedFriendlyCities(prev => prev.map(c => ({ ...c, progress: p })));
        setDestroyedEnemyCities(prev => prev.map(c => ({ ...c, progress: p })));
        if (p < 1.0) { rafId = requestAnimationFrame(loop); }
        else {
          setDestroyedFriendlyCities([]); setDestroyedEnemyCities([]);
          finishAll();
        }
      };
      rafId = requestAnimationFrame(loop);
    };

    const runTechPhase = (deploys, expireds, lost) => {
      if (deploys.length > 0) setNewTechDeploys(deploys);
      if (expireds.length > 0) setExpiredTechScans(expireds);
      setTimeout(() => { setExpiredTechScans([]); runLossPhase(lost); }, (deploys.length > 0 || expireds.length > 0) ? 1000 : 0);
    };

    const runCombatPhase = (items, tech, expired, lost) => {
      if (items.length === 0) { runTechPhase(tech, expired, lost); return; }
      setCombatAlerts(items.map(c => ({ ...c, progress: 0 })));
      setIsShaking(true);
      const start = performance.now(); const dur = 1400;
      const loop = (t) => {
        const p = Math.min((t - start) / dur, 1.0);
        setCombatAlerts(prev => prev.map(c => ({ ...c, progress: p })));
        if (p < 1.0) { rafId = requestAnimationFrame(loop); }
        else { setCombatAlerts([]); setIsShaking(false); setTimeout(() => runTechPhase(tech, expired, lost), 200); }
      };
      rafId = requestAnimationFrame(loop);
    };

    const runExposurePhase = (items, combat, tech, expired, lost) => {
      if (items.length === 0) { runCombatPhase(combat, tech, expired, lost); return; }
      setExposingSafehouses(items.map(e => ({ ...e, progress: 0 })));
      setConfettiCities(items.map(e => e.cityId));
      const start = performance.now(); const dur = 1300;
      const loop = (t) => {
        const p = Math.min((t - start) / dur, 1.0);
        setExposingSafehouses(prev => prev.map(e => ({ ...e, progress: p })));
        if (p < 1.0) { rafId = requestAnimationFrame(loop); }
        else {
          setExposingSafehouses([]); setConfettiCities([]);
          setUncoveredSafehouses(items.map(e => e.cityId));
          setTimeout(() => runCombatPhase(combat, tech, expired, lost), 300);
        }
      };
      rafId = requestAnimationFrame(loop);
    };

    const runBuildPhase = (builds, exposes, combat, tech, expired, lost) => {
      if (builds.length === 0) { runExposurePhase(exposes, combat, tech, expired, lost); return; }
      let buildIdx = 0;
      const buildNext = () => {
        if (buildIdx >= builds.length) { runExposurePhase(exposes, combat, tech, expired, lost); return; }
        const b = builds[buildIdx++];
        // Phase A: ring expand (700ms)
        setBuildingSafehouses([{ ...b, progress: 0 }]);
        const ringStart = performance.now(); const ringDur = 700;
        const ringLoop = (t) => {
          const p = Math.min((t - ringStart) / ringDur, 1.0);
          setBuildingSafehouses(prev => prev.map(x => ({ ...x, progress: p })));
          if (p < 1.0) { rafId = requestAnimationFrame(ringLoop); }
          else {
            setBuildingSafehouses([]);
            // Phase B: drop-bounce icon (900ms)
            setNewSafehouses(prev => [...prev, b.cityId]);
            setTimeout(() => { setNewSafehouses([]); setTimeout(buildNext, 200); }, 900);
          }
        };
        rafId = requestAnimationFrame(ringLoop);
      };
      buildNext();
    };

    // Regular move phase — agents and combat teams only
    const runMovePhase = (moves, builds, exposes, combat, tech, expired, lost) => {
      if (moves.length === 0) { runBuildPhase(builds, exposes, combat, tech, expired, lost); return; }
      setMovingUnits(moves);
      const start = performance.now(); const dur = 1400;
      const loop = (t) => {
        const p = Math.min((t - start) / dur, 1.0);
        setMovingUnits(prev => prev.map(m => ({ ...m, progress: p })));
        if (p < 1.0) { rafId = requestAnimationFrame(loop); }
        else { setMovingUnits([]); setTimeout(() => runBuildPhase(builds, exposes, combat, tech, expired, lost), 300); }
      };
      rafId = requestAnimationFrame(loop);
    };

    // Multi-phase drone animation: TRAVEL → ACTION → RETURN → DESTROYED
    const runDroneAnimPhase = (droneAnims, moves, builds, exposes, combat, tech, expired, lost) => {
      if (droneAnims.length === 0) { runMovePhase(moves, builds, exposes, combat, tech, expired, lost); return; }

      const TRAVEL_DUR = 1300;
      const RECON_DUR  = 950;
      const ATTACK_DUR = 1100;
      const RETURN_DUR = 1050;
      const DESTROY_DUR = 750;

      const afterDrones = () => {
        setDroneAnimUnits([]);
        setTimeout(() => runMovePhase(moves, builds, exposes, combat, tech, expired, lost), 300);
      };

      // Phase 3: Destroyed
      const runDestroyPhase = () => {
        const destroyed = droneAnims.filter(d => d.isDestroyed);
        if (destroyed.length === 0) { afterDrones(); return; }
        setDroneAnimUnits(destroyed.map(d => ({ ...d, phase: 3, progress: 0 })));
        const start = performance.now();
        const loop = (t) => {
          const p = Math.min((t - start) / DESTROY_DUR, 1.0);
          setDroneAnimUnits(prev => prev.map(d => ({ ...d, progress: p })));
          if (p < 1.0) { rafId = requestAnimationFrame(loop); }
          else { afterDrones(); }
        };
        rafId = requestAnimationFrame(loop);
      };

      // Phase 2: Return to base (ATTACK drones that are NOT destroyed)
      const runReturnPhase = () => {
        const returning = droneAnims.filter(d => d.droneAction === 'ATTACK' && !d.isDestroyed);
        if (returning.length === 0) { runDestroyPhase(); return; }
        setDroneAnimUnits(returning.map(d => ({ ...d, phase: 2, progress: 0 })));
        const start = performance.now();
        const loop = (t) => {
          const p = Math.min((t - start) / RETURN_DUR, 1.0);
          setDroneAnimUnits(prev => prev.map(d => ({ ...d, progress: p })));
          if (p < 1.0) { rafId = requestAnimationFrame(loop); }
          else { setTimeout(runDestroyPhase, 150); }
        };
        rafId = requestAnimationFrame(loop);
      };

      // Phase 1: Action at target city
      const runActionPhase = () => {
        const actionAnims = droneAnims.filter(d => d.droneAction !== 'MOVE');
        if (actionAnims.length === 0) { runReturnPhase(); return; }
        setDroneAnimUnits(actionAnims.map(d => ({ ...d, phase: 1, progress: 0 })));
        const maxDur = actionAnims.some(d => d.droneAction === 'ATTACK') ? ATTACK_DUR : RECON_DUR;
        const start = performance.now();
        const loop = (t) => {
          const p = Math.min((t - start) / maxDur, 1.0);
          setDroneAnimUnits(prev => prev.map(d => ({ ...d, progress: Math.min((t - start) / (d.droneAction === 'ATTACK' ? ATTACK_DUR : RECON_DUR), 1.0) })));
          if (p < 1.0) { rafId = requestAnimationFrame(loop); }
          else { setTimeout(runReturnPhase, 150); }
        };
        rafId = requestAnimationFrame(loop);
      };

      // Phase 0: Travel to target
      setDroneAnimUnits(droneAnims.map(d => ({ ...d, phase: 0, progress: 0 })));
      const start = performance.now();
      const loop = (t) => {
        const p = Math.min((t - start) / TRAVEL_DUR, 1.0);
        setDroneAnimUnits(prev => prev.map(d => ({ ...d, progress: p })));
        if (p < 1.0) { rafId = requestAnimationFrame(loop); }
        else { setTimeout(runActionPhase, 100); }
      };
      rafId = requestAnimationFrame(loop);
    };

    const hasAnything = newMoving.length > 0 || newDroneAnims.length > 0 || newBuilds.length > 0 || newExposes.length > 0 ||
      newCombat.length > 0 || newTechDeploysList.length > 0 || expiredTechList.length > 0 ||
      lossData.friendly.length > 0 || lossData.enemy.length > 0;

    if (hasAnything) {
      runDroneAnimPhase(newDroneAnims, newMoving, newBuilds, newExposes, newCombat, newTechDeploysList, expiredTechList, lossData);
    } else {
      setTimeout(() => { onAnimCompleteRef.current?.(); }, 200);
    }

    return () => cancelAnimationFrame(rafId);
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
      {/* Regular unit travel (agents and combat teams) */}
      {movingUnits.map((m, idx) => {
        const start = getPixelCoords(m.fromCity);
        const end = getPixelCoords(m.toCity);
        if (start.x === 0 || end.x === 0) return null;
        const currentX = start.x + (end.x - start.x) * m.progress;
        const currentY = start.y + (end.y - start.y) * m.progress;
        const sc = isTacticalView ? 0.45 : 1;
        const iconSize = isTacticalView ? 4 : 16;

        if (m.type === 'agent') {
          return (
            <g key={`move-${idx}`}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={m.color} strokeWidth={1.5 * sc} strokeDasharray="5,5" opacity="0.28" />
              <line x1={start.x} y1={start.y} x2={currentX} y2={currentY} stroke={m.color} strokeWidth={2.5 * sc} strokeLinecap="round" opacity="0.75" />
              <circle cx={currentX} cy={currentY} r={9 * sc} fill={m.color} opacity="0.12" />
              <g transform={`translate(${currentX - iconSize / 2}, ${currentY - iconSize / 2})`}>
                <g dangerouslySetInnerHTML={{ __html: agentIconHtml({ size: iconSize, color: m.color }) }} />
              </g>
              <circle cx={currentX} cy={currentY} r={13 * sc} fill="none" stroke={m.color} strokeWidth={sc} opacity={0.6 * (1 - m.progress)} className="animate-ping" />
            </g>
          );
        }

        if (m.type === 'team') {
          return (
            <g key={`move-${idx}`}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={m.color} strokeWidth={1.5 * sc} strokeDasharray="4,4" opacity="0.28" />
              <line x1={start.x} y1={start.y} x2={currentX} y2={currentY} stroke={m.color} strokeWidth={2.5 * sc} strokeLinecap="round" opacity="0.75" />
              <circle cx={currentX} cy={currentY} r={9 * sc} fill={m.color} opacity="0.12" />
              <g transform={`translate(${currentX - iconSize / 2}, ${currentY - iconSize / 2})`}>
                <g dangerouslySetInnerHTML={{ __html: combatTeamIconHtml({ size: iconSize, color: m.color }) }} />
              </g>
              <circle cx={currentX} cy={currentY} r={13 * sc} fill="none" stroke={m.color} strokeWidth={sc} opacity={0.6 * (1 - m.progress)} className="animate-ping" />
            </g>
          );
        }

        return null;
      })}

      {/* Multi-phase drone animations: TRAVEL → ACTION → RETURN → DESTROYED */}
      {droneAnimUnits.map((m, idx) => {
        const baseCoords = getPixelCoords(m.fromCity);
        const targetCoords = getPixelCoords(m.toCity);
        if (baseCoords.x === 0 || targetCoords.x === 0) return null;
        const sc = isTacticalView ? 0.35 : 1;
        const iconSize = isTacticalView ? 4 : 18;
        const halfIcon = iconSize / 2;

        // Phase 0: Travel from base to target
        if (m.phase === 0) {
          const cx = baseCoords.x + (targetCoords.x - baseCoords.x) * m.progress;
          const cy = baseCoords.y + (targetCoords.y - baseCoords.y) * m.progress;
          // Angle of travel for rotation
          const angle = Math.atan2(targetCoords.y - baseCoords.y, targetCoords.x - baseCoords.x) * 180 / Math.PI + 90;
          return (
            <g key={`drone-${idx}`}>
              <line x1={baseCoords.x} y1={baseCoords.y} x2={targetCoords.x} y2={targetCoords.y} stroke={m.color} strokeWidth={1.5 * sc} strokeDasharray="3,4" opacity="0.35" />
              <line x1={baseCoords.x} y1={baseCoords.y} x2={cx} y2={cy} stroke={m.color} strokeWidth={2 * sc} opacity="0.7" />
              <g transform={`translate(${cx}, ${cy}) rotate(${angle}) translate(${-halfIcon}, ${-halfIcon})`}>
                <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: m.color }) }} />
              </g>
              <circle cx={cx} cy={cy} r={5 * sc} fill="none" stroke={m.color} strokeWidth={sc} opacity={0.5} />
            </g>
          );
        }

        // Phase 1: Action at target (RECON = hover circle, ATTACK = bounce)
        if (m.phase === 1) {
          const actionAnim = m.droneAction === 'RECON' ? 'drone-recon-hover 0.9s ease-in-out infinite' : 'drone-attack-bounce 1.1s cubic-bezier(0.36,0.07,0.19,0.97) infinite';
          const orbitR = isTacticalView ? 3.5 : 18;
          return (
            <g key={`drone-${idx}`}>
              {/* Orbit ring at target for RECON */}
              {m.droneAction === 'RECON' && (
                <circle cx={targetCoords.x} cy={targetCoords.y} r={orbitR} fill="none" stroke={m.color} strokeWidth={isTacticalView ? 0.3 : 1.2} strokeDasharray={isTacticalView ? '0.6,0.6' : '3,3'} opacity="0.55" />
              )}
              {/* Impact rings for ATTACK */}
              {m.droneAction === 'ATTACK' && [
                <circle key="r1" cx={targetCoords.x} cy={targetCoords.y} r={orbitR * m.progress} fill="none" stroke="#ff3b30" strokeWidth={isTacticalView ? 0.4 : 1.5} opacity={1 - m.progress} />,
                <circle key="r2" cx={targetCoords.x} cy={targetCoords.y} r={orbitR * m.progress * 0.6} fill="none" stroke="#ff6600" strokeWidth={isTacticalView ? 0.3 : 1} opacity={(1 - m.progress) * 0.7} />
              ]}
              <g
                transform={`translate(${targetCoords.x - halfIcon}, ${targetCoords.y - halfIcon})`}
                style={{ animation: actionAnim }}
              >
                <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: m.droneAction === 'ATTACK' ? '#ff9800' : m.color }) }} />
              </g>
            </g>
          );
        }

        // Phase 2: Return to base (attack drones flying back)
        if (m.phase === 2) {
          const cx = targetCoords.x + (baseCoords.x - targetCoords.x) * m.progress;
          const cy = targetCoords.y + (baseCoords.y - targetCoords.y) * m.progress;
          const angle = Math.atan2(baseCoords.y - targetCoords.y, baseCoords.x - targetCoords.x) * 180 / Math.PI + 90;
          return (
            <g key={`drone-${idx}`}>
              <line x1={targetCoords.x} y1={targetCoords.y} x2={cx} y2={cy} stroke={m.color} strokeWidth={1.5 * sc} opacity="0.5" strokeDasharray="3,3" />
              <g transform={`translate(${cx}, ${cy}) rotate(${angle}) translate(${-halfIcon}, ${-halfIcon})`}>
                <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: m.color }) }} />
              </g>
            </g>
          );
        }

        // Phase 3: Drone destroyed — spin out explosion at target
        if (m.phase === 3) {
          const explodeR = (isTacticalView ? 6 : 28) * m.progress;
          return (
            <g key={`drone-${idx}`}>
              <circle cx={targetCoords.x} cy={targetCoords.y} r={explodeR} fill="none" stroke="#ff3b30" strokeWidth={isTacticalView ? 0.5 : 2.5} opacity={1 - m.progress} />
              <circle cx={targetCoords.x} cy={targetCoords.y} r={explodeR * 0.55} fill="rgba(255,59,48,0.15)" stroke="#ff6600" strokeWidth={isTacticalView ? 0.3 : 1.5} opacity={(1 - m.progress) * 0.8} />
              <g
                transform={`translate(${targetCoords.x - halfIcon}, ${targetCoords.y - halfIcon})`}
                style={{ animation: 'drone-destroyed-spin 0.75s ease-out forwards', transformOrigin: halfIcon + 'px ' + halfIcon + 'px' }}
              >
                <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#ff3b30' }) }} />
              </g>
              <text x={targetCoords.x} y={targetCoords.y - (isTacticalView ? 5 : 26)} textAnchor="middle"
                fill="#ff3b30" fontSize={isTacticalView ? '1.8' : '9'} fontFamily="monospace" fontWeight="bold"
                opacity={1 - m.progress}>DRONE DOWN</text>
            </g>
          );
        }

        return null;
      })}
      {buildingSafehouses.map((b, idx) => {
        const center = getPixelCoords(b.cityId);
        if (center.x === 0) return null;
        const color = (b.ownerFaction === 'HOSTILE') ? '#ff3b30' : '#00f0ff';
        const sc = isTacticalView ? 0.2 : 1;
        // Rings CONTRACT inward (large to small) as safehouse materializes
        const maxR = isTacticalView ? 9 : 42;
        const r1 = maxR * (1 - b.progress * 0.75);
        const r2 = r1 * 0.62;
        const ringOpacity = Math.max(0, 1 - b.progress * 1.1);
        const glowR = (isTacticalView ? 1.5 : 6) * b.progress;
        const iconSize = isTacticalView ? 2.5 : 11;
        const iconOpacity = b.progress > 0.4 ? Math.min((b.progress - 0.4) / 0.6, 1.0) : 0;
        // Corner L-brackets instead of crosshairs
        const bkt = r1 * 0.42;
        const bktW = isTacticalView ? 0.3 : 1.2;
        return (
          <g key={`build-${idx}`}>
            <circle cx={center.x} cy={center.y} r={r1} fill="none" stroke={color}
              strokeWidth={isTacticalView ? 0.4 : 1.6} strokeDasharray={`${3 * sc},${3 * sc}`} opacity={ringOpacity} />
            <circle cx={center.x} cy={center.y} r={r2} fill="none" stroke={color}
              strokeWidth={isTacticalView ? 0.25 : 1} strokeDasharray={`${2 * sc},${2 * sc}`} opacity={ringOpacity * 0.55} />
            {[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx, sy], i) => (
              <g key={i}>
                <line x1={center.x + sx * r1} y1={center.y + sy * r1}
                      x2={center.x + sx * (r1 - bkt)} y2={center.y + sy * r1}
                      stroke={color} strokeWidth={bktW} strokeLinecap="round" opacity={ringOpacity * 0.85} />
                <line x1={center.x + sx * r1} y1={center.y + sy * r1}
                      x2={center.x + sx * r1} y2={center.y + sy * (r1 - bkt)}
                      stroke={color} strokeWidth={bktW} strokeLinecap="round" opacity={ringOpacity * 0.85} />
              </g>
            ))}
            <circle cx={center.x} cy={center.y} r={glowR} fill={color} opacity={b.progress * 0.3} />
            <text x={center.x} y={center.y - r1 - (isTacticalView ? 1.5 : 7)} textAnchor="middle"
              fill={color} fontSize={isTacticalView ? 1.3 : 7} fontFamily="monospace" fontWeight="bold"
              opacity={ringOpacity * 0.8} letterSpacing="0.1em">BUILD</text>
            {iconOpacity > 0 && (
              <g opacity={iconOpacity} dangerouslySetInnerHTML={{ __html: safehouseAnimSvgGroup(center.x, center.y, color, iconSize) }} />
            )}
          </g>
        );
      })}

      {exposingSafehouses.map((e, idx) => {
        const center = getPixelCoords(e.cityId);
        if (center.x === 0) return null;
        const sc = isTacticalView ? 0.18 : 1;
        const r1 = (isTacticalView ? 2 : 8) + e.progress * (isTacticalView ? 10 : 44);
        const r2 = r1 * 0.60;
        const r3 = r1 * 0.3;
        const opacity = 1.0 - e.progress;
        return (
          <g key={`expose-${idx}`}>
            <circle cx={center.x} cy={center.y} r={r1} fill="none" stroke="#ffcc00"
              strokeWidth={isTacticalView ? 0.45 : 2} strokeDasharray={`${4 * sc},${3 * sc}`} opacity={opacity} />
            <circle cx={center.x} cy={center.y} r={r2} fill="rgba(255,204,0,0.06)" stroke="#ffcc00"
              strokeWidth={isTacticalView ? 0.3 : 1.2} opacity={opacity * 0.7} />
            <circle cx={center.x} cy={center.y} r={r3} fill="rgba(255,204,0,0.12)"
              stroke="#ffcc00" strokeWidth={isTacticalView ? 0.2 : 0.8} opacity={opacity * 0.5} />
            <circle cx={center.x} cy={center.y} r={isTacticalView ? 0.8 : 3.5}
              fill="#ffcc00" opacity={0.3 + (1 - e.progress) * 0.5} />
            <text x={center.x} y={center.y - r1 - (isTacticalView ? 1.5 : 10)} textAnchor="middle"
              fill="#ffcc00" fontSize={isTacticalView ? 1.4 : 8} fontFamily="monospace" fontWeight="bold"
              opacity={opacity * 0.9} letterSpacing="0.08em">EXPOSED</text>
          </g>
        );
      })}
      {combatAlerts.map((c, idx) => {
        const center = getPixelCoords(c.cityId);
        if (center.x === 0) return null;
        // Pulsing flash: 3 expanding diamond rings fading out — no crosshair, no huge circles
        const pulse = Math.sin(c.progress * Math.PI * 5) * 0.5 + 0.5; // oscillate 0–1
        const sc = isTacticalView ? 0.22 : 1;
        const r1 = (8 + c.progress * 20) * sc;
        const r2 = (4 + c.progress * 12) * sc;
        const opacity1 = (1 - c.progress) * 0.9;
        const opacity2 = (1 - c.progress) * 0.65;
        // Diamond shape via rotated square
        const d = r1;
        const dmPoints = `${center.x},${center.y - d} ${center.x + d},${center.y} ${center.x},${center.y + d} ${center.x - d},${center.y}`;
        const d2 = r2;
        const dmPoints2 = `${center.x},${center.y - d2} ${center.x + d2},${center.y} ${center.x},${center.y + d2} ${center.x - d2},${center.y}`;
        return (
          <g key={`combat-${idx}`}>
            {/* Outer flash ring */}
            <polygon points={dmPoints} fill="rgba(255,59,48,0.06)" stroke="#ff3b30" strokeWidth={1.8 * sc} opacity={opacity1} />
            {/* Inner compact ring */}
            <polygon points={dmPoints2} fill="rgba(255,100,50,0.1)" stroke="#ff6600" strokeWidth={1.2 * sc} opacity={opacity2} />
            {/* Center strike flash dot */}
            <circle cx={center.x} cy={center.y} r={3.5 * sc} fill="#ff3b30" opacity={0.5 + pulse * 0.5} />
            {/* STRIKE label — small, compact, no crosshair */}
            <text x={center.x} y={center.y - (10 + c.progress * 18) * sc} textAnchor="middle"
              fill="#ff3b30" fontSize={isTacticalView ? 1.6 : 8} fontFamily="monospace" fontWeight="bold"
              opacity={opacity1} letterSpacing="0.08em">STRIKE</text>
          </g>
        );
      })}
      {destroyedFriendlyCities.map((item, idx) => {
        const center = getPixelCoords(item.cityId);
        if (center.x === 0) return null;
        const p = item.progress;
        const sc = isTacticalView ? 0.2 : 1;
        // Phase 1 (0→0.4): compact red shockwave ring expands then fades
        // Phase 2 (0.4→1): small SAFEHOUSE LOST pill fades in then drifts up and fades out
        const ringR = (isTacticalView ? 3 : 14) * Math.min(p / 0.4, 1.0);
        const ringOp = p < 0.4 ? (1 - p / 0.4) * 0.85 : 0;
        const textOp = p > 0.35 ? Math.min((p - 0.35) / 0.25, 1) * (1 - Math.max(0, (p - 0.75) / 0.25)) : 0;
        const textY = center.y - (isTacticalView ? 3 : 14) - (p > 0.35 ? (p - 0.35) * (isTacticalView ? 4 : 18) : 0);
        const dotPulse = Math.sin(p * Math.PI * 6) * 0.3 + 0.7;
        return (
          <g key={`friendly-destroy-${idx}`}>
            {/* Compact shockwave ring */}
            <circle cx={center.x} cy={center.y} r={ringR} fill="rgba(255,59,48,0.08)"
              stroke="#ff3b30" strokeWidth={isTacticalView ? 0.5 : 2} opacity={ringOp} />
            <circle cx={center.x} cy={center.y} r={ringR * 0.5} fill="none"
              stroke="#ff6600" strokeWidth={isTacticalView ? 0.3 : 1.2} opacity={ringOp * 0.7} />
            {/* Small pulsing center dot — replaces giant X */}
            <circle cx={center.x} cy={center.y} r={isTacticalView ? 1 : 4}
              fill="#ff3b30" opacity={dotPulse * Math.min(p * 3, 1) * (1 - Math.max(0,(p-0.8)/0.2))} />
            {/* Elegant floating label */}
            <text x={center.x} y={textY} textAnchor="middle"
              fill="#ff3b30" fontSize={isTacticalView ? 1.4 : 7.5} fontFamily="monospace" fontWeight="bold"
              opacity={textOp} letterSpacing="0.06em">SAFEHOUSE LOST</text>
          </g>
        );
      })}
      {destroyedEnemyCities.map((item, idx) => {
        const center = getPixelCoords(item.cityId);
        if (center.x === 0) return null;
        const p = item.progress;
        const sc = isTacticalView ? 0.2 : 1;
        const ringR = (isTacticalView ? 3 : 14) * Math.min(p / 0.4, 1.0);
        const ringOp = p < 0.4 ? (1 - p / 0.4) * 0.8 : 0;
        const textOp = p > 0.35 ? Math.min((p - 0.35) / 0.25, 1) * (1 - Math.max(0, (p - 0.75) / 0.25)) : 0;
        const textY = center.y - (isTacticalView ? 3 : 14) - (p > 0.35 ? (p - 0.35) * (isTacticalView ? 4 : 18) : 0);
        const dotPulse = Math.sin(p * Math.PI * 6) * 0.3 + 0.7;
        return (
          <g key={`enemy-destroy-${idx}`}>
            {/* Compact green shockwave ring */}
            <circle cx={center.x} cy={center.y} r={ringR} fill="rgba(16,185,129,0.08)"
              stroke="#10b981" strokeWidth={isTacticalView ? 0.5 : 2} opacity={ringOp} />
            <circle cx={center.x} cy={center.y} r={ringR * 0.5} fill="none"
              stroke="#00ff66" strokeWidth={isTacticalView ? 0.3 : 1.2} opacity={ringOp * 0.7} />
            {/* Small pulsing center dot */}
            <circle cx={center.x} cy={center.y} r={isTacticalView ? 1 : 4}
              fill="#10b981" opacity={dotPulse * Math.min(p * 3, 1) * (1 - Math.max(0,(p-0.8)/0.2))} />
            {/* Elegant floating label */}
            <text x={center.x} y={textY} textAnchor="middle"
              fill="#10b981" fontSize={isTacticalView ? 1.4 : 7.5} fontFamily="monospace" fontWeight="bold"
              opacity={textOp} letterSpacing="0.06em">ENEMY NEUTRALIZED</text>
          </g>
        );
      })}

      {/* Ambient stationing drone orbital flights in Tactical View */}
      {isTacticalView && (session?.droneBases || []).map(baseCityId => {
        const cityDrones = (session?.drones || []).filter(d => {
          const plannedBase = localDroneDeployments[d.id];
          if (plannedBase) return plannedBase === baseCityId;
          return d.currentCity === baseCityId && d.status === 'ACTIVE';
        });
        if (cityDrones.length === 0) return null;
        const center = getPixelCoords(baseCityId);
        if (center.x === 0) return null;
        const orbitRadius = 4.5;
        const droneSize = 2.4;
        return (
          <g key={`stationed-drone-orbit-${baseCityId}`}>
            <circle cx={center.x} cy={center.y} r={orbitRadius} fill="none" stroke="rgba(16, 185, 129, 0.45)" strokeWidth="0.3" strokeDasharray="0.8,0.8" />
            <g style={{ transformOrigin: `${center.x}px ${center.y}px`, animation: 'drone-circular-orbit 5s linear infinite' }}>
              <g transform={`translate(${center.x - droneSize / 2}, ${center.y - orbitRadius - droneSize / 2})`}>
                <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: droneSize, color: '#10b981' }) }} />
              </g>
            </g>
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

        @keyframes enemyLossBurst {
          0% {
            transform: translate(0, 0) scale(0.4) rotate(0deg);
            opacity: 0;
          }
          20% { opacity: 1; filter: drop-shadow(0 0 12px #39ff14); }
          50% {
            transform: translate(var(--tx), var(--ty)) scale(1.4) rotate(45deg);
            filter: drop-shadow(0 0 12px #ffee00);
          }
          100% {
            transform: translate(var(--fall-x), var(--fall-y)) scale(0.2) rotate(180deg);
            opacity: 0;
          }
        }
        .enemy-loss-particle {
          position: absolute;
          font-size: var(--size);
          color: #10b981;
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.9);
          animation: enemyLossBurst 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) var(--delay) forwards;
          pointer-events: none;
          z-index: 101;
          font-family: monospace;
        }

        .safehouse-alert-badge {
          position: absolute;
          top: -34px;
          left: 50%;
          transform: translateX(-50%);
          font-family: monospace;
          font-size: 9px;
          font-weight: bold;
          padding: 3px 7px;
          border-radius: 4px;
          white-space: nowrap;
          z-index: 110;
          pointer-events: none;
          letter-spacing: 0.05em;
        }
        .safehouse-alert-badge.compromised {
          background: rgba(255, 59, 48, 0.95);
          color: #ffffff;
          border: 1px solid #ff3b30;
          box-shadow: 0 0 14px rgba(255, 59, 48, 0.8);
        }
        .safehouse-alert-badge.neutralized {
          background: rgba(16, 185, 129, 0.95);
          color: #ffffff;
          border: 1px solid #10b981;
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.8);
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

        @keyframes smoke-drift {
          0% {
            transform: translate(-50%, -50%) scale(0.5) translateY(0);
            opacity: 0;
          }
          20% {
            opacity: 0.8;
          }
          60% {
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.8) translateY(-32px) rotate(35deg);
            opacity: 0;
          }
        }
        @keyframes flame-pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(0.95);
            filter: drop-shadow(0 0 4px #ff3b30);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.15);
            filter: drop-shadow(0 0 10px #f59e0b);
          }
        }
        .smoke-cloud-1 {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 20px;
          height: 20px;
          background: radial-gradient(circle, rgba(110,110,110,0.8) 0%, rgba(70,70,70,0.35) 60%, transparent 100%);
          border-radius: 50%;
          pointer-events: none;
          animation: smoke-drift 2.5s infinite ease-out;
          z-index: 10;
        }
        .smoke-cloud-2 {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 22px;
          height: 22px;
          background: radial-gradient(circle, rgba(80,80,80,0.7) 0%, rgba(50,50,50,0.3) 60%, transparent 100%);
          border-radius: 50%;
          pointer-events: none;
          animation: smoke-drift 2.8s infinite ease-out;
          animation-delay: 0.9s;
          z-index: 10;
        }
        .fire-flame {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          font-size: 14px;
          pointer-events: none;
          animation: flame-pulse 0.7s infinite ease-in-out;
          z-index: 11;
        }
        .city-marker-outer.struck {
          border: 2px dashed #ff3b30 !important;
          animation: pulse 1s infinite !important;
          background: rgba(255, 59, 48, 0.15) !important;
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
            {Object.entries(scaledCoords).map(([cityId, coords], nodeIdx) => {
              const nodeData = activeScenario?.nodes?.find(n => n.id === cityId);
              const isFriendlyRaw = nodeData ? nodeData.territory === 'HOME_TERRITORY' : ['srinagar', 'jammu', 'amritsar', 'chandigarh', 'new_delhi'].includes(cityId);
              const isFriendly = isAttacker ? !isFriendlyRaw : isFriendlyRaw;
              const isTarget = activeScenario?.targetCity ? cityId === activeScenario.targetCity : cityId === 'new_delhi';
              
              const hasDefenderSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'DEFENDER');
              const hasHostileSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE');
              const hasExposedNormalSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.uncovered && !s.secure);
              const hasExposedSecureSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.uncovered && s.secure);
              
              const isSecureSafehouse = hasHostileSafehouse && session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.secure);
              const showSafehouseIcon = isAttacker ? hasHostileSafehouse : hasDefenderSafehouse;
              const shColorT = isAttacker ? (isSecureSafehouse ? '#ffcc00' : '#ff3b30') : '#00f0ff';
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

              const hasDroneBase = !isAttacker && (session.droneBases?.includes(cityId) || localDroneBaseBuilds.includes(cityId));
              const cityDronesCount = (isAttacker && !showGodMode) ? 0 : (session.drones || []).filter(d => {
                const plannedBase = localDroneDeployments[d.id];
                if (plannedBase) return plannedBase === cityId;
                return d.currentCity === cityId;
              }).length;

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
                    {destroyedFriendlyCities.some(c => c.cityId === cityId) && (
                      <div className="loss-pill loss-pill--friendly">SAFEHOUSE LOST</div>
                    )}
                    {destroyedEnemyCities.some(c => c.cityId === cityId) && (
                      <div className="loss-pill loss-pill--enemy">ENEMY NEUTRALIZED</div>
                    )}
                    {confettiCities.includes(cityId) && (
                      <div className="expose-glow expose-glow--tactical" />
                    )}
                    {isSweptZone && <div className="city-marker-sweep-ring"></div>}
                    {isSuspectHere && <div className="suspect-radar-ring"></div>}
                    {struckCities.includes(cityId.toLowerCase()) && (
                      <div className="struck-glow struck-glow--tactical" />
                    )}
                    <div className={`city-marker-outer ${isFriendly ? 'friendly' : 'hostile'} ${isSweptZone ? 'sweep-alert' : ''}`}></div>
                    <div className={`city-marker-inner ${isFriendly ? 'friendly' : 'hostile'} ${isTarget ? 'target' : ''}`}></div>
                    {showSafehouseIcon && (
                      <div 
                        className={`city-marker-safehouse ${isNewSafehouse ? 'safehouse-drop-bounce' : ''}`} 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <SafehouseIcon
                          size={11}
                          color={shColorT}
                          secure={isSecureSafehouse}
                          hostile={isAttacker && hasHostileSafehouse}
                        />
                      </div>
                    )}
                    {showExposedNormalIcon && (
                      <div className={`city-marker-exposed-hostile ${isNewExposed ? 'safehouse-reveal-bounce' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                        <SafehouseIcon size={9} color="#f59e0b" />
                        <span style={{ fontSize: '8px' }}>👁️</span>
                      </div>
                    )}
                    {showExposedSecureIcon && (
                      <div className={`city-marker-exposed-secure ${isNewExposed ? 'safehouse-reveal-bounce' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                        <SafehouseIcon size={9} color="#ffcc00" secure />
                        <span style={{ fontSize: '8px' }}>👁️</span>
                      </div>
                    )}
                    {isSuspectHere && <div className="city-marker-badge suspect pulse-badge" style={{ background: '#ff3b30', boxShadow: '0 0 15px #ff3b30', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', border: '2px solid white', borderRadius: '50%', width: '22px', height: '22px', transform: 'translate(12px, -24px)', zIndex: 1000 }}>🎯</div>}
                    {agentsCount > 0 && (
                      <div className="city-marker-badge agents-icon">
                        <AgentIcon size={11} color="#00f0ff" />
                        {agentsCount > 1 && <span className="badge-count">{agentsCount}</span>}
                      </div>
                    )}
                    {teamsCount > 0 && (
                      <div className="city-marker-badge teams-icon">
                        <CombatTeamIcon size={11} color="#ff3b30" />
                        {teamsCount > 1 && <span className="badge-count">{teamsCount}</span>}
                      </div>
                    )}
                    {combinedTech.length > 0 && (
                      <div className="city-marker-tech" style={{ display: 'flex', gap: '2px' }}>
                        {combinedTech}
                      </div>
                    )}
                    {hasDroneBase && (
                       <div 
                         className="city-marker-drone-base" 
                         title="Drone Base" 
                         style={{ 
                           position: 'absolute', 
                           bottom: '-18px', 
                           left: '-18px', 
                           background: 'rgba(0, 240, 255, 0.15)', 
                           border: '1px solid #00f0ff', 
                           borderRadius: '4px', 
                           padding: '2px', 
                           width: '16px', 
                           height: '16px', 
                           display: 'flex', 
                           alignItems: 'center', 
                           justifyContent: 'center', 
                           zIndex: 10 
                         }}
                       >
                         <DroneBaseIcon size={12} color="#00f0ff" />
                       </div>
                     )}
                     {cityDronesCount > 0 && (
                       <div 
                         className="city-marker-drone-count" 
                         title={`${cityDronesCount} Drone(s) stationed`} 
                         style={{ 
                           position: 'absolute', 
                           bottom: '-18px', 
                           right: '-18px', 
                           background: 'rgba(16, 185, 129, 0.15)', 
                           border: '1px solid #10b981', 
                           borderRadius: '4px', 
                           padding: '2px 4px', 
                           height: '16px', 
                           display: 'flex', 
                           alignItems: 'center', 
                           justifyContent: 'center', 
                           gap: '2px',
                           zIndex: 10 
                         }}
                       >
                         <DroneIcon size={11} color="#10b981" />
                         <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#10b981' }}>{cityDronesCount}</span>
                       </div>
                     )}
                    {hasIdleAgent && <div className="city-marker-idle">⚠</div>}
                    {isSweptZone && <div className="city-marker-sweep-label">⚠ SWEEP</div>}
                    <div className={`city-marker-label ${isSelected ? 'active' : ''} ${isSweptZone ? 'sweep-text' : ''} ${nodeIdx % 2 === 0 ? 'label-top' : 'label-bottom'}`}>{cityId.replace('_', ' ').toUpperCase()}</div>
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
      {selectedCityNode && !isAnimating && (
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
            localDroneBaseBuilds={localDroneBaseBuilds}
            onBuildDroneBase={(cityNode) => {
              setLocalDroneBaseBuilds(prev =>
                prev.includes(cityNode) ? prev.filter(c => c !== cityNode) : [...prev, cityNode]
              );
            }}
            localDroneDeployments={localDroneDeployments}
            onDeployDrone={(droneId, city) => {
              setLocalDroneDeployments(prev => ({
                ...prev,
                [droneId]: prev[droneId] === city ? null : city
              }));
            }}
            localDroneOperations={localDroneOperations}
            onToggleDroneOperation={(droneId, actionType, targetCity) => {
              setLocalDroneOperations(prev => {
                const exists = prev.find(op => op.droneId === droneId);
                if (exists) {
                  if (exists.actionType === actionType && exists.targetCity === targetCity) {
                    return prev.filter(op => op.droneId !== droneId);
                  } else {
                    return prev.map(op => op.droneId === droneId ? { droneId, actionType, targetCity } : op);
                  }
                } else {
                  return [...prev, { droneId, actionType, targetCity }];
                }
              });
            }}
            onBuyDrone={onBuyDrone}
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
