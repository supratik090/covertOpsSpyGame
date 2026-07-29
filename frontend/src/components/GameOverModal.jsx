import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Target, AlertTriangle, CheckCircle, XCircle,
  Play, SkipForward, Eye, LogOut, ChevronRight, Clock, MapPin
} from 'lucide-react';

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
          {showLocation && (
            <span style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: '#ff7070', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', letterSpacing: '0.04em' }}>
              📍 {step.suspectLocation.replace(/_/g, ' ').toUpperCase()}{targetSafehouse ? ` [#${targetSafehouse.safehouseCode}]` : ''}
            </span>
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
export default function GameOverModal({ session, replayPlan, onConfirm, onViewReplay }) {
  const isSuccess = session?.status === 'SUCCESS';
  const [phase, setPhase] = useState('RESULT');   // 'RESULT' | 'REPLAY'
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const autoRef = useRef(null);

  const primarySteps = replayPlan?.primaryPlan || [];
  const fallbackSteps = replayPlan?.fallbackPlan || [];
  const allSteps = [...primarySteps, ...fallbackSteps].sort((a, b) => a.turn - b.turn);

  // Auto-animate steps with 1s delay each
  useEffect(() => {
    if (phase === 'REPLAY' && autoPlaying) {
      if (visibleSteps < allSteps.length) {
        autoRef.current = setTimeout(() => {
          setVisibleSteps(v => v + 1);
        }, 1000);
      } else {
        setAutoPlaying(false);
      }
    }
    return () => clearTimeout(autoRef.current);
  }, [phase, autoPlaying, visibleSteps, allSteps.length]);

  const startReplay = () => {
    setPhase('REPLAY');
    setVisibleSteps(0);
    setAutoPlaying(true);
  };

  const skipToEnd = () => {
    setAutoPlaying(false);
    setVisibleSteps(allSteps.length);
  };

  if (phase === 'REPLAY') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(3,6,16,0.97)',
        backdropFilter: 'blur(16px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Replay header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 28px',
          borderBottom: '1px solid rgba(189,0,255,0.2)',
          background: 'rgba(189,0,255,0.04)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '3px' }}>DECRYPTED INTELLIGENCE — GOD MODE</div>
            <h2 style={{ fontSize: '16px', fontFamily: 'monospace', fontWeight: 700, color: '#bd00ff', letterSpacing: '0.06em', margin: 0 }}>
              ATTACKER TIMELINE RECONSTRUCTION
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {autoPlaying ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontFamily: 'monospace', color: '#bd00ff' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#bd00ff', animation: 'blink 1s infinite' }} />
                STREAMING {visibleSteps} / {allSteps.length}
              </div>
            ) : (
              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>
                {visibleSteps} / {allSteps.length} STEPS
              </span>
            )}
            {!autoPlaying && visibleSteps < allSteps.length && (
              <button onClick={() => setAutoPlaying(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '4px', border: '1px solid rgba(189,0,255,0.4)', background: 'rgba(189,0,255,0.08)', color: '#bd00ff', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                <Play size={11} /> RESUME
              </button>
            )}
            <button onClick={skipToEnd} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '4px', border: '1px solid rgba(189,0,255,0.25)', background: 'transparent', color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
              <SkipForward size={11} /> SKIP TO END
            </button>
            <button onClick={onConfirm} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '4px', border: '1px solid rgba(0,240,255,0.3)', background: 'rgba(0,240,255,0.06)', color: 'var(--cyan)', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
              <LogOut size={11} /> EXIT TO SCENARIOS
            </button>
          </div>
        </div>

        {/* Plan type divider labels */}
        <div style={{ display: 'flex', gap: '12px', padding: '10px 28px', borderBottom: '1px solid rgba(189,0,255,0.1)', flexShrink: 0, background: 'rgba(0,0,0,0.3)' }}>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#d480ff', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '3px', background: 'rgba(189,0,255,0.08)', border: '1px solid rgba(189,0,255,0.2)' }}>
            PRIMARY PLAN: {primarySteps.length} STEPS
          </span>
          {fallbackSteps.length > 0 && (
            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#f97316', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '3px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
              FALLBACK PLAN: {fallbackSteps.length} STEPS (ACTIVATED)
            </span>
          )}
        </div>

        {/* Scrollable timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 40px' }}>
          {/* Vertical rail */}
          <div style={{ position: 'relative', paddingLeft: '52px' }}>
            <div style={{
              position: 'absolute', left: '17px', top: 0, bottom: 0, width: '2px',
              background: 'linear-gradient(to bottom, rgba(189,0,255,0.7), rgba(189,0,255,0.05))',
              borderRadius: '2px',
            }} />

            {allSteps.map((step, idx) => (
              <TimelineCard
                key={idx}
                step={step}
                stepIdx={idx}
                session={session}
                visible={idx < visibleSteps}
              />
            ))}

            {/* "Streaming" placeholder */}
            {autoPlaying && visibleSteps < allSteps.length && (
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '0px', marginTop: '4px' }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px dashed rgba(189,0,255,0.3)', background: 'transparent', flexShrink: 0 }} />
                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(189,0,255,0.5)', letterSpacing: '0.06em' }}>
                  DECRYPTING NEXT ENTRY...
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULT PHASE ─────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(3,6,16,0.96)',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: isSuccess
            ? 'radial-gradient(ellipse at 50% 40%, rgba(0,255,102,0.06) 0%, transparent 65%)'
            : 'radial-gradient(ellipse at 50% 40%, rgba(255,59,48,0.08) 0%, transparent 65%)',
        }} />

        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%', maxWidth: '560px',
            margin: '20px',
            padding: '40px',
            borderRadius: '12px',
            background: 'rgba(8,14,30,0.95)',
            border: `1px solid ${isSuccess ? 'rgba(0,255,102,0.3)' : 'rgba(255,59,48,0.3)'}`,
            boxShadow: isSuccess
              ? '0 0 80px rgba(0,255,102,0.08), 0 24px 80px rgba(0,0,0,0.6)'
              : '0 0 80px rgba(255,59,48,0.1), 0 24px 80px rgba(0,0,0,0.6)',
            position: 'relative',
            textAlign: 'center',
          }}
        >
          {/* Corner accents */}
          <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '14px', height: '14px', borderTop: `2px solid ${isSuccess ? '#00ff66' : '#ff3b30'}`, borderLeft: `2px solid ${isSuccess ? '#00ff66' : '#ff3b30'}` }} />
          <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '14px', height: '14px', borderBottom: `2px solid ${isSuccess ? '#00ff66' : '#ff3b30'}`, borderRight: `2px solid ${isSuccess ? '#00ff66' : '#ff3b30'}` }} />

          {/* Status icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isSuccess ? 'rgba(0,255,102,0.1)' : 'rgba(255,59,48,0.1)',
              border: `2px solid ${isSuccess ? 'rgba(0,255,102,0.5)' : 'rgba(255,59,48,0.5)'}`,
              boxShadow: isSuccess ? '0 0 30px rgba(0,255,102,0.15)' : '0 0 30px rgba(255,59,48,0.15)',
            }}
          >
            {isSuccess
              ? <CheckCircle size={36} style={{ color: '#00ff66' }} />
              : <XCircle size={36} style={{ color: '#ff3b30' }} />}
          </motion.div>

          {/* Classification stamp */}
          <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-dim)', letterSpacing: '0.15em', marginBottom: '10px' }}>
            OPERATION COBRA — FINAL OUTCOME REPORT
          </div>

          {/* Main result */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              fontFamily: 'monospace', fontWeight: 900,
              fontSize: '28px',
              letterSpacing: '0.06em',
              color: isSuccess ? '#00ff66' : '#ff3b30',
              textShadow: isSuccess ? '0 0 30px rgba(0,255,102,0.35)' : '0 0 30px rgba(255,59,48,0.35)',
              marginBottom: '10px',
            }}
          >
            {isSuccess ? '✦ MISSION SUCCESS' : '✖ OPERATION COMPROMISED'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '28px' }}
          >
            {isSuccess
              ? `Threat neutralized. The target cell has been dismantled and the attack vector closed. Outstanding field work, Director. The nation's security has been preserved.`
              : `The attack has been executed. Intelligence gaps and operational delays allowed the cell to complete their mission. Debrief will follow.`}
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              display: 'flex', gap: '1px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '6px', overflow: 'hidden',
              marginBottom: '28px',
            }}
          >
            {[
              { label: 'TURNS ELAPSED', value: session?.currentTurn - 1, color: '#ffcc00' },
              { label: 'HEAT LEVEL', value: `${session?.heatPercentage}%`, color: session?.heatPercentage > 75 ? '#ff3b30' : '#00f0ff' },
              { label: 'INTEL GATHERED', value: session?.discoveredClues?.length || 0, color: '#00f0ff' },
              { label: 'BUDGET REMAINING', value: `$${(session?.budget || 0).toLocaleString()}`, color: '#00ff66' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, padding: '12px 8px', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: 700, color, marginBottom: '4px' }}>{value}</div>
                <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{label}</div>
              </div>
            ))}
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {replayPlan && (
              <button
                onClick={startReplay}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '13px 24px', borderRadius: '6px', cursor: 'pointer',
                  border: '1px solid rgba(189,0,255,0.5)',
                  background: 'rgba(189,0,255,0.1)',
                  color: '#d480ff',
                  fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em',
                  transition: 'all 0.2s',
                  width: '100%',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(189,0,255,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(189,0,255,0.1)'}
              >
                <Eye size={16} />
                VIEW GOD MODE REPLAY
                <span style={{ fontSize: '9px', color: 'rgba(212,128,255,0.6)', fontWeight: 400 }}>animated timeline</span>
              </button>
            )}

            <button
              onClick={onConfirm}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px 24px', borderRadius: '6px', cursor: 'pointer',
                border: `1px solid ${isSuccess ? 'rgba(0,255,102,0.4)' : 'rgba(0,240,255,0.3)'}`,
                background: isSuccess ? 'rgba(0,255,102,0.08)' : 'rgba(0,240,255,0.06)',
                color: isSuccess ? '#00ff66' : 'var(--cyan)',
                fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em',
                transition: 'all 0.2s',
                width: '100%',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <LogOut size={14} />
              RETURN TO SCENARIO SELECT
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
