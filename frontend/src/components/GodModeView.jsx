import React, { useState } from 'react';
import { Sliders, Shield, Target, AlertTriangle } from 'lucide-react';

export default function GodModeView({ 
  replayTurn, 
  setReplayTurn, 
  session,
  onRevertTurn
}) {
  const currentTurn = session?.currentTurn || 1;

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
      (c.source === 'TACTICAL_FORCE' || c.source === 'SECURITY_SWEEP_LOSS' || c.source === 'SECURITY_SWEEP_ALERT' || c.source === 'COMMAND_CENTER' || c.source === 'BORDER_INCIDENT')
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
          <p className="clues-subtitle" style={{ fontSize: '9.5px', marginTop: '2px' }}>God View tracking turn-by-turn history of positions, combat deployments, and strategic milestones</p>
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

      {steps.length === 0 ? (
        <div className="empty-state">
          <AlertTriangle size={48} />
          <p>No turns executed yet in this session.</p>
        </div>
      ) : (
        <>
          {/* Timeline Range Scanner */}
          <div className="resource-section full-width">
            <div className="resource-header">
              <Sliders size={12} />
              <h3 style={{ fontSize: '10px', margin: 0 }}>TIMELINE SCANNER</h3>
            </div>
            <div className="god-mode-controls flex items-center gap-4 bg-[rgba(5,8,17,0.7)] p-4 border border-[var(--border-subtle)] rounded-[var(--radius-sm)] mt-2">
              <input 
                type="range" 
                min="1" 
                max={currentTurn} 
                value={replayTurn > currentTurn ? currentTurn : replayTurn} 
                onChange={(e) => setReplayTurn(parseInt(e.target.value, 10))} 
                className="w-full cursor-pointer accent-purple-500"
                style={{ flex: 1 }}
              />
              <span className="font-mono text-purple-400 font-bold whitespace-nowrap" style={{ fontSize: '10px' }}>
                PREVIEW: TURN {replayTurn > currentTurn ? currentTurn : replayTurn} / {currentTurn}
              </span>
            </div>
          </div>

          {/* Replay feed list */}
          <div className="timeline-feed-container mt-8 relative pl-8" style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '15px' }}>
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
      )}
    </div>
  );
}
