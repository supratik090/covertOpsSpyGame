import React, { useState, useEffect, useRef } from 'react';
import { Play, Trash2, Activity, ChevronDown, ChevronRight, Award, Trophy, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchLeaderboard, fetchMyScores } from '../utils/scoresApi';

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

  const [myScoreData, setMyScoreData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  const startBtnRef = useRef(null);

  const handleSelectScenario = (scenarioId) => {
    setSelectedScenarioId(scenarioId);
    setTimeout(() => {
      startBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  useEffect(() => {
    fetchMyScores().then(data => {
      if (data) setMyScoreData(data);
    });
    fetchLeaderboard().then(data => {
      if (Array.isArray(data)) setLeaderboard(data);
    });
  }, []);

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
          <div className="auth-brand" style={{ margin: 0, alignItems: 'flex-start' }}>
            <span className="auth-brand-line" style={{ letterSpacing: '0.2em' }}>SECURITY DIRECTIVE</span>
            <span className="auth-brand-name" style={{ fontSize: '22px', letterSpacing: '0.06em' }}>
              <span style={{ color: 'var(--cyan)', textShadow: '0 0 10px rgba(0, 240, 255, 0.5)' }}>SHADOW</span> PROTOCOL
            </span>
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

        {/* Global User Score & Rank Banner */}
        {myScoreData && (
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            marginBottom: '16px',
            background: 'linear-gradient(90deg, rgba(0, 240, 255, 0.08), rgba(0, 255, 102, 0.05))',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            borderRadius: '8px',
            fontFamily: 'monospace'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={18} color="#00ff66" />
              <div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>COMMANDER STANDING</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--cyan)' }}>
                  RANK #{myScoreData.globalRank || '-'} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>GLOBALLY</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9.5px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>TOTAL CAREER SCORE</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#00ff66', textShadow: '0 0 8px rgba(0,255,102,0.4)' }}>
                {myScoreData.totalScore || 0} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PTS</span>
              </div>
            </div>
          </div>
        )}

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
            const scenarioBestScore = myScoreData?.scenarioScores?.[scenario.scenarioId]?.score;

            return (
              <div 
                key={scenario.scenarioId}
                className={`scenario-card ${selectedScenarioId === scenario.scenarioId ? 'selected' : ''}`}
                onClick={() => handleSelectScenario(scenario.scenarioId)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0 }}>
                    {scenario.title} 
                    {isFullSuccess && (
                      <span className="cia-tag green" style={{ background: 'rgba(0, 255, 102, 0.1)', color: '#00ff66', border: '1px solid rgba(0, 255, 102, 0.4)', fontSize: '8.5px', padding: '2px 6px', borderRadius: '3px', marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle', fontWeight: 'bold' }}>
                        ✓ FULL VICTORY
                      </span>
                    )}
                    {isPartialSuccess && !isFullSuccess && (
                      <span className="cia-tag gold" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '8.5px', padding: '2px 6px', borderRadius: '3px', marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle', fontWeight: 'bold' }}>
                        ⚡ PARTIAL VICTORY
                      </span>
                    )}
                    {scenarioBestScore !== undefined && (
                      <span style={{ background: 'rgba(0, 240, 255, 0.15)', color: 'var(--cyan)', border: '1px solid rgba(0, 240, 255, 0.4)', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle', fontWeight: 900, fontFamily: 'monospace' }}>
                        ★ {scenarioBestScore}/100 PTS
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

        <button 
          ref={startBtnRef}
          className="cyber-btn lg" 
          onClick={() => onStartNewGame(playerRole, gameMode === 'MULTIPLAYER', timerMinutes)}
          disabled={!selectedScenarioId || loading}
          style={{ width: '100%', marginBottom: '20px' }}
        >
          <Activity size={20} />
          <span>{gameMode === 'MULTIPLAYER' ? 'CREATE MULTIPLAYER LOBBY' : 'START NEW OPERATION'}</span>
        </button>

        {/* Global Leaderboard Section */}
        {leaderboard && leaderboard.length > 0 && (
          <div style={{
            background: 'rgba(4, 10, 24, 0.95)',
            border: '1px solid rgba(0, 240, 255, 0.25)',
            borderRadius: '8px',
            padding: '14px',
            marginTop: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'monospace', color: '#00ff66', fontWeight: 'bold', letterSpacing: '0.08em', marginBottom: '10px' }}>
              <Trophy size={14} color="#00ff66" /> TOP 5 GLOBAL COMMANDERS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'monospace', fontSize: '11px' }}>
              {leaderboard.map((user, idx) => {
                const isCurrentUser = myScoreData && user.username === myScoreData.username;
                return (
                  <div
                    key={user.username}
                    style={{
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      background: isCurrentUser ? 'rgba(0, 255, 102, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                      border: isCurrentUser ? '1px solid rgba(0, 255, 102, 0.3)' : '1px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        color: idx === 0 ? '#ffcc00' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#b45309' : 'var(--text-dim)',
                        fontWeight: 'bold',
                        width: '20px'
                      }}>
                        #{idx + 1}
                      </span>
                      <span style={{ color: isCurrentUser ? '#00ff66' : 'var(--text-primary)', fontWeight: isCurrentUser ? 'bold' : 'normal' }}>
                        {user.username} {isCurrentUser && '(YOU)'}
                      </span>
                    </div>
                    <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>
                      {user.totalScore} PTS
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
};

export default ScenarioSelect;
