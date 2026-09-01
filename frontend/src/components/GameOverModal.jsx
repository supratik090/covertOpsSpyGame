import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Target, AlertTriangle, CheckCircle, XCircle,
  Play, SkipForward, Eye, LogOut, ChevronRight, Clock, MapPin, Award
} from 'lucide-react';
import { fetchSessionScore } from '../utils/scoresApi';

/* ─── Source badge config (mirrors DossierView) ──────────────────────────── */
const SOURCE_CFG = {
  TACTICAL_FORCE:       { label: 'TACTICAL',    color: '#ff3b30', bg: 'rgba(255,59,48,0.1)'  },
  COMMAND_CENTER:       { label: 'COMMAND',     color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  SECURITY_SWEEP_LOSS:  { label: 'SWEEP LOSS',  color: '#ff0040', bg: 'rgba(255,0,64,0.1)'   },
};

/* ─── Per-step animated timeline card ───────────────────────────────────── */
function TimelineCard({ step, stepIdx, session, visible }) {
  const showLocation   = step.suspectLocation && step.suspectLocation !== 'NONE';
  const showFinance    = step.financeCity     && step.financeCity     !== 'NONE';
  const showLogistics  = step.logisticsCity   && step.logisticsCity   !== 'NONE';
  const showExfil      = step.escapeNode      && step.escapeNode      !== 'NONE';
  const showAction     = step.action          && step.action          !== 'IDLE' && step.action !== 'NONE';

  const combatOps = (session?.discoveredClues || []).filter(c =>
    c.turnDiscovered === step.turn &&
    (c.source === 'TACTICAL_FORCE' || c.clueText?.includes('COMBAT') || c.clueText?.includes('raid'))
  );

  const targetSafehouse = session?.safehouses?.find(
    s => s.cityNode === step.suspectLocation && s.ownerFaction === 'HOSTILE'
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -32 }}
      animate={visible ? { opacity: 1, x: 0 } : { opacity: 0, x: -32 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', gap: '16px', alignItems: 'flex-start',
        marginBottom: visible ? '16px' : '0',
        position: 'relative',
      }}
    >
      {/* Turn node */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
        background: combatOps.length > 0 ? 'rgba(255,59,48,0.15)' : 'rgba(189,0,255,0.12)',
        border: `2px solid ${combatOps.length > 0 ? '#ff3b30' : '#bd00ff'}`,
        boxShadow: `0 0 12px ${combatOps.length > 0 ? 'rgba(255,59,48,0.35)' : 'rgba(189,0,255,0.35)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2,
      }}>
        <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 900, color: combatOps.length > 0 ? '#ff6b6b' : '#d480ff' }}>
          {step.turn}
        </span>
      </div>

      {/* Card body */}
      <div style={{
        flex: 1,
        padding: '12px 14px',
        borderRadius: '6px',
        background: combatOps.length > 0 ? 'rgba(255,59,48,0.04)' : 'rgba(189,0,255,0.04)',
        border: `1px solid ${combatOps.length > 0 ? 'rgba(255,59,48,0.25)' : 'rgba(189,0,255,0.2)'}`,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#d480ff', letterSpacing: '0.06em' }}>
            TURN {step.turn}
          </span>
          <span style={{
            fontSize: '9px', fontFamily: 'monospace', fontWeight: 700,
            color: '#bd00ff', background: 'rgba(189,0,255,0.1)',
            border: '1px solid rgba(189,0,255,0.3)', padding: '1px 7px', borderRadius: '3px',
            letterSpacing: '0.05em',
          }}>
            {step.phase?.replace(/_/g, ' ') || 'IDLE'}
          </span>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: combatOps.length > 0 ? '10px' : 0 }}>
          {step.attackerHistories && step.attackerHistories.length > 0 ? (
            step.attackerHistories.map(h => (
              <span key={h.name} style={{
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '9px',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: h.eliminated ? '#888' : '#ff7070',
                background: h.eliminated ? 'rgba(255,255,255,0.02)' : 'rgba(255,59,48,0.08)',
                border: h.eliminated ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,59,48,0.25)',
                letterSpacing: '0.04em',
                textDecoration: h.eliminated ? 'line-through' : 'none'
              }}>
                👤 {h.name.split(' ')[0]}: {h.eliminated ? 'LOST' : `${h.location?.toUpperCase()} (${h.state})`}
              </span>
            ))
          ) : (
            showLocation && (
              <span style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: '#ff7070', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', letterSpacing: '0.04em' }}>
                📍 {step.suspectLocation.replace(/_/g, ' ').toUpperCase()}{targetSafehouse ? ` [#${targetSafehouse.safehouseCode}${targetSafehouse.subLocality ? ` - ${targetSafehouse.subLocality}` : ''}]` : ''}
              </span>
            )
          )}
          {showFinance && (
            <span style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', letterSpacing: '0.04em' }}>
              💳 FINANCE: {step.financeCity.replace(/_/g, ' ').toUpperCase()}
            </span>
          )}
          {showLogistics && (
            <span style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', letterSpacing: '0.04em' }}>
              📦 LOGISTICS: {step.logisticsCity.replace(/_/g, ' ').toUpperCase()}
            </span>
          )}
          {step.smuggling && (
            <span style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: '#f97316', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', letterSpacing: '0.04em' }}>
              🚨 INFILTRATION ACTIVE
            </span>
          )}
          {showExfil && (
            <span style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: '#fb923c', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)', letterSpacing: '0.04em' }}>
              🚪 EXFIL: {step.escapeNode.replace(/_/g, ' ').toUpperCase()}
            </span>
          )}
          {showAction && (
            <span style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: '#ff3b30', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.3)', letterSpacing: '0.04em' }}>
              🎯 {step.action.replace(/_/g, ' ').toUpperCase()}
            </span>
          )}
        </div>

        {/* Combat ops */}
        {combatOps.length > 0 && (
          <div style={{ padding: '8px 10px', borderRadius: '4px', background: 'rgba(255,59,48,0.05)', border: '1px solid rgba(255,59,48,0.2)' }}>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: '#ff6b6b', marginBottom: '5px', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Shield size={10} /> DEFENDER RESPONSE
            </div>
            {combatOps.map((op, i) => (
              <p key={i} style={{ margin: '3px 0 0', fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {op.clueText}
              </p>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Main modal ─────────────────────────────────────────────────────────── */
export default function GameOverModal({ session, onConfirm, onExtendGame, lastTurnReport }) {
  const isFullSuccess = session?.status === 'SUCCESS';
  const isPartialSuccess = session?.status === 'PARTIAL_DEFENDER_VICTORY';
  const isDefenderWin = isFullSuccess || isPartialSuccess;

  const [scoreData, setScoreData] = useState(null);

  useEffect(() => {
    if (session?.id && isDefenderWin) {
      fetchSessionScore(session.id).then(data => {
        if (data) setScoreData(data);
      });
    }
  }, [session?.id, isDefenderWin]);

  const titleText = isFullSuccess 
    ? '✦ FULL DEFENDER VICTORY' 
    : isPartialSuccess 
    ? '⚡ PARTIAL DEFENDER VICTORY' 
    : '✖ OPERATION COMPROMISED';

  const titleColor = isFullSuccess 
    ? '#00ff66' 
    : isPartialSuccess 
    ? '#f59e0b' 
    : '#ff3b30';

  const allNeutralized = session?.aiAttackers && session.aiAttackers.length > 0 && session.aiAttackers.every(a => a.eliminated);

  const subtitleText = isFullSuccess
    ? (allNeutralized
        ? 'All threat agents neutralized prior to any target strike. Target cell fully dismantled and national security preserved.'
        : 'Operation successfully defended. Threat cell failed to execute target strike prior to turn deadline. Sector secured.')
    : isPartialSuccess
    ? 'Target strike was executed in friendly territory, but all hostile threat agents were subsequently neutralized by Defender forces.'
    : 'The target attack was executed and hostile operatives exfiltrated. Intelligence gaps allowed the cell to complete their mission.';

  const finalTurnClues = (session?.discoveredClues || []).filter(c => 
    c.turnDiscovered === session?.currentTurn && 
    (c.source === 'TACTICAL_FORCE' || c.source === 'DRONE_ATTACK' || c.source === 'DRONE_RECON' || c.source === 'SAFEHOUSE_ATTACK' || c.source === 'STRIKE_EXECUTED' || c.source === 'SECURITY_SWEEP_ALERT' || c.source === 'SECURITY_SWEEP_LOSS' || c.source === 'BORDER_INCIDENT' || c.source === 'COMMAND_CENTER' || c.clueText?.toLowerCase().includes('neutralized') || c.clueText?.toLowerCase().includes('attacked') || c.clueText?.toLowerCase().includes('uncovered') || c.clueText?.toLowerCase().includes('shot down'))
  );

  const hasCombatReport = lastTurnReport?.combatOps?.length > 0 || lastTurnReport?.strikeEvents?.length > 0 || lastTurnReport?.sweepLosses?.length > 0 || finalTurnClues.length > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(3,6,16,0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          background: 'rgba(8,14,30,0.98)',
          border: `1px solid ${isDefenderWin ? 'rgba(0,240,255,0.3)' : 'rgba(255,59,48,0.3)'}`,
          borderRadius: '16px',
          padding: '40px 36px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: isDefenderWin
            ? '0 0 80px rgba(0,240,255,0.12), inset 0 0 40px rgba(0,240,255,0.05)'
            : '0 0 80px rgba(255,59,48,0.15), inset 0 0 40px rgba(255,59,48,0.05)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: isFullSuccess
            ? 'linear-gradient(90deg, transparent, #00ff66, transparent)'
            : isPartialSuccess
            ? 'linear-gradient(90deg, transparent, #f59e0b, transparent)'
            : 'linear-gradient(90deg, transparent, #ff3b30, transparent)',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2, stiffness: 400 }}
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isFullSuccess
                ? 'rgba(0,255,102,0.1)'
                : isPartialSuccess
                ? 'rgba(245,158,11,0.1)'
                : 'rgba(255,59,48,0.1)',
              border: `2px solid ${titleColor}`,
              boxShadow: `0 0 30px ${titleColor}40`,
            }}
          >
            {isDefenderWin ? (
              <Shield size={36} color={titleColor} />
            ) : (
              <AlertTriangle size={36} color={titleColor} />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div style={{
              fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.2em',
              color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px',
            }}>
              OPERATION DEBRIEF — {session?.scenarioId?.replace(/_/g, ' ') || 'COVERT OPS'}
            </div>
            <h1 style={{
              fontFamily: 'monospace', fontWeight: 900,
              fontSize: '24px',
              letterSpacing: '0.06em',
              color: titleColor,
              textShadow: `0 0 30px ${titleColor}40`,
              marginBottom: '10px',
            }}>
              {titleText}
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '20px' }}
          >
            {subtitleText}
          </motion.p>

          {/* 100-Point Performance Score Breakdown Panel */}
          {isDefenderWin && scoreData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              style={{
                margin: '0 auto 20px',
                maxWidth: '460px',
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(0, 240, 255, 0.04)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                boxShadow: '0 0 25px rgba(0, 240, 255, 0.08)',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(0, 240, 255, 0.2)', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--cyan)', letterSpacing: '0.08em' }}>
                  <Award size={16} /> PERFORMANCE RATING
                </div>
                <div style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 900, color: '#00ff66', textShadow: '0 0 10px rgba(0,255,102,0.5)' }}>
                  {scoreData.totalScore} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/ 100 PTS</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', fontFamily: 'monospace' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>⏱️ TURN EFFICIENCY ({scoreData.turnsUsed}/{scoreData.maxTurns} turns)</span>
                  <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>+{scoreData.turnScore} / 30</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>🛡️ PERSONNEL PRESERVATION ({scoreData.agentsLost} agents lost)</span>
                  <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>+{scoreData.personnelScore} / 35</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>💰 BUDGET CONSERVATION (${(scoreData.budgetRemaining || 0).toLocaleString()})</span>
                  <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>+{scoreData.budgetScore} / 25</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>🎖️ VICTORY QUALITY ({scoreData.outcome === 'SUCCESS' ? 'FULL DEFEAT' : 'PARTIAL DEFEAT'})</span>
                  <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>+{scoreData.victoryQualityScore} / 10</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Final Turn Combat & Tactical Resolution Report */}
          {hasCombatReport && (
            <div style={{
              margin: '0 auto 20px',
              maxWidth: '460px',
              padding: '14px 16px',
              borderRadius: '8px',
              background: 'rgba(6, 12, 28, 0.95)',
              border: `1px solid ${isDefenderWin ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 59, 48, 0.4)'}`,
              boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
              textAlign: 'left'
            }}>
              <div style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                fontWeight: 900,
                color: isDefenderWin ? '#00f0ff' : '#ff3b30',
                letterSpacing: '0.08em',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '6px'
              }}>
                <Target size={14} /> ⚔️ FINAL TURN RESOLUTION REPORT (TURN {session?.currentTurn || 1})
              </div>

              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11.5px', fontFamily: 'monospace', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                {lastTurnReport?.strikeEvents?.map((c, i) => (
                  <li key={`strike-${i}`} style={{ color: '#ff3b30', fontWeight: 'bold' }}>💥 {c.clueText}</li>
                ))}
                {lastTurnReport?.combatOps?.map((c, i) => (
                  <li key={`combat-${i}`} style={{ color: '#ff6b60' }}>🎯 {c.clueText}</li>
                ))}
                {lastTurnReport?.newExposedHostileSH?.map((sh, i) => (
                  <li key={`uncover-${i}`} style={{ color: '#00ff66' }}>🔍 Discovered hostile safehouse #{sh.safehouseCode}{sh.subLocality ? ` - ${sh.subLocality}` : ''} in {sh.cityNode.toUpperCase()}</li>
                ))}
                {(!lastTurnReport?.combatOps || lastTurnReport.combatOps.length === 0) && finalTurnClues.map((c, i) => (
                  <li key={`clue-${i}`} style={{ color: c.clueText?.includes('SHOT DOWN') || c.clueText?.includes('DESTROYED') ? '#ff3b30' : '#00f0ff' }}>
                    • {c.clueText}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Attacker team status list */}
          {session?.aiAttackers && session.aiAttackers.length > 0 && (
            <div style={{
              margin: '0 auto 24px',
              maxWidth: '420px',
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '9.5px', fontFamily: 'monospace', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '8px' }}>
                HOSTILE CELL STATUS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {session.aiAttackers.map((att, idx) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontSize: '11px', fontFamily: 'monospace',
                  }}>
                    <span style={{ color: 'var(--text-primary)' }}>{att.name}</span>
                    <span style={{
                      color: att.eliminated ? '#00ff66' : '#ff3b30',
                      fontWeight: 700,
                    }}>
                      {att.eliminated ? 'NEUTRALIZED' : 'ACTIVE / ESCAPED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {isFullSuccess && onExtendGame && (
              <button
                onClick={onExtendGame}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '14px 24px', borderRadius: '6px', cursor: 'pointer',
                  border: '1px solid #00ff66',
                  background: 'linear-gradient(135deg, rgba(0,255,102,0.25), rgba(0,240,255,0.2))',
                  color: '#00ff66',
                  fontFamily: 'monospace', fontSize: '13px', fontWeight: 900, letterSpacing: '0.08em',
                  boxShadow: '0 0 25px rgba(0,255,102,0.3)',
                  transition: 'all 0.2s',
                  width: '100%',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,255,102,0.4), rgba(0,240,255,0.3))';
                  e.currentTarget.style.boxShadow = '0 0 35px rgba(0,255,102,0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,255,102,0.25), rgba(0,240,255,0.2))';
                  e.currentTarget.style.boxShadow = '0 0 25px rgba(0,255,102,0.3)';
                }}
              >
                <Play size={14} />
                EXTEND OPERATION (ADD BUDGET & CONTINUE)
              </button>
            )}

            <button
              onClick={onConfirm}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '14px 24px', borderRadius: '6px', cursor: 'pointer',
                border: 'none',
                background: isDefenderWin
                  ? 'linear-gradient(135deg, #00f0ff, #7000ff)'
                  : 'linear-gradient(135deg, #ff3b30, #b00020)',
                color: '#fff',
                fontFamily: 'monospace', fontSize: '13px', fontWeight: 900, letterSpacing: '0.08em',
                boxShadow: isDefenderWin
                  ? '0 0 20px rgba(0,240,255,0.3)'
                  : '0 0 20px rgba(255,59,48,0.3)',
                transition: 'all 0.2s',
                width: '100%',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <LogOut size={14} />
              {isFullSuccess ? 'END OPERATION & RETURN' : 'RETURN TO SCENARIO SELECT'}
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
