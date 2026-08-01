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
  setLocalBeginHandover
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
            const lat = 36.0 - (node.coordinates.y * 0.12);
            const lng = 65.0 + (node.coordinates.x * 0.15);
            coords[node.id] = [lat, lng];
          }
        }
      });
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
  const [isShaking, setIsShaking] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);

  // Force re-render overlay coordinates when Leaflet map moves/zooms
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleMapUpdate = () => setMapVersion(v => v + 1);
    map.on('move zoom viewreset drag', handleMapUpdate);
    return () => {
      map.off('move zoom viewreset drag', handleMapUpdate);
    };
  }, [session]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Calculate bounding box containing all cities to maximize screen space usage
    const coords = Object.values(CITY_COORDINATES);
    const bounds = L.latLngBounds(coords);

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    });

    map.fitBounds(bounds, { padding: [50, 50] });

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
    };
    window.addEventListener('resize', handleResize);

    setTimeout(() => {
      map.invalidateSize();
      const coords = Object.values(CITY_COORDINATES);
      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }, 350);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
    };
  }, []);

  // Handle updates to cities, connections, and markers
  useEffect(() => {
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
      const hasExposedHostileSH = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE' && s.uncovered);
      
      const isSecureSafehouse = isAttacker && hasHostileSafehouse && (session.secureSafehouseTurns?.[cityId] > 0);
      const showSafehouseIcon = isAttacker ? (hasHostileSafehouse ? (isSecureSafehouse ? '🛡️' : '🏠') : '') : (hasDefenderSafehouse ? '🏠' : '');
      const showExposedHostileIcon = !isAttacker && hasExposedHostileSH;
      
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
          ${showExposedHostileIcon ? `<div class="city-marker-exposed-hostile">👁️</div>` : ''}
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

  }, [session, selectedCityNode, selectedAgent, localAgentMoves, localTeamMoves, localAgentTasks, session.hostilePatrolCities]);

  // Handle God Mode Replay Routes
  useEffect(() => {
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
  }, [showGodMode, replayPlan, replayTurn]);

  // Center and zoom map smoothly when selectedCityNode changes
  useEffect(() => {
    const map = mapRef.current;
    if (map && selectedCityNode) {
      const coords = CITY_COORDINATES[selectedCityNode];
      if (coords) {
        map.setView(coords, 8, { animate: true });
      }
    }
  }, [selectedCityNode]);

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

      // 4. Identify Safehouses built this turn
      session.safehouses.forEach(sh => {
        if (sh.ownerFaction === 'DEFENDER') {
          const wasPresent = prevSession.safehouses.some(psh => 
            psh.cityNode === sh.cityNode && psh.ownerFaction === 'DEFENDER'
          );
          if (!wasPresent) {
            newBuilding.push({ cityId: sh.cityNode, progress: 0 });
          }
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

      if (newMoving.length > 0 || newBuilding.length > 0 || newExposing.length > 0 || newCombat.length > 0) {
        setMovingUnits(newMoving);
        setBuildingSafehouses(newBuilding);
        setExposingSafehouses(newExposing);
        setCombatAlerts(newCombat);

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
    const map = mapRef.current;
    if (!map) return { x: 0, y: 0 };
    const latLng = CITY_COORDINATES[cityId];
    if (!latLng) return { x: 0, y: 0 };
    const point = map.latLngToContainerPoint(latLng);
    return { x: point.x, y: point.y };
  };

  // Zoom control handlers
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleFit = () => {
    const map = mapRef.current;
    if (map) {
      const coords = Object.values(CITY_COORDINATES);
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const selectedNodeData = activeScenario?.nodes?.find(n => n.id === selectedCityNode);
  const isAttacker = session?.playerRole === 'ATTACKER';
  const isFriendlyRaw = selectedNodeData ? selectedNodeData.territory === 'HOME_TERRITORY' : ['srinagar', 'jammu', 'amritsar', 'chandigarh', 'new_delhi'].includes(selectedCityNode);
  const isFriendly = isAttacker ? !isFriendlyRaw : isFriendlyRaw;
  const hasSafehouse = isAttacker
    ? session.safehouses.some(s => s.cityNode === selectedCityNode && s.ownerFaction === 'HOSTILE')
    : session.safehouses.some(s => s.cityNode === selectedCityNode && s.ownerFaction === 'DEFENDER');

  return (
    <div className={`map-container relative w-full h-full overflow-hidden ${isShaking ? 'shake-effect' : ''}`}>
      {/* Title */}
      <div className="map-title z-10 pointer-events-none">
        <h2>Tactical Map Feed</h2>

      </div>

      {/* Toolbar */}
      <div className="map-toolbar z-10">
        <button onClick={handleZoomIn} title="Zoom In"><ZoomIn size={16} /></button>
        <button onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={16} /></button>
        <button onClick={handleFit} title="Fit to Screen"><Maximize2 size={16} /></button>
      </div>

      {/* Leaflet Map Target */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} className="leaflet-map-element"></div>

      {/* Animations Canvas / SVG Overlay */}
      <svg 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          pointerEvents: 'none', 
          zIndex: 400 // Leaflet panes are generally below 400 (tile layers are 200, markers/overlays are 600, but absolute controls/drawer should sit on top)
        }}
      >
        {/* 1. Moving Units animations */}
        {movingUnits.map((m, idx) => {
          const start = getPixelCoords(m.fromCity);
          const end = getPixelCoords(m.toCity);
          if (start.x === 0 || end.x === 0) return null;

          const currentX = start.x + (end.x - start.x) * m.progress;
          const currentY = start.y + (end.y - start.y) * m.progress;

          return (
            <g key={`move-${idx}`}>
              {/* Glowing path line */}
              <line 
                x1={start.x} 
                y1={start.y} 
                x2={end.x} 
                y2={end.y} 
                stroke={m.color} 
                strokeWidth="2" 
                strokeDasharray="5,5" 
                opacity="0.3" 
              />
              <line 
                x1={start.x} 
                y1={start.y} 
                x2={currentX} 
                y2={currentY} 
                stroke={m.color} 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                opacity="0.8" 
              />
              {/* Glowing trace dot */}
              <circle 
                cx={currentX} 
                cy={currentY} 
                r="7" 
                fill={m.color} 
                filter="drop-shadow(0 0 6px rgba(255,255,255,0.8))"
              />
              <circle 
                cx={currentX} 
                cy={currentY} 
                r="14" 
                fill="none" 
                stroke={m.color} 
                strokeWidth="1.5" 
                opacity={1 - m.progress} 
                className="animate-ping" 
              />
            </g>
          );
        })}

        {/* 2. Safehouse Build blueprint animations */}
        {buildingSafehouses.map((b, idx) => {
          const center = getPixelCoords(b.cityId);
          if (center.x === 0) return null;

          const radius = 10 + b.progress * 40;
          const opacity = 1.0 - b.progress;

          return (
            <g key={`build-${idx}`}>
              <circle 
                cx={center.x} 
                cy={center.y} 
                r={radius} 
                fill="none" 
                stroke="#00f0ff" 
                strokeWidth="1.5" 
                strokeDasharray="4,4" 
                opacity={opacity} 
              />
              <circle 
                cx={center.x} 
                cy={center.y} 
                r={radius - 5} 
                fill="none" 
                stroke="#00f0ff" 
                strokeWidth="0.8" 
                opacity={opacity} 
              />
              {/* Crosshairs */}
              <line x1={center.x - radius - 5} y1={center.y} x2={center.x + radius + 5} y2={center.y} stroke="#00f0ff" strokeWidth="0.8" opacity={opacity} />
              <line x1={center.x} y1={center.y - radius - 5} x2={center.x} y2={center.y + radius + 5} stroke="#00f0ff" strokeWidth="0.8" opacity={opacity} />
            </g>
          );
        })}

        {/* 3. Exposed Hostile Safehouse reveal animations */}
        {exposingSafehouses.map((e, idx) => {
          const center = getPixelCoords(e.cityId);
          if (center.x === 0) return null;

          const radius = 8 + e.progress * 50;
          const opacity = 1.0 - e.progress;

          return (
            <g key={`expose-${idx}`}>
              <circle
                cx={center.x}
                cy={center.y}
                r={radius}
                fill="none"
                stroke="#ffcc00"
                strokeWidth="2.5"
                strokeDasharray="6,3"
                opacity={opacity}
              />
              <circle
                cx={center.x}
                cy={center.y}
                r={radius * 0.5}
                fill="none"
                stroke="#ffcc00"
                strokeWidth="1.5"
                opacity={opacity * 0.6}
              />
              <line x1={center.x - radius - 8} y1={center.y} x2={center.x + radius + 8} y2={center.y} stroke="#ffcc00" strokeWidth="1.2" opacity={opacity} />
              <line x1={center.x} y1={center.y - radius - 8} x2={center.x} y2={center.y + radius + 8} stroke="#ffcc00" strokeWidth="1.2" opacity={opacity} />
              <text x={center.x} y={center.y - radius - 14} textAnchor="middle" fill="#ffcc00" fontSize="10" opacity={opacity} fontFamily="monospace" fontWeight="bold">EXPOSED</text>
            </g>
          );
        })}

        {/* 4. Combat / Raid alerts animations */}
        {combatAlerts.map((c, idx) => {
          const center = getPixelCoords(c.cityId);
          if (center.x === 0) return null;

          const opacity = Math.sin(c.progress * Math.PI * 4.5) * 0.4 + 0.6; // pulses 4-5 times

          return (
            <g key={`combat-${idx}`}>
              {/* Target scanner circles */}
              <circle 
                cx={center.x} 
                cy={center.y} 
                r="24" 
                fill="rgba(255, 59, 48, 0.08)" 
                stroke="#ff3b30" 
                strokeWidth="2.5" 
                opacity={opacity} 
              />
              <circle 
                cx={center.x} 
                cy={center.y} 
                r="36" 
                fill="none" 
                stroke="#ff3b30" 
                strokeWidth="1.2" 
                strokeDasharray="6,3" 
                opacity={opacity} 
              />
              {/* Crosshair indicators */}
              <line x1={center.x - 48} y1={center.y} x2={center.x + 48} y2={center.y} stroke="#ff3b30" strokeWidth="1.5" opacity={opacity} />
              <line x1={center.x} y1={center.y - 48} x2={center.x} y2={center.y + 48} stroke="#ff3b30" strokeWidth="1.5" opacity={opacity} />
            </g>
          );
        })}
      </svg>

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
