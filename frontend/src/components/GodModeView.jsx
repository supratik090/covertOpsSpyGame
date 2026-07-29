import React, { useState } from 'react';
import { Eye, EyeOff, Sliders, Shield, Target, AlertTriangle, Play, CornerDownRight } from 'lucide-react';

export default function GodModeView({ 
  replayPlan, 
  replayTurn, 
  setReplayTurn, 
  showGodMode, 
  setShowGodMode,
  session 
}) {
  const [activePlanType, setActivePlanType] = useState('PRIMARY'); // 'PRIMARY' or 'FALLBACK'

  if (!replayPlan) {
    return (
      <div className="clues-view">
        <div className="clues-header">
          <h2>GOD MODE DEV TOOLS</h2>
          <p className="clues-subtitle">Suspect plan telemetry not yet loaded.</p>
        </div>
        <div className="empty-state">
          <Sliders size={48} />
          <p>No active plan plan found in memory. Start a session first.</p>
        </div>
      </div>
    );
  }

  const primarySteps = replayPlan.primaryPlan || [];
  const fallbackSteps = replayPlan.fallbackPlan || [];
  const steps = activePlanType === 'PRIMARY' ? primarySteps : fallbackSteps;

  // Helper to find combat team operations for a specific turn from session clues
  const getCombatOpsForTurn = (turnNum) => {
    if (!session || !session.discoveredClues) return [];
    return session.discoveredClues.filter(c => 
      c.turnDiscovered === turnNum && 
      (c.source === 'TACTICAL_FORCE' || c.clueText.includes('COMBAT') || c.clueText.includes('raid'))
    );
  };

  return (
    <div className="clues-view">
      <div className="clues-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="clues-header-left">
          <h2>GOD MODE TIMELINE FEED</h2>
          <p className="clues-subtitle">Chronological intelligence feed showing attacker trajectory and defender combat responses</p>
        </div>
        <button 
          onClick={() => setShowGodMode(!showGodMode)}
          className={`cyber-btn sm ${showGodMode ? 'active-accept' : 'red'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {showGodMode ? <Eye size={14} /> : <EyeOff size={14} />}
          {showGodMode ? 'MAP OVERLAY ACTIVE' : 'ACTIVATE MAP OVERLAY'}
        </button>
      </div>

      {/* Plan Type Selector Tabs */}
      <div className="godmode-tab-bar">
        <button
          onClick={() => setActivePlanType('PRIMARY')}
          className={`godmode-tab-btn ${activePlanType === 'PRIMARY' ? 'active' : ''}`}
        >
          PRIMARY OPERATIONAL PLAN ({primarySteps.length} Steps)
        </button>
        <button
          onClick={() => setActivePlanType('FALLBACK')}
          className={`godmode-tab-btn ${activePlanType === 'FALLBACK' ? 'active' : ''}`}
        >
          FALLBACK EMERGENCY PLAN ({fallbackSteps.length} Steps)
        </button>
      </div>

      <div className="godmode-scroll-container">
        {steps.length === 0 ? (
          <div className="empty-state mt-6">
            <AlertTriangle size={48} className="text-amber" />
            <p>No steps populated for this plan. Attacker has not activated this operational branch.</p>
          </div>
        ) : (
          <>
            {/* Timeline Controls */}
            <div className="resource-section full-width">
              <div className="resource-header">
                <Sliders size={16} />
                <h3>TIMELINE RANGE SCANNER</h3>
              </div>
              <div className="god-mode-controls flex items-center gap-4 bg-[rgba(5,8,17,0.7)] p-4 border border-[var(--border-subtle)] rounded-[var(--radius-sm)] mt-2">
                <input 
                  type="range" 
                  min="1" 
                  max={steps.length} 
                  value={replayTurn > steps.length ? steps.length : replayTurn} 
                  onChange={(e) => setReplayTurn(parseInt(e.target.value, 10))} 
                  className="w-full cursor-pointer accent-purple-500"
                  style={{ flex: 1 }}
                />
                <span className="font-mono text-purple-400 font-bold whitespace-nowrap">
                  PREVIEW LIMIT: TURN {replayTurn > steps.length ? steps.length : replayTurn} / {steps.length}
                </span>
              </div>
            </div>

            {/* Facebook style Timeline Feed */}
            <div className="timeline-feed-container mt-8 relative pl-8">
              {/* Vertical line connecting nodes */}
              <div className="timeline-vertical-line"></div>

            {steps.map((step, idx) => {
              const isActive = (replayTurn > steps.length ? steps.length : replayTurn) === step.turn;
              const combatOps = getCombatOpsForTurn(step.turn);
              const hasCombat = combatOps.length > 0;

              // Extract tag fields checking for validity
              const showLocation = step.suspectLocation && step.suspectLocation !== 'NONE';
              const showFinance = step.financeCity && step.financeCity !== 'NONE';
              const showLogistics = step.logisticsCity && step.logisticsCity !== 'NONE';
              const showExfiltration = step.escapeNode && step.escapeNode !== 'NONE';
              const showAction = step.action && step.action !== 'IDLE' && step.action !== 'NONE';

              return (
                <div 
                  key={idx} 
                  className={`timeline-post-wrapper relative mb-8 cursor-pointer transition-all ${
                    isActive ? 'timeline-active-post' : 'opacity-70'
                  }`}
                  onClick={() => setReplayTurn(step.turn)}
                >
                  {/* Timeline dot */}
                  <div className={`timeline-node-dot ${isActive ? 'active' : ''} ${hasCombat ? 'combat-alert' : ''}`}>
                    <span>{step.turn}</span>
                  </div>

                  {/* Timeline Card */}
                  <div className={`timeline-card-body cyber-panel p-4 ${isActive ? 'border-purple-500' : ''}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-mono text-xs text-purple-400 font-bold">TURN {step.turn} REPORT</span>
                      {hasCombat && (
                        <span className="flex items-center gap-1 font-mono text-[9px] px-2 py-0.5 rounded bg-[rgba(255,59,48,0.15)] text-red-400 border border-[rgba(255,59,48,0.3)]">
                          <Shield size={10} /> TACTICAL ENGAGEMENT
                        </span>
                      )}
                    </div>

                    <h4 className="font-mono text-sm text-[var(--text-primary)] mb-3">
                      Phase: <span className="text-purple-300 font-bold">
                        {step.phase === 'HOME_TRANSIT' ? 'ATTACK PREP' : step.phase?.replace(/_/g, ' ')}
                      </span>
                    </h4>

                    {/* Cyber Tags row - Hide if value doesn't exist */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {showLocation && (() => {
                        const targetSafehouse = session?.safehouses?.find(s => s.cityNode === step.suspectLocation && s.ownerFaction === 'HOSTILE');
                        const safehouseCode = targetSafehouse ? targetSafehouse.safehouseCode : '';
                        return (
                          <span className="timeline-tag location">
                            📍 LOCATION: {step.suspectLocation?.replace(/_/g, ' ').toUpperCase()} {safehouseCode ? `(#${safehouseCode})` : ''}
                          </span>
                        );
                      })()}
                      {showFinance && (
                        <span className="timeline-tag finance">
                          💳 FINANCE: {step.financeCity?.replace(/_/g, ' ').toUpperCase()} {step.financeMethod ? `(${step.financeMethod.replace(/_/g, ' ')})` : ''}
                        </span>
                      )}
                      {showLogistics && (
                        <span className="timeline-tag logistics">
                          📦 LOGISTICS: {step.logisticsCity?.replace(/_/g, ' ').toUpperCase()} {step.logisticsMethod ? `(${step.logisticsMethod.replace(/_/g, ' ')})` : ''}
                        </span>
                      )}
                      {step.smuggling && (
                        <span className="timeline-tag smuggling">
                          🚨 INFILTRATION ZONE: {step.smugglingMethod ? step.smugglingMethod.replace(/_/g, ' ').toUpperCase() : 'ACTIVE'}
                        </span>
                      )}
                      {showExfiltration && (
                        <span className="timeline-tag exfiltration" style={{ background: 'rgba(235, 94, 40, 0.08)', color: '#eb5e28', border: '1px solid rgba(235, 94, 40, 0.2)' }}>
                          🚪 EXFILTRATION NODE: {step.escapeNode?.replace(/_/g, ' ').toUpperCase()} {step.escapeMethod ? `(${step.escapeMethod.replace(/_/g, ' ')})` : ''}
                        </span>
                      )}
                      {showAction && (
                        <span className="timeline-tag action" style={{ background: 'rgba(255, 59, 48, 0.1)', color: 'var(--red)', border: '1px solid rgba(255, 59, 48, 0.3)', fontWeight: 'bold' }}>
                          🎯 ACTION: {step.action?.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Defender Combat Actions Subpanel */}
                    {hasCombat && (
                      <div className="mt-3 p-3 bg-[rgba(255,59,48,0.04)] border border-[rgba(255,59,48,0.2)] rounded-[var(--radius-sm)]">
                        <span className="font-mono text-[10px] text-red-400 font-bold flex items-center gap-1.5 mb-1.5">
                          <Target size={11} /> DEFENDER COMBAT OPERATIONS
                        </span>
                        {combatOps.map((op, opIdx) => (
                          <p key={opIdx} className="font-mono text-xs text-[var(--text-secondary)] leading-relaxed m-0 mt-1">
                            {op.clueText}
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
    </div>
  );
}
