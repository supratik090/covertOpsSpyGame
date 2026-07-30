import React from 'react';
import { Play, Trash2, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

const ScenarioSelect = ({
  scenarios,
  sessions,
  selectedScenarioId,
  setSelectedScenarioId,
  onStartNewGame,
  onLoadGame,
  onDeleteGame,
  hasActiveGame,
  loading,
  errorMsg
}) => {
  const getScenarioTitle = (scenarioId) => {
    const s = scenarios.find(sc => sc.scenarioId === scenarioId);
    return s ? s.title : scenarioId;
  };

  const activeSession = sessions.find(s => s.status === 'ACTIVE');

  return (
    <div className="select-screen">
      <motion.div 
        className="select-card cyber-panel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="auth-brand">
          <span className="auth-brand-line">PROTOCOL</span>
          <span className="auth-brand-name">NIGHTFALL</span>
        </div>
        <h1 className="select-title">COMMAND DESK: OPERATIONS CENTER</h1>

        {errorMsg && <div className="error-msg">{errorMsg}</div>}

        {/* Active Campaign */}
        {activeSession && (
          <div className="scenario-card selected" style={{ borderLeftColor: '#00ff66', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: '2px' }}>ACTIVE CAMPAIGN</div>
                <h3 style={{ margin: '4px 0' }}>{getScenarioTitle(activeSession.scenarioId)}</h3>
                <div className="scenario-meta" style={{ marginTop: '6px' }}>
                  <div>TURN: <span className="val cyan">{activeSession.currentTurn}/{activeSession.maxTurns}</span></div>
                  <div>STATUS: <span className="val green">ACTIVE</span></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  className="cyber-btn sm green"
                  onClick={() => onLoadGame(activeSession.id)}
                  disabled={loading}
                >
                  <Play size={12} /> RESUME
                </button>
                <button
                  className="cyber-btn sm red"
                  onClick={() => onDeleteGame(activeSession.id)}
                  disabled={loading}
                >
                  <Trash2 size={12} /> ABANDON
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Completed/Compromised Sessions */}
        {sessions.filter(s => s.status !== 'ACTIVE').length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h2 className="select-title" style={{ fontSize: '11px', paddingBottom: '8px', marginBottom: '10px', borderBottom: 'none' }}>
              ARCHIVED CAMPAIGNS
            </h2>
            {sessions.filter(s => s.status !== 'ACTIVE').map(s => (
              <div key={s.id} className="scenario-card selected" style={{ borderLeftColor: s.status === 'SUCCESS' ? '#00f0ff' : '#ff3b30', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '11px' }}>{getScenarioTitle(s.scenarioId)}</h3>
                    <div className="scenario-meta" style={{ marginTop: '4px' }}>
                      <div>TURN: <span className="val cyan">{s.currentTurn}/{s.maxTurns}</span></div>
                      <div>STATUS: <span className={`val ${s.status === 'SUCCESS' ? 'cyan' : 'red'}`}>{s.status}</span></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button className="cyber-btn sm" onClick={() => onLoadGame(s.id)} disabled={loading} style={{ fontSize: '9px', padding: '4px 8px' }}>
                      <Play size={10} /> REVIEW
                    </button>
                    <button className="cyber-btn sm red" onClick={() => onDeleteGame(s.id)} disabled={loading} style={{ fontSize: '9px', padding: '4px 8px' }}>
                      <Trash2 size={10} /> DELETE
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Campaign Section — only shown when no active game */}
        {!hasActiveGame && (
          <>
            <h2 className="select-title" style={{ fontSize: '11px', paddingBottom: '8px', marginBottom: '10px' }}>
              START NEW CAMPAIGN
            </h2>

            <div className="scenario-list" style={{ maxHeight: '240px', marginBottom: '16px' }}>
              {scenarios.map(scenario => (
                <div 
                  key={scenario.scenarioId}
                  className={`scenario-card ${selectedScenarioId === scenario.scenarioId ? 'selected' : ''}`}
                  onClick={() => setSelectedScenarioId(scenario.scenarioId)}
                >
                  <h3>{scenario.title} <span>({scenario.scenarioId})</span></h3>

                  <div className="scenario-meta">
                    <div>TARGET VIP: [CLASSIFIED]</div>
                    <div>BUDGET: ${scenario.startingBudget?.toLocaleString()}</div>
                    <div>TURN LIMIT: {scenario.maxTurns}</div>
                    <div>ATTACK FORM: [REDACTED]</div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              className="cyber-btn lg" 
              onClick={onStartNewGame}
              disabled={!selectedScenarioId || loading}
              style={{ width: '100%' }}
            >
              <Activity size={20} />
              <span>START NEW OPERATION</span>
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ScenarioSelect;
