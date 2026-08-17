import React, { useState, useCallback, useEffect } from 'react';
import { Shield, Users, MapPin, CheckCircle, ChevronRight, AlertTriangle, X, List, Cpu } from 'lucide-react';
import { GAME_API_BASE } from '../config';

const PHASES = [
  { id: 1, key: 'safehouses', label: 'SAFEHOUSES', icon: Shield,  color: '#00f0ff' },
  { id: 2, key: 'agents',     label: 'AGENTS',     icon: Users,   color: '#10b981' },
  { id: 3, key: 'teams',      label: 'TEAMS',      icon: MapPin,  color: '#f59e0b' },
  { id: 4, key: 'drones',     label: 'DRONES',     icon: Cpu,     color: '#10B981' },
];

const territoryColor = (t) =>
  t === 'HOME_TERRITORY' ? '#00f0ff' : t === 'HOSTILE_TERRITORY' ? '#ff3b30' : '#a0a0a0';
const territoryLabel = (t) =>
  t === 'HOME_TERRITORY' ? 'FRIENDLY' : t === 'HOSTILE_TERRITORY' ? 'HOSTILE' : 'NEUTRAL';

export default function DeploymentScreen({ session, activeScenario, onDeploymentComplete, addToast }) {
  const nodes = activeScenario?.nodes || [];
  const safehouseCount = Math.floor(nodes.length / 2);

  const [phase, setPhase] = useState(1);
  const [safehouseCities, setSafehouseCities] = useState(new Set());
  const [agentPlacements, setAgentPlacements] = useState({});
  const [teamPlacements, setTeamPlacements]   = useState({});
  const [droneBaseCity, setDroneBaseCity] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [mobilePanel, setMobilePanel] = useState('cities');

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const agents = session.agents || [];
  const teams  = session.tacticalTeams || [];
  const unplacedAgents = agents.filter(a => agentPlacements[a.id] === undefined);
  const unplacedTeams  = teams.filter(t  => teamPlacements[t.id]  === undefined);
  const remainingSafehouses = safehouseCount - safehouseCities.size;
  const phase1Done = safehouseCities.size >= safehouseCount;
  const phase2Done = phase1Done && unplacedAgents.length === 0;
  const phase3Done = phase2Done && unplacedTeams.length === 0;
  const phase4Done = phase3Done && droneBaseCity !== null;
  const allDone    = phase4Done;

  const handleCityDrop = useCallback((cityId) => {
    if (!dragging && !selected) return;
    const active = dragging || selected;
    if (phase === 1 && active.type === 'safehouse') {
      if (safehouseCities.has(cityId)) {
        setSafehouseCities(prev => { const s = new Set(prev); s.delete(cityId); return s; });
      } else if (safehouseCities.size < safehouseCount) {
        setSafehouseCities(prev => new Set([...prev, cityId]));
      }
    } else if (phase === 2 && active.type === 'agent') {
      if (!safehouseCities.has(cityId)) return;
      setAgentPlacements(prev => ({ ...prev, [active.id]: cityId }));
    } else if (phase === 3 && active.type === 'team') {
      if (!safehouseCities.has(cityId)) return;
      setTeamPlacements(prev => ({ ...prev, [active.id]: cityId }));
    } else if (phase === 4 && (active.type === 'drone_base' || active.type === 'drone')) {
      const node = nodes.find(n => n.id === cityId);
      if (node && node.territory === 'HOME_TERRITORY') {
        setDroneBaseCity(cityId);
      } else {
        addToast?.('Drone Base can only be established in friendly home territory.', 'warning');
      }
    }
    setDragging(null); setSelected(null); setDragOver(null);
  }, [dragging, selected, phase, safehouseCities, safehouseCount, nodes, addToast]);

  const removeSafehouse = (id) => setSafehouseCities(prev => { const s = new Set(prev); s.delete(id); return s; });
  const removeAgent = (id) => setAgentPlacements(prev => { const n = { ...prev }; delete n[id]; return n; });
  const removeTeam  = (id) => setTeamPlacements(prev  => { const n = { ...prev }; delete n[id]; return n; });
  const removeDroneBase = () => setDroneBaseCity(null);

  const handleConfirm = async () => {
    if (!allDone || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        safehouses: [...safehouseCities],
        agentDeployments: Object.fromEntries(Object.entries(agentPlacements).map(([k,v]) => [String(k),v])),
        teamDeployments:  Object.fromEntries(Object.entries(teamPlacements).map(([k,v])  => [String(k),v])),
        droneBaseCity: droneBaseCity
      };
      const token = localStorage.getItem('spy_game_token');
      const res = await fetch(`${GAME_API_BASE}/${session.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Deployment rejected by server.');
      onDeploymentComplete(await res.json());
      addToast?.('Assets deployed. Operation is LIVE.', 'success');
    } catch (err) { addToast?.(err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleSkip = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const dsh = (activeScenario?.startingDefenderSafehouses || []).map(s => s.cityId);
      const da = {}; (activeScenario?.agents || []).forEach(a => { da[String(a.id)] = a.startingCity; });
      const dt = {}; (activeScenario?.tacticalTeams || []).forEach(t => { dt[String(t.id)] = t.startingCity; });
      const token = localStorage.getItem('spy_game_token');
      const res = await fetch(`${GAME_API_BASE}/${session.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ safehouses: dsh, agentDeployments: da, teamDeployments: dt }),
      });
      if (!res.ok) throw new Error('Failed to load default deployment config.');
      onDeploymentComplete(await res.json());
      addToast?.('Loaded default deployments.', 'info');
    } catch (err) { addToast?.(err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const cityLabel = (cid) => nodes.find(n => n.id === cid)?.name || cid?.replace(/_/g, ' ').toUpperCase() || cid;
  const cityContents = (cid) => ({
    hasSH:    safehouseCities.has(cid),
    myAgents: agents.filter(a => agentPlacements[a.id] === cid),
    myTeams:  teams.filter(t  => teamPlacements[t.id]  === cid),
  });

  const handleAssetTap = (type, id, label) => {
    if (selected?.type === type && selected?.id === id) { setSelected(null); }
    else { setSelected({ type, id, label }); if (isMobile) setMobilePanel('cities'); }
  };
  const handleCityTap = (cityId) => { if (selected) handleCityDrop(cityId); };

  const currentPhase = PHASES[phase - 1];
  const PhaseIcon = currentPhase.icon;

  const renderCities = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 8 }}>
      {nodes.map(node => {
        const { hasSH, myAgents, myTeams } = cityContents(node.id);
        const tColor = territoryColor(node.territory);
        const isValidDrop =
          phase === 1 ? (!hasSH && safehouseCities.size < safehouseCount) :
          phase === 2 ? (hasSH && (dragging?.type === 'agent' || selected?.type === 'agent')) :
          phase === 3 ? (hasSH && (dragging?.type === 'team'  || selected?.type === 'team')) : false;
        const isDimmed = (phase === 2 || phase === 3) && !hasSH;
        const isHovered = dragOver === node.id && isValidDrop;
        return (
          <div key={node.id}
            onDragOver={e => { e.preventDefault(); setDragOver(node.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleCityDrop(node.id)}
            onClick={() => handleCityTap(node.id)}
            style={{ padding: '10px 12px', borderRadius: 6, position: 'relative', transition: 'all 0.15s',
              border: `1px solid ${isHovered ? currentPhase.color : hasSH ? '#00f0ff40' : isDimmed ? '#ffffff08' : '#ffffff14'}`,
              background: isHovered ? `${currentPhase.color}18` : hasSH ? 'rgba(0,240,255,0.05)' : isDimmed ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.02)',
              opacity: isDimmed ? 0.4 : 1,
              cursor: isValidDrop || (selected && hasSH) ? 'pointer' : 'default',
              boxShadow: isHovered ? `0 0 12px ${currentPhase.color}40` : hasSH ? '0 0 8px rgba(0,240,255,0.12)' : 'none',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
              <span style={{ fontSize: 7, color: tColor, letterSpacing: '0.12em', padding: '1px 4px', border: `1px solid ${tColor}40`, borderRadius: 2, background: `${tColor}12` }}>
                {territoryLabel(node.territory)}
              </span>
              {hasSH && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Shield size={9} style={{ color: '#00f0ff' }} />
                  {phase === 1 && (
                    <button onClick={e => { e.stopPropagation(); removeSafehouse(node.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b3080', padding: 0 }}>
                      <X size={8} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 3, color: hasSH ? '#e0f8ff' : isDimmed ? '#333' : '#888' }}>
              {(node.name || node.id).replace(/_/g, ' ').toUpperCase()}
            </div>
            {myAgents.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
                {myAgents.map(a => (
                  <span key={a.id} onClick={e => { e.stopPropagation(); removeAgent(a.id); }}
                    style={{ fontSize: 7, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 3, padding: '1px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Users size={6} /> {a.codename}
                  </span>
                ))}
              </div>
            )}
            {myTeams.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
                {myTeams.map(t => (
                  <span key={t.id} onClick={e => { e.stopPropagation(); removeTeam(t.id); }}
                    style={{ fontSize: 7, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 3, padding: '1px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <MapPin size={6} /> {t.name}
                  </span>
                ))}
              </div>
            )}
            {droneBaseCity === node.id && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
                <span onClick={e => { e.stopPropagation(); removeDroneBase(); }}
                  style={{ fontSize: 7, color: '#00f0ff', background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: 3, padding: '1px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                  🏭 DRONE BASE (2 🚁)
                </span>
              </div>
            )}
            {isHovered && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none', border: `2px solid ${currentPhase.color}`, boxShadow: `inset 0 0 16px ${currentPhase.color}30`, animation: 'pulse 1s ease-in-out infinite' }} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderAssets = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {phase === 1 && (
        <>
          <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.1em' }}>
            PLACE {safehouseCount} SAFEHOUSES
            <span style={{ color: remainingSafehouses > 0 ? currentPhase.color : '#10b981', marginLeft: 8 }}>
              {remainingSafehouses > 0 ? `${remainingSafehouses} REMAINING` : '✓ ALL PLACED'}
            </span>
          </div>
          {Array.from({ length: safehouseCount }).map((_, i) => {
            const placed = i < safehouseCities.size;
            return (
              <div key={i} draggable={!placed}
                onDragStart={() => !placed && setDragging({ type: 'safehouse', id: `sh-${i}`, label: `SAFEHOUSE ALPHA-${i + 1}` })}
                onDragEnd={() => setDragging(null)}
                onClick={() => !placed && handleAssetTap('safehouse', `sh-${i}`, `SAFEHOUSE ALPHA-${i + 1}`)}
                style={{ padding: '10px 12px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                  cursor: placed ? 'default' : 'grab', opacity: placed ? 0.4 : 1,
                  border: `1px solid ${placed ? '#10b98140' : selected?.id === `sh-${i}` ? currentPhase.color : 'rgba(0,240,255,0.2)'}`,
                  background: placed ? 'rgba(16,185,129,0.05)' : selected?.id === `sh-${i}` ? `${currentPhase.color}18` : 'rgba(0,240,255,0.04)',
                }}>
                <Shield size={13} style={{ color: placed ? '#10b981' : currentPhase.color }} />
                <div>
                  <div style={{ fontSize: 9, color: placed ? '#10b981' : currentPhase.color, letterSpacing: '0.1em' }}>SAFEHOUSE {String(i + 1).padStart(2, '0')}</div>
                  <div style={{ fontSize: 7, color: '#555', marginTop: 1 }}>{placed ? 'PLACED' : isMobile ? 'TAP → CITIES → TAP CITY' : 'DRAG TO CITY'}</div>
                </div>
              </div>
            );
          })}
        </>
      )}
      {phase === 2 && (
        <>
          <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.1em' }}>
            {unplacedAgents.length > 0 ? `${unplacedAgents.length} AGENTS UNDEPLOYED` : '✓ ALL AGENTS DEPLOYED'}
          </div>
          {unplacedAgents.map(a => (
            <div key={a.id} draggable
              onDragStart={() => setDragging({ type: 'agent', id: a.id, label: a.codename })}
              onDragEnd={() => setDragging(null)}
              onClick={() => handleAssetTap('agent', a.id, a.codename)}
              style={{ padding: '10px 12px', borderRadius: 4, cursor: 'grab', transition: 'all 0.2s',
                border: `1px solid ${selected?.id === a.id ? currentPhase.color : 'rgba(16,185,129,0.25)'}`,
                background: selected?.id === a.id ? `${currentPhase.color}18` : 'rgba(16,185,129,0.04)',
              }}>
              <div style={{ fontSize: 10, color: currentPhase.color, letterSpacing: '0.08em' }}>{a.codename}</div>
              <div style={{ fontSize: 8, color: '#666', marginTop: 2 }}>{a.name}</div>
              <div style={{ fontSize: 7, color: '#444', marginTop: 1 }}>{isMobile ? 'TAP → CITIES → TAP CITY' : 'DRAG TO SAFEHOUSE CITY'}</div>
            </div>
          ))}
          {agents.filter(a => agentPlacements[a.id]).map(a => (
            <div key={a.id} style={{ padding: '8px 12px', borderRadius: 4, opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(16,185,129,0.15)', background: 'rgba(16,185,129,0.04)' }}>
              <div>
                <div style={{ fontSize: 9, color: '#10b981', letterSpacing: '0.08em' }}>{a.codename}</div>
                <div style={{ fontSize: 8, color: '#555' }}>→ {cityLabel(agentPlacements[a.id])}</div>
              </div>
              <button onClick={() => removeAgent(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 2 }}><X size={10} /></button>
            </div>
          ))}
        </>
      )}
      {phase === 3 && (
        <>
          <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.1em' }}>
            {unplacedTeams.length > 0 ? `${unplacedTeams.length} TEAMS UNDEPLOYED` : '✓ ALL TEAMS DEPLOYED'}
          </div>
          {unplacedTeams.map(t => (
            <div key={t.id} draggable
              onDragStart={() => setDragging({ type: 'team', id: t.id, label: t.name })}
              onDragEnd={() => setDragging(null)}
              onClick={() => handleAssetTap('team', t.id, t.name)}
              style={{ padding: '10px 12px', borderRadius: 4, cursor: 'grab', transition: 'all 0.2s',
                border: `1px solid ${selected?.id === t.id ? currentPhase.color : 'rgba(245,158,11,0.25)'}`,
                background: selected?.id === t.id ? `${currentPhase.color}18` : 'rgba(245,158,11,0.04)',
              }}>
              <div style={{ fontSize: 10, color: currentPhase.color, letterSpacing: '0.08em' }}>{t.name}</div>
              <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>{t.operatingCountry}</div>
              <div style={{ fontSize: 7, color: '#444', marginTop: 1 }}>{isMobile ? 'TAP → CITIES → TAP CITY' : 'DRAG TO SAFEHOUSE CITY'}</div>
            </div>
          ))}
          {teams.filter(t => teamPlacements[t.id]).map(t => (
            <div key={t.id} style={{ padding: '8px 12px', borderRadius: 4, opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.04)' }}>
              <div>
                <div style={{ fontSize: 9, color: '#f59e0b', letterSpacing: '0.08em' }}>{t.name}</div>
                <div style={{ fontSize: 8, color: '#555' }}>→ {cityLabel(teamPlacements[t.id])}</div>
              </div>
              <button onClick={() => removeTeam(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 2 }}><X size={10} /></button>
            </div>
          ))}
        </>
      )}
      {phase === 4 && (
        <>
          <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.1em' }}>
            ESTABLISH DRONE BASE & ALLOCATE DRONES
            <span style={{ color: droneBaseCity ? '#10b981' : currentPhase.color, marginLeft: 8 }}>
              {droneBaseCity ? '✓ BASE ESTABLISHED' : '1 BASE REQUIRED'}
            </span>
          </div>
          <div draggable={!droneBaseCity}
            onDragStart={() => !droneBaseCity && setDragging({ type: 'drone_base', id: 'db-1', label: 'DRONE BASE HANGAR' })}
            onDragEnd={() => setDragging(null)}
            onClick={() => !droneBaseCity && handleAssetTap('drone_base', 'db-1', 'DRONE BASE HANGAR')}
            style={{ padding: '10px 12px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
              cursor: droneBaseCity ? 'default' : 'grab', opacity: droneBaseCity ? 0.4 : 1,
              border: `1px solid ${droneBaseCity ? '#10b98140' : selected?.id === 'db-1' ? currentPhase.color : 'rgba(0,240,255,0.2)'}`,
              background: droneBaseCity ? 'rgba(16,185,129,0.05)' : selected?.id === 'db-1' ? `${currentPhase.color}18` : 'rgba(0,240,255,0.04)',
            }}>
            <Cpu size={13} style={{ color: droneBaseCity ? '#10b981' : currentPhase.color }} />
            <div>
              <div style={{ fontSize: 9, color: droneBaseCity ? '#10b981' : currentPhase.color, letterSpacing: '0.1em' }}>DRONE BASE HANGAR</div>
              <div style={{ fontSize: 7, color: '#555', marginTop: 1 }}>{droneBaseCity ? `ESTABLISHED AT ${cityLabel(droneBaseCity)}` : isMobile ? 'TAP → HOME CITY' : 'DRAG TO HOME CITY'}</div>
            </div>
          </div>

          {droneBaseCity && (
            <div style={{ padding: '10px 12px', borderRadius: 4, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>
              <Cpu size={13} style={{ color: '#10b981' }} />
              <div>
                <div style={{ fontSize: 9, color: '#10b981', letterSpacing: '0.1em' }}>2x DRONES ASSIGNED</div>
                <div style={{ fontSize: 7, color: '#888', marginTop: 1 }}>STATIONED AT {cityLabel(droneBaseCity)}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderSummary = () => (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#00f0ff88', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={9} /> SAFEHOUSES</span>
          <span style={{ fontSize: 9, color: phase1Done ? '#10b981' : '#00f0ff' }}>{safehouseCities.size}/{safehouseCount}</span>
        </div>
        {[...safehouseCities].map(c => <div key={c} style={{ fontSize: 8, color: '#00f0ffaa', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>◆ {cityLabel(c)}</div>)}
        {safehouseCities.size === 0 && <div style={{ fontSize: 8, color: '#333', fontStyle: 'italic' }}>None placed</div>}
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#10b98188', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}><Users size={9} /> AGENTS</span>
          <span style={{ fontSize: 9, color: phase2Done ? '#10b981' : '#888' }}>{Object.keys(agentPlacements).length}/{agents.length}</span>
        </div>
        {agents.filter(a => agentPlacements[a.id]).map(a => <div key={a.id} style={{ fontSize: 8, color: '#10b981aa', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>▸ {a.codename} → {cityLabel(agentPlacements[a.id])}</div>)}
        {Object.keys(agentPlacements).length === 0 && <div style={{ fontSize: 8, color: '#333', fontStyle: 'italic' }}>None deployed</div>}
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#f59e0b88', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={9} /> COMBAT TEAMS</span>
          <span style={{ fontSize: 9, color: phase3Done ? '#10b981' : '#888' }}>{Object.keys(teamPlacements).length}/{teams.length}</span>
        </div>
        {teams.filter(t => teamPlacements[t.id]).map(t => <div key={t.id} style={{ fontSize: 8, color: '#f59e0baa', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>▸ {t.name} → {cityLabel(teamPlacements[t.id])}</div>)}
        {Object.keys(teamPlacements).length === 0 && <div style={{ fontSize: 8, color: '#333', fontStyle: 'italic' }}>None stationed</div>}
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: '#10b98188', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}><Cpu size={9} /> DRONE SYSTEM</span>
          <span style={{ fontSize: 9, color: phase4Done ? '#10b981' : '#888' }}>{droneBaseCity ? '1/1' : '0/1'}</span>
        </div>
        {droneBaseCity ? (
          <div style={{ fontSize: 8, color: '#10b981aa', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>◆ BASE → {cityLabel(droneBaseCity)} (2x Drones Stationed)</div>
        ) : (
          <div style={{ fontSize: 8, color: '#333', fontStyle: 'italic' }}>None established</div>
        )}
      </div>
      {allDone && (
        <button onClick={handleConfirm} disabled={submitting} className="flash-proceed"
          style={{ width: '100%', padding: '10px 0', border: '1px solid #10b981', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 10, letterSpacing: '0.12em', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s', fontFamily: "'Share Tech Mono','Courier New',monospace", '--flash-color': '#10b981', '--flash-bg-high': 'rgba(16,185,129,0.32)', '--flash-bg-low': 'rgba(16,185,129,0.06)' }}>
          {submitting ? 'DEPLOYING…' : '⚡ GO LIVE'}
        </button>
      )}
    </div>
  );

  const renderPhaseNav = () => (
    <div style={{ display: 'flex', gap: 8 }}>
      {phase < 4 && (
        <button onClick={() => {
          if (phase === 1 && phase1Done) setPhase(2);
          else if (phase === 2 && phase2Done) setPhase(3);
          else if (phase === 3 && phase3Done) setPhase(4);
          else addToast?.(`Complete ${currentPhase.label.toLowerCase()} first.`, 'warning');
        }}
          className={((phase === 1 && phase1Done) || (phase === 2 && phase2Done) || (phase === 3 && phase3Done)) ? 'flash-proceed' : ''}
          style={{ flex: 1, padding: '10px', border: `1px solid ${currentPhase.color}`, borderRadius: 4, background: `${currentPhase.color}18`, color: currentPhase.color, fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: "'Share Tech Mono','Courier New',monospace", opacity: ((phase === 1 && phase1Done) || (phase === 2 && phase2Done) || (phase === 3 && phase3Done)) ? 1 : 0.35, transition: 'all 0.2s', '--flash-color': currentPhase.color, '--flash-bg-high': `${currentPhase.color}3a`, '--flash-bg-low': `${currentPhase.color}0e` }}>
          NEXT PHASE →
        </button>
      )}
      {phase === 4 && (
        <button onClick={handleConfirm} disabled={!allDone || submitting}
          className={allDone ? 'flash-proceed' : ''}
          style={{ flex: 1, padding: '10px', border: `1px solid ${allDone ? '#10b981' : '#333'}`, borderRadius: 4, background: allDone ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)', color: allDone ? '#10b981' : '#444', fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, cursor: allDone ? 'pointer' : 'not-allowed', transition: 'all 0.2s', fontFamily: "'Share Tech Mono','Courier New',monospace", '--flash-color': '#10b981', '--flash-bg-high': 'rgba(16,185,129,0.32)', '--flash-bg-low': 'rgba(16,185,129,0.06)' }}>
          {submitting ? 'DEPLOYING…' : '⚡ CONFIRM DEPLOYMENT'}
        </button>
      )}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,4,12,0.95)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', fontFamily: "'Share Tech Mono','Courier New',monospace", overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,240,255,0.015) 2px,rgba(0,240,255,0.015) 4px)' }} />

      {/* Header */}
      <div style={{ padding: isMobile ? '10px 12px 8px' : '18px 24px 14px', borderBottom: '1px solid rgba(0,240,255,0.12)', background: 'rgba(0,240,255,0.03)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            {!isMobile && <div style={{ fontSize: 10, color: 'rgba(0,240,255,0.5)', letterSpacing: '0.2em', marginBottom: 3 }}>INITIAL DEPLOYMENT — CLASSIFIED OPERATION</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: isMobile ? 14 : 20, fontWeight: 700, color: '#00f0ff', letterSpacing: '0.08em' }}>
                {isMobile ? 'ASSET DEPLOYMENT' : 'ASSET DEPLOYMENT CONSOLE'}
              </div>
              <button onClick={handleSkip} disabled={submitting}
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,59,48,0.4)', background: 'rgba(255,59,48,0.1)', color: '#ff3b30', fontSize: 8, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.1em', fontFamily: "'Share Tech Mono','Courier New',monospace" }}>
                {submitting ? 'SKIPPING…' : 'SKIP'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
            {PHASES.map((p, i) => {
              const done = (p.id === 1 && phase1Done) || (p.id === 2 && phase2Done) || (p.id === 3 && phase3Done) || (p.id === 4 && phase4Done);
              const active = p.id === phase;
              return (
                <React.Fragment key={p.id}>
                  <div onClick={() => { if (p.id === 1) setPhase(1); if (p.id === 2 && phase1Done) setPhase(2); if (p.id === 3 && phase2Done) setPhase(3); if (p.id === 4 && phase3Done) setPhase(4); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: isMobile ? '5px 8px' : '6px 14px', borderRadius: 4, transition: 'all 0.2s',
                      cursor: (p.id === 1 || (p.id === 2 && phase1Done) || (p.id === 3 && phase2Done)) ? 'pointer' : 'not-allowed',
                      border: `1px solid ${active ? p.color : done ? '#ffffff30' : '#ffffff18'}`,
                      background: active ? `${p.color}18` : done ? '#ffffff08' : 'transparent',
                      opacity: !done && !active && p.id > phase ? 0.35 : 1,
                    }}>
                    {done ? <CheckCircle size={10} style={{ color: p.color }} /> : <p.icon size={10} style={{ color: active ? p.color : '#888' }} />}
                    {!isMobile && <span style={{ fontSize: 9, color: active ? p.color : done ? '#aaa' : '#555', letterSpacing: '0.1em' }}>{p.label}</span>}
                  </div>
                  {i < PHASES.length - 1 && <ChevronRight size={10} style={{ color: '#333' }} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <div style={{ marginTop: 8, height: 2, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', transition: 'width 0.4s ease', background: `linear-gradient(90deg, #00f0ff, ${currentPhase.color})`,
            width: `${Math.round(((phase - 1) / 3 + (
              phase === 1 ? safehouseCities.size / Math.max(safehouseCount, 1) / 3 :
              phase === 2 ? (agents.length - unplacedAgents.length) / Math.max(agents.length, 1) / 3 :
              (teams.length - unplacedTeams.length) / Math.max(teams.length, 1) / 3
            )) * 100)}%` }} />
        </div>
      </div>

      {/* Body */}
      {isMobile ? (
        <>
          {/* Mobile: scrollable content panel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <div style={{ padding: '8px 12px', borderRadius: 4, marginBottom: 10, background: `${currentPhase.color}0e`, border: `1px solid ${currentPhase.color}30`, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertTriangle size={11} style={{ color: currentPhase.color, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 9, color: currentPhase.color, letterSpacing: '0.07em' }}>
                {phase === 1 && `Tap ASSETS tab → select a safehouse → CITIES tab → tap a city. Repeat ${safehouseCount}x.`}
                {phase === 2 && 'Tap ASSETS tab → select an agent → CITIES tab → tap a safehouse city.'}
                {phase === 3 && 'Tap ASSETS tab → select a team → CITIES tab → tap a safehouse city.'}
              </span>
            </div>
            {selected && (
              <div style={{ padding: '8px 12px', marginBottom: 10, background: `${currentPhase.color}18`, border: `1px solid ${currentPhase.color}`, borderRadius: 4, fontSize: 10, color: currentPhase.color, textAlign: 'center', letterSpacing: '0.08em' }}>
                ✓ SELECTED: {selected.label} — NOW TAP A CITY
              </div>
            )}
            {mobilePanel === 'assets'  && renderAssets()}
            {mobilePanel === 'cities'  && renderCities()}
            {mobilePanel === 'summary' && renderSummary()}
          </div>
          {/* Phase nav */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {renderPhaseNav()}
          </div>
          {/* Bottom tab bar */}
          <div style={{ display: 'flex', borderTop: '1px solid rgba(0,240,255,0.15)', background: 'rgba(0,0,0,0.8)', flexShrink: 0 }}>
            {[
              { id: 'assets',  label: 'ASSETS',  Icon: PhaseIcon },
              { id: 'cities',  label: 'CITIES',  Icon: MapPin },
              { id: 'summary', label: 'SUMMARY', Icon: List },
            ].map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setMobilePanel(id)}
                style={{ flex: 1, padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: mobilePanel === id ? `${currentPhase.color}18` : 'transparent', border: 'none', borderTop: mobilePanel === id ? `2px solid ${currentPhase.color}` : '2px solid transparent', color: mobilePanel === id ? currentPhase.color : '#555', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Share Tech Mono','Courier New',monospace" }}>
                <Icon size={16} />
                <span style={{ fontSize: 8, letterSpacing: '0.08em' }}>{label}</span>
                {id === 'assets' && selected && <span style={{ fontSize: 7, color: currentPhase.color }}>●</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Desktop: 3-column */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* LEFT: Assets */}
          <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid rgba(0,240,255,0.1)', background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.15em', marginBottom: 2 }}>ASSETS TO DEPLOY</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PhaseIcon size={12} style={{ color: currentPhase.color }} />
                <span style={{ fontSize: 11, color: currentPhase.color, letterSpacing: '0.1em' }}>{currentPhase.label}</span>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>{renderAssets()}</div>
            <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {renderPhaseNav()}
              {!allDone && phase < 3 && (
                <div style={{ fontSize: 8, color: '#444', textAlign: 'center', letterSpacing: '0.08em' }}>
                  {phase === 1 && `${remainingSafehouses} SAFEHOUSE${remainingSafehouses !== 1 ? 'S' : ''} REMAINING`}
                  {phase === 2 && `${unplacedAgents.length} AGENT${unplacedAgents.length !== 1 ? 'S' : ''} TO PLACE`}
                </div>
              )}
            </div>
          </div>

          {/* CENTER: Cities */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: '8px 14px', borderRadius: 4, marginBottom: 4, background: `${currentPhase.color}0e`, border: `1px solid ${currentPhase.color}30`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={12} style={{ color: currentPhase.color, flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: currentPhase.color, letterSpacing: '0.1em' }}>
                {phase === 1 && `DRAG SAFEHOUSE TOKENS ONTO CITIES — SELECT ${safehouseCount} OUT OF ${nodes.length} CITIES`}
                {phase === 2 && 'DRAG FIELD AGENTS ONTO HIGHLIGHTED SAFEHOUSE CITIES'}
                {phase === 3 && 'STATION COMBAT TEAMS IN SAFEHOUSE CITIES'}
              </span>
            </div>
            {renderCities()}
          </div>

          {/* RIGHT: Summary */}
          <div style={{ width: 200, flexShrink: 0, borderLeft: '1px solid rgba(0,240,255,0.1)', background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.15em' }}>DEPLOYMENT SUMMARY</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>{renderSummary()}</div>
          </div>
        </div>
      )}

      {/* Drag indicator – desktop only */}
      {(dragging || selected) && !isMobile && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', padding: '8px 16px', background: `${currentPhase.color}22`, border: `1px solid ${currentPhase.color}`, borderRadius: 4, fontSize: 10, color: currentPhase.color, letterSpacing: '0.12em', pointerEvents: 'none', boxShadow: `0 0 20px ${currentPhase.color}40` }}>
          {dragging ? `DRAGGING: ${dragging.label} — DROP ON A CITY` : `SELECTED: ${selected?.label} — TAP A CITY TO PLACE`}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes proceed-flash {
          0%, 100% { box-shadow: 0 0 14px var(--flash-color); background-color: var(--flash-bg-high); border-color: var(--flash-color); }
          50% { box-shadow: 0 0 2px transparent; background-color: var(--flash-bg-low); border-color: rgba(255,255,255,0.1); }
        }
        .flash-proceed { animation: proceed-flash 1.4s infinite; }
      `}</style>
    </div>
  );
}
