import React, { useState, useEffect } from 'react';
import { Shield, Users, Radio, Cpu } from 'lucide-react';
import { SafehouseIcon, HostileSafehouseIcon, ExposedSafehouseIcon, DroneBaseIcon, DroneIcon } from './GameSymbols';

const formatK = (amt) => {
  if (typeof amt !== 'number') return amt;
  if (amt >= 1000) {
    const k = amt / 1000;
    return `$${Number.isInteger(k) ? k : k.toFixed(0)}K`;
  }
  return `$${amt}`;
};

export default function CIAIntelBox({ 
  cityId, 
  session, 
  nodesData, 
  selectedAgent,
  selectedTeam,
  onClose,
  onAssignAgentTask,
  onRelocateAgent,
  onRelocateTacticalTeam,
  onDeployTech,
  onBuildSafehouse,
  covertActions = [],
  onToggleCovertAction,
  localAgentMoves = {},
  localTeamMoves = {},
  localAgentTasks = {},
  setSelectedCityNode,
  localTechDeploys = [],
  localSafehouseBuilds = [],
  localDroneBaseBuilds = [],
  onBuildDroneBase,
  localDroneDeployments = {},
  onDeployDrone,
  localDroneOperations = [],
  onToggleDroneOperation
}) {
  if (!cityId || !session) return null;

  const [activeAgentId, setActiveAgentId] = useState(null);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [showDeployMenu, setShowDeployMenu] = useState(false);

  // Auto-highlight agent/team selected from AgentsView
  useEffect(() => {
    if (selectedAgent && selectedAgent.currentCity === cityId) {
      setActiveAgentId(selectedAgent.id);
      setActiveTeamId(null);
    }
  }, [selectedAgent?.id, cityId]);

  useEffect(() => {
    if (selectedTeam && selectedTeam.currentCity === cityId) {
      setActiveTeamId(selectedTeam.id);
      setActiveAgentId(null);
    }
  }, [selectedTeam?.id, cityId]);
  
  // Track selected safehouse code for combat team raid actions
  const [selectedRaidTarget, setSelectedRaidTarget] = useState({}); // maps teamId -> safehouseCode
  const [activeDroneId, setActiveDroneId] = useState(null);
  const [selectedDroneMode, setSelectedDroneMode] = useState({}); // droneId -> 'RECON' | 'ATTACK'

  // Derive isFriendly from scenario nodesData instead of hardcoded city list
  const currentNodeInfo = nodesData.find(n => n.id === cityId);
  const isFriendly = currentNodeInfo ? currentNodeInfo.territory === 'HOME_TERRITORY' : false;
  const isHostile = currentNodeInfo ? currentNodeInfo.territory === 'HOSTILE_TERRITORY' : false;

  const renderTechButton = (type, label, cost) => {
    const isAlreadyActive = session.espionageResources.some(r => r.cityNode === cityId && r.type === type);
    const isQueued = localTechDeploys.some(d => d.type === type && d.cityNode === cityId);

    let btnClass = "cia-dispatch-btn font-mono text-center w-full flex justify-between items-center px-3 py-1.5 mt-1";
    let btnStyle = { fontSize: '11px', whiteSpace: 'nowrap' };

    if (isAlreadyActive) {
      btnClass += " border-emerald-500 text-emerald-400 bg-[rgba(16,185,129,0.08)] cursor-not-allowed";
      return (
        <button key={type} className={btnClass} style={btnStyle} disabled>
          <span>{label}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.15)]">ACTIVE</span>
        </button>
      );
    }

    if (isQueued) {
      btnClass += " border-emerald-500 text-cyan-300 bg-[rgba(0,240,255,0.12)] shadow-[0_0_8px_rgba(0,240,255,0.2)]";
      return (
        <button key={type} onClick={() => onDeployTech?.(type, cityId)} className={btnClass} style={btnStyle}>
          <span>{label}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.2)] text-emerald-400" style={{ letterSpacing: '0.05em' }}>&#10003;&nbsp; ADDED</span>
        </button>
      );
    }

    return (
      <button key={type} onClick={() => onDeployTech?.(type, cityId)} className={btnClass} style={btnStyle}>
        <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap' }}>{label}</span>
        <span className="text-amber text-[11px] font-bold" style={{ marginLeft: '12px', whiteSpace: 'nowrap' }}>{formatK(cost)}</span>
      </button>
    );
  };

  const renderSafehouseButton = () => {
    const hasDefenderSafehouse = session.safehouses.some(s => s.cityNode === cityId && s.ownerFaction === 'DEFENDER');
    if (hasDefenderSafehouse) return null; // already exists, hide option

    const isQueued = localSafehouseBuilds.includes(cityId);
    const cost = isFriendly ? 40000 : 100000;
    const costText = formatK(cost);

    let btnClass = "cia-dispatch-btn font-mono text-center w-full flex justify-between items-center px-3 py-2 mt-2";
    let btnStyle = { fontSize: '12px', fontWeight: 'bold', padding: '9px 12px', whiteSpace: 'nowrap' };

    if (isQueued) {
      btnStyle.background = 'rgba(16, 185, 129, 0.08)';
      btnStyle.border = '1px solid #10b981';
      btnStyle.color = '#10b981';
      return (
        <button onClick={() => onBuildSafehouse?.(cityId)} className={btnClass} style={btnStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <SafehouseIcon size={13} color="#10b981" style={{ animation: 'pulse 1.5s infinite' }} />
            BUILD SAFEHOUSE
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.2)] text-emerald-400" style={{ letterSpacing: '0.05em', whiteSpace: 'nowrap', marginLeft: '8px' }}>&#10003;&nbsp; QUEUED</span>
        </button>
      );
    }

    btnStyle.background = 'rgba(255, 255, 255, 0.02)';
    btnStyle.border = '1px solid rgba(255, 255, 255, 0.15)';
    return (
      <button onClick={() => onBuildSafehouse?.(cityId)} className={btnClass} style={btnStyle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          <SafehouseIcon size={13} color="rgba(0,240,255,0.5)" />
          BUILD SAFEHOUSE
        </span>
        <span className="text-muted text-[11px]" style={{ whiteSpace: 'nowrap', fontWeight: 'bold', marginLeft: '8px' }}>{costText}</span>
      </button>
    );
  };
  const nodeInfo = nodesData.find(n => n.id === cityId);

  // Filter agents and tactical teams using dynamic local in-turn move calculations.
  const localAgents = session.agents.filter(a => {
    const plannedDest = localAgentMoves[a.id];
    if (plannedDest) {
      return plannedDest === cityId;
    }
    return a.currentCity === cityId;
  });

  const localTeams = session.tacticalTeams.filter(t => {
    const plannedDest = localTeamMoves[t.id];
    if (plannedDest) {
      return plannedDest === cityId;
    }
    return t.currentCity === cityId;
  });

  const localTech = session.espionageResources.filter(r => r.cityNode === cityId);

  // Safehouses
  const safehouseList = session.safehouses.filter(s => s.cityNode === cityId);
  const friendlySafehouses = safehouseList.filter(s => s.ownerFaction === 'DEFENDER');
  const hostileSafehouses = safehouseList.filter(s => s.ownerFaction === 'HOSTILE' && s.uncovered);

  // Build allConnections dynamically from scenario nodesData
  const allConnections = nodesData.map(node => ({
    from: node.id,
    to: node.connections || []
  }));

  const currentConnections = allConnections.find(c => c.from === cityId)?.to || [];
  // hasHostileConnection: any adjacent city that is HOSTILE_TERRITORY per scenario
  const hasHostileConnection = currentConnections.some(connId => {
    const connNode = nodesData.find(n => n.id === connId);
    return connNode ? connNode.territory === 'HOSTILE_TERRITORY' : false;
  });
  const isFriendlyBorder = isFriendly && hasHostileConnection;

  return (
    <div className="cia-intel-box cyber-panel animate-fade-in">
      <div className="cia-box-header">
        <div className="cia-glow-indicator animate-ping"></div>
        <h3 className="text-cyber">TACTICAL REPORT</h3>
        {onClose && (
          <button 
            onClick={onClose} 
            className="cia-close-btn"
            title="Terminate Feed"
          >
            ✕
          </button>
        )}
      </div>

      <div className="cia-box-body">
        {/* City Metadata */}
        <div className="cia-section">
          <div className="cia-meta-row">
            <span className="label">DESIGNATION:</span>
            <span className="value text-cyber">{cityId.replace('_', ' ').toUpperCase()}</span>
          </div>
          <div className="cia-meta-row">
            <span className="label">SECURITY ZONE:</span>
            <span className={`value font-bold ${isFriendly ? 'text-success' : 'text-threat'}`}>
              {isFriendly ? 'FRIENDLY / HOME' : 'HOSTILE / ENEMY'}
            </span>
          </div>
          <div className="cia-meta-row mt-1">
            <span className="label">DETECTION HEAT:</span>
            <span className={`value font-mono font-bold ${isFriendly ? 'text-success' : 'text-threat'}`}>
              {session.cityHeat?.[cityId] || 0}%
            </span>
          </div>
        </div>

        {/* Safehouses Status */}
        <div className="cia-section">
          <h4 className="cia-sub-title">
            <SafehouseIcon size={12} color="var(--cyan)" style={{ marginRight: '4px' }} />
            SAFEHOUSE ASSETS
          </h4>
          <div className="cia-grid-item">
            <div className="cia-sub-item">
              <span className="label font-mono">FRIENDLY SAFEHOUSE CODES:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {friendlySafehouses.length === 0 ? (
                  <span className="text-dim font-mono">NONE OPERATIONAL</span>
                ) : (
                  friendlySafehouses.map((s, idx) => (
                    <span key={idx} className="cia-tag cyan font-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <SafehouseIcon size={10} color="#00f0ff" secure={s.secure} />
                      #{s.safehouseCode}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="cia-sub-item mt-2">
              <span className="label font-mono">ENEMY SAFEHOUSE:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {hostileSafehouses.length === 0 ? (
                  <span className="text-dim font-mono">NONE REVEALED</span>
                ) : (
                  hostileSafehouses.map((s, idx) => (
                    <span key={idx} className="cia-tag red font-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <ExposedSafehouseIcon size={10} secure={s.secure} />
                      #{s.safehouseCode} (EXPOSED)
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>



        {/* Field Intelligence Force */}
        <div className="cia-section">
          <h4 className="cia-sub-title"><Users size={12} /> FIELD INTEL FORCE</h4>
          {localAgents.length === 0 ? (
            <div className="text-dim font-mono text-[10px] py-1">None</div>
          ) : (
            <div className="cia-list">
              {localAgents.map(a => {
                const isMoved = localAgentMoves[a.id] !== undefined;
                const effectiveTask = localAgentTasks[a.id] || a.activeTask;
                const isIdle = !effectiveTask || effectiveTask === 'NONE' || effectiveTask === '';
                return (
                  <div key={a.id} className="cia-agent-block">
                    <div 
                      className={`cia-list-item cursor-pointer ${activeAgentId === a.id ? 'active-select' : ''} ${isMoved ? 'moved-locked' : ''}`}
                      onClick={() => {
                        if (isMoved) return;
                        setActiveAgentId(activeAgentId === a.id ? null : a.id);
                      }}
                    >
                      <span className="value text-cyber">AGENT: {a.codename}</span>
                      <span className="label font-mono text-[9px]">
                        {isMoved ? `TRANSIT -> ${localAgentMoves[a.id].toUpperCase()}` : (
                          isIdle ? <span className="text-amber blink">⚠ NO TASK ASSIGNED</span> : effectiveTask.replace(/_/g, ' ')
                        )}
                      </span>
                    </div>

                    {activeAgentId === a.id && !isMoved && (
                      <div className="cia-agent-controls animate-fade-in">
                        {/* Task Assignment */}
                        <div>
                          <span className="cia-controls-label">TASK DIRECTIVES</span>
                          <div className="cia-task-button-grid">
                            {['FIND_SUSPECT', 'MONITOR_FINANCE', 'MONITOR_LOGISTICS', 'UNCOVER_SAFEHOUSE'].map(task => {
                              let displayText = '';
                              if (task === 'FIND_SUSPECT') displayText = ' GATHER INTELLIGENCE ';
                              else if (task === 'MONITOR_FINANCE') displayText = ' INVESTIGATE FINANCE ';
                              else if (task === 'MONITOR_LOGISTICS') displayText = ' INVESTIGATE LOGISTICS ';
                              else if (task === 'UNCOVER_SAFEHOUSE') displayText = ' UNCOVER SAFEHOUSE ';

                              return (
                                <button
                                  key={task}
                                  onClick={() => onAssignAgentTask?.(a.id, task)}
                                  className={`cia-task-btn font-mono ${(localAgentTasks[a.id] || a.activeTask) === task ? 'active' : ''}`}
                                >
                                  {displayText}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Movement Options */}
                        {a.cooldownRemaining === 0 && (
                          <div>
                            <span className="cia-controls-label">MOVE TO CONNECTING CENTER</span>
                            <div className="cia-dispatch-list">
                              {currentConnections.length === 0 ? (
                                <span className="text-[8px] text-dim">NO CONNECTED NODES</span>
                              ) : (
                                currentConnections.map(connId => (
                                  <button
                                    key={connId}
                                    onClick={() => {
                                      onRelocateAgent?.(a.id, connId);
                                      setActiveAgentId(null);
                                    }}
                                    className="cia-dispatch-btn font-mono"
                                  >
                                    {connId.toUpperCase()}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                        
                        {a.cooldownRemaining > 0 && (
                          <div className="text-threat font-mono text-[8px] mt-1 blink">
                            LOCKOUT ACTIVE: {a.cooldownRemaining} TURNS REMAINING
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Combat Force */}
        <div className="cia-section">
          <h4 className="cia-sub-title"><Shield size={12} /> COMBAT FORCE</h4>
          {localTeams.length === 0 ? (
            <div className="text-dim font-mono text-[10px] py-1">None</div>
          ) : (
            <div className="cia-list">
              {localTeams.map(t => {
                const isMoved = localTeamMoves[t.id] !== undefined;
                
                // Get active covert action planned for this team
                const activeAction = covertActions.find(act => act.teamId === t.id);
                const isRaidPlanned = activeAction && activeAction.actionType === 'RAID_SAFEHOUSE';
                const plannedRaidCode = activeAction ? activeAction.targetSafehouseCode : '';

                return (
                  <div key={t.id} className="cia-agent-block">
                    <div 
                      className={`cia-list-item cursor-pointer ${activeTeamId === t.id ? 'active-select' : ''} ${isMoved ? 'moved-locked' : ''}`}
                      onClick={() => {
                        if (isMoved) return;
                        setActiveTeamId(activeTeamId === t.id ? null : t.id);
                      }}
                    >
                      <span className="value text-threat">TACTICAL: {t.name}</span>
                      <span className="label font-mono text-[9px]">
                        {isMoved ? `TRANSIT -> ${localTeamMoves[t.id].toUpperCase()}` : (activeAction ? `${activeAction.actionType.replace('_', ' ')} ${activeAction.targetSafehouseCode ? '#' + activeAction.targetSafehouseCode : ''}` : 'COMBAT READY')}
                      </span>
                    </div>

                    {activeTeamId === t.id && !isMoved && (
                      <div className="cia-agent-controls animate-fade-in">
                        {/* Combat Raid Actions — only available when team is not on operation cooldown */}
                        {t.cooldownRemaining === 0 ? (
                          <div>
                            <span className="cia-controls-label">COVERT ACTION PLANNER</span>
                            
                            {/* Hostile Safehouse Selection grid if any exist */}
                            {hostileSafehouses.length > 0 ? (
                              <div className="mb-2">
                                <span className="label text-[8px] font-mono text-dim block mb-1">CHOOSE TARGET SAFEHOUSE FOR RAID:</span>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {hostileSafehouses.map(s => {
                                    const code = s.safehouseCode;
                                    const isSelected = selectedRaidTarget[t.id] === code || plannedRaidCode === code;
                                    return (
                                      <button 
                                        key={code}
                                        onClick={() => setSelectedRaidTarget(prev => ({ ...prev, [t.id]: code }))}
                                        className={`cia-dispatch-btn font-mono ${isSelected ? 'active-select' : ''}`}
                                        style={{ 
                                          background: isSelected ? 'rgba(255, 59, 48, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                                          borderColor: isSelected ? 'var(--red)' : 'rgba(255, 255, 255, 0.08)',
                                          color: isSelected ? 'var(--red)' : 'var(--text-muted)'
                                        }}
                                      >
                                        #{code}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Require explicit selection when multiple safehouses exist */}
                                {(() => {
                                  const hasExplicitSelection = !!selectedRaidTarget[t.id] || !!plannedRaidCode;
                                  const requiresSelection = hostileSafehouses.length > 1 && !hasExplicitSelection;
                                  const chosenCode = selectedRaidTarget[t.id] || (hostileSafehouses.length === 1 ? hostileSafehouses[0].safehouseCode : '');
                                  if (requiresSelection) {
                                    return (
                                      <div
                                        className="cia-task-btn font-mono w-full text-center py-2"
                                        style={{ opacity: 0.45, cursor: 'not-allowed', border: '1px solid rgba(255,59,48,0.25)', color: 'var(--text-muted)' }}
                                      >
                                        ⚠ SELECT A TARGET SAFEHOUSE FIRST
                                      </div>
                                    );
                                  }
                                  return (
                                    <button
                                      onClick={() => onToggleCovertAction?.('RAID_SAFEHOUSE', cityId, t.id, chosenCode)}
                                      className={`cia-task-btn font-mono w-full text-center py-2 ${isRaidPlanned ? 'active' : ''}`}
                                      style={{ background: isRaidPlanned ? 'rgba(255, 59, 48, 0.15)' : '', borderColor: isRaidPlanned ? 'var(--red)' : '', color: isRaidPlanned ? 'var(--red)' : '' }}
                                    >
                                      {isRaidPlanned ? 'CANCEL RAID ORDER' : 'LAUNCH COMBAT RAID'}
                                    </button>
                                  );
                                })()}
                              </div>
                            ) : null}

                             {/* Standard tactical disruptions */}
                             <div className="cia-task-button-grid mt-2">
                               {(() => {
                                 const actOptions = [];
                                 if (isFriendly) {
                                   actOptions.push('TRANSIT_CHECKPOINT');
                                   actOptions.push('CITY_GRID_LOCKDOWN');
                                   if (isFriendlyBorder) {
                                     actOptions.push('STOP_INFILTRATION');
                                     actOptions.push('STOP_EXFILTRATION');
                                   }
                                 }
                                  const baseCosts = {
                                    'FREEZE_FINANCE': 50000,
                                    'RAID_LOGISTICS': 50000,
                                    'TRANSIT_CHECKPOINT': 80000,
                                    'CITY_GRID_LOCKDOWN': 100000,
                                    'STOP_INFILTRATION': 35000,
                                    'STOP_EXFILTRATION': 40000
                                  };
                                  return actOptions.map(actType => {
                                    const isActPlanned = activeAction && activeAction.actionType === actType;
                                    const cost = baseCosts[actType] || 0;
                                    const displayCost = isHostile ? cost * 2 : cost;
                                    return (
                                      <button
                                        key={actType}
                                        onClick={() => onToggleCovertAction?.(actType, cityId, t.id)}
                                        className={`cia-task-btn font-mono ${isActPlanned ? 'active' : ''}`}
                                      >
                                        <span style={{ flex: 1, textAlign: 'left' }}>{actType.replace('RAID_', '').replace('_', ' ')}</span>
                                        <span className="text-amber text-[10px] font-bold" style={{ marginLeft: '12px' }}>${displayCost.toLocaleString()}</span>
                                      </button>
                                    );
                                  });
                               })()}
                             </div>
                           </div>
                        ) : (
                          <div className="text-threat font-mono text-[8px] mb-2 blink">
                            ⚠ OPERATION COOLDOWN ACTIVE — COVERT ACTIONS LOCKED ({t.cooldownRemaining} TURNS REMAINING)
                          </div>
                        )}

                        {/* Movement Options — always available regardless of cooldown */}
                        <div className="mt-3">
                          <span className="cia-controls-label">MOVE TO CONNECTING CENTER</span>
                          <div className="cia-dispatch-list">
                            {currentConnections.length === 0 ? (
                              <span className="text-[8px] text-dim">NO CONNECTED NODES</span>
                            ) : (
                              currentConnections.map(connId => (
                                <button
                                  key={connId}
                                  onClick={() => {
                                    onRelocateTacticalTeam?.(t.id, connId);
                                    setActiveTeamId(null);
                                  }}
                                  className="cia-dispatch-btn font-mono"
                                >
                                  {connId.toUpperCase()}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Redesigned Deploy Assets Controls */}
        <div className="cia-section">
          <h4 className="cia-sub-title"><Cpu size={12} /> DEPLOY SCANNER & DEFENSES</h4>
          <div className="mt-1 flex flex-col gap-2.5">
            {onBuildSafehouse && renderSafehouseButton()}
            
            {onDeployTech && (
              <>
                <button 
                  onClick={() => setShowDeployMenu(!showDeployMenu)}
                  className="cia-dispatch-btn font-mono text-center w-full"
                  style={{ background: 'rgba(255, 204, 0, 0.05)', border: '1px solid rgba(255, 204, 0, 0.4)', color: 'var(--amber)', fontSize: '13px', fontWeight: 'bold', padding: '10px 12px' }}
                >
                  {showDeployMenu ? 'HIDE DEPLOYMENT CONSOLE' : 'DEPLOY SURVEILLANCE TECHNOLOGY'}
                </button>

                {showDeployMenu && (
                  <div className="cia-agent-controls animate-fade-in" style={{ borderColor: 'rgba(255, 204, 0, 0.3)' }}>
                    <span className="cia-controls-label" style={{ color: 'var(--amber)', borderBottomColor: 'rgba(255, 204, 0, 0.15)' }}>SCANNER GRID OPTIONS</span>
                    <div className="flex flex-col gap-2 mt-2">
                      {!session.espionageResources.some(r => r.cityNode === cityId && r.type === 'CCTV') && renderTechButton('CCTV', 'CCTV MONITOR', 30000)}
                      {!session.espionageResources.some(r => r.cityNode === cityId && r.type === 'WIRE_TAP') && renderTechButton('WIRE_TAP', 'WIRE TAP', 20000)}
                      {!session.espionageResources.some(r => r.cityNode === cityId && r.type === 'PHONE_TAP') && renderTechButton('PHONE_TAP', 'PHONE TAP', 40000)}
                      {!session.espionageResources.some(r => r.cityNode === cityId && r.type === 'SATELLITE') && renderTechButton('SATELLITE', 'SATELLITE VIEW', 80000)}
                      {isFriendly && !session.espionageResources.some(r => r.cityNode === cityId && r.type === 'FINANCE_MONITOR') && renderTechButton('FINANCE_MONITOR', 'FINANCE MONITOR', 50000)}
                      {isFriendly && !session.espionageResources.some(r => r.cityNode === cityId && r.type === 'BIOMETRIC_SCAN') && renderTechButton('BIOMETRIC_SCAN', 'BIOMETRIC SCAN GRID', 35000)}
                      {isFriendlyBorder && !session.espionageResources.some(r => r.cityNode === cityId && r.type === 'BORDER_GUARD') && renderTechButton('BORDER_GUARD', 'BORDER GUARD MOBILIZATION', 40000)}
                      {isFriendly && !session.espionageResources.some(r => r.cityNode === cityId && r.type === 'SIGNAL_JAMMER') && renderTechButton('SIGNAL_JAMMER', 'SIGNAL JAMMER TECH', 25000)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Drone Aviation System */}
        {isFriendly && (
          <div className="cia-section">
            <h4 className="cia-sub-title"><DroneIcon size={12} color="var(--cyan)" /> DRONE AVIATION FORCE</h4>

            {/* Drone Base status / construct button */}
            {(() => {
              const hasBase = session.droneBases?.includes(cityId);
              const isBaseQueued = localDroneBaseBuilds.includes(cityId);

              if (hasBase) {
                return (
                  <div className="cia-list-item mb-2" style={{ cursor: 'default' }}>
                    <span className="value text-cyber flex items-center gap-1.5" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <DroneBaseIcon size={12} color="#00f0ff" /> DRONE BASE
                    </span>
                    <span className="label font-mono text-[9px] text-emerald-400 font-bold">● OPERATIONAL</span>
                  </div>
                );
              }

              if (isBaseQueued) {
                return (
                  <button 
                    onClick={() => onBuildDroneBase?.(cityId)}
                    className="cia-dispatch-btn font-mono text-center w-full flex justify-between items-center px-3 py-1.5 mb-2"
                    style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981', color: '#10b981' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <DroneBaseIcon size={12} color="#10b981" /> CONSTRUCT DRONE BASE
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.2)] text-emerald-400">&#10003;&nbsp; QUEUED</span>
                  </button>
                );
              }

              return (
                <button 
                  onClick={() => onBuildDroneBase?.(cityId)}
                  className="cia-dispatch-btn font-mono text-center w-full flex justify-between items-center px-3 py-1.5 mb-2"
                  style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DroneBaseIcon size={12} color="rgba(0,240,255,0.6)" /> CONSTRUCT DRONE BASE
                  </span>
                  <span className="text-muted text-[10px]" style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>$200K</span>
                </button>
              );
            })()}

            {/* Drones List matching Field Agents and Combat Force */}
            {(session.droneBases?.includes(cityId) || localDroneBaseBuilds.includes(cityId)) && (
              <div>
                {(() => {
                  const localDrones = (session.drones || []).filter(d => {
                    const plannedBase = localDroneDeployments[d.id];
                    if (plannedBase) return plannedBase === cityId;
                    return d.currentCity === cityId;
                  });

                  const reserveDrones = (session.drones || []).filter(d => 
                    (!d.currentCity && !localDroneDeployments[d.id]) || d.status === 'RESERVE'
                  );

                  const getDroneName = (id) => {
                    if (id === 1) return "Drone Alpha";
                    if (id === 2) return "Drone Theta";
                    return `Drone #${id}`;
                  };

                  if (localDrones.length === 0 && reserveDrones.length === 0) {
                    return <div className="text-dim font-mono text-[10px] py-1">No drones deployed</div>;
                  }

                  return (
                    <div className="cia-list">
                      {localDrones.map(drone => {
                        const plannedOp = localDroneOperations.find(op => op.droneId === drone.id);
                        const droneName = getDroneName(drone.id);
                        const currentMode = selectedDroneMode[drone.id] || 'RECON';

                        return (
                          <div key={drone.id} className="cia-agent-block">
                            <div 
                              className={`cia-list-item cursor-pointer ${activeDroneId === drone.id ? 'active-select' : ''}`}
                              onClick={() => setActiveDroneId(activeDroneId === drone.id ? null : drone.id)}
                            >
                              <span className="value text-cyber flex items-center gap-1.5" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <DroneIcon size={12} color="var(--cyan)" className="drone-rotor-spin" /> DRONE: {droneName.toUpperCase()}
                              </span>
                              <span className="label font-mono text-[9px]">
                                {plannedOp ? `${plannedOp.actionType} -> ${plannedOp.targetCity.toUpperCase()}` : (drone.status === 'ACTIVE' ? 'READY' : drone.status)}
                              </span>
                            </div>

                            {activeDroneId === drone.id && (
                              <div className="cia-agent-controls animate-fade-in">
                                {plannedOp ? (
                                  <div className="flex justify-between items-center bg-[rgba(0,240,255,0.04)] border border-[rgba(0,240,255,0.25)] p-2 rounded">
                                    <span className="text-cyber font-mono text-[10px] font-bold">
                                      {plannedOp.actionType === 'RECON' ? '🔍 RECON' : '🚀 ATTACK'} &rarr; {plannedOp.targetCity.replace('_', ' ').toUpperCase()}
                                    </span>
                                    <button 
                                      onClick={() => onToggleDroneOperation?.(drone.id, plannedOp.actionType, plannedOp.targetCity)}
                                      className="text-red-400 text-[9px] font-mono font-bold underline hover:text-red-300 transition-colors"
                                    >
                                      CANCEL ORDER
                                    </button>
                                  </div>
                                ) : (
                                  <div>
                                    {/* Operation Mode Selector Buttons */}
                                    <div>
                                      <span className="cia-controls-label">OPERATION MODE</span>
                                      <div className="cia-task-button-grid">
                                        <button
                                          onClick={() => setSelectedDroneMode(prev => ({ ...prev, [drone.id]: 'RECON' }))}
                                          className={`cia-task-btn font-mono ${currentMode === 'RECON' ? 'active' : ''}`}
                                        >
                                          🔍 RECON ($50K)
                                        </button>
                                        <button
                                          onClick={() => setSelectedDroneMode(prev => ({ ...prev, [drone.id]: 'ATTACK' }))}
                                          className={`cia-task-btn font-mono ${currentMode === 'ATTACK' ? 'active' : ''}`}
                                          style={currentMode === 'ATTACK' ? { background: 'rgba(255, 59, 48, 0.15)', borderColor: 'var(--red)', color: 'var(--red)' } : {}}
                                        >
                                          🚀 ATTACK ($100K)
                                        </button>
                                      </div>
                                    </div>

                                    {/* Target Region Dispatch List */}
                                    <div className="mt-3">
                                      <span className="cia-controls-label">DISPATCH TO CONNECTING REGION</span>
                                      <div className="cia-dispatch-list">
                                        {currentConnections.length === 0 ? (
                                          <span className="text-[8px] text-dim font-mono">NO CONNECTED NODES</span>
                                        ) : (
                                          currentConnections.map(connId => {
                                            const connNode = nodesData.find(n => n.id === connId);
                                            const isConnHostile = connNode ? connNode.territory === 'HOSTILE_TERRITORY' : false;
                                            const riskText = isConnHostile ? ' (10% RISK)' : '';
                                            const costText = currentMode === 'ATTACK' ? '$100K' : '$50K';

                                            return (
                                              <button
                                                key={connId}
                                                onClick={() => {
                                                  onToggleDroneOperation?.(drone.id, currentMode, connId);
                                                  setActiveDroneId(null);
                                                }}
                                                className="cia-dispatch-btn font-mono"
                                                style={currentMode === 'ATTACK' ? { borderColor: 'rgba(255, 59, 48, 0.3)', color: '#ff3b30' } : {}}
                                              >
                                                <span>{connId.toUpperCase()}{riskText}</span>
                                                <span className="text-amber text-[9px] font-bold" style={{ marginLeft: '8px' }}>
                                                  {costText}
                                                </span>
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>

                                    {/* Option to relocate drone to another city with an operational drone base */}
                                    {(() => {
                                      const otherBases = (session.droneBases || []).filter(b => b !== cityId);
                                      if (otherBases.length === 0) return null;
                                      return (
                                        <div className="mt-3">
                                          <span className="cia-controls-label">RELOCATE TO ANOTHER BASE</span>
                                          <div className="cia-dispatch-list">
                                            {otherBases.map(targetBase => (
                                              <button
                                                key={targetBase}
                                                onClick={() => {
                                                  onDeployDrone?.(drone.id, targetBase);
                                                  setActiveDroneId(null);
                                                }}
                                                className="cia-dispatch-btn font-mono"
                                              >
                                                <span>RELOCATE &rarr; {targetBase.toUpperCase()}</span>
                                                <span className="text-emerald-400 text-[9px] font-bold" style={{ marginLeft: '8px' }}>BASE READY</span>
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Reserve Drones Deployment */}
                      {reserveDrones.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                          <span className="cia-controls-label">DEPLOY RESERVE ASSET</span>
                          <div className="cia-dispatch-list mt-1">
                            {reserveDrones.map(d => (
                              <button 
                                key={d.id}
                                onClick={() => onDeployDrone?.(d.id, cityId)}
                                className="cia-dispatch-btn font-mono"
                              >
                                <span>{getDroneName(d.id).toUpperCase()}</span>
                                <span className="text-emerald-400 text-[9px] font-bold" style={{ marginLeft: '8px' }}>DEPLOY HERE</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Tech Assets */}
        <div className="cia-section">
          <h4 className="cia-sub-title"><Radio size={12} /> SURVEILLANCE MATRIX</h4>
          {localTech.length === 0 ? (
            <div className="text-dim font-mono text-[10px] py-1">None</div>
          ) : (
            <div className="cia-tag-list">
              {localTech.map((r, i) => {
                let icon = '🛰️';
                if (r.type === 'CCTV') icon = '📹';
                else if (r.type === 'WIRE_TAP') icon = '🔍';
                else if (r.type === 'PHONE_TAP') icon = '📞';
                else if (r.type === 'SATELLITE') icon = '🛰️';
                else if (r.type === 'FINANCE_MONITOR') icon = '💰';
                else if (r.type === 'BIOMETRIC_SCAN') icon = '🔴';
                else if (r.type === 'BORDER_GUARD') icon = '🚧';
                else if (r.type === 'SIGNAL_JAMMER') icon = '📡';
                
                return (
                  <span key={i} className="cia-tag cyan font-mono animate-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>{icon}</span>
                    <span>{r.type.replace('_', ' ')} (T-{r.cooldownRemaining})</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>



      </div>

      {/* Next Connected City selector footer */}
      {(() => {
        const connections = currentConnections;
        return (
          <div className="cia-box-footer" style={{ flexDirection: 'column', gap: '6px', alignItems: 'stretch', width: '100%' }}>
            <span className="label font-mono text-[8px] text-dim mb-1" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ADJACENT REGIONS:
            </span>
            <div className="flex flex-wrap gap-1.5 w-full">
              {connections.length === 0 ? (
                <span className="text-[9px] text-dim font-mono">NO CONNECTED SECTORS</span>
              ) : (
                connections.map(connId => (
                  <button
                    key={connId}
                    onClick={() => setSelectedCityNode?.(connId)}
                    className="cyber-btn sm"
                    style={{ flex: '1 1 0px', textTransform: 'uppercase', fontSize: '8.5px', padding: '5px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}
                  >
                    ➡️ {connId.replace(/_/g, ' ')}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
