import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Shield, Users, MapPin, CheckCircle, ChevronRight, AlertTriangle, X } from 'lucide-react';
import { GAME_API_BASE } from '../config';
import { fetchWithRetry } from '../utils/api';

// ── Phase definitions ───────────────────────────────────────────────────────
const PHASES = [
  { id: 1, key: 'safehouses', label: 'ESTABLISH SAFEHOUSES',  icon: Shield,  color: '#00f0ff', dim: '#00f0ff33' },
  { id: 2, key: 'agents',     label: 'DEPLOY FIELD AGENTS',   icon: Users,   color: '#10b981', dim: '#10b98133' },
  { id: 3, key: 'teams',      label: 'STATION COMBAT TEAMS',  icon: MapPin,  color: '#f59e0b', dim: '#f59e0b33' },
];

// ── Helper: territory colour ────────────────────────────────────────────────
const territoryColor = (territory) =>
  territory === 'HOME_TERRITORY' ? '#00f0ff' : territory === 'HOSTILE_TERRITORY' ? '#ff3b30' : '#a0a0a0';

const territoryLabel = (territory) =>
  territory === 'HOME_TERRITORY' ? 'FRIENDLY' : territory === 'HOSTILE_TERRITORY' ? 'HOSTILE' : 'NEUTRAL';

