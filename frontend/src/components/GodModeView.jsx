import React, { useState } from 'react';
import { Sliders, Shield, Target, AlertTriangle } from 'lucide-react';

export default function GodModeView({ 
  replayTurn, 
  setReplayTurn, 
  session,
  onRevertTurn,
  nodes = []
}) {
  const currentTurn = session?.currentTurn || 1;
  const [activeGodTab, setActiveGodTab] = useState('timeline'); // 'timeline' or 'safehouses'

  // Track the actual positions of the Attackers dynamically from the AI master plan
  const getAttackersForTurn = (t) => {
    const planSteps = session?.aiMasterPlan?.primaryPlan || [];
    const step = planSteps.find(s => s.turn === t);
    if (step && step.attackerHistories && step.attackerHistories.length > 0) {
      return step.attackerHistories;
    }
    // Fallback to legacy single location structure
    return [{
      name: session?.actualAttacker || 'Suspect',
      location: step?.suspectLocation || session?.suspectLocation || 'karachi',
      state: step?.phase || session?.activeAttackerPhase || 'Initial decoy',
      eliminated: false
    }];
  };

  // Find Defender activity/relocations for this turn
  const getDefenderEventsForTurn = (t) => {
    return (session?.discoveredClues || []).filter(c => 
      c.turnDiscovered === t && 
      (c.source === 'TACTICAL_FORCE' || c.source === 'SECURITY_SWEEP_LOSS' || c.source === 'SECURITY_SWEEP_ALERT' || c.source === 'COMMAND_CENTER' || c.source === 'BORDER_INCIDENT' || c.source === 'SAFEHOUSE_ATTACK')
    );
  };

  // Get other major actions (finance, logistics, handovers, safehouse builds)
  const getMajorActionsForTurn = (t) => {
    const allowedSources = [
      'FINANCE_REQUESTED', 'FINANCE_SOURCED', 'LOGISTICS_REQUESTED', 'LOGISTICS_SOURCED',
      'HANDOVER_INITIATED', 'HANDOVER_COMPLETED', 'HANDOVER_UNLOCKED', 'INFILTRATION_APPROVED',
      'SAFEHOUSE_EXPOSED', 'STRIKE_EXECUTED', 'BORDER_GUARD', 'TRANSIT_CHECKPOINT'
    ];
    return (session?.discoveredClues || []).filter(c => 
      c.turnDiscovered === t && 
      allowedSources.includes(c.source)
    );
  };

  const steps = [];
  for (let t = 1; t <= currentTurn; t++) {
    steps.push({
      turn: t,
      attackers: getAttackersForTurn(t),
      defenderEvents: getDefenderEventsForTurn(t),
      actions: getMajorActionsForTurn(t)
    });
  }

  const selectedStep = steps.find(s => s.turn === (replayTurn > currentTurn ? currentTurn : replayTurn)) || steps[steps.length - 1];

  return (
    <div className="clues-view">
      <div className="clues-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
        <div className="clues-header-left">
          <h2 style={{ fontSize: '13px', margin: 0 }}>TACTICAL TIMELINE TELEMETRY</h2>
          <p className="clues-subtitle" style={{ fontSize: '9.5px', marginTop: '2px' }}>God View tracking turn-by-turn history of positions, combat deployments, and safehouse status</p>
        </div>
        {onRevertTurn && session?.turnHistory && session.turnHistory.length > 0 && (
          <button 
            onClick={onRevertTurn}
            style={{
              padding: '6px 12px',
              border: '1px solid #f97316',
              color: '#f97316',
              background: 'rgba(249,115,22,0.06)',
              fontFamily: 'monospace',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 0 10px rgba(249,115,22,0.1)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.06)'}
          >
            ⚠ REVERT LAST TURN
          </button>
        )}
      </div>

      {/* God Mode Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(0, 240, 255, 0.15)', paddingBottom: '10px' }}>
        <button 
          onClick={() => setActiveGodTab('timeline')}
          style={{
            padding: '6px 16px',
            border: activeGodTab === 'timeline' ? '1px solid var(--cyan)' : '1px solid transparent',
            background: activeGodTab === 'timeline' ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
            color: activeGodTab === 'timeline' ? 'var(--cyan)' : '#888',
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 700,
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          TIMELINE
        </button>
        <button 
          onClick={() => setActiveGodTab('safehouses')}
          style={{
            padding: '6px 16px',
            border: activeGodTab === 'safehouses' ? '1px solid var(--cyan)' : '1px solid transparent',
            background: activeGodTab === 'safehouses' ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
            color: activeGodTab === 'safehouses' ? 'var(--cyan)' : '#888',
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 700,
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          SAFEHOUSES & POSITIONS
        </button>
      </div>

      {steps.length === 0 ? (
        <div className="empty-state">
          <AlertTriangle size={48} />
          <p>No turns executed yet in this session.</p>
        </div>
      ) : activeGodTab === 'timeline' ? (
        <>

          {/* Replay feed list */}
          <div className="timeline-feed-container mt-8 relative pl-8" style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '15px' }}>
            <div className="timeline-vertical-line" style={{ top: '0', bottom: '0', height: 'auto' }}></div>

            {steps.map((step, idx) => {
              const isActive = (replayTurn > currentTurn ? currentTurn : replayTurn) === step.turn;
              const hasActions = step.actions.length > 0;
              const hasDefender = step.defenderEvents.length > 0;

              return (
                <div 
                  key={idx} 
                  className={`timeline-post-wrapper relative mb-8 cursor-pointer transition-all ${
                    isActive ? 'timeline-active-post' : 'opacity-70'
                  }`}
                  onClick={() => setReplayTurn(step.turn)}
                >
                  <div className={`timeline-node-dot ${isActive ? 'active' : ''} ${hasDefender ? 'combat-alert' : ''}`}>
                    <span>{step.turn}</span>
                  </div>

                  <div className={`timeline-card-body cyber-panel p-4 ${isActive ? 'border-purple-500' : ''}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-mono text-purple-400 font-bold" style={{ fontSize: '10px' }}>TURN {step.turn} LOGS</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {step.attackers?.map(a => (
                        <span key={a.name} className="timeline-tag location" style={{
                          background: a.eliminated ? 'rgba(255, 255, 255, 0.02)' : 'rgba(163, 114, 240, 0.08)',
                          color: a.eliminated ? '#888' : '#a372f0',
                          border: a.eliminated ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(163, 114, 240, 0.2)',
                          fontSize: '9px',
                          padding: '3px 6px',
                          textDecoration: a.eliminated ? 'line-through' : 'none'
                        }}>
                          👤 {a.name.split(' ')[0]}: {a.eliminated ? 'LOST' : `${a.location?.replace(/_/g, ' ').toUpperCase()} (${a.state})`}
                        </span>
                      ))}
                    </div>

                    {/* Attacker major actions */}
                    {hasActions && (
                      <div className="mt-2 p-2.5 bg-[rgba(0,240,255,0.03)] border border-[rgba(0,240,255,0.15)] rounded mb-2">
                        <span className="font-mono text-[9px] text-cyan-400 font-bold flex items-center gap-1.5 mb-1">
                          <Target size={11} /> ATTACKER OPERATIONS
                        </span>
                        {step.actions.map((op, opIdx) => (
                           <p key={opIdx} className="font-mono text-[10px] text-[var(--text-secondary)] leading-relaxed m-0 mt-1">
                            • {op.clueText} {op.cityName ? (
                              <span className="text-purple-400 font-bold ml-1">
                                [Location: {op.cityName.replace(/_/g, ' ').toUpperCase()}]
                              </span>
                            ) : ''}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Defender logs */}
                    {hasDefender && (
                      <div className="mt-2 p-2.5 bg-[rgba(255,59,48,0.03)] border border-[rgba(255,59,48,0.15)] rounded">
                        <span className="font-mono text-[9px] text-red-400 font-bold flex items-center gap-1.5 mb-1">
                          <Shield size={11} /> DEFENDER INTELLIGENCE
                        </span>
                        {step.defenderEvents.map((op, opIdx) => (
                          <p key={opIdx} className="font-mono text-[10px] text-[var(--text-secondary)] leading-relaxed m-0 mt-1">
                            • {op.clueText} {op.cityName ? (
                              <span className="text-red-400 font-bold ml-1">
                                [Location: {op.cityName.replace(/_/g, ' ').toUpperCase()}]
                              </span>
                            ) : ''}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Safehouses & Positions debugging list */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px', marginTop: '10px' }}>
          {nodes.map(node => {
            const cityId = node.id;
            const cityName = node.name || cityId;
            const isFriendly = node.territory === 'HOME_TERRITORY';
            
            const citySafehouses = (session?.safehouses || []).filter(s => s.cityNode?.toLowerCase() === cityId.toLowerCase());
            const cityAgents = (session?.agents || []).filter(a => a.currentCity?.toLowerCase() === cityId.toLowerCase());
            const cityTeams = (session?.tacticalTeams || []).filter(t => t.currentCity?.toLowerCase() === cityId.toLowerCase());
            const cityAttackers = (session?.aiAttackers || []).filter(a => !a.eliminated && a.currentLocation?.toLowerCase() === cityId.toLowerCase());
            
            const hasEntities = citySafehouses.length > 0 || cityAgents.length > 0 || cityTeams.length > 0 || cityAttackers.length > 0;
            const hasFriendlySH = citySafehouses.some(s => s.ownerFaction === 'DEFENDER');
            const hasHostileSH = citySafehouses.some(s => s.ownerFaction === 'HOSTILE');
            
            return (
              <div 
                key={cityId} 
                className="cyber-panel" 
                style={{ 
                  padding: '12px 16px', 
                  background: hasEntities ? 'rgba(0, 240, 255, 0.02)' : 'rgba(255,255,255,0.01)',
                  border: `1px solid ${hasEntities ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255,255,255,0.04)'}`,
                  opacity: hasEntities ? 1 : 0.55
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: isFriendly ? '#00f0ff' : '#ff3b30', fontFamily: 'monospace' }}>
                    {cityName.toUpperCase()} <span style={{ fontSize: '8px', fontWeight: 'normal', opacity: 0.6 }}>({node.territory?.replace('_', ' ')})</span>
                  </span>
                  {hasEntities && <span style={{ fontSize: '8px', background: 'rgba(0,240,255,0.1)', color: '#00f0ff', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace', fontWeight: 'bold' }}>ACTIVE</span>}
                </div>
                        {hasEntities ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '10.5px', fontFamily: 'monospace' }}>
                    {/* Safehouses list */}
                    {citySafehouses.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ color: '#00f0ff', fontWeight: 'bold' }}>Safehouses:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                          {citySafehouses.map((sh, shIdx) => {
                            const isDefender = sh.ownerFaction === 'DEFENDER';
                            const badgeBg = isDefender ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 59, 48, 0.08)';
                            const badgeColor = isDefender ? '#00f0ff' : '#ff3b30';
                            const badgeBorder = isDefender ? '1px solid rgba(0, 240, 255, 0.2)' : '1px solid rgba(255, 59, 48, 0.2)';
                            
                            const shAgents = isDefender ? cityAgents : [];
                            const shTeams = isDefender ? cityTeams : [];
                            const shAttackers = !isDefender ? cityAttackers.filter(a => !sh.attackerName || a.name === sh.attackerName) : [];

                            return (
                              <div key={shIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div 
                                  style={{ 
                                    background: badgeBg,
                                    color: badgeColor,
                                    border: badgeBorder,
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    alignSelf: 'flex-start'
                                  }}
                                >
                                  {isDefender ? '🏠 Friendly' : '🚨 Hostile'} {sh.secure ? '(Secure)' : '(Standard)'} [Code: #{sh.safehouseCode}] 
                                  <span style={{ opacity: 0.6, fontSize: '8.5px' }}>
                                    ({sh.uncovered ? 'EXPOSED' : 'HIDDEN'})
                                  </span>
                                </div>
                                {(shAgents.length > 0 || shTeams.length > 0 || shAttackers.length > 0) && (
                                  <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9.5px' }}>
                                    {shAgents.map(a => (
                                      <div key={a.id} style={{ color: '#10b981' }}>
                                        └─ 👤 Field Agent: {a.codename} ({a.activeTask || 'IDLE'})
                                      </div>
                                    ))}
                                    {shTeams.map(t => (
                                      <div key={t.id} style={{ color: '#ff6666' }}>
                                        └─ ⚔️ Combat Team: {t.name}
                                      </div>
                                    ))}
                                    {shAttackers.map(a => (
                                      <div key={a.name} style={{ color: '#a372f0' }}>
                                        └─ 👤 AI Operative: {a.name} (Stage: {a.state})
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Warnings / Fallbacks */}
                    {!hasFriendlySH && (cityAgents.length > 0 || cityTeams.length > 0) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9.5px', color: '#eab308', paddingLeft: '4px' }}>
                        <div style={{ fontWeight: 'bold' }}>⚠️ WARNING: Defender assets present but NO friendly safehouse exists!</div>
                        {cityAgents.map(a => (
                          <div key={a.id}>└─ 👤 Field Agent: {a.codename} ({a.activeTask || 'IDLE'})</div>
                        ))}
                        {cityTeams.map(t => (
                          <div key={t.id}>└─ ⚔️ Combat Team: {t.name}</div>
                        ))}
                      </div>
                    )}

                    {!hasHostileSH && cityAttackers.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9.5px', color: '#eab308', paddingLeft: '4px' }}>
                        <div style={{ fontWeight: 'bold' }}>⚠️ WARNING: AI Operatives present but NO hostile safehouse exists!</div>
                        {cityAttackers.map(a => (
                          <div key={a.name}>└─ 👤 AI Operative: {a.name} (Stage: {a.state})</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '9px', color: '#555', fontStyle: 'italic', fontFamily: 'monospace' }}>
                    No assets or threats detected
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
