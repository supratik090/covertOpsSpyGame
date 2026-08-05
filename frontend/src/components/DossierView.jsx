import React, { useState } from 'react';
import { BookOpen, MapPin, ChevronRight } from 'lucide-react';
import { getSuspectImage } from '../assets/suspectImages';

// ─── Source badge config ────────────────────────────────────────────────────
const SOURCE_CONFIG = {
  WIRE_TAP:             { label: 'WIRE TAP',      color: '#00f0ff', bg: 'rgba(0,240,255,0.08)',    border: 'rgba(0,240,255,0.25)' },
  PHONE_TAP:            { label: 'PHONE TAP',      color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.25)' },
  CCTV:                 { label: 'CCTV',           color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)' },
  SATELLITE:            { label: 'SATELLITE',      color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)' },
  FINANCE_MONITOR:      { label: 'FINANCE INTEL',  color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.25)' },
  HUMINT:               { label: 'HUMINT',         color: '#00f0ff', bg: 'rgba(0,240,255,0.08)',   border: 'rgba(0,240,255,0.25)' },
  TACTICAL_FORCE:       { label: 'TACTICAL',       color: '#ff3b30', bg: 'rgba(255,59,48,0.08)',   border: 'rgba(255,59,48,0.25)' },
  SECURITY_SWEEP_ALERT: { label: 'SWEEP ALERT',    color: '#ff0040', bg: 'rgba(255,0,64,0.08)',    border: 'rgba(255,0,64,0.35)' },
};