export default function DeploymentScreen({ session, activeScenario, onDeploymentComplete, addToast }) {
  const nodes = activeScenario?.nodes || [];

  // ── Number of safehouses: floor(cities / 2) ───────────────────────────────
  const safehouseCount = Math.floor(nodes.length / 2);

  // ── Deployment state ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState(1);
  // safehouses: Set of cityIds where a safehouse has been placed
  const [safehouseCities, setSafehouseCities] = useState(new Set());
  // agents: { agentId(int) -> cityId(str) }
  const [agentPlacements, setAgentPlacements] = useState({});
  // teams: { teamId(int) -> cityId(str) }
  const [teamPlacements, setTeamPlacements]   = useState({});

  // ── Drag state ────────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(null); // { type, id, label }
  const [dragOver,  setDragOver]  = useState(null); // cityId currently hovered

  // ── Mobile: tap-to-select then tap-city ──────────────────────────────────
  const [selected, setSelected] = useState(null); // same structure as dragging

  // ── Submission state ─────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Derived: cities that have at least one safehouse ─────────────────────
  const safehouseSet = safehouseCities; // alias

  // ── Unplaced items per phase ──────────────────────────────────────────────
  const agents = session.agents || [];
  const teams  = session.tacticalTeams || [];

  const unplacedAgents = agents.filter(a => agentPlacements[a.id] === undefined);
  const unplacedTeams  = teams.filter(t  => teamPlacements[t.id]  === undefined);

  const remainingSafehouses = safehouseCount - safehouseCities.size;

  // ── Phase completion gates ────────────────────────────────────────────────
  const phase1Done = safehouseCities.size >= safehouseCount;
  const phase2Done = phase1Done && unplacedAgents.length === 0;
  const phase3Done = phase2Done && unplacedTeams.length  === 0;
  const allDone    = phase3Done;

  // ── City validity per phase ───────────────────────────────────────────────
  const isCityValid = useCallback((cityId) => {
    if (phase === 1) return safehouseCities.size < safehouseCount && !safehouseCities.has(cityId);
    if (phase === 2) return safehouseCities.has(cityId) && selected !== null;
    if (phase === 3) return safehouseCities.has(cityId) && selected !== null;
    return false;
  }, [phase, safehouseCities, safehouseCount, selected]);

  // ── Drop handler ──────────────────────────────────────────────────────────
  const handleCityDrop = useCallback((cityId) => {
    if (!dragging && !selected) return;
    const active = dragging || selected;

    if (phase === 1 && active.type === 'safehouse') {
      if (safehouseCities.has(cityId)) {
        // Toggle off
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
    }
    setDragging(null);
    setSelected(null);
    setDragOver(null);
  }, [dragging, selected, phase, safehouseCities, safehouseCount]);

  // ── Remove placement ─────────────────────────────────────────────────────
  const removeSafehouse = (cityId) =>
    setSafehouseCities(prev => { const s = new Set(prev); s.delete(cityId); return s; });
  const removeAgent = (agentId) =>
    setAgentPlacements(prev => { const n = { ...prev }; delete n[agentId]; return n; });
  const removeTeam = (teamId) =>
    setTeamPlacements(prev => { const n = { ...prev }; delete n[teamId]; return n; });

  // ── Confirm deployment ────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!allDone || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        safehouses: [...safehouseCities],
        agentDeployments: Object.fromEntries(
          Object.entries(agentPlacements).map(([k, v]) => [String(k), v])
        ),
        teamDeployments: Object.fromEntries(
          Object.entries(teamPlacements).map(([k, v]) => [String(k), v])
        ),
      };
      const token = localStorage.getItem('spy_game_token');
      const res = await fetch(`${GAME_API_BASE}/${session.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Deployment rejected by server.');
      const updated = await res.json();
      addToast?.('Assets deployed. Operation is LIVE.', 'success');
      onDeploymentComplete(updated);
    } catch (err) {
      addToast?.(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Skip deployment (Load default config values) ──────────────────────────
  const handleSkip = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const defaultSafehouses = (activeScenario?.startingDefenderSafehouses || []).map(s => s.cityId);
      const defaultAgents = {};
      (activeScenario?.agents || []).forEach(a => {
        defaultAgents[String(a.id)] = a.startingCity;
      });
      const defaultTeams = {};
      (activeScenario?.tacticalTeams || []).forEach(t => {
        defaultTeams[String(t.id)] = t.startingCity;
      });

      const payload = {
        safehouses: defaultSafehouses,
        agentDeployments: defaultAgents,
        teamDeployments: defaultTeams,
      };

      const token = localStorage.getItem('spy_game_token');
      const res = await fetch(`${GAME_API_BASE}/${session.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to load default deployment config.');
      const updated = await res.json();
      addToast?.('Loaded default deployments.', 'info');
      onDeploymentComplete(updated);
    } catch (err) {
      addToast?.(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── City label ────────────────────────────────────────────────────────────
  const cityLabel = (cityId) =>
    nodes.find(n => n.id === cityId)?.name || cityId?.replace(/_/g, ' ').toUpperCase() || cityId;

  // ── What's placed in a city for the summary ───────────────────────────────
  const cityContents = (cityId) => {
    const hasSH   = safehouseCities.has(cityId);
    const myAgents = agents.filter(a => agentPlacements[a.id] === cityId);
    const myTeams  = teams.filter(t  => teamPlacements[t.id]  === cityId);
    return { hasSH, myAgents, myTeams };
  };

  // ── Tap handler for mobile ────────────────────────────────────────────────
  const handleAssetTap = (type, id, label) => {
    if (selected?.type === type && selected?.id === id) {
      setSelected(null);
    } else {
      setSelected({ type, id, label });
    }
  };

  const handleCityTap = (cityId) => {
    if (selected) {
      handleCityDrop(cityId);
    }
  };

  const currentPhase = PHASES[phase - 1];
  const PhaseIcon = currentPhase.icon;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,4,12,0.82)',
      backdropFilter: 'blur(3px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Share Tech Mono', 'Courier New', monospace",
      overflow: 'hidden',
    }}>
      {/* ── Scanline / grid overlay ──────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,240,255,0.015) 2px,rgba(0,240,255,0.015) 4px)',
      }} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: '18px 24px 14px',
        borderBottom: '1px solid rgba(0,240,255,0.12)',
        background: 'rgba(0,240,255,0.03)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(0,240,255,0.5)', letterSpacing: '0.2em', marginBottom: 4 }}>
              INITIAL DEPLOYMENT — CLASSIFIED OPERATION
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#00f0ff', letterSpacing: '0.1em' }}>
                ASSET DEPLOYMENT CONSOLE
              </div>
              <button
                onClick={handleSkip}
                disabled={submitting}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid rgba(255, 59, 48, 0.4)',
                  background: 'rgba(255, 59, 48, 0.1)',
                  color: '#ff3b30',
                  fontSize: 9,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.1em',
                  transition: 'all 0.2s',
                  fontFamily: "'Share Tech Mono', 'Courier New', monospace",
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 59, 48, 0.2)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 59, 48, 0.1)'; }}
              >
                {submitting ? 'SKIPPING…' : 'SKIP (LOAD DEFAULTS)'}
              </button>
            </div>
          </div>
          {/* Phase stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {PHASES.map((p, i) => {
              const done = (p.id === 1 && phase1Done) || (p.id === 2 && phase2Done) || (p.id === 3 && phase3Done);
              const active = p.id === phase;
              return (
                <React.Fragment key={p.id}>
                  <div
                    onClick={() => {
                      if (p.id === 1) setPhase(1);
                      if (p.id === 2 && phase1Done) setPhase(2);
                      if (p.id === 3 && phase2Done) setPhase(3);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                      borderRadius: 4, cursor: (p.id === 1 || (p.id === 2 && phase1Done) || (p.id === 3 && phase2Done)) ? 'pointer' : 'not-allowed',
                      border: `1px solid ${active ? p.color : done ? '#ffffff30' : '#ffffff18'}`,
                      background: active ? `${p.color}18` : done ? '#ffffff08' : 'transparent',
                      opacity: !done && !active && p.id > phase ? 0.35 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {done ? (
                      <CheckCircle size={12} style={{ color: p.color }} />
                    ) : (
                      <p.icon size={12} style={{ color: active ? p.color : '#888' }} />
                    )}
                    <span style={{ fontSize: 9, color: active ? p.color : done ? '#aaa' : '#555', letterSpacing: '0.12em' }}>
                      {p.label}
                    </span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <ChevronRight size={12} style={{ color: '#333' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 10, height: 2, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.round(((phase - 1) / 3 + (
              phase === 1 ? safehouseCities.size / safehouseCount / 3 :
              phase === 2 ? (agents.length - unplacedAgents.length) / Math.max(agents.length, 1) / 3 :
              (teams.length - unplacedTeams.length) / Math.max(teams.length, 1) / 3
            )) * 100)}%`,
            background: `linear-gradient(90deg, #00f0ff, ${currentPhase.color})`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

        {/* ── LEFT: Asset panel ─────────────────────────────────────────── */}
        <div style={{
          width: 240, flexShrink: 0,
          borderRight: '1px solid rgba(0,240,255,0.1)',
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.15em', marginBottom: 2 }}>ASSETS TO DEPLOY</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <PhaseIcon size={12} style={{ color: currentPhase.color }} />
              <span style={{ fontSize: 11, color: currentPhase.color, letterSpacing: '0.1em' }}>
                {currentPhase.label}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Phase 1: Safehouse tokens */}
            {phase === 1 && (
              <>
                <div style={{ fontSize: 9, color: '#666', marginBottom: 4, letterSpacing: '0.1em' }}>
                  PLACE {safehouseCount} SAFEHOUSES
                  <span style={{ color: remainingSafehouses > 0 ? currentPhase.color : '#10b981', marginLeft: 8 }}>
                    {remainingSafehouses > 0 ? `${remainingSafehouses} REMAINING` : '✓ ALL PLACED'}
                  </span>
                </div>
                {Array.from({ length: safehouseCount }).map((_, i) => {
                  const placed = i < safehouseCities.size;
                  return (
                    <div
                      key={i}
                      draggable={!placed}
                      onDragStart={() => !placed && setDragging({ type: 'safehouse', id: `sh-${i}`, label: `SAFEHOUSE ALPHA-${i + 1}` })}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => !placed && handleAssetTap('safehouse', `sh-${i}`, `SAFEHOUSE ALPHA-${i + 1}`)}
                      style={{
                        padding: '10px 12px',
                        border: `1px solid ${placed ? '#10b98140' : selected?.id === `sh-${i}` ? currentPhase.color : 'rgba(0,240,255,0.2)'}`,
                        borderRadius: 4,
                        background: placed ? 'rgba(16,185,129,0.05)' : selected?.id === `sh-${i}` ? `${currentPhase.color}18` : 'rgba(0,240,255,0.04)',
                        cursor: placed ? 'default' : 'grab',
                        opacity: placed ? 0.4 : 1,
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <Shield size={14} style={{ color: placed ? '#10b981' : currentPhase.color }} />
                      <div>
                        <div style={{ fontSize: 9, color: placed ? '#10b981' : currentPhase.color, letterSpacing: '0.1em' }}>
                          SAFEHOUSE {String(i + 1).padStart(2, '0')}
                        </div>
                        <div style={{ fontSize: 8, color: '#555', marginTop: 1 }}>
                          {placed ? 'PLACED' : 'DRAG TO CITY'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Phase 2: Agents */}
            {phase === 2 && (
              <>
                <div style={{ fontSize: 9, color: '#666', marginBottom: 4, letterSpacing: '0.1em' }}>
                  {unplacedAgents.length > 0
                    ? `${unplacedAgents.length} AGENTS UNDEPLOYED`
                    : '✓ ALL AGENTS DEPLOYED'}
                </div>
                {unplacedAgents.map(a => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={() => setDragging({ type: 'agent', id: a.id, label: a.codename })}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => handleAssetTap('agent', a.id, a.codename)}
                    style={{
                      padding: '10px 12px',
                      border: `1px solid ${selected?.id === a.id ? currentPhase.color : 'rgba(16,185,129,0.25)'}`,
                      borderRadius: 4,
                      background: selected?.id === a.id ? `${currentPhase.color}18` : 'rgba(16,185,129,0.04)',
                      cursor: 'grab',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 10, color: currentPhase.color, letterSpacing: '0.08em' }}>{a.codename}</div>
                    <div style={{ fontSize: 8, color: '#666', marginTop: 2 }}>{a.name}</div>
                    <div style={{ fontSize: 8, color: '#444', marginTop: 1 }}>DRAG TO SAFEHOUSE CITY</div>
                  </div>
                ))}
                {/* Placed agents summary */}
                {agents.filter(a => agentPlacements[a.id]).map(a => (
                  <div
                    key={a.id}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid rgba(16,185,129,0.15)',
                      borderRadius: 4,
                      background: 'rgba(16,185,129,0.04)',
                      opacity: 0.6,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 9, color: '#10b981', letterSpacing: '0.08em' }}>{a.codename}</div>
                      <div style={{ fontSize: 8, color: '#555' }}>→ {cityLabel(agentPlacements[a.id])}</div>
                    </div>
                    <button
                      onClick={() => removeAgent(a.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 2 }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* Phase 3: Teams */}
            {phase === 3 && (
              <>
                <div style={{ fontSize: 9, color: '#666', marginBottom: 4, letterSpacing: '0.1em' }}>
                  {unplacedTeams.length > 0
                    ? `${unplacedTeams.length} TEAMS UNDEPLOYED`
                    : '✓ ALL TEAMS DEPLOYED'}
                </div>
                {unplacedTeams.map(t => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragging({ type: 'team', id: t.id, label: t.name })}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => handleAssetTap('team', t.id, t.name)}
                    style={{
                      padding: '10px 12px',
                      border: `1px solid ${selected?.id === t.id ? currentPhase.color : 'rgba(245,158,11,0.25)'}`,
                      borderRadius: 4,
                      background: selected?.id === t.id ? `${currentPhase.color}18` : 'rgba(245,158,11,0.04)',
                      cursor: 'grab',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 10, color: currentPhase.color, letterSpacing: '0.08em' }}>{t.name}</div>
                    <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>{t.operatingCountry}</div>
                    <div style={{ fontSize: 8, color: '#444', marginTop: 1 }}>DRAG TO SAFEHOUSE CITY</div>
                  </div>
                ))}
                {teams.filter(t => teamPlacements[t.id]).map(t => (
                  <div
                    key={t.id}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid rgba(245,158,11,0.15)',
                      borderRadius: 4,
                      background: 'rgba(245,158,11,0.04)',
                      opacity: 0.6,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 9, color: '#f59e0b', letterSpacing: '0.08em' }}>{t.name}</div>
                      <div style={{ fontSize: 8, color: '#555' }}>→ {cityLabel(teamPlacements[t.id])}</div>
                    </div>
                    <button
                      onClick={() => removeTeam(t.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 2 }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Phase navigation */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {phase < 3 && (
              <button
                onClick={() => {
                  if (phase === 1 && phase1Done) setPhase(2);
                  else if (phase === 2 && phase2Done) setPhase(3);
                  else addToast?.(`Complete ${currentPhase.label.toLowerCase()} first.`, 'warning');
                }}
                className={(phase === 1 && phase1Done) || (phase === 2 && phase2Done) ? 'flash-proceed' : ''}
                style={{
                  padding: '9px', border: `1px solid ${currentPhase.color}`, borderRadius: 4,
                  background: `${currentPhase.color}18`, color: currentPhase.color,
                  fontSize: 10, letterSpacing: '0.12em', cursor: 'pointer',
                  opacity: (phase === 1 && phase1Done) || (phase === 2 && phase2Done) ? 1 : 0.35,
                  transition: 'all 0.2s',
                  '--flash-color': currentPhase.color,
                  '--flash-bg-high': `${currentPhase.color}3a`,
                  '--flash-bg-low': `${currentPhase.color}0e`,
                }}
              >
                NEXT PHASE →
              </button>
            )}
            {phase === 3 && (
              <button
                onClick={handleConfirm}
                disabled={!allDone || submitting}
                className={allDone ? 'flash-proceed' : ''}
                style={{
                  padding: '10px', border: `1px solid ${allDone ? '#10b981' : '#333'}`,
                  borderRadius: 4,
                  background: allDone ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)',
                  color: allDone ? '#10b981' : '#444',
                  fontSize: 10, letterSpacing: '0.12em',
                  cursor: allDone ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  fontWeight: 700,
                  '--flash-color': '#10b981',
                  '--flash-bg-high': 'rgba(16,185,129,0.32)',
                  '--flash-bg-low': 'rgba(16,185,129,0.06)',
                }}
              >
                {submitting ? 'DEPLOYING…' : '⚡ CONFIRM DEPLOYMENT'}
              </button>
            )}
            {!allDone && phase < 3 && (
              <div style={{ fontSize: 8, color: '#444', textAlign: 'center', letterSpacing: '0.08em' }}>
                {phase === 1 && `${remainingSafehouses} SAFEHOUSE${remainingSafehouses !== 1 ? 'S' : ''} REMAINING`}
                {phase === 2 && `${unplacedAgents.length} AGENT${unplacedAgents.length !== 1 ? 'S' : ''} TO PLACE`}
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: City grid ─────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Instruction banner */}
          <div style={{
            padding: '8px 14px', borderRadius: 4, marginBottom: 4,
            background: `${currentPhase.color}0e`,
            border: `1px solid ${currentPhase.color}30`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={12} style={{ color: currentPhase.color, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: currentPhase.color, letterSpacing: '0.1em' }}>
              {phase === 1 && `DRAG SAFEHOUSE TOKENS ONTO CITIES BELOW — SELECT ${safehouseCount} OUT OF ${nodes.length} CITIES`}
              {phase === 2 && 'DRAG FIELD AGENTS ONTO HIGHLIGHTED SAFEHOUSE CITIES — ONLY SAFEHOUSE CITIES ARE VALID'}
              {phase === 3 && 'STATION COMBAT TEAMS IN SAFEHOUSE CITIES — ALL TEAMS MUST BE DEPLOYED BEFORE PROCEEDING'}
            </span>
          </div>

          {/* City grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
          }}>
            {nodes.map(node => {
              const { hasSH, myAgents, myTeams } = cityContents(node.id);
              const tColor = territoryColor(node.territory);

              // Compute drop-target validity
              const isValidDrop =
                phase === 1 ? (!hasSH && safehouseCities.size < safehouseCount) :
                phase === 2 ? (hasSH && (dragging?.type === 'agent' || selected?.type === 'agent')) :
                phase === 3 ? (hasSH && (dragging?.type === 'team'  || selected?.type === 'team')) :
                false;

              const isDimmed =
                (phase === 2 && !hasSH) ||
                (phase === 3 && !hasSH);

              const isHovered = dragOver === node.id && isValidDrop;

              return (
                <div
                  key={node.id}
                  onDragOver={e => { e.preventDefault(); setDragOver(node.id); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleCityDrop(node.id)}
                  onClick={() => handleCityTap(node.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 6,
                    border: `1px solid ${
                      isHovered   ? currentPhase.color :
                      hasSH       ? '#00f0ff40' :
                      isDimmed    ? '#ffffff08' :
                      '#ffffff14'
                    }`,
                    background: isHovered
                      ? `${currentPhase.color}18`
                      : hasSH
                        ? 'rgba(0,240,255,0.05)'
                        : isDimmed
                          ? 'rgba(0,0,0,0.2)'
                          : 'rgba(255,255,255,0.02)',
                    opacity: isDimmed ? 0.4 : 1,
                    cursor: isValidDrop || (selected && hasSH) ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                    position: 'relative',
                    boxShadow: isHovered ? `0 0 12px ${currentPhase.color}40` : hasSH ? '0 0 8px rgba(0,240,255,0.12)' : 'none',
                  }}
                >
                  {/* Territory badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{
                      fontSize: 8, color: tColor, letterSpacing: '0.15em',
                      padding: '2px 5px', border: `1px solid ${tColor}40`,
                      borderRadius: 2, background: `${tColor}12`,
                    }}>
                      {territoryLabel(node.territory)}
                    </span>
                    {hasSH && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Shield size={10} style={{ color: '#00f0ff' }} />
                        {phase === 1 && (
                          <button
                            onClick={e => { e.stopPropagation(); removeSafehouse(node.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b3080', padding: 0 }}
                          >
                            <X size={9} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* City name */}
                  <div style={{ fontSize: 12, color: hasSH ? '#e0f8ff' : isDimmed ? '#333' : '#888', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>
                    {(node.name || node.id).replace(/_/g, ' ').toUpperCase()}
                  </div>

                  {/* Placed assets */}
                  {myAgents.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {myAgents.map(a => (
                        <span
                          key={a.id}
                          onClick={e => { e.stopPropagation(); removeAgent(a.id); }}
                          style={{
                            fontSize: 8, color: '#10b981', background: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.3)', borderRadius: 3,
                            padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                          }}
                        >
                          <Users size={7} /> {a.codename}
                        </span>
                      ))}
                    </div>
                  )}
                  {myTeams.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {myTeams.map(t => (
                        <span
                          key={t.id}
                          onClick={e => { e.stopPropagation(); removeTeam(t.id); }}
                          style={{
                            fontSize: 8, color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                            border: '1px solid rgba(245,158,11,0.3)', borderRadius: 3,
                            padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                          }}
                        >
                          <MapPin size={7} /> {t.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Drop target glow */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none',
                      border: `2px solid ${currentPhase.color}`,
                      boxShadow: `inset 0 0 16px ${currentPhase.color}30`,
                      animation: 'pulse 1s ease-in-out infinite',
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Summary panel ─────────────────────────────────────── */}
        <div style={{
          width: 200, flexShrink: 0,
          borderLeft: '1px solid rgba(0,240,255,0.1)',
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.15em' }}>DEPLOYMENT SUMMARY</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {/* Safehouses */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: '#00f0ff88', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={9} /> SAFEHOUSES
                </div>
                <span style={{ fontSize: 9, color: phase1Done ? '#10b981' : '#00f0ff' }}>
                  {safehouseCities.size}/{safehouseCount}
                </span>
              </div>
              {[...safehouseCities].map(cid => (
                <div key={cid} style={{ fontSize: 8, color: '#00f0ffaa', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  ◆ {cityLabel(cid)}
                </div>
              ))}
              {safehouseCities.size === 0 && (
                <div style={{ fontSize: 8, color: '#333', fontStyle: 'italic' }}>None placed</div>
              )}
            </div>

            {/* Agents */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: '#10b98188', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={9} /> AGENTS
                </div>
                <span style={{ fontSize: 9, color: phase2Done ? '#10b981' : '#888' }}>
                  {Object.keys(agentPlacements).length}/{agents.length}
                </span>
              </div>
              {agents.filter(a => agentPlacements[a.id]).map(a => (
                <div key={a.id} style={{ fontSize: 8, color: '#10b981aa', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  ▸ {a.codename} → {cityLabel(agentPlacements[a.id])}
                </div>
              ))}
              {Object.keys(agentPlacements).length === 0 && (
                <div style={{ fontSize: 8, color: '#333', fontStyle: 'italic' }}>None deployed</div>
              )}
            </div>

            {/* Teams */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: '#f59e0b88', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={9} /> COMBAT TEAMS
                </div>
                <span style={{ fontSize: 9, color: phase3Done ? '#10b981' : '#888' }}>
                  {Object.keys(teamPlacements).length}/{teams.length}
                </span>
              </div>
              {teams.filter(t => teamPlacements[t.id]).map(t => (
                <div key={t.id} style={{ fontSize: 8, color: '#f59e0baa', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  ▸ {t.name} → {cityLabel(teamPlacements[t.id])}
                </div>
              ))}
              {Object.keys(teamPlacements).length === 0 && (
                <div style={{ fontSize: 8, color: '#333', fontStyle: 'italic' }}>None stationed</div>
              )}
            </div>
          </div>

          {/* Confirm CTA at bottom of summary */}
          {allDone && (
            <div style={{ padding: 10, borderTop: '1px solid rgba(16,185,129,0.2)' }}>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flash-proceed"
                style={{
                  width: '100%', padding: '10px 0',
                  border: '1px solid #10b981', borderRadius: 4,
                  background: 'rgba(16,185,129,0.15)', color: '#10b981',
                  fontSize: 10, letterSpacing: '0.12em', cursor: 'pointer', fontWeight: 700,
                  transition: 'all 0.2s',
                  '--flash-color': '#10b981',
                  '--flash-bg-high': 'rgba(16,185,129,0.32)',
                  '--flash-bg-low': 'rgba(16,185,129,0.06)',
                }}
              >
                {submitting ? 'DEPLOYING…' : '⚡ GO LIVE'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drag-in-progress floating indicator */}
      {(dragging || selected) && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 16px',
          background: `${currentPhase.color}22`,
          border: `1px solid ${currentPhase.color}`,
          borderRadius: 4, fontSize: 10, color: currentPhase.color,
          letterSpacing: '0.12em', pointerEvents: 'none',
          boxShadow: `0 0 20px ${currentPhase.color}40`,
        }}>
          {dragging
            ? `DRAGGING: ${dragging.label} — DROP ON A CITY`
            : `SELECTED: ${selected?.label} — TAP A CITY TO PLACE`
          }
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        @keyframes proceed-flash {
          0%, 100% {
            box-shadow: 0 0 14px var(--flash-color);
            background-color: var(--flash-bg-high);
            border-color: var(--flash-color);
          }
          50% {
            box-shadow: 0 0 2px transparent;
            background-color: var(--flash-bg-low);
            border-color: rgba(255,255,255,0.1);
          }
        }
        .flash-proceed {
          animation: proceed-flash 1.4s infinite;
        }
      `}</style>
    </div>
  );
}
