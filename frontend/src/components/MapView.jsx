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
  onServiceDrone,
  onAnimationComplete
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tacticalContainerRef = useRef(null);

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
      .filter(c => {
        const isStrike = c.source === 'STRIKE_EXECUTED' || c.source === 'SAFEHOUSE_ATTACK' || c.source === 'DRONE_ATTACK';
        const city = c.location || c.cityName;
        const clueTurn = c.turnDiscovered !== undefined ? c.turnDiscovered : c.turn;
        return isStrike && city && clueTurn === lastTurn;
      })
      .map(c => (c.location || c.cityName).toLowerCase());
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

  // Normalize node coordinate points for Tactical View cleanly preserving relative positions
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
        // Map to safe inner bounds [12%-88% horizontal, 15%-80% vertical] for mobile nav safety
        const scaledX = 12 + ((node.coordinates.x - minX) / xRange) * 76;
        const scaledY = 15 + ((node.coordinates.y - minY) / yRange) * 65;
        coords[node.id] = { x: scaledX, y: scaledY };
      } else {
        coords[node.id] = { x: 50, y: 50 };
      }
    });

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
  const [shakeIntensity, setShakeIntensity] = useState('heavy'); // 'heavy' | 'medium' | 'light'
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

    const gridCanvas = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png', {
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
      
      const hasDefenderSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'DEFENDER' && s.status !== 'DESTROYED');
      const hasHostileSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.status !== 'DESTROYED');
      const hasExposedNormalSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && (s.uncovered || s.exposed) && !s.secure && s.status !== 'DESTROYED');
      const hasExposedSecureSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && (s.uncovered || s.exposed) && s.secure && s.status !== 'DESTROYED');
      
      const isSecureSafehouse = hasHostileSafehouse && session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.secure && s.status !== 'DESTROYED');
      // Build safehouse icon HTML string for Leaflet markers (SVG from GameSymbols)
      const shColor = isAttacker ? (isSecureSafehouse ? '#ffcc00' : '#ff3b30') : '#00f0ff';
      const showSafehouseIconHtml = isAttacker
        ? (hasHostileSafehouse ? safehouseIconHtml({ size: 13, color: shColor, secure: isSecureSafehouse, hostile: true }) : '')
        : (hasDefenderSafehouse ? safehouseIconHtml({ size: 13, color: '#00f0ff' }) : '');
      const showExposedNormalIcon = !isAttacker && hasExposedNormalSH;
      const showExposedSecureIcon = !isAttacker && hasExposedSecureSH;
      
      const isSweptZone = sweepCities.includes(cityId);
      const isDroneDefenseActive = Boolean(session?.activeDroneDefenseCity && session.activeDroneDefenseCity.toLowerCase() === cityId.toLowerCase());

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
      const hasIdleAgent = !isAttacker && session.agents.some(a => {
        const currentLoc = localAgentMoves[a.id] || a.currentCity;
        if (currentLoc !== cityId) return false;
        const effectiveTask = localAgentTasks[a.id] || a.activeTask;
        return !effectiveTask || effectiveTask === 'NONE' || effectiveTask === '';
      });

       const isStruck = struckCities.includes(cityId.toLowerCase());

       const hasDroneBase = !isAttacker && (session.droneBases?.includes(cityId) || localDroneBaseBuilds.includes(cityId));
       const cityDronesCount = (isAttacker && !showGodMode) ? 0 : (session.drones || []).filter(d => {
         const plannedBase = localDroneDeployments[d.id];
         if (plannedBase) return plannedBase === cityId;
         return d.currentCity === cityId && d.status !== 'SHOT_DOWN';
       }).length;

       const droneBaseHtml = hasDroneBase ? `
         <div class="city-marker-drone-base" title="Drone Base Stationed" style="position: absolute; bottom: -18px; left: -18px; background: rgba(0, 240, 255, 0.15); border: 1px solid var(--cyan); border-radius: 4px; padding: 2px; display: flex; align-items: center; justify-content: center; z-index: 10;">
           ${droneBaseIconHtml({ size: 11, color: 'var(--cyan)' })}
         </div>
       ` : '';

       const droneHtml = (hasDroneBase && cityDronesCount > 0) ? `
         <div class="city-marker-drone-count" title="${cityDronesCount} Drone(s) stationed" style="position: absolute; bottom: -18px; right: -18px; background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 4px; padding: 2px; height: 16px; display: flex; align-items: center; justify-content: center; gap: 2px; padding-left: 3px; padding-right: 4px; z-index: 10;">
           ${droneIconHtml({ size: 11, color: '#10b981' })}
           <span style="font-size: 8px; font-weight: bold; color: #10b981;">${cityDronesCount}</span>
         </div>
       ` : '';

       // Construct dynamic HTML for Leaflet markers matching the index.css styling
       const markerHtml = `
         <div class="city-marker-wrapper ${isSelected ? 'selected' : ''} ${hasIdleAgent ? 'has-idle' : ''} ${isSweptZone ? 'swept-zone' : ''} ${isSuspectHere ? 'suspect-here-wrapper' : ''} ${isStruck ? 'city-struck' : ''}">
           ${isSweptZone ? '<div class="city-marker-sweep-ring"></div>' : ''}
           ${isDroneDefenseActive ? '<div class="city-marker-drone-defense-ring"></div>' : ''}
           ${isSuspectHere ? '<div class="suspect-radar-ring"></div>' : ''}
           ${destroyedFriendlyCities.includes(cityId) ? '<div class="safehouse-alert-badge compromised">🚨 SAFEHOUSE COMPROMISED</div>' : ''}
           ${destroyedEnemyCities.some(c => (typeof c === 'string' ? c : c.cityId) === cityId) ? `<div class="safehouse-alert-badge neutralized">🎯 ${destroyedEnemyCities.find(c => (typeof c === 'string' ? c : c.cityId) === cityId)?.isElimination ? 'ENEMY ELIMINATED' : 'SAFEHOUSE DESTROYED'}</div>` : ''}
           ${isStruck ? '<div class="smoke-fumes-container"><div class="fume-particle" style="--wind: -3px; --wind-far: -8px"></div><div class="fume-particle" style="--wind: 4px; --wind-far: 9px"></div><div class="fume-particle" style="--wind: -1px; --wind-far: -3px"></div></div><div class="fire-flame">🔥</div>' : ''}
           <div class="city-marker-outer ${isFriendly ? 'friendly' : 'hostile'} ${isSweptZone ? 'sweep-alert' : ''} ${isDroneDefenseActive ? 'drone-defense-alert' : ''}"></div>
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
           ${isDroneDefenseActive ? '<div class="city-marker-drone-defense-label">🛡️ AIR DEFENSE ACTIVE</div>' : ''}
            <div class="city-marker-label ${isSelected ? 'active' : ''} ${isSweptZone ? 'sweep-text' : ''}">${cityId.replace('_', ' ').toUpperCase()}</div>
          </div>
        `;

       // Construct rich Hover & Mobile Tooltip HTML
       let tooltipContent = `<div class="city-tooltip-card">`;
       tooltipContent += `<div class="city-tooltip-header ${isFriendly ? 'friendly' : 'hostile'}">
         <span class="city-tooltip-title">${cityId.replace('_', ' ').toUpperCase()}</span>
       </div>`;
       if (isDroneDefenseActive) {
         tooltipContent += `<div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); padding: 4px 8px; margin: 4px 8px; border-radius: 4px; font-size: 8.5px; font-weight: bold; color: #ef4444; font-family: monospace;">🛡️ HOSTILE SAM AIR DEFENSE ACTIVE (24H)</div>`;
       }
       tooltipContent += `<span class="city-tooltip-tag">${isFriendly ? 'FRIENDLY' : 'HOSTILE'}</span>
       </div>`;

       // 1. Agents section
       const cityAgents = session.agents.filter(a => {
         const plannedDest = localAgentMoves[a.id];
         if (plannedDest) return plannedDest === cityId;
         return a.currentCity === cityId;
       });
       if (cityAgents.length > 0) {
         tooltipContent += `<div class="city-tooltip-section">
           <div class="city-tooltip-section-title">🕵️ FIELD AGENTS (${cityAgents.length})</div>`;
         cityAgents.forEach(a => {
           const task = localAgentTasks[a.id] || a.activeTask || 'IDLE';
           const isMoving = localAgentMoves[a.id] && localAgentMoves[a.id] === cityId && a.currentCity !== cityId;
           const displayTask = isMoving ? '🚚 IN TRANSIT' : (task === 'NONE' || task === '' ? 'IDLE' : task.replace(/_/g, ' '));
           tooltipContent += `<div class="city-tooltip-item">
             <span class="item-name">${a.name || 'Agent #' + a.id} (${a.skill || 80}%)</span>
             <span class="item-task ${displayTask === 'IDLE' ? 'idle' : 'active'}">${displayTask}</span>
           </div>`;
         });
         tooltipContent += `</div>`;
       }

       // 2. Combat Teams section
       const cityTeams = (session.tacticalTeams || []).filter(t => {
         const plannedDest = localTeamMoves[t.id];
         if (plannedDest) return plannedDest === cityId;
         return t.currentCity === cityId;
       });
       if (cityTeams.length > 0) {
         tooltipContent += `<div class="city-tooltip-section">
           <div class="city-tooltip-section-title">⚔️ COMBAT TEAMS (${cityTeams.length})</div>`;
         cityTeams.forEach(t => {
           const isMoving = localTeamMoves[t.id] && localTeamMoves[t.id] === cityId && t.currentCity !== cityId;
           const displayType = isMoving ? '🚚 IN TRANSIT' : (t.type || 'STRIKE_FORCE').replace(/_/g, ' ');
           tooltipContent += `<div class="city-tooltip-item">
             <span class="item-name">${t.name || 'Team #' + t.id} (${t.effectiveness || 80}%)</span>
             <span class="item-task active">${displayType}</span>
           </div>`;
         });
         tooltipContent += `</div>`;
       }

       // 3. Drones & Base section
       const cityDrones = (isAttacker && !showGodMode) ? [] : (session.drones || []).filter(d => {
         const plannedBase = localDroneDeployments[d.id];
         if (plannedBase) return plannedBase === cityId;
         return d.currentCity === cityId && d.status === 'ACTIVE';
       });
       if (cityDrones.length > 0 || hasDroneBase) {
         tooltipContent += `<div class="city-tooltip-section">
           <div class="city-tooltip-section-title">🚁 DRONES & BASE (${cityDrones.length} Stationed)</div>`;
         if (hasDroneBase && cityDrones.length === 0) {
           tooltipContent += `<div class="city-tooltip-item"><span class="item-name">Drone Base Operational</span><span class="item-task idle">EMPTY (0/2)</span></div>`;
         }
         cityDrones.forEach(d => {
           const op = (localDroneOperations || []).find(o => o.droneId === d.id) || { actionType: d.assignedActionType, targetCity: d.assignedTargetCity };
           const opText = op.actionType ? `${op.actionType} -> ${op.targetCity?.toUpperCase()}` : 'STANDBY';
           tooltipContent += `<div class="city-tooltip-item">
             <span class="item-name">Drone #${d.id} (${d.type || '1-HOP'})</span>
             <span class="item-task ${op.actionType ? 'active' : 'idle'}">${opText}</span>
           </div>`;
         });
         tooltipContent += `</div>`;
       }

       // 4. Tech Assets section
       const cityTechs = (session.espionageResources || []).filter(r => r.cityNode?.toLowerCase() === cityId.toLowerCase());
       if (cityTechs.length > 0) {
         tooltipContent += `<div class="city-tooltip-section">
           <div class="city-tooltip-section-title">📡 TECH ASSETS</div>`;
         cityTechs.forEach(r => {
           const label = r.type === 'BORDER_GUARD' ? 'BORDER GUARD (Interdiction)'
                       : r.type === 'SATELLITE' ? 'SATELLITE SURVEILLANCE'
                       : r.type === 'CCTV' ? 'CCTV MONITORING'
                       : r.type.replace(/_/g, ' ');
           tooltipContent += `<div class="city-tooltip-item"><span class="item-name">• ${label}</span></div>`;
         });
         tooltipContent += `</div>`;
       }

       // 5. Safehouses & Suspect section (Only show exposed hostile safehouses and non-destroyed safehouses)
        const citySafehouses = (session.safehouses || []).filter(s => {
          if (!s.cityNode || s.cityNode.toLowerCase() !== cityId.toLowerCase()) return false;
          if (s.status === 'DESTROYED') return false;
          const isFriendly = isAttacker ? s.ownerFaction === 'HOSTILE' : s.ownerFaction === 'DEFENDER';
          if (isFriendly) return true;
          return Boolean(s.uncovered || s.exposed || showGodMode);
        });

        if (citySafehouses.length > 0 || isSuspectHere) {
          tooltipContent += `<div class="city-tooltip-section">
            <div class="city-tooltip-section-title">🏠 SAFEHOUSE / TARGET INTEL</div>`;
          if (isSuspectHere) {
            tooltipContent += `<div class="city-tooltip-item"><span class="item-name" style="color:#ff3b30; font-weight:800;">🎯 TARGET SUSPECT DETECTED</span></div>`;
          }
          citySafehouses.forEach(s => {
            const isFriendly = isAttacker ? s.ownerFaction === 'HOSTILE' : s.ownerFaction === 'DEFENDER';
            const factionLabel = isFriendly ? 'FRIENDLY SAFEHOUSE' : 'HOSTILE SAFEHOUSE';
            const isCompromised = s.exposed || s.uncovered;
            tooltipContent += `<div class="city-tooltip-item">
              <span class="item-name">${factionLabel}</span>
              <span class="item-task ${isCompromised ? 'compromised' : 'active'}">${isCompromised ? 'EXPOSED' : 'SECURE'}</span>
            </div>`;
          });
          tooltipContent += `</div>`;
        }

       if (cityAgents.length === 0 && cityTeams.length === 0 && cityDrones.length === 0 && !hasDroneBase && cityTechs.length === 0 && citySafehouses.length === 0 && !isSuspectHere) {
         tooltipContent += `<div class="city-tooltip-empty">No field assets stationed</div>`;
       }

       tooltipContent += `</div>`;

       const customIcon = L.divIcon({
         html: markerHtml,
         className: 'custom-leaflet-marker',
         iconSize: [40, 40],
         iconAnchor: [20, 20]
       });

       const marker = L.marker(coords, { icon: customIcon })
         .addTo(map)
         .bindTooltip(tooltipContent, {
           direction: 'top',
           offset: [0, -25],
           className: 'cyber-leaflet-tooltip',
           sticky: false
         })
         .on('click', () => {
           setSelectedCityNode(cityId);
           // Zoom into the clicked city smoothly
           map.setView(coords, 8, { animate: true });
         });

       markersRef.current[cityId] = marker;
     });

    // Helper to add minor geographical offset to coordinate pairs
    const getOffsetCoords = (c1, c2, offsetAmount) => {
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
    // ── Combat detection: classify each TACTICAL_FORCE / SAFEHOUSE_ATTACK / BORDER clue into typed outcomes ──
    const detectCombatOutcome = (c) => {
      const src  = c.source || '';
      const text = c.clueText || '';
      if (src === 'TACTICAL_FORCE') {
        if (text.includes('COMBAT SUCCESS'))               return 'COMBAT_VICTORY';
        if (text.includes('COMBAT ENGAGEMENT') && (text.includes('escaped') || text.includes('lockout') || text.includes('forfeited'))) return 'COMBAT_PARTIAL';
        if (text.includes('COMBAT ENGAGEMENT') && text.includes('no suspect presence')) return 'RAID_EMPTY';
        if (text.includes('COMBAT ENGAGEMENT') && text.includes('Intel breach'))        return 'RAID_EMPTY';
        if (text.includes('raided') || text.includes('dismantled') || text.includes('destroyed')) return 'SAFEHOUSE_RAIDED';
        return 'COMBAT_PARTIAL';
      }
      if (src === 'SAFEHOUSE_ATTACK') {
        if (text.includes('repelled') || text.includes('secure') || text.includes('defended')) return 'SAFEHOUSE_DEFENDED';
        return 'SAFEHOUSE_RAIDED';
      }
      if (src === 'BORDER_GUARD' || src === 'BORDER_INCIDENT' || text.includes('Relocation blocked') || text.includes('INTERCEPTION') || text.includes('INTERCEPTED') || text.includes('interdicted') || text.includes('Infiltration foiled')) return 'BORDER_INTERCEPTED';
      if (src === 'COMMAND_CENTER' && text.includes('RAID LOGISTICS')) return 'LOGISTICS_RAIDED';
      if (text.includes('COMBAT')) return 'COMBAT_PARTIAL';
      return null;
    };
    const COMBAT_OUTCOME_COLOR = {
      COMBAT_VICTORY:    '#fbbf24',  // gold
      COMBAT_PARTIAL:    '#f97316',  // amber
      SAFEHOUSE_RAIDED:  '#ff9800',  // orange
      RAID_EMPTY:        '#facc15',  // yellow
      SAFEHOUSE_DEFENDED:'#00f0ff',  // cyan
      BORDER_INTERCEPTED:'#a855f7',  // purple
      LOGISTICS_RAIDED:  '#14b8a6',  // teal
    };
    const COMBAT_OUTCOME_SHAKE = {
      COMBAT_VICTORY:    'heavy',
      COMBAT_PARTIAL:    'medium',
      SAFEHOUSE_RAIDED:  'medium',
      RAID_EMPTY:        'light',
      SAFEHOUSE_DEFENDED:'light',
      BORDER_INTERCEPTED:'light',
      LOGISTICS_RAIDED:  null,
    };
    const newCombat = [];
    lastTurnClues.forEach(c => {
      const outcome = detectCombatOutcome(c);
      if (!outcome) return;
      // Find city: parse from clue text by matching scenario node names/ids
      let cityId = null;
      const nodes = activeScenario?.nodes || [];
      for (const n of nodes) {
        const needle = (n.name || n.id).toUpperCase();
        if ((c.clueText || '').toUpperCase().includes(needle)) { cityId = n.id; break; }
      }
      // Fallback: use AI primary plan for this turn
      if (!cityId) {
        const step = session.aiMasterPlan?.primaryPlan?.find(s => s.turn === prevSession.currentTurn);
        cityId = step?.suspectLocation || null;
      }
      if (!cityId) return;
      // Find team's home city for travel phase
      const teamInPrev = prevSession.tacticalTeams?.find(t => {
        const needle = (t.name || '').toLowerCase();
        return (c.clueText || '').toLowerCase().includes(needle);
      });
      const fromCity = teamInPrev?.currentCity || null;
      // Deduplicate by cityId+outcome
      if (!newCombat.some(x => x.cityId === cityId && x.outcome === outcome)) {
        newCombat.push({ cityId, outcome, fromCity, color: COMBAT_OUTCOME_COLOR[outcome], shakeLevel: COMBAT_OUTCOME_SHAKE[outcome], progress: 0, phase: 0 });
      }
    });

    // ── Drone animations: multi-phase RECON / ATTACK / MOVE / DESTROYED ─────
    // Outcome types: RECON_SUCCESS | RECON_NO_ENEMY | ATTACK_SUCCESS | ATTACK_NO_ENEMY | SHOT_DOWN | DAMAGED | RETURNED_SAFE | MOVE
    const detectDroneOutcome = (c, droneAction) => {
      const text = c.clueText || '';
      if (text.includes('SHOT DOWN') || text.includes('DRONE DOWN')) return 'SHOT_DOWN';
      if (droneAction === 'RECON') {
        if (text.includes('RECON SUCCESS')) return 'RECON_SUCCESS';
        return 'RECON_NO_ENEMY';
      }
      if (droneAction === 'ATTACK') {
        if (text.includes('No exposed hostile')) return 'ATTACK_NO_ENEMY';
        return 'ATTACK_SUCCESS';
      }
      return 'RETURNED_SAFE';
    };

    lastTurnClues.forEach(c => {
      const isDamagedClue = c.source === 'DRONE_DAMAGED' || (c.clueText && c.clueText.includes('DRONE DAMAGED'));
      const isShotDownClue = c.source === 'DRONE_SHOT_DOWN' || (c.clueText && c.clueText.includes('DRONE DOWN'));
      if (c.source === 'DRONE_RECON' || c.source === 'DRONE_ATTACK' || isDamagedClue || isShotDownClue) {
        const droneMatch = c.clueText?.match(/Drone #?(\d+)/i);
        if (droneMatch) {
          const droneId = parseInt(droneMatch[1]);
          let toCity = c.location;
          if (!toCity) {
            const targetNode = activeScenario?.nodes?.find(n => c.clueText?.toLowerCase().includes(n.id.toLowerCase()) || (n.name && c.clueText?.toLowerCase().includes(n.name.toLowerCase())));
            toCity = targetNode?.id;
          }
          if (toCity) {
            const prevDrone = prevSession.drones?.find(d => d.id === droneId);
            const currentDrone = session.drones?.find(d => d.id === droneId);
            const fromCity = prevDrone ? prevDrone.currentCity : (currentDrone ? currentDrone.currentCity : toCity);
            if (fromCity) {
              const isRecon = c.clueText?.toLowerCase().includes('recon') || c.source === 'DRONE_RECON';
              const droneAction = isRecon ? 'RECON' : 'ATTACK';
              const outcome = isShotDownClue ? 'SHOT_DOWN' : (isDamagedClue ? 'DAMAGED' : detectDroneOutcome(c, droneAction));
              const isDestroyed = outcome === 'SHOT_DOWN';

              // Color-code by outcome
              const outcomeColor = {
                RECON_SUCCESS:   '#00f0ff',  // cyan — intel gathered
                RECON_NO_ENEMY:  '#6ee7b7',  // muted green — clear
                ATTACK_SUCCESS:  '#ff9800',  // orange — strike confirmed
                ATTACK_NO_ENEMY: '#facc15',  // yellow — miss
                SHOT_DOWN:       '#ff3b30',  // red — destroyed
                DAMAGED:         '#f97316',  // amber — damaged
                RETURNED_SAFE:   '#10b981',  // green — safe return
              }[outcome] || '#10b981';

              newDroneAnims.push({
                fromCity,
                toCity,
                baseCity: fromCity,
                droneAction,
                outcome,
                isDestroyed,
                phase: 0,
                progress: 0,
                color: outcomeColor
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
            outcome: 'MOVE',
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
      setIsShaking(false); setShakeIntensity('heavy');
      setTimeout(() => { onAnimCompleteRef.current?.(); }, 300);
    };

    const runLossPhase = (loss) => {
      const friendlyCount = loss?.friendly?.length || 0;
      const enemyCount = loss?.enemy?.length || 0;
      if (friendlyCount === 0 && enemyCount === 0) { finishAll(); return; }
      // Use progress-driven animation instead of a static timeout
      if (friendlyCount > 0) setDestroyedFriendlyCities(loss.friendly.map(c => ({ cityId: c, progress: 0 })));
      if (enemyCount > 0) {
        const recentClues = session?.discoveredClues || [];
        setDestroyedEnemyCities(loss.enemy.map(cId => {
          const isElim = recentClues.some(clue => 
            clue.turn === session.currentTurn && 
            clue.location?.toLowerCase() === cId.toLowerCase() && 
            (clue.text?.includes("NEUTRALIZED") || clue.text?.includes("ELIMINATED") || clue.text?.includes("SUSPECT NEUTRALIZED") || clue.type === 'SUSPECT_NEUTRALIZED')
          );
          return { cityId: cId, isElimination: isElim, progress: 0 };
        }));
      }
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

    // Phase durations per combat outcome type
    const COMBAT_ACTION_DUR = {
      COMBAT_VICTORY:    2000,
      COMBAT_PARTIAL:    1800,
      SAFEHOUSE_RAIDED:  1700,
      RAID_EMPTY:        1400,
      SAFEHOUSE_DEFENDED:1500,
      BORDER_INTERCEPTED:1300,
      LOGISTICS_RAIDED:  1200,
    };

    const runCombatPhase = (items, tech, expired, lost) => {
      if (items.length === 0) { runTechPhase(tech, expired, lost); return; }

      // Determine max shake intensity across all events this turn
      const maxShake = items.some(i => i.shakeLevel === 'heavy')  ? 'heavy'
                     : items.some(i => i.shakeLevel === 'medium') ? 'medium'
                     : items.some(i => i.shakeLevel === 'light')  ? 'light'
                     : null;

      // ── Phase 0: Travel (troop movement to target) ─────────────────
      const TRAVEL_DUR = 1000;
      const withTravel = items.filter(i => i.fromCity && i.fromCity !== i.cityId);
      const noTravel   = items.filter(i => !i.fromCity || i.fromCity === i.cityId);

      const startAction = () => {
        // ── Phase 1: Action at city ─────────────────────────────────────
        const maxDur = Math.max(...items.map(i => COMBAT_ACTION_DUR[i.outcome] || 1400));
        if (maxShake) { setIsShaking(true); setShakeIntensity(maxShake); }
        setCombatAlerts(items.map(i => ({ ...i, phase: 1, progress: 0 })));
        const start1 = performance.now();
        const loop1 = (t) => {
          setCombatAlerts(prev => prev.map(i => {
            const dur = COMBAT_ACTION_DUR[i.outcome] || 1400;
            return { ...i, progress: Math.min((t - start1) / dur, 1.0) };
          }));
          if ((t - start1) < maxDur) { rafId = requestAnimationFrame(loop1); }
          else {
            setIsShaking(false);
            // ── Phase 2: Linger (result glow fades) ─────────────────────
            const LINGER_DUR = 800;
            setCombatAlerts(prev => prev.map(i => ({ ...i, phase: 2, progress: 0 })));
            const start2 = performance.now();
            const loop2 = (t2) => {
              const p2 = Math.min((t2 - start2) / LINGER_DUR, 1.0);
              setCombatAlerts(prev => prev.map(i => ({ ...i, progress: p2 })));
              if (p2 < 1.0) { rafId = requestAnimationFrame(loop2); }
              else { setCombatAlerts([]); setTimeout(() => runTechPhase(tech, expired, lost), 200); }
            };
            rafId = requestAnimationFrame(loop2);
          }
        };
        rafId = requestAnimationFrame(loop1);
      };

      if (withTravel.length > 0) {
        setCombatAlerts([...withTravel.map(i => ({ ...i, phase: 0, progress: 0 })), ...noTravel.map(i => ({ ...i, phase: 1, progress: 0 }))]);
        const start0 = performance.now();
        const loop0 = (t) => {
          const p0 = Math.min((t - start0) / TRAVEL_DUR, 1.0);
          setCombatAlerts(prev => prev.map(i => i.phase === 0 ? { ...i, progress: p0 } : i));
          if (p0 < 1.0) { rafId = requestAnimationFrame(loop0); }
          else { setTimeout(startAction, 80); }
        };
        rafId = requestAnimationFrame(loop0);
      } else {
        startAction();
      }
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
        // Phase A: Tactical construction reticle animation around the node (850ms)
        setBuildingSafehouses([{ ...b, progress: 0 }]);
        const ringStart = performance.now(); const ringDur = 850;
        const ringLoop = (t) => {
          const p = Math.min((t - ringStart) / ringDur, 1.0);
          setBuildingSafehouses(prev => prev.map(x => ({ ...x, progress: p })));
          if (p < 1.0) { rafId = requestAnimationFrame(ringLoop); }
          else {
            setBuildingSafehouses([]);
            // Phase B: Show final safehouse icon with drop-bounce reveal (950ms)
            setNewSafehouses(prev => [...prev, b.cityId]);
            setTimeout(() => { setNewSafehouses([]); setTimeout(buildNext, 200); }, 950);
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

    // Multi-phase drone animation: TRAVEL → ACTION → RETURN/CRASH/DAMAGED
    const runDroneAnimPhase = (droneAnims, moves, builds, exposes, combat, tech, expired, lost) => {
      if (droneAnims.length === 0) { runMovePhase(moves, builds, exposes, combat, tech, expired, lost); return; }

      const TRAVEL_DUR  = 1400;  // phase 0 — fly to target
      const ACTION_DUR  = 1350;  // phase 1 — action at target (base; per-outcome below)
      const RETURN_DUR  = 1100;  // phase 2 — return flight (alive drones)
      const DESTROY_DUR = 900;   // phase 3 — crash / neutralized

      // Per-outcome action duration overrides
      const actionDurForOutcome = (outcome) => ({
        RECON_SUCCESS:   1500,
        RECON_NO_ENEMY:  1000,
        ATTACK_SUCCESS:  1600,
        ATTACK_NO_ENEMY: 1100,
        SHOT_DOWN:       1400,
        DAMAGED:         1300,
        RETURNED_SAFE:   950,
        MOVE:            0,
      }[outcome] ?? ACTION_DUR);

      const afterDrones = () => {
        setDroneAnimUnits([]);
        setTimeout(() => runMovePhase(moves, builds, exposes, combat, tech, expired, lost), 300);
      };

      // Phase 3: Crash / Neutralized (SHOT_DOWN) — or linger for DAMAGED
      const runDestroyPhase = () => {
        const terminal = droneAnims.filter(d => d.outcome === 'SHOT_DOWN' || d.outcome === 'DAMAGED');
        if (terminal.length === 0) { afterDrones(); return; }
        const dur = terminal.some(d => d.outcome === 'SHOT_DOWN') ? DESTROY_DUR : 700;
        setDroneAnimUnits(terminal.map(d => ({ ...d, phase: 3, progress: 0 })));
        const start = performance.now();
        const loop = (t) => {
          const p = Math.min((t - start) / dur, 1.0);
          setDroneAnimUnits(prev => prev.map(d => ({ ...d, progress: p })));
          if (p < 1.0) { rafId = requestAnimationFrame(loop); }
          else { afterDrones(); }
        };
        rafId = requestAnimationFrame(loop);
      };

      // Phase 2: Return to base — ALL surviving drones (RECON and ATTACK both fly home)
      const runReturnPhase = () => {
        const returning = droneAnims.filter(d => d.outcome !== 'SHOT_DOWN' && d.outcome !== 'MOVE');
        if (returning.length === 0) { runDestroyPhase(); return; }
        setDroneAnimUnits(returning.map(d => ({ ...d, phase: 2, progress: 0 })));
        const start = performance.now();
        // RECON drones return faster (850ms), ATTACK/DAMAGED take full 1100ms
        const loop = (t) => {
          setDroneAnimUnits(prev => prev.map(d => {
            const dur = (d.droneAction === 'RECON') ? 850 : RETURN_DUR;
            return { ...d, progress: Math.min((t - start) / dur, 1.0) };
          }));
          const maxP = (t - start) / RETURN_DUR;
          if (maxP < 1.0) { rafId = requestAnimationFrame(loop); }
          else { setTimeout(runDestroyPhase, 150); }
        };
        rafId = requestAnimationFrame(loop);
      };


      // Phase 1: Action at target city — outcome-specific animations
      const runActionPhase = () => {
        const actionAnims = droneAnims.filter(d => d.droneAction !== 'MOVE');
        if (actionAnims.length === 0) { runReturnPhase(); return; }
        const maxDur = Math.max(...actionAnims.map(d => actionDurForOutcome(d.outcome)));
        setDroneAnimUnits(actionAnims.map(d => ({ ...d, phase: 1, progress: 0 })));
        const start = performance.now();
        const loop = (t) => {
          setDroneAnimUnits(prev => prev.map(d => ({
            ...d,
            progress: Math.min((t - start) / actionDurForOutcome(d.outcome), 1.0)
          })));
          const globalP = (t - start) / maxDur;
          if (globalP < 1.0) { rafId = requestAnimationFrame(loop); }
          else { setTimeout(runReturnPhase, 200); }
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
        else { setTimeout(runActionPhase, 120); }
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


      {droneAnimUnits.map((m, idx) => {
        const baseCoords   = getPixelCoords(m.fromCity);
        const targetCoords = getPixelCoords(m.toCity);
        if (baseCoords.x === 0 || targetCoords.x === 0) return null;
        const sc       = isTacticalView ? 0.35 : 1;
        const iconSize = isTacticalView ? 4 : 18;
        const half     = iconSize / 2;
        const tx = targetCoords.x;
        const ty = targetCoords.y;

        /* ── Phase 0: Travel outbound ──────────────────────────────────────── */
        if (m.phase === 0) {
          const cx    = baseCoords.x + (tx - baseCoords.x) * m.progress;
          const cy    = baseCoords.y + (ty - baseCoords.y) * m.progress;
          const angle = Math.atan2(ty - baseCoords.y, tx - baseCoords.x) * 180 / Math.PI + 90;
          return (
            <g key={`drone-${idx}`}>
              <line x1={baseCoords.x} y1={baseCoords.y} x2={tx} y2={ty} stroke={m.color} strokeWidth={1.5*sc} strokeDasharray="3,4" opacity="0.28" />
              <line x1={baseCoords.x} y1={baseCoords.y} x2={cx} y2={cy} stroke={m.color} strokeWidth={2.2*sc} opacity="0.72" strokeLinecap="round" />
              <circle cx={cx} cy={cy} r={8*sc} fill={m.color} opacity={0.1} />
              <g transform={`translate(${cx},${cy}) rotate(${angle}) translate(${-half},${-half})`}>
                <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: m.color }) }} />
              </g>
              <circle cx={cx} cy={cy} r={5*sc} fill="none" stroke={m.color} strokeWidth={sc} opacity={0.5} />
            </g>
          );
        }

        /* ── Phase 1: Action at target — outcome-specific ──────────────────── */
        if (m.phase === 1) {
          const p      = m.progress;
          const orbitR = isTacticalView ? 4 : 22;

          /* RECON_SUCCESS — cyan rotating scan rings + INTEL LOCK */
          if (m.outcome === 'RECON_SUCCESS') {
            const r1  = orbitR * (0.5 + p * 0.5);
            const r2  = r1 * 0.62;
            const deg = p * 540;
            const bx  = tx + r1 * Math.cos(deg * Math.PI / 180);
            const by  = ty + r1 * Math.sin(deg * Math.PI / 180);
            const lop = p > 0.55 ? Math.min((p - 0.55) / 0.35, 1) : 0;
            return (
              <g key={`drone-${idx}`}>
                <circle cx={tx} cy={ty} r={r1} fill="none" stroke="#00f0ff" strokeWidth={isTacticalView?0.45:1.8} strokeDasharray={`${4*sc},${3*sc}`} opacity={0.72} transform={`rotate(${deg},${tx},${ty})`} />
                <circle cx={tx} cy={ty} r={r2} fill="none" stroke="#00f0ff" strokeWidth={isTacticalView?0.28:1.1} strokeDasharray={`${2*sc},${4*sc}`} opacity={0.44} transform={`rotate(${-deg*0.7},${tx},${ty})`} />
                <line x1={tx-r1*0.35} y1={ty} x2={tx+r1*0.35} y2={ty} stroke="#00f0ff" strokeWidth={0.8*sc} opacity={0.65} />
                <line x1={tx} y1={ty-r1*0.35} x2={tx} y2={ty+r1*0.35} stroke="#00f0ff" strokeWidth={0.8*sc} opacity={0.65} />
                <circle cx={bx} cy={by} r={2.8*sc} fill="#00f0ff" opacity={0.88} />
                <circle cx={bx} cy={by} r={5*sc} fill="none" stroke="#00f0ff" strokeWidth={0.6*sc} opacity={0.4} />
                <g transform={`translate(${tx-half},${ty-half})`} style={{animation:'drone-recon-hover 0.9s ease-in-out infinite'}}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#00f0ff' }) }} />
                </g>
                {lop > 0 && (
                  <g transform={`translate(${tx},${ty-r1-(isTacticalView?5:22)})`} opacity={lop}>
                    <rect x={isTacticalView?-16:-62} y={isTacticalView?-3.5:-14} width={isTacticalView?32:124} height={isTacticalView?7:22} fill="rgba(0,20,30,0.92)" stroke="#00f0ff" strokeWidth={isTacticalView?0.35:1.2} rx="3" />
                    <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#00f0ff" fontSize={isTacticalView?'2.2':'9'} fontFamily="monospace" fontWeight="bold">🔍 RECON SUCCESS</text>
                  </g>
                )}
              </g>
            );
          }

          /* RECON_NO_ENEMY — soft green pulse + SECTOR CLEAR */
          if (m.outcome === 'RECON_NO_ENEMY') {
            const r1  = orbitR * (0.5 + p * 0.5);
            const lop = p > 0.6 ? Math.min((p - 0.6) / 0.3, 1) : 0;
            return (
              <g key={`drone-${idx}`}>
                <circle cx={tx} cy={ty} r={r1} fill="rgba(110,231,183,0.07)" stroke="#6ee7b7" strokeWidth={isTacticalView?0.38:1.5} strokeDasharray={`${3*sc},${3*sc}`} opacity={0.7-p*0.3} />
                <circle cx={tx} cy={ty} r={r1*0.5} fill="none" stroke="#6ee7b7" strokeWidth={isTacticalView?0.22:0.9} opacity={0.38} />
                <line x1={tx-4*sc} y1={ty} x2={tx-1*sc} y2={ty+3.5*sc} stroke="#6ee7b7" strokeWidth={1.4*sc} strokeLinecap="round" opacity={0.85} />
                <line x1={tx-1*sc} y1={ty+3.5*sc} x2={tx+5*sc} y2={ty-4*sc} stroke="#6ee7b7" strokeWidth={1.4*sc} strokeLinecap="round" opacity={0.85} />
                <g transform={`translate(${tx-half},${ty-half})`} style={{animation:'drone-recon-hover 1.1s ease-in-out infinite'}}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#6ee7b7' }) }} />
                </g>
                {lop > 0 && (
                  <g transform={`translate(${tx},${ty-r1-(isTacticalView?4.5:20)})`} opacity={lop}>
                    <rect x={isTacticalView?-14:-55} y={isTacticalView?-3.5:-14} width={isTacticalView?28:110} height={isTacticalView?7:22} fill="rgba(0,18,10,0.9)" stroke="#6ee7b7" strokeWidth={isTacticalView?0.35:1.1} rx="3" />
                    <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#6ee7b7" fontSize={isTacticalView?'2.1':'8.5'} fontFamily="monospace" fontWeight="bold">✅ SECTOR CLEAR</text>
                  </g>
                )}
              </g>
            );
          }

          /* ATTACK_SUCCESS — orange firestorm blast + STRIKE CONFIRMED */
          if (m.outcome === 'ATTACK_SUCCESS') {
            const br   = orbitR * (0.3 + p * 1.5);
            const ir   = br * 0.52;
            const cr   = br * 0.22;
            const flk  = 0.5 + 0.5 * Math.sin(p * Math.PI * 10);
            const lop  = p > 0.4 ? Math.min((p - 0.4) / 0.35, 1) : 0;
            const angs = [0,0.52,1.05,1.57,2.09,2.62,3.14,3.67,4.19,4.71,5.24,5.76];
            return (
              <g key={`drone-${idx}`}>
                <circle cx={tx} cy={ty} r={br} fill="rgba(255,152,0,0.13)"  stroke="#ff9800" strokeWidth={isTacticalView?0.55:2.5} opacity={1-p*0.75} />
                <circle cx={tx} cy={ty} r={ir} fill="rgba(255,69,0,0.28)"   stroke="#ff4500" strokeWidth={isTacticalView?0.42:1.8} opacity={1-p*0.55} />
                <circle cx={tx} cy={ty} r={cr} fill="rgba(255,255,80,0.6)"  stroke="#ffff00" strokeWidth={isTacticalView?0.3:1.2}  opacity={flk} />
                <circle cx={tx} cy={ty} r={cr*0.45} fill="#ffffff" opacity={flk*0.7} />
                {angs.map((a,i) => (
                  <circle key={i} cx={tx+br*0.9*Math.cos(a)} cy={ty+br*0.9*Math.sin(a)}
                    r={(2.5+(i%3)*0.8)*sc} fill={i%3===0?'#ffcc00':i%3===1?'#ff6500':'#ff3b30'} opacity={(1-p)*0.85} />
                ))}
                <g transform={`translate(${tx-half},${ty-half})`} style={{animation:'drone-attack-bounce 1.1s cubic-bezier(0.36,0.07,0.19,0.97) infinite'}}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#ff9800' }) }} />
                </g>
                {lop > 0 && (
                  <g transform={`translate(${tx},${ty-br-(isTacticalView?5:20)})`} opacity={lop}>
                    <rect x={isTacticalView?-18:-68} y={isTacticalView?-3.5:-14} width={isTacticalView?36:136} height={isTacticalView?7:22} fill="rgba(28,8,0,0.92)" stroke="#ff9800" strokeWidth={isTacticalView?0.35:1.2} rx="3" />
                    <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#ff9800" fontSize={isTacticalView?'2.2':'9'} fontFamily="monospace" fontWeight="bold">🎯 STRIKE CONFIRMED</text>
                  </g>
                )}
              </g>
            );
          }

          /* ATTACK_NO_ENEMY — yellow miss rings + X + NO TARGET FOUND */
          if (m.outcome === 'ATTACK_NO_ENEMY') {
            const mr  = orbitR * (0.5 + p * 0.8);
            const lop = p > 0.6 ? Math.min((p - 0.6) / 0.3, 1) : 0;
            return (
              <g key={`drone-${idx}`}>
                <circle cx={tx} cy={ty} r={mr}      fill="rgba(250,204,21,0.08)" stroke="#facc15" strokeWidth={isTacticalView?0.42:1.8} strokeDasharray={`${5*sc},${3*sc}`} opacity={0.8-p*0.5} />
                <circle cx={tx} cy={ty} r={mr*0.55} fill="none" stroke="#facc15" strokeWidth={isTacticalView?0.25:1} opacity={0.38-p*0.28} />
                <line x1={tx-6*sc} y1={ty-6*sc} x2={tx+6*sc} y2={ty+6*sc} stroke="#facc15" strokeWidth={isTacticalView?0.65:2.8} strokeLinecap="round" opacity={0.85} />
                <line x1={tx+6*sc} y1={ty-6*sc} x2={tx-6*sc} y2={ty+6*sc} stroke="#facc15" strokeWidth={isTacticalView?0.65:2.8} strokeLinecap="round" opacity={0.85} />
                <g transform={`translate(${tx-half},${ty-half})`} style={{animation:'drone-recon-hover 0.8s ease-in-out infinite'}}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#facc15' }) }} />
                </g>
                {lop > 0 && (
                  <g transform={`translate(${tx},${ty-mr-(isTacticalView?4.5:20)})`} opacity={lop}>
                    <rect x={isTacticalView?-17:-66} y={isTacticalView?-3.5:-14} width={isTacticalView?34:132} height={isTacticalView?7:22} fill="rgba(28,22,0,0.92)" stroke="#facc15" strokeWidth={isTacticalView?0.35:1.1} rx="3" />
                    <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#facc15" fontSize={isTacticalView?'2.1':'8.5'} fontFamily="monospace" fontWeight="bold">⚠️ NO TARGET FOUND</text>
                  </g>
                )}
              </g>
            );
          }

          /* SHOT_DOWN — red alarm pulse + spinning + INTERCEPTED */
          if (m.outcome === 'SHOT_DOWN') {
            const ar  = orbitR * (0.45 + p * 0.7);
            const flk = Math.abs(Math.sin(p * Math.PI * 7));
            const deg = p * 360;
            return (
              <g key={`drone-${idx}`}>
                <circle cx={tx} cy={ty} r={ar}      fill="rgba(255,59,48,0.15)"  stroke="#ff3b30" strokeWidth={isTacticalView?0.5:2.5} opacity={0.88-p*0.35} />
                <circle cx={tx} cy={ty} r={ar*0.52} fill="rgba(255,59,48,0.22)"  stroke="#ff3b30" strokeWidth={isTacticalView?0.32:1.5} opacity={flk*0.9} />
                <g transform={`translate(${tx},${ty}) rotate(${deg}) translate(${-half},${-half})`}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#ff3b30' }) }} />
                </g>
                <g transform={`translate(${tx},${ty-ar-(isTacticalView?4.5:20)})`} opacity={Math.min(p*3,1)}>
                  <rect x={isTacticalView?-15:-60} y={isTacticalView?-3.5:-14} width={isTacticalView?30:120} height={isTacticalView?7:22} fill="rgba(28,0,0,0.94)" stroke="#ff3b30" strokeWidth={isTacticalView?0.35:1.2} rx="3" />
                  <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#ff3b30" fontSize={isTacticalView?'2.1':'9'} fontFamily="monospace" fontWeight="bold">🚨 INTERCEPTED</text>
                </g>
              </g>
            );
          }

          /* DAMAGED — amber flicker rings + wobbly + DRONE DAMAGED */
          if (m.outcome === 'DAMAGED') {
            const dr  = orbitR * (0.42 + p * 0.5);
            const flk = 0.5 + 0.5 * Math.abs(Math.sin(p * Math.PI * 6));
            const wb  = Math.sin(p * Math.PI * 5) * 20;
            const lop = p > 0.5 ? Math.min((p - 0.5) / 0.35, 1) : 0;
            return (
              <g key={`drone-${idx}`}>
                <circle cx={tx} cy={ty} r={dr}      fill="rgba(249,115,22,0.12)" stroke="#f97316" strokeWidth={isTacticalView?0.42:2} strokeDasharray={`${3*sc},${2*sc}`} opacity={flk} />
                <circle cx={tx} cy={ty} r={dr*0.55} fill="none" stroke="#f97316" strokeWidth={isTacticalView?0.25:1} opacity={flk*0.55} />
                {[0.5,1.5,2.5,3.5,4.5].map((a,i) => (
                  <circle key={i} cx={tx+dr*0.7*Math.cos(a+p*4)} cy={ty+dr*0.7*Math.sin(a+p*4)} r={2*sc} fill="#f97316" opacity={flk*0.8} />
                ))}
                <g transform={`translate(${tx},${ty}) rotate(${wb}) translate(${-half},${-half})`}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#f97316' }) }} />
                </g>
                {lop > 0 && (
                  <g transform={`translate(${tx},${ty-dr-(isTacticalView?4.5:20)})`} opacity={lop}>
                    <rect x={isTacticalView?-16:-64} y={isTacticalView?-3.5:-14} width={isTacticalView?32:128} height={isTacticalView?7:22} fill="rgba(28,10,0,0.92)" stroke="#f97316" strokeWidth={isTacticalView?0.35:1.1} rx="3" />
                    <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#f97316" fontSize={isTacticalView?'2.1':'8.5'} fontFamily="monospace" fontWeight="bold">⚡ DRONE DAMAGED</text>
                  </g>
                )}
              </g>
            );
          }

          /* RETURNED_SAFE / MOVE fallback — colored hover */
          {
            const anim = m.droneAction === 'RECON'
              ? 'drone-recon-hover 0.9s ease-in-out infinite'
              : 'drone-attack-bounce 1.1s cubic-bezier(0.36,0.07,0.19,0.97) infinite';
            return (
              <g key={`drone-${idx}`}>
                <circle cx={tx} cy={ty} r={orbitR} fill="none" stroke={m.color} strokeWidth={isTacticalView?0.32:1.3} strokeDasharray={isTacticalView?'0.6,0.6':'3,3'} opacity="0.55" />
                <g transform={`translate(${tx-half},${ty-half})`} style={{animation:anim}}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: m.color }) }} />
                </g>
              </g>
            );
          }
        }

        /* ── Phase 2: Return flight — outcome-styled ───────────────────────── */
        if (m.phase === 2) {
          const cx    = tx + (baseCoords.x - tx) * m.progress;
          const cy    = ty + (baseCoords.y - ty) * m.progress;
          const angle = Math.atan2(baseCoords.y - ty, baseCoords.x - tx) * 180 / Math.PI + 90;

          /* DAMAGED: amber limp + smoke puffs */
          if (m.outcome === 'DAMAGED') {
            const sx = cx + (isTacticalView?1.5:6) * Math.sin(m.progress * 16);
            const sy = cy + (isTacticalView?0.8:3.5);
            return (
              <g key={`drone-${idx}`}>
                <circle cx={sx} cy={sy+(isTacticalView?1.5:6)} r={2.5*sc} fill="#555" opacity={0.38*(1-m.progress)} />
                <circle cx={sx-(isTacticalView?1.2:5)} cy={sy+(isTacticalView?2.5:11)} r={1.8*sc} fill="#f97316" opacity={0.28*(1-m.progress)} />
                <line x1={tx} y1={ty} x2={cx} y2={cy} stroke="#f97316" strokeWidth={1.6*sc} opacity={0.55} strokeDasharray={`${2*sc},${3*sc}`} />
                <g transform={`translate(${cx},${cy}) rotate(${angle+Math.sin(m.progress*Math.PI*7)*18}) translate(${-half},${-half})`}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#f97316' }) }} />
                </g>
              </g>
            );
          }

          /* ATTACK_SUCCESS: clean orange return */
          if (m.outcome === 'ATTACK_SUCCESS') {
            return (
              <g key={`drone-${idx}`}>
                <line x1={tx} y1={ty} x2={cx} y2={cy} stroke="#ff9800" strokeWidth={1.8*sc} opacity={0.55} strokeDasharray={`${3*sc},${3*sc}`} />
                <circle cx={cx} cy={cy} r={4.5*sc} fill="#ff9800" opacity={0.18} />
                <g transform={`translate(${cx},${cy}) rotate(${angle}) translate(${-half},${-half})`}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#ff9800' }) }} />
                </g>
              </g>
            );
          }

          /* RECON_SUCCESS: cyan mission-complete return with glowing trail */
          if (m.outcome === 'RECON_SUCCESS') {
            const glowOp = m.progress * 0.35;
            return (
              <g key={`drone-${idx}`}>
                <line x1={tx} y1={ty} x2={cx} y2={cy} stroke="#00f0ff" strokeWidth={1.8*sc} opacity={0.55} strokeDasharray={`${4*sc},${3*sc}`} />
                <circle cx={cx} cy={cy} r={7*sc} fill="none" stroke="#00f0ff" strokeWidth={isTacticalView?0.4:1.5} opacity={glowOp*2} />
                <circle cx={cx} cy={cy} r={4*sc} fill="#00f0ff" opacity={glowOp} />
                <g transform={`translate(${cx},${cy}) rotate(${angle}) translate(${-half},${-half})`}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#00f0ff' }) }} />
                </g>
              </g>
            );
          }

          /* RECON_NO_ENEMY: soft green return — sector was clear */
          if (m.outcome === 'RECON_NO_ENEMY') {
            return (
              <g key={`drone-${idx}`}>
                <line x1={tx} y1={ty} x2={cx} y2={cy} stroke="#6ee7b7" strokeWidth={1.6*sc} opacity={0.45} strokeDasharray={`${4*sc},${3*sc}`} />
                <circle cx={cx} cy={cy} r={4*sc} fill="#6ee7b7" opacity={m.progress * 0.25} />
                <g transform={`translate(${cx},${cy}) rotate(${angle}) translate(${-half},${-half})`}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#6ee7b7' }) }} />
                </g>
              </g>
            );
          }

          /* Default return (ATTACK_NO_ENEMY / RETURNED_SAFE) */
          return (
            <g key={`drone-${idx}`}>
              <line x1={tx} y1={ty} x2={cx} y2={cy} stroke={m.color} strokeWidth={1.6*sc} opacity={0.5} strokeDasharray={`${3*sc},${3*sc}`} />
              <g transform={`translate(${cx},${cy}) rotate(${angle}) translate(${-half},${-half})`}>
                <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: m.color }) }} />
              </g>
            </g>
          );
        }

        /* ── Phase 3: Terminal — SHOT_DOWN fireball | DAMAGED spark linger ─── */
        if (m.phase === 3) {
          const p = m.progress;

          /* SHOT_DOWN — cinematic fireball crash */
          if (m.outcome === 'SHOT_DOWN') {
            const eR  = (isTacticalView?11:46) * p;
            const pY  = (isTacticalView?16:60) * p;
            const deg = p * 1080;
            const sOp = Math.max(0, 0.95 - p * 0.72);
            const fOp = p > 0.32 ? Math.max(0, 1-(p-0.32)*2.4) : p*3.0;
            const ffk = Math.abs(Math.sin(p * Math.PI * 12));
            const sa  = [0,0.52,1.05,1.57,2.09,2.62,3.14,3.67,4.19,4.71,5.24,5.76];
            return (
              <g key={`drone-crash-${idx}`}>
                {/* Zigzag fire trail */}
                {[0,1,2,3,4].map(i => {
                  const fy  = p*i*0.22; const fx  = Math.sin(p*9+i)*(isTacticalView?3.5:12);
                  const fy2 = p*(i+1)*0.22; const fx2 = Math.sin(p*9+i+1)*(isTacticalView?3.5:12);
                  return <line key={i} x1={tx+fx} y1={ty+pY*fy} x2={tx+fx2} y2={ty+pY*fy2}
                    stroke={i%2===0?'#ff4500':'#cc2200'} strokeWidth={isTacticalView?1.5:5.5}
                    strokeLinecap="round" opacity={sOp*(1-i*0.15)} />;
                })}
                {/* Smoke column */}
                <line x1={tx} y1={ty} x2={tx+(isTacticalView?1.5:5)*Math.cos(p*13)} y2={ty+pY} stroke="#1a1a1a" strokeWidth={isTacticalView?3.5:12} strokeLinecap="round" opacity={sOp*0.5} />
                {/* Blast rings */}
                <circle cx={tx} cy={ty+pY} r={eR}       fill="rgba(255,59,48,0.18)"   stroke="#ff3b30" strokeWidth={isTacticalView?0.7:3.2} opacity={1-p} />
                <circle cx={tx} cy={ty+pY} r={eR*0.62}  fill="rgba(255,100,0,0.28)"   stroke="#ff6500" strokeWidth={isTacticalView?0.5:2.2} opacity={fOp} />
                <circle cx={tx} cy={ty+pY} r={eR*0.32}  fill="rgba(255,255,80,0.58)"  stroke="#ffff00" strokeWidth={isTacticalView?0.32:1.5} opacity={fOp*ffk} />
                <circle cx={tx} cy={ty+pY} r={eR*0.13}  fill="#ffffff" opacity={fOp*0.88} />
                {/* Spark burst */}
                {sa.map((a,i) => (
                  <circle key={i} cx={tx+eR*0.88*Math.cos(a)} cy={ty+pY+eR*0.88*Math.sin(a)}
                    r={(2.8+(i%3)*0.9)*sc} fill={i%3===0?'#ffff00':i%3===1?'#ff6500':'#ff3b30'} opacity={(1-p)*0.92} />
                ))}
                {/* Spinning falling drone */}
                <g transform={`translate(${tx},${ty+pY}) rotate(${deg}) translate(${-half},${-half})`}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize*1.15, color: '#ff3b30' }) }} />
                </g>
                {/* DRONE DOWN banner */}
                <g transform={`translate(${tx},${ty-(isTacticalView?7:32)})`} opacity={Math.max(0, 1-p*2.0)}>
                  <rect x={isTacticalView?-15:-60} y={isTacticalView?-3.5:-14} width={isTacticalView?30:120} height={isTacticalView?7:24} fill="rgba(22,0,0,0.94)" stroke="#ff3b30" strokeWidth={isTacticalView?0.35:1.5} rx="3" />
                  <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#ff3b30" fontSize={isTacticalView?'2.2':'9.5'} fontFamily="monospace" fontWeight="bold">💥 DRONE DOWN</text>
                </g>
              </g>
            );
          }

          /* DAMAGED — amber sparks + RETURNING DAMAGED */
          if (m.outcome === 'DAMAGED') {
            const cx  = tx + (baseCoords.x - tx) * p * 0.6;
            const cy  = ty + (baseCoords.y - ty) * p * 0.6;
            const flk = 0.5 + 0.5 * Math.abs(Math.sin(p * Math.PI * 9));
            const sr  = (isTacticalView?5:20) * (0.4 + p * 0.6);
            const wb  = Math.sin(p * Math.PI * 8) * 22;
            return (
              <g key={`drone-damaged-${idx}`}>
                {[0.4,1.3,2.2,3.1,4.0,5.0].map((a,i) => (
                  <circle key={i} cx={cx+sr*Math.cos(a+p*7)} cy={cy+sr*Math.sin(a+p*7)}
                    r={(2.2+(i%2)*0.8)*sc} fill={i%2===0?'#f97316':'#facc15'} opacity={flk*(1-p*0.4)} />
                ))}
                <circle cx={cx} cy={cy} r={(isTacticalView?7:26)*(0.35+p*0.35)} fill="rgba(249,115,22,0.1)" stroke="#f97316" strokeWidth={isTacticalView?0.4:1.6} strokeDasharray={`${2*sc},${2*sc}`} opacity={flk*0.65} />
                <g transform={`translate(${cx},${cy}) rotate(${wb}) translate(${-half},${-half})`}>
                  <g dangerouslySetInnerHTML={{ __html: droneIconHtml({ size: iconSize, color: '#f97316' }) }} />
                </g>
                <g transform={`translate(${cx},${cy-(isTacticalView?7.5:32)})`} opacity={Math.min(p*3.5,0.92)}>
                  <rect x={isTacticalView?-18:-72} y={isTacticalView?-3.5:-14} width={isTacticalView?36:144} height={isTacticalView?7:22} fill="rgba(28,10,0,0.92)" stroke="#f97316" strokeWidth={isTacticalView?0.35:1.1} rx="3" />
                  <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#f97316" fontSize={isTacticalView?'2.1':'8.5'} fontFamily="monospace" fontWeight="bold">⚡ RETURNING DAMAGED</text>
                </g>
              </g>
            );
          }
        }

        return null;
      })}


      {/* Drone Repair Complete SVG Animation Overlay */}
      {(session?.drones || []).filter(d => d.status === 'ACTIVE' && (session?.discoveredClues || []).some(c => c.turnDiscovered === session?.currentTurn && c.source === 'DRONE_SERVICED' && c.clueText?.includes(`Drone #${d.id}`))).map(d => {
        const center = getPixelCoords(d.currentCity);
        if (center.x === 0) return null;
        const sc = isTacticalView ? 0.2 : 1;
        return (
          <g key={`drone-repaired-${d.id}`}>
            <circle cx={center.x} cy={center.y} r={isTacticalView ? 8 : 36} fill="rgba(0, 255, 102, 0.15)" stroke="#00ff66" strokeWidth={isTacticalView ? 0.4 : 2} strokeDasharray="3,3">
              <animate attributeName="r" values={isTacticalView ? "4;10;4" : "18;42;18"} dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
            </circle>
            <g transform={`translate(${center.x}, ${center.y - (isTacticalView ? 7 : 32)})`}>
              <rect x={isTacticalView ? -14 : -60} y={isTacticalView ? -3 : -14} width={isTacticalView ? 28 : 120} height={isTacticalView ? 6 : 22} fill="rgba(6, 20, 12, 0.9)" stroke="#00ff66" strokeWidth={isTacticalView ? 0.3 : 1} rx="4" />
              <text x="0" y={isTacticalView ? 1 : 1} textAnchor="middle" fill="#00ff66" fontSize={isTacticalView ? '2.2' : '9.5'} fontFamily="monospace" fontWeight="bold">
                🛠️ REPAIR COMPLETE
              </text>
            </g>
          </g>
        );
      })}
      {buildingSafehouses.map((b, idx) => {
        const center = getPixelCoords(b.cityId);
        if (center.x === 0) return null;
        const color = (b.ownerFaction === 'HOSTILE') ? '#ff3b30' : '#00f0ff';
        const sc = isTacticalView ? 0.22 : 1;
        const maxR = isTacticalView ? 10 : 46;
        const r1 = maxR * (1 - b.progress * 0.72);
        const r2 = r1 * 0.6;
        const ringOpacity = Math.max(0, 1 - b.progress * 0.85);
        const glowR = (isTacticalView ? 2 : 8) * b.progress;
        const bkt = r1 * 0.45;
        const bktW = isTacticalView ? 0.35 : 1.5;
        const scanDeg = b.progress * 540;
        return (
          <g key={`build-${idx}`}>
            {/* Contracting outer dashed scan ring */}
            <circle cx={center.x} cy={center.y} r={r1} fill="rgba(0,240,255,0.06)" stroke={color}
              strokeWidth={isTacticalView ? 0.45 : 1.8} strokeDasharray={`${4 * sc},${3 * sc}`} opacity={ringOpacity}
              transform={`rotate(${scanDeg},${center.x},${center.y})`} />
            {/* Inner Contracting Ring */}
            <circle cx={center.x} cy={center.y} r={r2} fill="none" stroke={color}
              strokeWidth={isTacticalView ? 0.28 : 1.2} strokeDasharray={`${2 * sc},${2 * sc}`} opacity={ringOpacity * 0.65}
              transform={`rotate(${-scanDeg * 0.8},${center.x},${center.y})`} />
            {/* L-bracket Corner Reticle Marks */}
            {[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx, sy], i) => (
              <g key={i}>
                <line x1={center.x + sx * r1} y1={center.y + sy * r1}
                      x2={center.x + sx * (r1 - bkt)} y2={center.y + sy * r1}
                      stroke={color} strokeWidth={bktW} strokeLinecap="round" opacity={ringOpacity * 0.9} />
                <line x1={center.x + sx * r1} y1={center.y + sy * r1}
                      x2={center.x + sx * r1} y2={center.y + sy * (r1 - bkt)}
                      stroke={color} strokeWidth={bktW} strokeLinecap="round" opacity={ringOpacity * 0.9} />
              </g>
            ))}
            {/* Center tactical energy core glow */}
            <circle cx={center.x} cy={center.y} r={glowR} fill={color} opacity={b.progress * 0.4} />
            <circle cx={center.x} cy={center.y} r={glowR * 0.5} fill="#ffffff" opacity={b.progress * 0.6} />
            {/* Construction Label */}
            <g transform={`translate(${center.x},${center.y - r1 - (isTacticalView ? 2 : 8)})`}>
              <rect x={isTacticalView ? -16 : -68} y={isTacticalView ? -3 : -12} width={isTacticalView ? 32 : 136} height={isTacticalView ? 6 : 20} fill="rgba(0,20,30,0.92)" stroke={color} strokeWidth={isTacticalView ? 0.3 : 1} rx="3" opacity={ringOpacity * 0.9} />
              <text x="0" y={isTacticalView ? 1.5 : 1.5} textAnchor="middle" fill={color} fontSize={isTacticalView ? '2' : '8.5'} fontFamily="monospace" fontWeight="bold" opacity={ringOpacity * 0.95} letterSpacing="0.08em">
                🛠️ CONSTRUCTING SAFEHOUSE
              </text>
            </g>
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
      {combatAlerts.map((ca, idx) => {
        // ── Phase 0: Troop travel to target ──────────────────────────────
        if (ca.phase === 0 && ca.fromCity) {
          const from = getPixelCoords(ca.fromCity);
          const to   = getPixelCoords(ca.cityId);
          if (from.x === 0 || to.x === 0) return null;
          const cx    = from.x + (to.x - from.x) * ca.progress;
          const cy    = from.y + (to.y - from.y) * ca.progress;
          const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
          const sc    = isTacticalView ? 0.35 : 1;
          const iSz   = isTacticalView ? 4 : 18;
          return (
            <g key={`combat-travel-${idx}`}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={ca.color} strokeWidth={1.5*sc} strokeDasharray={`${3*sc},${3*sc}`} opacity={0.28} />
              <line x1={from.x} y1={from.y} x2={cx} y2={cy} stroke={ca.color} strokeWidth={2.2*sc} opacity={0.72} strokeLinecap="round" />
              <circle cx={cx} cy={cy} r={7*sc} fill={ca.color} opacity={0.12} />
              <g transform={`translate(${cx},${cy}) rotate(${angle}) translate(${-iSz/2},${-iSz/2})`}>
                <g dangerouslySetInnerHTML={{ __html: combatTeamIconHtml({ size: iSz, color: ca.color }) }} />
              </g>
            </g>
          );
        }

        // ── Phase 1 & 2: Action & Linger at battle city ──────────────────
        const center = getPixelCoords(ca.cityId);
        if (center.x === 0) return null;
        const sc  = isTacticalView ? 0.22 : 1;
        const p   = ca.progress;
        const phs = ca.phase; // 1=action, 2=linger
        const lop = phs === 2 ? 1 - p : 1; // overall fade in linger phase
        const tx  = center.x, ty = center.y;
        const pulse  = Math.abs(Math.sin(p * Math.PI * 7));
        const flk    = 0.5 + 0.5 * pulse;

        /* ── COMBAT_VICTORY — gold starburst + 12 particle burst ── */
        if (ca.outcome === 'COMBAT_VICTORY') {
          const br  = (isTacticalView?10:44) * (0.25 + p * 0.75);
          const ir  = br * 0.55;
          const cr  = br * 0.22;
          const sa  = Array.from({length:12}, (_,i) => i * Math.PI / 6);
          const bop = p > 0.35 ? Math.min((p-0.35)/0.3, 1) : 0;
          return (
            <g key={`combat-${idx}`} opacity={lop}>
              {/* Outer gold blast ring */}
              <circle cx={tx} cy={ty} r={br}   fill="rgba(251,191,36,0.1)" stroke="#fbbf24" strokeWidth={isTacticalView?0.7:3.2} opacity={(1-p)*0.9} />
              <circle cx={tx} cy={ty} r={ir}   fill="rgba(251,191,36,0.2)" stroke="#fde68a" strokeWidth={isTacticalView?0.5:2.2} opacity={(1-p*0.6)*0.85} />
              <circle cx={tx} cy={ty} r={cr}   fill="rgba(255,255,180,0.7)" stroke="#fff" strokeWidth={isTacticalView?0.3:1.3} opacity={flk} />
              <circle cx={tx} cy={ty} r={cr*0.4} fill="#ffffff" opacity={flk*0.85} />
              {/* 12-particle starburst */}
              {sa.map((a,i) => (
                <g key={i}>
                  <line x1={tx+cr*0.5*Math.cos(a)} y1={ty+cr*0.5*Math.sin(a)}
                        x2={tx+br*0.92*Math.cos(a)} y2={ty+br*0.92*Math.sin(a)}
                        stroke={i%3===0?'#fbbf24':i%3===1?'#fde68a':'#ff9800'}
                        strokeWidth={(1.8+(i%2)*0.8)*sc} strokeLinecap="round"
                        opacity={(1-p)*0.9} />
                  <circle cx={tx+br*0.9*Math.cos(a)} cy={ty+br*0.9*Math.sin(a)}
                    r={(2.5+(i%3)*0.7)*sc} fill={i%3===0?'#fbbf24':'#fff'} opacity={(1-p)*0.85} />
                </g>
              ))}
              {/* NEUTRALIZED banner */}
              {bop > 0 && (
                <g transform={`translate(${tx},${ty-br-(isTacticalView?5:24)})`} opacity={bop*lop}>
                  <rect x={isTacticalView?-18:-72} y={isTacticalView?-3.5:-14} width={isTacticalView?36:144} height={isTacticalView?7:24} fill="rgba(30,20,0,0.94)" stroke="#fbbf24" strokeWidth={isTacticalView?0.35:1.4} rx="3" />
                  <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#fbbf24" fontSize={isTacticalView?'2.2':'9.5'} fontFamily="monospace" fontWeight="bold">🏆 ALL NEUTRALIZED</text>
                </g>
              )}
            </g>
          );
        }

        /* ── COMBAT_PARTIAL — amber dual rings + sparks ── */
        if (ca.outcome === 'COMBAT_PARTIAL') {
          const r1  = (isTacticalView?8:36) * (0.3 + p * 0.7);
          const r2  = r1 * 0.52;
          const spR = r1 * 0.82;
          const bop = p > 0.45 ? Math.min((p-0.45)/0.3, 1) : 0;
          const spks = [0,1.05,2.09,3.14,4.19,5.24];
          return (
            <g key={`combat-${idx}`} opacity={lop}>
              <circle cx={tx} cy={ty} r={r1} fill="rgba(249,115,22,0.1)" stroke="#f97316" strokeWidth={isTacticalView?0.55:2.5} opacity={(1-p)*0.9} />
              <circle cx={tx} cy={ty} r={r2} fill="rgba(249,115,22,0.18)" stroke="#fb923c" strokeWidth={isTacticalView?0.35:1.6} strokeDasharray={`${2*sc},${2*sc}`} opacity={flk*0.8} />
              {spks.map((a,i) => (
                <circle key={i} cx={tx+spR*Math.cos(a+p*3)} cy={ty+spR*Math.sin(a+p*3)}
                  r={(2.2+(i%2)*0.6)*sc} fill={i%2===0?'#f97316':'#facc15'} opacity={flk*(1-p*0.5)} />
              ))}
              <circle cx={tx} cy={ty} r={(isTacticalView?1.5:5)*flk} fill="#f97316" opacity={flk*0.7} />
              {bop > 0 && (
                <g transform={`translate(${tx},${ty-r1-(isTacticalView?4.5:22)})`} opacity={bop*lop}>
                  <rect x={isTacticalView?-18:-72} y={isTacticalView?-3.5:-14} width={isTacticalView?36:144} height={isTacticalView?7:24} fill="rgba(28,10,0,0.93)" stroke="#f97316" strokeWidth={isTacticalView?0.35:1.2} rx="3" />
                  <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#f97316" fontSize={isTacticalView?'2.1':'9'} fontFamily="monospace" fontWeight="bold">⚡ SUSPECT ESCAPED</text>
                </g>
              )}
            </g>
          );
        }

        /* ── SAFEHOUSE_RAIDED — orange lock-break rotation + flash ── */
        if (ca.outcome === 'SAFEHOUSE_RAIDED') {
          const r1  = (isTacticalView?9:40) * (0.3 + p * 0.7);
          const deg = p * 720;
          const bop = p > 0.4 ? Math.min((p-0.4)/0.3, 1) : 0;
          const sa  = [0, 0.79, 1.57, 2.36, 3.14, 3.93, 4.71, 5.50];
          return (
            <g key={`combat-${idx}`} opacity={lop}>
              {/* Rotating orange segmented ring */}
              {sa.map((a,i) => (
                <line key={i}
                  x1={tx + r1*0.55*Math.cos(a+deg*Math.PI/180)} y1={ty + r1*0.55*Math.sin(a+deg*Math.PI/180)}
                  x2={tx + r1*Math.cos(a+deg*Math.PI/180)}       y2={ty + r1*Math.sin(a+deg*Math.PI/180)}
                  stroke={i%2===0?'#ff9800':'#ff6500'} strokeWidth={(1.8+(i%2)*0.6)*sc} strokeLinecap="round"
                  opacity={(1-p*0.5)*0.9} />
              ))}
              <circle cx={tx} cy={ty} r={r1} fill="rgba(255,152,0,0.08)" stroke="#ff9800" strokeWidth={isTacticalView?0.45:2} opacity={(1-p)*0.8} />
              <circle cx={tx} cy={ty} r={r1*0.3} fill="rgba(255,200,50,0.5)" stroke="#fde68a" strokeWidth={isTacticalView?0.3:1.2} opacity={flk*0.75} />
              <circle cx={tx} cy={ty} r={(isTacticalView?1.5:5)*flk} fill="#ffffff" opacity={flk*0.6} />
              {bop > 0 && (
                <g transform={`translate(${tx},${ty-r1-(isTacticalView?4.5:22)})`} opacity={bop*lop}>
                  <rect x={isTacticalView?-20:-80} y={isTacticalView?-3.5:-14} width={isTacticalView?40:160} height={isTacticalView?7:24} fill="rgba(28,8,0,0.93)" stroke="#ff9800" strokeWidth={isTacticalView?0.35:1.2} rx="3" />
                  <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#ff9800" fontSize={isTacticalView?'2.1':'9'} fontFamily="monospace" fontWeight="bold">🏚️ SAFEHOUSE DESTROYED</text>
                </g>
              )}
            </g>
          );
        }

        /* ── RAID_EMPTY — yellow dashed shimmer + X + LOCATION EMPTY ── */
        if (ca.outcome === 'RAID_EMPTY') {
          const r1  = (isTacticalView?8:34) * (0.4 + p * 0.6);
          const bop = p > 0.5 ? Math.min((p-0.5)/0.35, 1) : 0;
          return (
            <g key={`combat-${idx}`} opacity={lop}>
              <circle cx={tx} cy={ty} r={r1} fill="rgba(250,204,21,0.07)" stroke="#facc15" strokeWidth={isTacticalView?0.42:1.9} strokeDasharray={`${5*sc},${3*sc}`} opacity={(1-p)*0.85} />
              <circle cx={tx} cy={ty} r={r1*0.55} fill="none" stroke="#facc15" strokeWidth={isTacticalView?0.25:1.1} opacity={(1-p)*0.4} />
              {/* Bold question / X shimmer */}
              <line x1={tx-5*sc} y1={ty-5*sc} x2={tx+5*sc} y2={ty+5*sc} stroke="#facc15" strokeWidth={isTacticalView?0.6:2.8} strokeLinecap="round" opacity={flk*0.88} />
              <line x1={tx+5*sc} y1={ty-5*sc} x2={tx-5*sc} y2={ty+5*sc} stroke="#facc15" strokeWidth={isTacticalView?0.6:2.8} strokeLinecap="round" opacity={flk*0.88} />
              {bop > 0 && (
                <g transform={`translate(${tx},${ty-r1-(isTacticalView?4:20)})`} opacity={bop*lop}>
                  <rect x={isTacticalView?-17:-68} y={isTacticalView?-3.5:-14} width={isTacticalView?34:136} height={isTacticalView?7:24} fill="rgba(28,22,0,0.93)" stroke="#facc15" strokeWidth={isTacticalView?0.35:1.1} rx="3" />
                  <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#facc15" fontSize={isTacticalView?'2.1':'9'} fontFamily="monospace" fontWeight="bold">❓ LOCATION EMPTY</text>
                </g>
              )}
            </g>
          );
        }

        /* ── SAFEHOUSE_DEFENDED — cyan shield ripple ── */
        if (ca.outcome === 'SAFEHOUSE_DEFENDED') {
          const r1  = (isTacticalView?9:40) * (0.3 + p * 0.7);
          const sa  = Array.from({length:8}, (_,i) => i * Math.PI / 4);
          const bop = p > 0.45 ? Math.min((p-0.45)/0.3, 1) : 0;
          return (
            <g key={`combat-${idx}`} opacity={lop}>
              <circle cx={tx} cy={ty} r={r1}      fill="rgba(0,240,255,0.08)" stroke="#00f0ff" strokeWidth={isTacticalView?0.5:2.4} opacity={(1-p)*0.88} />
              <circle cx={tx} cy={ty} r={r1*0.6}  fill="rgba(0,240,255,0.12)" stroke="#00d4e8" strokeWidth={isTacticalView?0.32:1.4} opacity={flk*0.75} />
              {sa.map((a,i) => (
                <line key={i}
                  x1={tx + r1*0.28*Math.cos(a)} y1={ty + r1*0.28*Math.sin(a)}
                  x2={tx + r1*0.88*Math.cos(a)} y2={ty + r1*0.88*Math.sin(a)}
                  stroke={i%2===0?'#00f0ff':'#67e8f9'} strokeWidth={1.5*sc} strokeLinecap="round"
                  opacity={(1-p*0.55)*0.82} />
              ))}
              <circle cx={tx} cy={ty} r={(isTacticalView?1.5:6)*flk} fill="#00f0ff" opacity={flk*0.45} />
              {bop > 0 && (
                <g transform={`translate(${tx},${ty-r1-(isTacticalView?4.5:22)})`} opacity={bop*lop}>
                  <rect x={isTacticalView?-17:-68} y={isTacticalView?-3.5:-14} width={isTacticalView?34:136} height={isTacticalView?7:24} fill="rgba(0,18,26,0.93)" stroke="#00f0ff" strokeWidth={isTacticalView?0.35:1.2} rx="3" />
                  <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#00f0ff" fontSize={isTacticalView?'2.1':'9'} fontFamily="monospace" fontWeight="bold">🛡️ ATTACK REPELLED</text>
                </g>
              )}
            </g>
          );
        }

        /* ── BORDER_INTERCEPTED — purple scan gate + blocked line ── */
        if (ca.outcome === 'BORDER_INTERCEPTED') {
          const r1  = (isTacticalView?8:36) * (0.3 + p * 0.7);
          const deg = p * 360;
          const bop = p > 0.4 ? Math.min((p-0.4)/0.35, 1) : 0;
          return (
            <g key={`combat-${idx}`} opacity={lop}>
              <circle cx={tx} cy={ty} r={r1} fill="rgba(168,85,247,0.1)" stroke="#a855f7" strokeWidth={isTacticalView?0.5:2.2} strokeDasharray={`${4*sc},${2*sc}`} opacity={(1-p*0.5)*0.88} transform={`rotate(${deg},${tx},${ty})`} />
              <circle cx={tx} cy={ty} r={r1*0.5} fill="none" stroke="#c084fc" strokeWidth={isTacticalView?0.3:1.3} opacity={flk*0.65} />
              {/* Blocked path bar */}
              <line x1={tx-r1*0.7} y1={ty} x2={tx+r1*0.7} y2={ty} stroke="#ff3b30" strokeWidth={isTacticalView?0.6:3} strokeLinecap="round" opacity={(1-p)*0.85} />
              <circle cx={tx} cy={ty} r={(isTacticalView?1.5:5.5)*flk} fill="#a855f7" opacity={flk*0.5} />
              {bop > 0 && (
                <g transform={`translate(${tx},${ty-r1-(isTacticalView?4.5:22)})`} opacity={bop*lop}>
                  <rect x={isTacticalView?-16:-64} y={isTacticalView?-3.5:-14} width={isTacticalView?32:128} height={isTacticalView?7:24} fill="rgba(18,0,28,0.94)" stroke="#a855f7" strokeWidth={isTacticalView?0.35:1.2} rx="3" />
                  <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#a855f7" fontSize={isTacticalView?'2.1':'9'} fontFamily="monospace" fontWeight="bold">🚫 ROUTE BLOCKED</text>
                </g>
              )}
            </g>
          );
        }

        /* ── LOGISTICS_RAIDED — teal cache-strike flash ── */
        if (ca.outcome === 'LOGISTICS_RAIDED') {
          const r1  = (isTacticalView?7:30) * (0.4 + p * 0.6);
          const bop = p > 0.45 ? Math.min((p-0.45)/0.35, 1) : 0;
          return (
            <g key={`combat-${idx}`} opacity={lop}>
              <circle cx={tx} cy={ty} r={r1} fill="rgba(20,184,166,0.1)" stroke="#14b8a6" strokeWidth={isTacticalView?0.45:2} opacity={(1-p)*0.85} />
              <circle cx={tx} cy={ty} r={r1*0.5} fill="rgba(20,184,166,0.2)" stroke="#2dd4bf" strokeWidth={isTacticalView?0.28:1.2} opacity={flk*0.7} />
              {[0, 1.57, 3.14, 4.71].map((a,i) => (
                <line key={i} x1={tx+r1*0.22*Math.cos(a)} y1={ty+r1*0.22*Math.sin(a)}
                              x2={tx+r1*0.78*Math.cos(a)} y2={ty+r1*0.78*Math.sin(a)}
                  stroke="#14b8a6" strokeWidth={1.8*sc} strokeLinecap="round" opacity={(1-p)*0.85} />
              ))}
              <circle cx={tx} cy={ty} r={(isTacticalView?1.2:4.5)*flk} fill="#14b8a6" opacity={flk*0.6} />
              {bop > 0 && (
                <g transform={`translate(${tx},${ty-r1-(isTacticalView?4:20)})`} opacity={bop*lop}>
                  <rect x={isTacticalView?-16:-64} y={isTacticalView?-3.5:-14} width={isTacticalView?32:128} height={isTacticalView?7:24} fill="rgba(0,18,16,0.93)" stroke="#14b8a6" strokeWidth={isTacticalView?0.35:1.1} rx="3" />
                  <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#14b8a6" fontSize={isTacticalView?'2.1':'9'} fontFamily="monospace" fontWeight="bold">💰 CACHE SEIZED</text>
                </g>
              )}
            </g>
          );
        }

        /* ── Fallback generic (unknown outcome) ── */
        {
          const r1 = (isTacticalView?8:36) * (0.3 + p * 0.7);
          const col = ca.color || '#ff3b30';
          return (
            <g key={`combat-${idx}`} opacity={lop}>
              <circle cx={tx} cy={ty} r={r1} fill="none" stroke={col} strokeWidth={isTacticalView?0.5:2.2} opacity={(1-p)*0.85} />
              <circle cx={tx} cy={ty} r={(isTacticalView?1.5:5)*flk} fill={col} opacity={flk*0.6} />
            </g>
          );
        }
      })}
      {destroyedFriendlyCities.map((item, idx) => {
        const center = getPixelCoords(item.cityId);
        if (center.x === 0) return null;
        const p   = item.progress;
        const sc  = isTacticalView ? 0.2 : 1;
        const tx  = center.x, ty = center.y;
        // Phase A (0→0.45): red implosion — rings collapse inward
        // Phase B (0.35→0.8): SAFEHOUSE LOST pill fades in and drifts up
        // Phase C (0.75→1): everything fades out
        const phA  = Math.min(p / 0.45, 1.0);
        const maxR = isTacticalView ? 14 : 58;
        const r1   = maxR * (1 - phA * 0.88);   // collapses inward
        const r2   = r1 * 0.55;
        const r3   = r1 * 0.28;
        const rOp  = Math.max(0, 1 - phA * 1.15);
        const flk  = Math.abs(Math.sin(p * Math.PI * 8));
        const sa   = [0, 0.52, 1.05, 1.57, 2.09, 2.62, 3.14, 3.67];
        const textOp = p > 0.35 ? Math.min((p-0.35)/0.25, 1) * (1 - Math.max(0,(p-0.75)/0.25)) : 0;
        const textY  = ty - (isTacticalView?5:22) - (p > 0.35 ? (p-0.35)*(isTacticalView?8:32) : 0);
        return (
          <g key={`friendly-destroy-${idx}`}>
            {/* Collapsing red rings */}
            <circle cx={tx} cy={ty} r={r1} fill="rgba(255,59,48,0.1)"  stroke="#ff3b30" strokeWidth={isTacticalView?0.6:2.8} opacity={rOp} />
            <circle cx={tx} cy={ty} r={r2} fill="rgba(255,80,20,0.18)" stroke="#ff6600" strokeWidth={isTacticalView?0.4:1.8} opacity={rOp*0.8} />
            <circle cx={tx} cy={ty} r={r3} fill="rgba(255,200,50,0.5)" stroke="#ffcc00" strokeWidth={isTacticalView?0.28:1.2} opacity={rOp*flk} />
            {/* Particle burst outward on impact */}
            {sa.map((a,i) => (
              <circle key={i}
                cx={tx + maxR*phA*0.75*Math.cos(a)} cy={ty + maxR*phA*0.75*Math.sin(a)}
                r={(2.2+(i%3)*0.6)*sc} fill={i%2===0?'#ff3b30':'#ff6600'}
                opacity={(1-phA)*0.88} />
            ))}
            {/* Center core flash */}
            <circle cx={tx} cy={ty} r={(isTacticalView?1.5:6)*Math.max(0,1-phA*1.5)} fill="#ff3b30" opacity={flk*0.85} />
            {/* Floating SAFEHOUSE LOST label */}
            <g transform={`translate(${tx},${textY})`} opacity={textOp}>
              <rect x={isTacticalView?-17:-66} y={isTacticalView?-3.5:-14} width={isTacticalView?34:132} height={isTacticalView?7:24} fill="rgba(28,0,0,0.92)" stroke="#ff3b30" strokeWidth={isTacticalView?0.35:1.2} rx="3" />
              <text x="0" y={isTacticalView?1.8:2} textAnchor="middle" fill="#ff3b30" fontSize={isTacticalView?'2.1':'9'} fontFamily="monospace" fontWeight="bold">⚠️ SAFEHOUSE LOST</text>
            </g>
          </g>
        );
      })}
      {destroyedEnemyCities.map((item, idx) => {
        const center = getPixelCoords(item.cityId);
        if (center.x === 0) return null;
        const p   = item.progress;
        const sc  = isTacticalView ? 0.2 : 1;
        const tx  = center.x, ty = center.y;
        // Phase A (0→0.5): green starburst explosion expands outward
        // Phase B (0.4→0.8): ELIMINATED label fades in and drifts up
        // Phase C (0.75→1): fade out
        const phA  = Math.min(p / 0.5, 1.0);
        const maxR = isTacticalView ? 16 : 64;
        const eR   = maxR * phA;
        const eOp  = Math.max(0, 1 - phA * 1.1);
        const flk  = Math.abs(Math.sin(p * Math.PI * 7));
        const sa   = Array.from({length:12}, (_,i) => i * Math.PI / 6);
        const textOp = p > 0.38 ? Math.min((p-0.38)/0.25, 1) * (1 - Math.max(0,(p-0.75)/0.25)) : 0;
        const textY  = ty - (isTacticalView?5:22) - (p > 0.38 ? (p-0.38)*(isTacticalView?8:32) : 0);
        return (
          <g key={`enemy-destroy-${idx}`}>
            {/* Expanding green blast rings */}
            <circle cx={tx} cy={ty} r={eR}       fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth={isTacticalView?0.6:2.8} opacity={eOp} />
            <circle cx={tx} cy={ty} r={eR*0.6}   fill="rgba(0,255,102,0.18)" stroke="#00ff66" strokeWidth={isTacticalView?0.4:1.8} opacity={eOp*0.85} />
            <circle cx={tx} cy={ty} r={eR*0.28}  fill="rgba(180,255,220,0.55)" stroke="#a7f3d0" strokeWidth={isTacticalView?0.28:1.2} opacity={eOp*flk} />
            {/* 12-ray starburst */}
            {sa.map((a,i) => (
              <g key={i}>
                <line x1={tx+eR*0.22*Math.cos(a)} y1={ty+eR*0.22*Math.sin(a)}
                      x2={tx+eR*0.9*Math.cos(a)}  y2={ty+eR*0.9*Math.sin(a)}
                  stroke={i%3===0?'#10b981':i%3===1?'#34d399':'#00ff66'}
                  strokeWidth={(1.6+(i%2)*0.8)*sc} strokeLinecap="round" opacity={eOp*0.9} />
                <circle cx={tx+eR*0.88*Math.cos(a)} cy={ty+eR*0.88*Math.sin(a)}
                  r={(2+(i%3)*0.5)*sc} fill={i%2===0?'#10b981':'#a7f3d0'} opacity={eOp*0.88} />
              </g>
            ))}
            {/* Core white flash */}
            <circle cx={tx} cy={ty} r={(isTacticalView?2:8)*Math.max(0,1-phA*1.6)} fill="#ffffff" opacity={flk*0.8} />
            {/* Floating DESTROYED / ELIMINATED label */}
            {(() => {
              const labelText = item.isElimination ? '✓ ENEMY ELIMINATED' : '✓ SAFEHOUSE DESTROYED';
              const rectW = isTacticalView ? (item.isElimination ? 30 : 38) : (item.isElimination ? 120 : 150);
              const rectX = -rectW / 2;
              return (
                <g transform={`translate(${tx},${textY})`} opacity={textOp}>
                  <rect x={rectX} y={isTacticalView ? -3.5 : -14} width={rectW} height={isTacticalView ? 7 : 24} fill="rgba(0,20,10,0.92)" stroke="#10b981" strokeWidth={isTacticalView ? 0.35 : 1.2} rx="3" />
                  <text x="0" y={isTacticalView ? 1.8 : 2} textAnchor="middle" fill="#10b981" fontSize={isTacticalView ? '2.1' : '9'} fontFamily="monospace" fontWeight="bold">
                    {labelText}
                  </text>
                </g>
              );
            })()}
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
    <div className={`map-container relative w-full h-full overflow-hidden ${isShaking ? `shake-${shakeIntensity}` : ''}`}>
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
          ref={tacticalContainerRef}
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

            {/* Connection Lines SVG – single clean line per connection to prevent layer ghosting */}
            <svg 
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2 }} 
              shapeRendering="geometricPrecision"
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
                const x1 = start.x.toFixed(2);
                const y1 = start.y.toFixed(2);
                const x2 = end.x.toFixed(2);
                const y2 = end.y.toFixed(2);

                return (
                  <line
                    key={`conn-${idx}`}
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray="6, 8"
                    className="connection-line-anim"
                    style={{ '--line-color': color }}
                  />
                );
              })}
            </svg>

            {/* Absolute Positioned City Node Markers */}
            {Object.entries(scaledCoords).map(([cityId, coords], nodeIdx) => {
              const nodeData = activeScenario?.nodes?.find(n => n.id === cityId);
              const isFriendlyRaw = nodeData ? nodeData.territory === 'HOME_TERRITORY' : ['srinagar', 'jammu', 'amritsar', 'chandigarh', 'new_delhi'].includes(cityId);
              const isFriendly = isAttacker ? !isFriendlyRaw : isFriendlyRaw;
              const isTarget = activeScenario?.targetCity ? cityId === activeScenario.targetCity : cityId === 'new_delhi';
              
              const hasDefenderSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'DEFENDER' && s.status !== 'DESTROYED');
              const hasHostileSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.status !== 'DESTROYED');
              const hasExposedNormalSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && (s.uncovered || s.exposed) && !s.secure && s.status !== 'DESTROYED');
              const hasExposedSecureSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && (s.uncovered || s.exposed) && s.secure && s.status !== 'DESTROYED');
              
              const isBuildingHere = buildingSafehouses.some(b => b.cityId === cityId);
              const isSecureSafehouse = hasHostileSafehouse && session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.secure && s.status !== 'DESTROYED');
              const showSafehouseIcon = !isBuildingHere && (isAttacker ? hasHostileSafehouse : hasDefenderSafehouse);
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
                return d.currentCity === cityId && d.status !== 'SHOT_DOWN';
              }).length;

              const isDroneDefenseActive = Boolean(session?.activeDroneDefenseCity && session.activeDroneDefenseCity.toLowerCase() === cityId.toLowerCase());

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
                      <div className="loss-pill loss-pill--enemy">
                        {destroyedEnemyCities.find(c => c.cityId === cityId)?.isElimination ? 'ENEMY ELIMINATED' : 'SAFEHOUSE DESTROYED'}
                      </div>
                    )}
                    {confettiCities.includes(cityId) && (
                      <div className="expose-glow expose-glow--tactical" />
                    )}
                    {isSweptZone && <div className="city-marker-sweep-ring"></div>}
                    {isDroneDefenseActive && <div className="city-marker-drone-defense-ring"></div>}
                    {isSuspectHere && <div className="suspect-radar-ring"></div>}
                    {struckCities.includes(cityId.toLowerCase()) && (
                      <div className="struck-glow struck-glow--tactical" />
                    )}
                    <div className={`city-marker-outer ${isFriendly ? 'friendly' : 'hostile'} ${isSweptZone ? 'sweep-alert' : ''} ${isDroneDefenseActive ? 'drone-defense-alert' : ''}`}></div>
                    <div className={`city-marker-inner ${isFriendly ? 'friendly' : 'hostile'} ${isTarget ? 'target' : ''}`}></div>
                    {/* Structured Top Asset Toolbar — Flex container prevents icon collisions */}
                    {(agentsCount > 0 || showSafehouseIcon || showExposedNormalIcon || showExposedSecureIcon || teamsCount > 0) && (
                      <div className="city-marker-asset-bar">
                        {agentsCount > 0 && (
                          <div className="asset-chip asset-chip--agent" title={`${agentsCount} Field Agent(s)`}>
                            <AgentIcon size={11} color="#00f0ff" />
                            {agentsCount > 1 && <span className="chip-count">{agentsCount}</span>}
                          </div>
                        )}

                        {showSafehouseIcon && (
                          <div 
                            className={`asset-chip asset-chip--safehouse ${isNewSafehouse ? 'safehouse-drop-bounce' : ''}`}
                            title={isSecureSafehouse ? 'Secure Safehouse' : 'Standard Safehouse'}
                          >
                            <SafehouseIcon
                              size={11}
                              color={shColorT}
                              secure={isSecureSafehouse}
                              hostile={isAttacker && hasHostileSafehouse}
                            />
                          </div>
                        )}

                        {(showExposedNormalIcon || showExposedSecureIcon) && (
                          <div 
                            className={`asset-chip asset-chip--exposed ${isNewExposed ? 'safehouse-reveal-bounce' : ''}`}
                            title="Exposed Hostile Safehouse"
                          >
                            <SafehouseIcon size={10} color={showExposedSecureIcon ? '#ffcc00' : '#f59e0b'} secure={showExposedSecureIcon} />
                            <span className="chip-eye">👁️</span>
                          </div>
                        )}

                        {teamsCount > 0 && (
                          <div className="asset-chip asset-chip--team" title={`${teamsCount} Tactical Team(s)`}>
                            <CombatTeamIcon size={11} color="#ff3b30" />
                            {teamsCount > 1 && <span className="chip-count">{teamsCount}</span>}
                          </div>
                        )}
                      </div>
                    )}
                    {isSuspectHere && <div className="city-marker-badge suspect pulse-badge" style={{ background: '#ff3b30', boxShadow: '0 0 15px #ff3b30', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', border: '2px solid white', borderRadius: '50%', width: '22px', height: '22px', transform: 'translate(12px, -24px)', zIndex: 1000 }}>🎯</div>}
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
                    {isDroneDefenseActive && <div className="city-marker-drone-defense-label">🛡️ AIR DEFENSE ACTIVE</div>}
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
            onServiceDrone={onServiceDrone}
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