function SourceBadge({ source }) {
  const cfg = SOURCE_CONFIG[source] || {
    label: source?.replace(/_/g, ' ') || 'INTEL',
    color: '#888', bg: 'rgba(136,136,136,0.08)', border: 'rgba(136,136,136,0.25)',
  };
  return (
    <span style={{
      padding: '2px 7px',
      borderRadius: '3px',
      fontSize: '9px',
      fontFamily: 'monospace',
      fontWeight: 700,
      letterSpacing: '0.07em',
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Single clue row inside timeline ───────────────────────────────────────
function ClueEntry({ clue }) {
  const isSweep = clue.source === 'SECURITY_SWEEP_ALERT';
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: '5px',
      background: isSweep ? 'rgba(255,0,64,0.06)' : 'rgba(6,15,35,0.7)',
      border: `1px solid ${isSweep ? 'rgba(255,0,64,0.3)' : 'rgba(0,240,255,0.1)'}`,
      fontFamily: 'monospace',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
        <SourceBadge source={clue.source} />
        {clue.discoveredByAgent && clue.discoveredByAgent !== 'Surveillance Tech' && (
          <span style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
            via <span style={{ color: 'var(--cyan)' }}>{clue.discoveredByAgent}</span>
          </span>
        )}
      </div>
      <div style={{
        fontSize: '11px',
        color: isSweep ? '#ff7090' : 'var(--text-primary)',
        lineHeight: '1.55',
        fontWeight: isSweep ? 600 : 400,
      }}>
        {clue.clueText}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function DossierView({ session, localAssessments, onSetClueAssessment }) {
  const suspects = session?.attackerNames || [];
  const [selectedSuspect, setSelectedSuspect] = useState(suspects[0] || null);

  // All accepted clues (plus relocation footprint clues automatically)
  const acceptedClues = (session?.discoveredClues || [])
    .map((clue, index) => ({ clue, index }))
    .filter(({ clue, index }) => 
      clue.turnDiscovered <= session.currentTurn && 
      (clue.source === 'SUSPECT_RELOCATION' || (localAssessments[index] || 'UNASSESSED') === 'ACCEPT')
    );

  // Clues relevant to selected suspect:
  //   • clue text mentions the suspect's first name, OR
  //   • it's a surveillance/tech clue (shown regardless of suspect name)
  const suspectClues = selectedSuspect
    ? acceptedClues.filter(({ clue }) => {
        const firstName = selectedSuspect.split(' ')[0].toLowerCase();
        const mentionsSelectedSuspect = clue.clueText?.toLowerCase().includes(firstName);

        let mentionsOtherSuspect = false;
        for (const suspect of suspects) {
          if (suspect !== selectedSuspect) {
            const otherFirstName = suspect.split(' ')[0].toLowerCase();
            if (clue.clueText?.toLowerCase().includes(otherFirstName)) {
              mentionsOtherSuspect = true;
              break;
            }
          }
        }

        if (mentionsOtherSuspect) {
          return mentionsSelectedSuspect;
        }

        const isTech = ['WIRE_TAP', 'PHONE_TAP', 'CCTV', 'SATELLITE', 'FINANCE_MONITOR'].includes(clue.source);
        return mentionsSelectedSuspect || isTech;
      })
    : [];

  const maxTurn = Math.max(
    session?.currentTurn || 1,
    suspectClues.length > 0
      ? Math.max(...suspectClues.map(({ clue }) => clue.turnOccurred || clue.turnDiscovered || 1))
      : 1
  );

  // Group by turn number
  const cluesByTurn = {};
  suspectClues.forEach(({ clue, index }) => {
    const t = clue.turnOccurred || clue.turnDiscovered || 1;
    if (!cluesByTurn[t]) cluesByTurn[t] = [];
    cluesByTurn[t].push({ clue, index });
  });

  const suspectImg = getSuspectImage(selectedSuspect);
  const turns = Array.from({ length: maxTurn }, (_, i) => i + 1).reverse();

  // Count confirmed clues per suspect (for badge)
  const countForSuspect = (name) =>
    acceptedClues.filter(({ clue }) =>
      clue.clueText?.toLowerCase().includes(name.split(' ')[0].toLowerCase())
    ).length;

  // ── Empty state ──────────────────────────────────────────────────────────
  if (acceptedClues.length === 0) {
    return (
      <div className="clues-view">
        <div className="empty-state">
          <BookOpen size={48} />
          <p>No confirmed intelligence in dossier. Mark clues as ACCEPT on the Clue Board first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="clues-view" style={{ paddingBottom: '40px' }}>
      <style>{`
        .suspect-selector-container {
          display: flex;
          gap: 10px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .suspect-selector-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px 8px 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .suspect-selector-img-container {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .suspect-selector-name {
          font-size: 11px;
          font-family: monospace;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .suspect-selector-count {
          font-size: 9px;
          font-family: monospace;
          color: var(--text-dim);
          margin-top: 2px;
        }
        @media (max-width: 600px) {
          .suspect-selector-container {
            gap: 6px;
            margin-bottom: 16px;
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 6px;
          }
          .suspect-selector-btn {
            gap: 6px;
            padding: 5px 8px 5px 5px;
            border-radius: 6px;
            flex-shrink: 0;
          }
          .suspect-selector-img-container {
            width: 26px;
            height: 26px;
            border-radius: 4px;
          }
          .suspect-selector-name {
            font-size: 9px;
          }
          .suspect-selector-count {
            font-size: 7px;
            margin-top: 1px;
          }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid rgba(0,240,255,0.15)', paddingBottom: '14px' }}>
        <h2 style={{ fontFamily: 'monospace', fontSize: '17px', fontWeight: 700, color: 'var(--cyan)', letterSpacing: '0.06em', margin: 0 }}>
          CASE FILE DOSSIER
        </h2>
        <p style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace', marginTop: '4px' }}>
          Select a suspect to view their confirmed intelligence timeline
        </p>
      </div>

      {/* ── Suspect selector ── */}
      <div className="suspect-selector-container">
        {suspects.map(name => {
          const img = getSuspectImage(name);
          const isSelected = selectedSuspect === name;
          const count = countForSuspect(name);
          const currentAttackerObj = (session?.aiAttackers || []).find(a => a.name === name);
          return (
            <button
              key={name}
              onClick={() => setSelectedSuspect(name)}
              className="suspect-selector-btn"
              style={{
                border: isSelected
                  ? '1px solid rgba(255,59,48,0.65)'
                  : '1px solid rgba(255,255,255,0.08)',
                background: isSelected
                  ? 'rgba(255,59,48,0.1)'
                  : 'rgba(255,255,255,0.02)',
                opacity: currentAttackerObj?.eliminated ? 0.65 : 1,
                boxShadow: isSelected ? '0 0 18px rgba(255,59,48,0.18)' : 'none',
              }}
            >
              {img && (
                <div 
                  className="suspect-selector-img-container"
                  style={{
                    border: isSelected
                      ? '1px solid rgba(255,59,48,0.55)'
                      : '1px solid rgba(255,255,255,0.12)',
                    filter: currentAttackerObj?.eliminated ? 'grayscale(100%)' : 'none',
                  }}
                >
                  <img src={img} alt={name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </div>
              )}
              <div style={{ textAlign: 'left' }}>
                <div 
                  className="suspect-selector-name"
                  style={{
                    color: currentAttackerObj?.eliminated ? '#888' : (isSelected ? '#ff7070' : 'var(--text-primary)'),
                    textDecoration: currentAttackerObj?.eliminated ? 'line-through' : 'none',
                  }}
                >
                  {name.toUpperCase()} {currentAttackerObj?.eliminated && '(LOST)'}
                </div>
                <div className="suspect-selector-count">
                  {count} clue{count !== 1 ? 's' : ''} confirmed
                </div>
              </div>
              {isSelected && (
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#ff3b30', boxShadow: '0 0 6px #ff3b30',
                  marginLeft: '4px', flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Selected suspect banner ── */}
      {selectedSuspect && (() => {
        const attackerObj = (session?.aiAttackers || []).find(a => a.name === selectedSuspect);
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 16px',
            marginBottom: '28px',
            background: attackerObj?.eliminated ? 'rgba(136,136,136,0.05)' : 'rgba(255,59,48,0.05)',
            border: attackerObj?.eliminated ? '1px solid rgba(136,136,136,0.2)' : '1px solid rgba(255,59,48,0.2)',
            borderLeft: attackerObj?.eliminated ? '3px solid #888' : '3px solid #ff3b30',
            borderRadius: '8px',
          }}>
            {suspectImg && (
              <div style={{
                width: '58px', height: '58px', borderRadius: '7px', flexShrink: 0,
                overflow: 'hidden', border: attackerObj?.eliminated ? '1px solid rgba(136,136,136,0.5)' : '1px solid rgba(255,59,48,0.5)',
                boxShadow: attackerObj?.eliminated ? 'none' : '0 0 14px rgba(255,59,48,0.18)',
                filter: attackerObj?.eliminated ? 'grayscale(100%)' : 'none',
              }}>
                <img src={suspectImg} alt={selectedSuspect}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '4px' }}>
                SUBJECT OF INVESTIGATION
              </div>
              <div style={{
                fontSize: '15px',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: attackerObj?.eliminated ? '#aaa' : '#ff7070',
                letterSpacing: '0.06em',
                textDecoration: attackerObj?.eliminated ? 'line-through' : 'none',
              }}>
                {selectedSuspect.toUpperCase()}
              </div>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-dim)', marginTop: '4px' }}>
                Coverage: T1 – T{maxTurn}&nbsp;&nbsp;·&nbsp;&nbsp;{suspectClues.length} intel entries
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>THREAT STATUS</div>
              <div style={{
                fontSize: '12px',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: attackerObj?.eliminated 
                  ? '#888' 
                  : attackerObj?.healingTurnsRemaining > 0 
                    ? '#ff9500' 
                    : '#ff3b30',
                marginTop: '3px'
              }}>
                {attackerObj?.eliminated 
                  ? '◉ LOST' 
                  : attackerObj?.healingTurnsRemaining > 0 
                    ? `◉ HEALING (${attackerObj.healingTurnsRemaining} TURNS)` 
                    : `◉ ${attackerObj?.state?.toUpperCase() || 'ACTIVE'}`}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Timeline ── */}
      {selectedSuspect && (
        <div style={{
          position: 'relative',
          paddingLeft: '52px',
          maxHeight: '420px',
          overflowY: 'auto',
          paddingRight: '12px',
          background: 'rgba(6,15,35,0.4)',
          border: '1px solid rgba(0,240,255,0.1)',
          borderRadius: '8px',
          paddingTop: '16px',
          paddingBottom: '16px',
        }}>

          {/* Vertical rail */}
          <div style={{
            position: 'absolute', left: '18px', top: '8px', bottom: '8px', width: '2px',
            background: 'linear-gradient(to bottom, rgba(255,59,48,0.7) 0%, rgba(255,59,48,0.08) 100%)',
            borderRadius: '2px',
          }} />

          {turns.map(turn => {
            const turnClues = cluesByTurn[turn] || [];
            const hasData = turnClues.length > 0;

            // Unique cities this turn
            const cities = [...new Set(turnClues.map(({ clue }) => clue.cityName).filter(Boolean))];
            const hasMultipleCities = cities.length > 1;

            if (!hasData) {
              // ── No-intel tick ──
              return (
                <div key={turn} style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '4px' }}>
                  {/* Tiny tick on rail */}
                  <div style={{
                    position: 'absolute', left: '13px',
                    width: '12px', height: '12px', borderRadius: '50%',
                    background: '#060c1c',
                    border: '1px solid rgba(255,59,48,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1,
                  }}>
                    <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,59,48,0.2)' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.3 }}>
                    <span style={{
                      fontSize: '9px', fontFamily: 'monospace', fontWeight: 700,
                      color: 'rgba(255,59,48,0.5)', minWidth: '22px', letterSpacing: '0.05em',
                    }}>T{turn}</span>
                    <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>
                      — NO INTEL —
                    </span>
                  </div>
                </div>
              );
            }

            // ── Full turn entry ──
            return (
              <div key={turn} style={{ position: 'relative', marginBottom: '20px' }}>

                {/* Turn node on rail */}
                <div style={{
                  position: 'absolute', left: '-34px', top: '2px',
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: '#0d1f3c',
                  border: '2px solid #ff3b30',
                  boxShadow: '0 0 10px rgba(255,59,48,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 2,
                }}>
                  <span style={{ fontSize: '7px', fontFamily: 'monospace', fontWeight: 900, color: '#ff7070' }}>{turn}</span>
                </div>

                {/* Turn header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '11px', fontFamily: 'monospace', fontWeight: 700,
                    color: '#ff7070', letterSpacing: '0.08em',
                  }}>
                    TURN {turn}
                  </span>
                  {cities.map(city => (
                    <span key={city} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      padding: '2px 8px', borderRadius: '3px', fontSize: '9px',
                      fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em',
                      color: '#34d399', background: 'rgba(52,211,153,0.08)',
                      border: '1px solid rgba(52,211,153,0.25)',
                    }}>
                      <MapPin size={8} />
                      {city.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  ))}
                  {hasMultipleCities && (
                    <span style={{
                      fontSize: '8px', fontFamily: 'monospace', color: 'var(--amber)',
                      background: 'rgba(255,204,0,0.08)', border: '1px solid rgba(255,204,0,0.25)',
                      padding: '1px 6px', borderRadius: '3px', letterSpacing: '0.05em',
                    }}>
                      SPLIT SIGHTING
                    </span>
                  )}
                </div>

                {/* Clue entries */}
                {!hasMultipleCities ? (
                  // Single location — flat list
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {turnClues.map(({ clue, index }) => (
                      <ClueEntry key={index} clue={clue} />
                    ))}
                  </div>
                ) : (
                  // Multiple cities — branched columns
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {cities.map(city => {
                      const cityClues = turnClues.filter(({ clue }) => clue.cityName === city);
                      return (
                        <div key={city} style={{
                          paddingLeft: '12px',
                          borderLeft: '2px solid rgba(52,211,153,0.35)',
                        }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            fontSize: '9px', fontFamily: 'monospace', fontWeight: 700,
                            color: '#34d399', letterSpacing: '0.06em', marginBottom: '6px',
                          }}>
                            <ChevronRight size={10} />
                            {city.replace(/_/g, ' ').toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {cityClues.map(({ clue, index }) => (
                              <ClueEntry key={index} clue={clue} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {/* Clues with no city (global tech intel) */}
                    {turnClues
                      .filter(({ clue }) => !clue.cityName)
                      .map(({ clue, index }) => (
                        <ClueEntry key={index} clue={clue} />
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
