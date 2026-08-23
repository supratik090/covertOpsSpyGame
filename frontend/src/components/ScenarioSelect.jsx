import React, { useState } from 'react';
import { Play, Trash2, Activity, ChevronDown, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const getCountryFlag = (country) => {
  if (!country) return '';
  const c = country.toLowerCase().trim();
  if (c === 'india') return '🇮🇳';
  if (c === 'pakistan') return '🇵🇰';
  if (c === 'bangladesh') return '🇧🇩';
  if (c === 'israel') return '🇮🇱';
  if (c === 'iran') return '🇮🇷';
  return '';
};

const ScenarioSelect = ({
  scenarios,
  sessions,
  selectedScenarioId,
  setSelectedScenarioId,
  onStartNewGame,
  onLoadGame,
  onDeleteGame,
  onJoinGame,
  loading,
  errorMsg,
  onLogout
}) => {
  const playerRole = 'DEFENDER';
  const gameMode = 'SINGLE';
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [joinToken, setJoinToken] = useState('');
  const [activeOpen, setActiveOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const getScenarioTitle = (scenarioId) => {
    const s = scenarios.find(sc => sc.scenarioId === scenarioId);
    return s ? s.title : scenarioId;
  };

  const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
  const archivedSessions = sessions.filter(s => s.status !== 'ACTIVE');

  const activeScenarioIds = new Set(activeSessions.map(s => s.scenarioId));
  const availableScenarios = scenarios.filter(s => !activeScenarioIds.has(s.scenarioId));

  return (
    <div className="select-screen">
      <motion.div 
        className="select-card cyber-panel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="auth-brand" style={{ margin: 0 }}>
            <span className="auth-brand-line">PROTOCOL</span>
            <span className="auth-brand-name">NIGHTFALL</span>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="cyber-btn sm red"
              style={{ fontSize: '9px', padding: '4px 10px', textTransform: 'uppercase', height: '24px', flexShrink: 0 }}
            >
              LOGOUT
            </button>
          )}
        </div>
        <h1 className="select-title">COMMAND DESK: OPERATIONS CENTER</h1>

        {errorMsg && <div className="error-msg">{errorMsg}</div>}

        {/* Collapsible Active Campaigns */}
        {activeSessions.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div 
              onClick={() => setActiveOpen(!activeOpen)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'rgba(0, 255, 102, 0.05)',
                border: '1px solid rgba(0, 255, 102, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: activeOpen ? '10px' : '0',
                userSelect: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeOpen ? <ChevronDown size={14} color="#00ff66" /> : <ChevronRight size={14} color="#00ff66" />}
                <h2 style={{ fontSize: '11px', margin: 0, color: '#00ff66', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.08em' }}>
                  ACTIVE CAMPAIGNS ({activeSessions.length})
                </h2>
              </div>
              <span style={{ fontSize: '9px', color: 'rgba(0, 255, 102, 0.7)', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {activeOpen ? 'COLLAPSE ▲' : 'EXPAND ▼'}
              </span>
            </div>

            {activeOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeSessions.map(s => (
                  <div key={s.id} className="scenario-card selected" style={{ borderLeftColor: '#00ff66', marginBottom: '0px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '4px 0' }}>{getScenarioTitle(s.scenarioId)}</h3>
                        {s.multiplayer && (
                          <div style={{ fontSize: '9.5px', fontFamily: 'monospace', color: 'var(--cyan)', marginTop: '2px', wordBreak: 'break-all' }}>
                            GAME TOKEN: {s.id}
                          </div>
                        )}
                        <div className="scenario-meta" style={{ marginTop: '6px' }}>
                          <div>TURN: <span className="val cyan">{s.currentTurn}/{s.maxTurns}</span></div>
                          <div>ROLE: <span className={`val ${s.playerRole === 'ATTACKER' ? 'red' : 'green'}`} style={{ fontWeight: 'bold' }}>{s.playerRole}</span></div>
                          <div>STATUS: <span className="val green">ACTIVE</span></div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          className="cyber-btn sm green"
                          onClick={() => onLoadGame(s.id)}
                          disabled={loading}
                        >
                          <Play size={12} /> RESUME
                        </button>
                        <button
                          className="cyber-btn sm red"
                          onClick={() => onDeleteGame(s.id)}
                          disabled={loading}
                        >
                          <Trash2 size={12} /> ABANDON
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Archived Campaigns */}
        {archivedSessions.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div 
              onClick={() => setArchivedOpen(!archivedOpen)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'rgba(0, 240, 255, 0.05)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: archivedOpen ? '10px' : '0',
                userSelect: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {archivedOpen ? <ChevronDown size={14} color="var(--cyan)" /> : <ChevronRight size={14} color="var(--cyan)" />}
                <h2 style={{ fontSize: '11px', margin: 0, color: 'var(--cyan)', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.08em' }}>
                  ARCHIVED CAMPAIGNS ({archivedSessions.length})
                </h2>
              </div>
              <span style={{ fontSize: '9px', color: 'rgba(0, 240, 255, 0.7)', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {archivedOpen ? 'COLLAPSE ▲' : 'EXPAND ▼'}
              </span>
            </div>

            {archivedOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {archivedSessions.map(s => {
                  const isSuccess = s.status === 'SUCCESS';
                  const isPartial = s.status === 'PARTIAL_DEFENDER_VICTORY';
                  const statusColor = isSuccess ? '#00f0ff' : isPartial ? '#f59e0b' : '#ff3b30';
                  return (
                    <div key={s.id} className="scenario-card selected" style={{ borderLeftColor: statusColor, marginBottom: '0px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '11px' }}>{getScenarioTitle(s.scenarioId)}</h3>
                          <div className="scenario-meta" style={{ marginTop: '4px' }}>
                            <div>TURN: <span className="val cyan">{s.currentTurn}/{s.maxTurns}</span></div>
                            <div>ROLE: <span className={`val ${s.playerRole === 'ATTACKER' ? 'red' : 'green'}`} style={{ fontWeight: 'bold' }}>{s.playerRole}</span></div>
                            <div>STATUS: <span className="val" style={{ color: statusColor, fontWeight: 'bold' }}>{s.status}</span></div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button className="cyber-btn sm" onClick={() => onLoadGame(s.id)} disabled={loading} style={{ fontSize: '9px', padding: '4px 8px' }}>
                            <Play size={10} /> REVIEW
                          </button>
                          <button className="cyber-btn sm red" onClick={() => onDeleteGame(s.id)} disabled={loading} style={{ fontSize: '9px', padding: '4px 8px' }}>
                            <Trash2 size={10} /> PURGE
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* New Campaign Section */}
        <h2 className="select-title" style={{ fontSize: '11px', paddingBottom: '8px', marginBottom: '10px' }}>
          START NEW CAMPAIGN
        </h2>

        <div className="scenario-list" style={{ marginBottom: '16px' }}>
          {scenarios.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-dim)' }}>No scenario profiles loaded on the Command Desk.</p>
            </div>
          ) : availableScenarios.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-dim)' }}>All scenarios currently have an active campaign in progress.</p>
            </div>
          ) : availableScenarios.map(scenario => {
            const completedSession = sessions.find(s => s.scenarioId === scenario.scenarioId && (s.status === 'SUCCESS' || s.status === 'PARTIAL_DEFENDER_VICTORY'));
            const isFullSuccess = completedSession?.status === 'SUCCESS';
            const isPartialSuccess = completedSession?.status === 'PARTIAL_DEFENDER_VICTORY';
            return (
              <div 
                key={scenario.scenarioId}
                className={`scenario-card ${selectedScenarioId === scenario.scenarioId ? 'selected' : ''}`}
                onClick={() => setSelectedScenarioId(scenario.scenarioId)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0 }}>
                    {scenario.title} 
                    {isFullSuccess && (
                      <span className="cia-tag green" style={{ background: 'rgba(0, 255, 102, 0.1)', color: '#00ff66', border: '1px solid rgba(0, 255, 102, 0.4)', fontSize: '8.5px', padding: '2px 6px', borderRadius: '3px', marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle', fontWeight: 'bold' }}>
                        ✓ FULL VICTORY
                      </span>
                    )}
                    {isPartialSuccess && (
                      <span className="cia-tag gold" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '8.5px', padding: '2px 6px', borderRadius: '3px', marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle', fontWeight: 'bold' }}>
                        ⚡ PARTIAL VICTORY
                      </span>
                    )}
                  </h3>
                  {scenario.attackingCountry && scenario.defendingCountry && (
                    <span style={{ fontSize: '15px', marginLeft: '12px', display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                      {getCountryFlag(scenario.attackingCountry)}
                      <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>⚔️</span>
                      {getCountryFlag(scenario.defendingCountry)}
                    </span>
                  )}
                </div>

                <div className="scenario-meta" style={{ marginTop: '8px' }}>
                  {scenario.attackingCountry && scenario.defendingCountry && (
                    <div>THEATER: <span className="val cyan">{scenario.attackingCountry} vs {scenario.defendingCountry}</span></div>
                  )}
                  <div>TARGET VIP: [CLASSIFIED]</div>
                  <div>BUDGET: ${scenario.startingBudget?.toLocaleString()}</div>
                  <div>TURN LIMIT: {scenario.maxTurns}</div>
                  <div>ATTACK FORM: [REDACTED]</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Player Role & Game Mode: locked to DEFENDER / SINGLE PLAYER — UI toggles hidden */}



        <button 
          className="cyber-btn lg" 
          onClick={() => onStartNewGame(playerRole, gameMode === 'MULTIPLAYER', timerMinutes)}
          disabled={!selectedScenarioId || loading}
          style={{ width: '100%', marginBottom: '15px' }}
        >
          <Activity size={20} />
          <span>{gameMode === 'MULTIPLAYER' ? 'CREATE MULTIPLAYER LOBBY' : 'START NEW OPERATION'}</span>
        </button>


      </motion.div>
    </div>
  );
};

export default ScenarioSelect;
