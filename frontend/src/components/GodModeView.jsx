import React, { useState } from 'react';
import { Sliders, Shield, Target, AlertTriangle } from 'lucide-react';

export default function GodModeView({ 
  replayTurn, 
  setReplayTurn, 
  session 
}) {
  const currentTurn = session?.currentTurn || 1;

  // Track the actual positions of the Attacker dynamically from turn logs
  const getSuspectLocationForTurn = (t) => {
    const moves = (session?.discoveredClues || []).filter(c => 
      (c.source === 'SUSPECT_RELOCATION' || c.source === 'SAFEHOUSE_ROTATION') && c.turnDiscovered <= t
    );
    if (moves.length > 0) {
      const lastMove = moves[moves.length - 1];
      const txt = lastMove.clueText.toLowerCase();
      if (txt.includes('rotated safehouses inside ')) {
        return lastMove.clueText.substring(lastMove.clueText.indexOf('inside ') + 7).replace(' to shake surveillance.', '').trim();
      } else if (txt.includes('relocated to ')) {
        return lastMove.clueText.substring(lastMove.clueText.indexOf('to ') + 3).trim();
      }
    }
    return session?.suspectLocation || 'KARACHI';
  };

  // Find Defender activity/relocations for this turn
  const getDefenderEventsForTurn = (t) => {
    return (session?.discoveredClues || []).filter(c => 
      c.turnDiscovered === t && 
      (c.source === 'TACTICAL_FORCE' || c.source === 'SECURITY_SWEEP_LOSS' || c.source === 'SECURITY_SWEEP_ALERT')
    );
  };

  // Get other major actions (finance, logistics, handovers, safehouse builds)
  const getMajorActionsForTurn = (t) => {
    const ignoreSources = [
      'SUSPECT_RELOCATION', 'SAFEHOUSE_ROTATION', 'TACTICAL_FORCE',
      'SECURITY_SWEEP_ALERT', 'SECURITY_SWEEP_LOSS'
    ];
    return (session?.discoveredClues || []).filter(c => 
      c.turnDiscovered === t && 
      !ignoreSources.some(src => c.source.startsWith(src))
    );
  };

  const steps = [];
  for (let t = 1; t <= currentTurn; t++) {
    steps.push({
      turn: t,
      suspectLocation: getSuspectLocationForTurn(t),
      defenderEvents: getDefenderEventsForTurn(t),
      actions: getMajorActionsForTurn(t)
    });
  }

  const selectedStep = steps.find(s => s.turn === (replayTurn > currentTurn ? currentTurn : replayTurn)) || steps[steps.length - 1];

  return (
    <div className="clues-view">
      <div className="clues-header">
        <div className="clues-header-left">
          <h2 style={{ fontSize: '13px', margin: 0 }}>TACTICAL TIMELINE TELEMETRY</h2>
          <p className="clues-subtitle" style={{ fontSize: '9.5px', marginTop: '2px' }}>God View tracking turn-by-turn history of positions, combat deployments, and strategic milestones</p>
        </div>
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
          <div className="timeline-feed-container mt-8 relative pl-8">
            <div className="timeline-vertical-line"></div>

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
                      <span className="timeline-tag location" style={{ background: 'rgba(163, 114, 240, 0.08)', color: '#a372f0', border: '1px solid rgba(163, 114, 240, 0.2)', fontSize: '9px', padding: '3px 6px' }}>
                        📍 ATTACKER POSITION: {step.suspectLocation?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    {/* Attacker major actions */}
                    {hasActions && (
                      <div className="mt-2 p-2.5 bg-[rgba(0,240,255,0.03)] border border-[rgba(0,240,255,0.15)] rounded mb-2">
                        <span className="font-mono text-[9px] text-cyan-400 font-bold flex items-center gap-1.5 mb-1">
                          <Target size={11} /> ATTACKER OPERATIONS
                        </span>
                        {step.actions.map((op, opIdx) => (
                          <p key={opIdx} className="font-mono text-[10px] text-[var(--text-secondary)] leading-relaxed m-0 mt-1">
                            • {op.clueText}
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
                            • {op.clueText}
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
