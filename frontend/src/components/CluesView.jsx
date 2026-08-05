import React, { useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import ClueCard from './ClueCard';

// Sources considered "routine" surveillance intel — can be bulk-dismissed
const ROUTINE_SOURCES = ['WIRE_TAP', 'PHONE_TAP', 'CCTV', 'SATELLITE', 'FINANCE_MONITOR'];

export default function CluesView({ session, localAssessments, onSetClueAssessment, onSetMultipleClueAssessments, isAttacker }) {
  const [intelFilter, setIntelFilter] = useState('ALL');
  const [clearedClues, setClearedClues] = useState([]);
  const filters = ['ALL', 'REJECT', 'DOUBT', 'UNASSESSED'];
  const suspects = session?.attackerNames || [];

  const handleAcceptAllOldClues = () => {
    const assessmentsToSet = {};
    (session?.discoveredClues || []).forEach((clue, index) => {
      if (clue.source === 'SUSPECT_RELOCATION') return;
      if (clue.turnDiscovered >= session.currentTurn) return;
      if (isAttacker) {
        const txt = (clue.clueText || '').toLowerCase();
        const isCombatTeam = txt.includes('combat team') || txt.includes('comat team') || txt.includes('tactical team');
        const isSweep = txt.includes('sweep') || txt.includes('lockdown') || txt.includes('patrol');
        if (!isCombatTeam && !isSweep) {
          return;
        }
      }
      const assessment = localAssessments[index] || 'UNASSESSED';
      if (assessment !== 'ACCEPT') {
        assessmentsToSet[index] = 'ACCEPT';
      }
    });
    if (Object.keys(assessmentsToSet).length > 0 && onSetMultipleClueAssessments) {
      onSetMultipleClueAssessments(assessmentsToSet);
    }
  };

  const unacceptedOldCluesCount = (session?.discoveredClues || []).filter((clue, index) => {
    if (clue.source === 'SUSPECT_RELOCATION') return false;
    if (clue.turnDiscovered >= session.currentTurn) return false;
    if (isAttacker) {
      const txt = (clue.clueText || '').toLowerCase();
      const isCombatTeam = txt.includes('combat team') || txt.includes('comat team') || txt.includes('tactical team');
      const isSweep = txt.includes('sweep') || txt.includes('lockdown') || txt.includes('patrol');
      if (!isCombatTeam && !isSweep) {
        return false;
      }
    }
    const assessment = localAssessments[index] || 'UNASSESSED';
    return assessment !== 'ACCEPT';
  }).length;

  const filteredClues = (session?.discoveredClues || []).map((clue, index) => ({ clue, index }))
    .filter(({ clue, index }) => {
      if (clue.source === 'SUSPECT_RELOCATION') return false;
      if (clue.turnDiscovered > session.currentTurn) return false;
      if (clearedClues.includes(index)) return false;
  
      // Filter for Attacker: only show combat/tactical teams and sweeps/lockdowns/patrols clues
      if (isAttacker) {
        const txt = (clue.clueText || '').toLowerCase();
        const isCombatTeam = txt.includes('combat team') || txt.includes('comat team') || txt.includes('tactical team');
        const isSweep = txt.includes('sweep') || txt.includes('lockdown') || txt.includes('patrol');
        if (!isCombatTeam && !isSweep) {
          return false;
        }
      }
 
      const assessment = localAssessments[index] || 'UNASSESSED';
      if (assessment === 'ACCEPT') return false;
      // Rejected clues only appear in the REJECT tab, not in ALL
      if (intelFilter === 'ALL' && assessment === 'REJECT') return false;
      if (intelFilter !== 'ALL' && assessment !== intelFilter) return false;
      return true;
    });

  // Dismiss all unassessed routine/tech intel clues
  const handleDismissRoutine = () => {
    const indicesToClear = [];
    (session?.discoveredClues || []).forEach((clue, index) => {
      if (clearedClues.includes(index)) return;
      const assessment = localAssessments[index] || 'UNASSESSED';
      if (assessment === 'UNASSESSED' && ROUTINE_SOURCES.includes(clue.source)) {
        indicesToClear.push(index);
      }
    });
    setClearedClues(prev => [...prev, ...indicesToClear]);
  };

  const handleClearAssessed = () => {
    const indicesToClear = [];
    (session?.discoveredClues || []).forEach((clue, index) => {
      const assessment = localAssessments[index] || 'UNASSESSED';
      if (assessment !== 'UNASSESSED') {
        indicesToClear.push(index);
      }
    });
    setClearedClues(prev => [...prev, ...indicesToClear]);
  };

  // Count dismissable routine clues
  const dismissableCount = (session?.discoveredClues || []).filter((clue, index) => {
    if (clearedClues.includes(index)) return false;
    const assessment = localAssessments[index] || 'UNASSESSED';
    return assessment === 'UNASSESSED' && ROUTINE_SOURCES.includes(clue.source);
  }).length;

  // Group clues by city / agent
  const groupedClues = {};
  filteredClues.forEach(item => {
    let groupKey = 'HEADQUARTERS ARCHIVES';
    if (item.clue.cityName) {
      const cityUpper = item.clue.cityName.replace(/_/g, ' ').toUpperCase();
      if (item.clue.discoveredByAgent === 'Surveillance Tech') {
        groupKey = `SURVEILLANCE MATRIX: ${cityUpper}`;
      } else if (item.clue.discoveredByAgent) {
        groupKey = `${cityUpper} (Agent: ${item.clue.discoveredByAgent})`;
      } else {
        groupKey = cityUpper;
      }
    }
    if (!groupedClues[groupKey]) groupedClues[groupKey] = [];
    groupedClues[groupKey].push(item);
  });

  return (
    <div className="clues-view">
      <div className="clues-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="clues-header-left">
          <h2>INTEL SCREEN &amp; CLUE BOARD</h2>
          <p className="clues-subtitle">Examine intercepted communications and gathered intelligence</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {/* Dismiss routine intel */}
          {dismissableCount > 0 && (
            <button
              onClick={handleDismissRoutine}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                height: 'fit-content',
                padding: '5px 11px',
                borderRadius: '4px',
                border: '1px solid rgba(255,204,0,0.35)',
                background: 'rgba(255,204,0,0.06)',
                color: '#ffcc00',
                fontFamily: 'monospace',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              title={`Dismiss ${dismissableCount} routine surveillance clue${dismissableCount !== 1 ? 's' : ''}`}
            >
              <Trash2 size={12} />
              DISMISS ROUTINE INTEL
              <span style={{
                background: 'rgba(255,204,0,0.2)',
                borderRadius: '8px',
                padding: '1px 6px',
                fontSize: '9px',
              }}>
                {dismissableCount}
              </span>
            </button>
          )}
          {unacceptedOldCluesCount > 0 && (
            <button
              onClick={handleAcceptAllOldClues}
              className="cyber-btn sm"
              style={{
                height: 'fit-content',
                background: 'rgba(52,199,89,0.06)',
                border: '1px solid rgba(52,199,89,0.35)',
                color: '#34c759',
              }}
            >
              ACCEPT ALL PREVIOUS ({unacceptedOldCluesCount})
            </button>
          )}
          <button
            onClick={handleClearAssessed}
            className="cyber-btn sm"
            style={{ height: 'fit-content' }}
          >
            ARCHIVE ASSESSED CLUES
          </button>
        </div>
      </div>

      <div className="filter-bar">
        {filters.map(f => (
          <button
            key={f}
            className={`filter-chip ${intelFilter === f ? 'active' : ''}`}
            onClick={() => setIntelFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="clues-grouped-container">
        {filteredClues.length > 0 ? (
          Object.entries(groupedClues).map(([groupName, items]) => (
            <div key={groupName} className="clue-group-section mb-6">
              <h3 className="clue-group-title text-cyber border-b border-cyan-800 pb-1 mb-3 font-mono text-sm tracking-wider">
                {groupName}
              </h3>
              <div className="clues-grid">
                {items.map(({ clue, index }) => (
                  <ClueCard
                    key={index}
                    clue={clue}
                    index={index}
                    assessment={localAssessments[index] || 'UNASSESSED'}
                    onSetAssessment={onSetClueAssessment}
                    suspects={suspects}
                    isAttacker={isAttacker}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Search size={48} />
            <p>No clues match current filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
