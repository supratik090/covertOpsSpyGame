import React from 'react';
import { Shield, Coins, MapPin, Activity, HelpCircle, CheckCircle, ChevronRight, Key } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSuspectImage } from '../assets/suspectImages';

const CellHqView = ({
  session,
  activeScenario,
  localSeekPermissionType,
  setLocalSeekPermissionType,
  localTriggerStrike,
  setLocalTriggerStrike,
  localTriggerExfiltration,
  setLocalTriggerExfiltration,
  addToast
}) => {
  const isApprovedInf = session.infiltrationGoAheadApproved;
  const isApprovedStrike = session.strikeGoAheadApproved;

  const currentPhase = session.activeAttackerPhase || 'TRAIL_BREAKING';
  const budget = session.attackerBudget || 0;
  const location = session.suspectLocation || 'NONE';

  const financeSourced = session.financeCollected || false;
  const logisticsSourced = session.logisticsCollected || false;
  const handoverAchieved = session.handoverCompleted || false;

  const suspectName = session.actualAttacker || 'Faizal Khan';
  const suspectImg = getSuspectImage(suspectName);

  const handleQueuePermission = (type) => {
    if (localSeekPermissionType === type) {
      setLocalSeekPermissionType('');
      addToast("Clearance request cancelled.", "info");
    } else {
      setLocalSeekPermissionType(type);
      addToast(`Clearance request for ${type} queued for end of turn.`, "success");
    }
  };

  const handleQueueStrike = () => {
    if (localTriggerStrike) {
      setLocalTriggerStrike(false);
      addToast("Strike attack trigger cancelled.", "info");
    } else {
      setLocalTriggerStrike(true);
      addToast("Strike attack trigger queued for end of turn.", "success");
    }
  };

  const handleQueueExfil = () => {
    if (localTriggerExfiltration) {
      setLocalTriggerExfiltration(false);
      addToast("Exfiltration protocol trigger cancelled.", "info");
    } else {
      setLocalTriggerExfiltration(true);
      addToast("Exfiltration protocol trigger queued for end of turn.", "success");
    }
  };

  // Helper to render checklist status
  const renderCheckItem = (label, isDone) => (
    <div className="flex items-center gap-2 py-1.5 border-b border-[var(--cyber-border)]" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--cyber-border)' }}>
      {isDone ? (
        <CheckCircle size={14} style={{ color: '#00ff66' }} />
      ) : (
        <ChevronRight size={14} style={{ color: '#ffcc00' }} />
      )}
      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: isDone ? '#ffffff' : '#a0a0a0' }}>
        {label}
      </span>
    </div>
  );

  return (
    <motion.div 
      className="dossier-panel cyber-panel"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="auth-brand" style={{ marginBottom: '8px' }}>
          <span className="auth-brand-line">OPERATIONS CELL</span>
          <span className="auth-brand-name">RED DRAGON</span>
        </div>
        {suspectImg && (
          <img 
            src={suspectImg} 
            alt={suspectName} 
            style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '50%', 
              border: '2px solid var(--red)',
              boxShadow: '0 0 8px rgba(255, 59, 48, 0.4)'
            }} 
          />
        )}
      </div>

      <h1 className="select-title" style={{ fontSize: '14px', marginBottom: '8px' }}>CELL HQ DASHBOARD - {suspectName.toUpperCase()}</h1>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <div className="scenario-card selected" style={{ padding: '8px', borderLeftColor: '#00f0ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#a0a0a0' }}>
            <Coins size={10} /> BUDGET
          </div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px', color: '#00f0ff' }}>
            ${budget.toLocaleString()}
          </div>
        </div>
        <div className="scenario-card selected" style={{ padding: '8px', borderLeftColor: '#ff3b30' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#a0a0a0' }}>
            <MapPin size={10} /> LOCATION
          </div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '4px', color: '#ff3b30', textTransform: 'uppercase' }}>
            {location.replace('_', ' ')}
          </div>
        </div>
        <div className="scenario-card selected" style={{ padding: '8px', borderLeftColor: '#ffcc00' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#a0a0a0' }}>
            <Activity size={10} /> ACTIVE PHASE
          </div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '4px', color: '#ffcc00' }}>
            {currentPhase.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Go-Ahead Permissions Panel */}
      <div className="scenario-card selected" style={{ borderLeftColor: '#00ff66', padding: '12px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '11px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={12} /> HQ RECONNAISSANCE CLEARANCE
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {/* Clearance 1: Infiltration */}
          <div style={{ borderBottom: '1px dashed #333', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold' }}>STAGE 1: BORDER INFILTRATION</span>
              <span style={{ fontSize: '9px', color: isApprovedInf ? '#00ff66' : '#ffcc00' }}>
                {isApprovedInf ? 'APPROVED' : localSeekPermissionType === 'INFILTRATION' ? 'PENDING TURN END' : 'AWAITING PREREQS'}
              </span>
            </div>

            {/* Stage 1 Checklist */}
            <div style={{ marginTop: '4px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {renderCheckItem(`Finance sourcing phase: ${financeSourced ? 'COMPLETE' : 'AWAITING COLLECTION'}`, financeSourced || isApprovedInf)}
              {renderCheckItem(`Logistics sourcing phase: ${logisticsSourced ? 'COMPLETE' : 'AWAITING COLLECTION'}`, logisticsSourced || isApprovedInf)}
              {renderCheckItem(`Phase status: ${handoverAchieved ? 'HANDOVER ACHIEVED' : 'AWAITING HANDOVER'}`, handoverAchieved || isApprovedInf)}
            </div>
            
            {!isApprovedInf && (
              <button
                className={`cyber-btn sm ${localSeekPermissionType === 'INFILTRATION' ? 'amber' : 'green'}`}
                style={{ width: '100%', fontSize: '10px', padding: '6px' }}
                onClick={() => handleQueuePermission('INFILTRATION')}
                disabled={!handoverAchieved}
              >
                {localSeekPermissionType === 'INFILTRATION' ? 'CANCEL REQUEST' : 'REQUEST BORDER GO-AHEAD'}
              </button>
            )}
          </div>

          {/* Clearance 2: Strike */}
          <div style={{ paddingTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold' }}>STAGE 2: STRIKE AUTHORIZATION</span>
              <span style={{ fontSize: '9px', color: isApprovedStrike ? '#00ff66' : '#ffcc00' }}>
                {isApprovedStrike ? 'APPROVED' : localTriggerStrike ? 'PENDING TURN END' : 'AWAITING PREREQS'}
              </span>
            </div>

            {/* Stage 2 Checklist */}
            {(() => {
              const targetCity = (session.scenarioId === 'operation_thunder' || session.scenarioId === 'operation_coastal_thunder') ? 'mumbai' : 'new_delhi';
              return (
                <div style={{ marginTop: '4px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {renderCheckItem("Stage 1: Border Infiltration approved", isApprovedInf)}
                  {renderCheckItem(`Operative located at target city (${targetCity.replace('_', ' ').toUpperCase()})`, location.toLowerCase() === targetCity.toLowerCase())}
                </div>
              );
            })()}
            
            {isApprovedInf && !isApprovedStrike && (
              <button
                className={`cyber-btn sm ${localSeekPermissionType === 'STRIKE' ? 'amber' : 'green'}`}
                style={{ width: '100%', fontSize: '10px', padding: '6px' }}
                onClick={() => handleQueuePermission('STRIKE')}
                disabled={location.toLowerCase() !== ((session.scenarioId === 'operation_thunder' || session.scenarioId === 'operation_coastal_thunder') ? 'mumbai' : 'new_delhi')}
              >
                {localSeekPermissionType === 'STRIKE' ? 'CANCEL REQUEST' : 'REQUEST STRIKE GO-AHEAD'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Operational Actions */}
      <div className="scenario-card selected" style={{ borderLeftColor: '#ff3b30', padding: '12px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '11px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Key size={12} /> CRITICAL CELL COMMANDS
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {isApprovedStrike && currentPhase !== "EXFILTRATION" && (
            <button
              className={`cyber-btn lg ${localTriggerStrike ? 'amber' : 'red'}`}
              style={{ width: '100%', padding: '10px' }}
              onClick={handleQueueStrike}
            >
              {localTriggerStrike ? 'CANCEL STRIKE TRIGGER' : '💥 EXECUTE TARGET STRIKE'}
            </button>
          )}

          {currentPhase === "EXFILTRATION" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: '#ffcc00', fontFamily: 'monospace' }}>
                ⚠ OPERATIVE MUST RETURN HOME UNDETECTED TO WIN
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Active Scan Deflector Systems */}
      <div className="scenario-card selected" style={{ borderLeftColor: '#00f0ff', padding: '12px', flex: 1 }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '11px', fontFamily: 'monospace' }}>
          ACTIVE DECOYS & JAMMERS
        </h3>
        
        <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {session.activeDecoys && session.activeDecoys.map((decoy, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
              <span style={{ color: '#00f0ff' }}>🛰️ DECOY {decoy.type} ({decoy.cityNode.replace('_', ' ').toUpperCase()})</span>
              <span>{decoy.turnsRemaining} turns remaining</span>
            </div>
          ))}

          {session.espionageResources && session.espionageResources.filter(r => r.type === 'ATTACKER_JAMMER').map((jammer, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
              <span style={{ color: '#ffcc00' }}>⚡ ACTIVE JAMMER ({jammer.cityNode.replace('_', ' ').toUpperCase()})</span>
              <span>{jammer.cooldownRemaining} turns remaining</span>
            </div>
          ))}

          {(!session.activeDecoys || session.activeDecoys.length === 0) && 
           (!session.espionageResources || session.espionageResources.filter(r => r.type === 'ATTACKER_JAMMER').length === 0) && (
            <div style={{ color: '#666', fontSize: '10px', fontFamily: 'monospace', textAlign: 'center', padding: '16px 0' }}>
              No active decoys or jammer channels currently deployed.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CellHqView;
