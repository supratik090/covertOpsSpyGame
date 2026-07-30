import React, { useState } from 'react';
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
  onJoinGame,
  loading,
  errorMsg,
  onLogout
}) => {
  const [playerRole, setPlayerRole] = useState('DEFENDER');
  const [gameMode, setGameMode] = useState('SINGLE'); // 'SINGLE', 'MULTIPLAYER'
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [joinToken, setJoinToken] = useState('');

  const getScenarioTitle = (scenarioId) => {
    const s = scenarios.find(sc => sc.scenarioId === scenarioId);
    return s ? s.title : scenarioId;
  };

  const activeSession = sessions.find(s => s.status === 'ACTIVE');
  const activeScenarioIds = new Set(sessions.filter(s => s.status === 'ACTIVE').map(s => s.scenarioId));
  const availableScenarios = scenarios.filter(s => !activeScenarioIds.has(s.scenarioId));

  return (
    <div className="select-screen">
      <motion.div 
        className="select-card cyber-panel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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

        {/* Active Campaign */}
        {activeSession && (
          <div className="scenario-card selected" style={{ borderLeftColor: '#00ff66', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: '2px' }}>ACTIVE CAMPAIGN</div>
                <h3 style={{ margin: '4px 0' }}>{getScenarioTitle(activeSession.scenarioId)}</h3>
                {activeSession.multiplayer && (
                  <div style={{ fontSize: '9.5px', fontFamily: 'monospace', color: 'var(--cyan)', marginTop: '2px', wordBreak: 'break-all' }}>
                    GAME TOKEN: {activeSession.id}
                  </div>
                )}
                <div className="scenario-meta" style={{ marginTop: '6px' }}>
                  <div>TURN: <span className="val cyan">{activeSession.currentTurn}/{activeSession.maxTurns}</span></div>
                  <div>ROLE: <span className={`val ${activeSession.playerRole === 'ATTACKER' ? 'red' : 'green'}`} style={{ fontWeight: 'bold' }}>{activeSession.playerRole}</span></div>
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
                      <div>ROLE: <span className={`val ${s.playerRole === 'ATTACKER' ? 'red' : 'green'}`} style={{ fontWeight: 'bold' }}>{s.playerRole}</span></div>
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

        {/* New Campaign Section */}
        <h2 className="select-title" style={{ fontSize: '11px', paddingBottom: '8px', marginBottom: '10px' }}>
          START NEW CAMPAIGN
        </h2>

        <div className="scenario-list" style={{ maxHeight: '240px', marginBottom: '16px' }}>
          {scenarios.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-dim)' }}>No scenario profiles loaded on the Command Desk.</p>
            </div>
          ) : availableScenarios.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-dim)' }}>All scenarios currently have an active campaign in progress.</p>
            </div>
          ) : availableScenarios.map(scenario => (
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

        {/* Player Role Selection */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button 
            type="button"
            className={`cyber-btn sm ${playerRole === 'DEFENDER' ? 'green' : ''}`}
            onClick={() => setPlayerRole('DEFENDER')}
            style={{ flex: 1, padding: '8px', fontSize: '10px' }}
          >
            PLAY AS DEFENDER
          </button>
          <button 
            type="button"
            className={`cyber-btn sm ${playerRole === 'ATTACKER' ? 'red' : ''}`}
            onClick={() => setPlayerRole('ATTACKER')}
            style={{ flex: 1, padding: '8px', fontSize: '10px' }}
          >
            PLAY AS ATTACKER
          </button>
        </div>

        {/* Game Mode Selection */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button 
            type="button"
            className={`cyber-btn sm ${gameMode === 'SINGLE' ? 'green' : ''}`}
            onClick={() => setGameMode('SINGLE')}
            style={{ flex: 1, padding: '6px', fontSize: '9.5px' }}
          >
            SINGLE PLAYER VS AI
          </button>
          <button 
            type="button"
            className={`cyber-btn sm ${gameMode === 'MULTIPLAYER' ? 'cyan' : ''}`}
            onClick={() => setGameMode('MULTIPLAYER')}
            style={{ flex: 1, padding: '6px', fontSize: '9.5px' }}
          >
            MULTIPLAYER PVP
          </button>
        </div>

        {gameMode === 'MULTIPLAYER' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            <label style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>TURN TIMER (MINUTES)</label>
            <select 
              className="cyber-input" 
              value={timerMinutes} 
              onChange={(e) => setTimerMinutes(Number(e.target.value))}
              style={{ width: '100%', height: '32px', fontSize: '11px', background: 'var(--bg-card)', color: '#00f0ff', borderColor: 'var(--border-color)', borderStyle: 'solid', borderWidth: '1px' }}
            >
              <option value="1">1 MINUTE</option>
              <option value="2">2 MINUTES</option>
              <option value="3">3 MINUTES</option>
              <option value="5">5 MINUTES</option>
              <option value="10">10 MINUTES</option>
            </select>
          </div>
        )}

        <button 
          className="cyber-btn lg" 
          onClick={() => onStartNewGame(playerRole, gameMode === 'MULTIPLAYER', timerMinutes)}
          disabled={!selectedScenarioId || loading}
          style={{ width: '100%', marginBottom: '15px' }}
        >
          <Activity size={20} />
          <span>{gameMode === 'MULTIPLAYER' ? 'CREATE MULTIPLAYER LOBBY' : 'START NEW OPERATION'}</span>
        </button>

        {/* Join Game Section */}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
          <h2 className="select-title" style={{ fontSize: '11px', paddingBottom: '6px', marginBottom: '8px', borderBottom: 'none' }}>
            JOIN MULTIPLAYER OPERATION
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="ENTER GAME TOKEN ID" 
              value={joinToken} 
              onChange={(e) => setJoinToken(e.target.value)} 
              className="cyber-input"
              style={{ flex: 1, height: '32px', fontSize: '11px', textAlign: 'center', fontFamily: 'monospace' }}
            />
            <button 
              className="cyber-btn sm green"
              onClick={() => onJoinGame(joinToken)}
              disabled={!joinToken || loading}
              style={{ height: '32px', padding: '0 12px' }}
            >
              JOIN
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ScenarioSelect;
