import React, { useState } from 'react';
import { Shield, Compass, Cpu, Radio, Archive, DollarSign, Activity } from 'lucide-react';

export default function AttackerIntelBox({
  cityId,
  session,
  activeScenario,
  onClose,
  onBuildSafehouse,
  onDeployTech,
  localBuiltSafehouses = [],
  localBuiltSecureSafehouses = [],
  localActiveJammerTarget,
  localDecoyDeployments = [],
  localSuspectMove,
  setLocalSuspectMove,
  addToast,
  isWaiting,
  localTargetSafehouseCode,
  setLocalTargetSafehouseCode
}) {
  if (!cityId || !session) return null;

  const [showDeployMenu, setShowDeployMenu] = useState(false);

  const currentLoc = session.suspectLocation;
  const isCurrentlyHere = currentLoc === cityId;

  // Determine territory details (for Attacker: Home means safe attacker land, Hostile means defender land)
  const nodeData = activeScenario?.nodes?.find(n => n.id === cityId);
  const isFriendlyRaw = nodeData ? nodeData.territory === 'HOME_TERRITORY' : false;
  const isFriendly = session.playerRole === 'ATTACKER' ? !isFriendlyRaw : isFriendlyRaw;

  // Adjacent connection check
  const currentLocNode = activeScenario?.nodes?.find(n => n.id === currentLoc);
  const currentConnections = currentLocNode?.connections || [];
  const isConnected = currentConnections.includes(cityId);

  // Sourcing checks
  const isFinanceCity = activeScenario?.financeMapping && activeScenario.financeMapping[cityId];
  const isLogisticsCity = activeScenario?.logisticsMapping && activeScenario.logisticsMapping[cityId];
  const isHandoverCity = !isFinanceCity && !isLogisticsCity && nodeData && nodeData.territory === 'HOSTILE_TERRITORY';

  // Safehouses in this city
  const citySafehouses = session.safehouses?.filter(s => s.cityNode === cityId && s.ownerFaction === 'HOSTILE') || [];
  const hasSafehouse = citySafehouses.length > 0;
  const isSecureSafehouse = session.secureSafehouseTurns?.[cityId] > 0;

  // Queued builds/moves
  const isBuildQueued = localBuiltSafehouses.includes(cityId);
  const isSecureBuildQueued = localBuiltSecureSafehouses.includes(cityId);
  const isMoveQueued = localSuspectMove === cityId;

  const handleBuild = (secure) => {
    if (isWaiting) {
      addToast("It is not your turn.", "warning");
      return;
    }
    if (onBuildSafehouse) {
      onBuildSafehouse(cityId, secure);
    }
  };

  const handleDeploy = (type) => {
    if (isWaiting) {
      addToast("It is not your turn.", "warning");
      return;
    }
    if (onDeployTech) {
      onDeployTech(type, cityId);
    }
  };

  const handleMoveSelection = () => {
    if (isWaiting) {
      addToast("It is not your turn.", "warning");
      return;
    }
    if (isMoveQueued) {
      setLocalSuspectMove('');
      addToast("Operative move cancelled.", "info");
    } else {
      setLocalSuspectMove(cityId);
      addToast(`Operative route to ${cityId.replace(/_/g, ' ').toUpperCase()} plotted for turn end.`, "success");
    }
  };

  const renderSafehouseButton = () => {
    if (hasSafehouse) return null;

    const standardCost = isFriendly ? 50000 : 150000;
    const secureCost = isFriendly ? 100000 : 300000;

    let stdBtnStyle = {};
    if (isBuildQueued) {
      stdBtnStyle = { background: 'rgba(0, 255, 102, 0.08)', border: '1px solid #00ff66', color: '#00ff66' };
    }
    let secBtnStyle = {};
    if (isSecureBuildQueued) {
      secBtnStyle = { background: 'rgba(0, 255, 102, 0.08)', border: '1px solid #00ff66', color: '#00ff66' };
    }

    return (
      <div className="flex flex-col gap-2 mt-2">
        <button
          onClick={() => handleBuild(false)}
          className="cia-dispatch-btn font-mono flex justify-between items-center w-full px-4 py-2"
          style={stdBtnStyle}
          disabled={isWaiting}
        >
          <span>{isBuildQueued ? '✓ HIDE-OUT QUEUED' : 'ESTABLISH HIDE-OUT'}</span>
          {!isBuildQueued && <span className="text-amber">${standardCost.toLocaleString()}</span>}
        </button>
        <button
          onClick={() => handleBuild(true)}
          className="cia-dispatch-btn font-mono flex justify-between items-center w-full px-4 py-2"
          style={secBtnStyle}
          disabled={isWaiting}
        >
          <span>{isSecureBuildQueued ? '✓ SECURE HIDE-OUT QUEUED' : 'ESTABLISH SECURE SAFEHOUSE'}</span>
          {!isSecureBuildQueued && <span className="text-amber">${secureCost.toLocaleString()}</span>}
        </button>
      </div>
    );
  };

  const renderTechButton = (type, label, cost, needsSuspect = false) => {
    const isJammer = type === 'JAMMER';
    const isAlreadyActive = isJammer
      ? session.espionageResources?.some(r => r.cityNode === cityId && r.type === 'ATTACKER_JAMMER')
      : session.activeDecoys?.some(d => d.cityNode === cityId && d.type === type.replace('DECOY_', ''));

    const isQueued = isJammer
      ? localActiveJammerTarget === cityId
      : localDecoyDeployments?.some(d => d.type === type.replace('DECOY_', '') && d.cityNode === cityId);

    let btnStyle = { padding: '8px 10px', fontSize: '10px' };
    let btnClass = "cia-task-btn font-mono w-full flex items-center";

    if (isAlreadyActive) {
      btnClass += " border-emerald-500 text-emerald-400 bg-[rgba(16,185,129,0.08)] cursor-not-allowed";
      return (
        <button key={type} className={btnClass} style={btnStyle} disabled>
          <span>{label}</span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.15)]" style={{ marginLeft: 'auto' }}>ACTIVE</span>
        </button>
      );
    }

    if (isQueued) {
      btnClass += " border-emerald-500 text-cyan-300 bg-[rgba(0,240,255,0.12)] shadow-[0_0_8px_rgba(0,240,255,0.2)]";
      return (
        <button key={type} onClick={() => handleDeploy(type)} className={btnClass} style={btnStyle} disabled={isWaiting}>
          <span>{label}</span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.2)] text-emerald-400" style={{ letterSpacing: '0.05em', marginLeft: 'auto' }}>✓ QUEUED</span>
        </button>
      );
    }

    const disabled = needsSuspect && !isCurrentlyHere;

    return (
      <button 
        key={type} 
        onClick={() => handleDeploy(type)} 
        className={btnClass} 
        style={btnStyle} 
        disabled={disabled || isWaiting}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        {disabled ? (
          <span className="text-[8px] text-dim" style={{ textTransform: 'uppercase' }}>REQUIRES OPERATIVE PRESENT</span>
        ) : (
          <span className="text-amber text-[10px] font-bold">${cost.toLocaleString()}</span>
        )}
      </button>
    );
  };

  const financeSourced = session.uncoveredFinanceCities?.includes(cityId);
  const logisticsSourced = session.uncoveredLogisticsCities?.includes(cityId);

  return (
    <div className="cia-intel-box cyber-panel animate-fade-in" style={{ borderColor: '#ff3b30' }}>
      <div className="cia-box-header" style={{ borderBottomColor: 'rgba(255, 59, 48, 0.3)' }}>
        <div className="cia-glow-indicator animate-ping" style={{ backgroundColor: '#ff3b30', boxShadow: '0 0 8px #ff3b30' }}></div>
        <h3 className="text-cyber" style={{ color: '#ff3b30', textShadow: '0 0 8px rgba(255, 59, 48, 0.3)' }}>OPERATIVE COMMAND</h3>
        <button onClick={onClose} className="cia-close-btn" title="Close Panel">✕</button>
      </div>

      <div className="cia-box-body">
        {/* City Metadata */}
        <div className="cia-section">
          <div className="cia-meta-row">
            <span className="label">DESIGNATION:</span>
            <span className="value text-cyber" style={{ color: '#ffffff' }}>{cityId.replace(/_/g, ' ').toUpperCase()}</span>
          </div>
          <div className="cia-meta-row">
            <span className="label">SECURITY ZONE:</span>
            <span className={`value font-bold ${isFriendly ? 'text-success' : 'text-threat'}`}>
              {isFriendly ? 'SECURE ZONE (HOME)' : 'HOSTILE CORRIDOR (TARGET)'}
            </span>
          </div>
          <div className="cia-meta-row mt-1">
            <span className="label">DETECTION HEAT:</span>
            <span className="value font-mono font-bold text-amber">{session.cityHeat?.[cityId] || 0}%</span>
          </div>
        </div>

        {/* Safehouses Status */}
        <div className="cia-section">
          <h4 className="cia-sub-title" style={{ color: '#ff3b30' }}><Shield size={12} /> HIDE-OUT ASSETS</h4>
          <div className="cia-grid-item">
            <div className="cia-sub-item">
              <span className="label font-mono">ACTIVE HIDE-OUT CODES:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {citySafehouses.length === 0 ? (
                  <span className="text-dim font-mono text-[10px]">NO HIDE-OUTS ESTABLISHED</span>
                ) : (
                  citySafehouses.map((s, idx) => (
                    <span key={idx} className={`cia-tag font-mono ${isSecureSafehouse ? 'cyan' : 'red'}`}>
                      {isSecureSafehouse ? '🛡️' : '🏠'} #{s.safehouseCode} {isSecureSafehouse ? '(SECURE)' : ''}
                    </span>
                  ))
                )}
              </div>
            </div>
            {isCurrentlyHere && citySafehouses.length >= 2 && (
              <div className="cia-sub-item mt-2">
                <span className="label font-mono">SELECT SAFE-HOUSE TO OCCUPY:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {citySafehouses.map((s, idx) => {
                    const isSelected = localTargetSafehouseCode === s.safehouseCode || (session.targetSafehouseCode === s.safehouseCode && !localTargetSafehouseCode);
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (isWaiting) return;
                          setLocalTargetSafehouseCode(s.safehouseCode);
                          addToast(`Target safehouse set to #${s.safehouseCode}`, "success");
                        }}
                        className={`cia-dispatch-btn font-mono ${isSelected ? 'active-select' : ''}`}
                        style={{
                          background: isSelected ? 'rgba(255, 59, 48, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                          borderColor: isSelected ? '#ff3b30' : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#ff3b30' : '#a0a0a0',
                          fontSize: '10px',
                          padding: '4px 8px'
                        }}
                        disabled={isWaiting}
                      >
                        #{s.safehouseCode}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Operative Mobility */}
        <div className="cia-section">
          <h4 className="cia-sub-title" style={{ color: '#ff3b30' }}><Compass size={12} /> OPERATIVE MOBILITY</h4>
          <div className="cia-list">
            {isCurrentlyHere ? (
              <div className="cia-list-item flex items-center justify-between" style={{ borderLeftColor: '#00ff66' }}>
                <span className="value text-cyber" style={{ color: '#00ff66' }}>🎯 OPERATIVE PRESENT AT LOCATION</span>
                <span className="label font-mono text-[9px] text-success">ACTIVE</span>
              </div>
            ) : (
              <div 
                className={`cia-list-item flex items-center justify-between ${isMoveQueued ? 'active-select' : ''}`} 
                style={{ borderLeftColor: isMoveQueued ? '#ffcc00' : isConnected ? '#00f0ff' : '#444' }}
              >
                <span className="value font-bold" style={{ color: isMoveQueued ? '#ffcc00' : isConnected ? '#00f0ff' : '#666' }}>
                  {isMoveQueued ? 'ROUTE PLOTTED TO THIS NODE' : isConnected ? 'CONNECTED CORRIDOR' : 'OUT OF REACH'}
                </span>
                <span className="label font-mono text-[9px]">
                  {isMoveQueued ? 'QUEUED' : isConnected ? 'REACHABLE' : 'LOCKED'}
                </span>
              </div>
            )}
            
            {!isCurrentlyHere && isConnected && (
              <button
                onClick={handleMoveSelection}
                className={`cia-dispatch-btn font-mono w-full text-center py-2 mt-2 ${isMoveQueued ? 'active' : ''}`}
                style={{
                  background: isMoveQueued ? 'rgba(255, 204, 0, 0.15)' : 'rgba(255, 59, 48, 0.1)',
                  borderColor: isMoveQueued ? '#ffcc00' : '#ff3b30',
                  color: isMoveQueued ? '#ffcc00' : '#ff3b30',
                  fontSize: '11px'
                }}
                disabled={isWaiting}
              >
                {isMoveQueued ? '✕ CANCEL PLOTTED ROUTE' : '➡️ PLOT SUSPECT ROUTE HERE'}
              </button>
            )}
          </div>
        </div>

        {/* Deploy Decoys & Defense Tech */}
        <div className="cia-section">
          <h4 className="cia-sub-title" style={{ color: '#ff3b30' }}><Cpu size={12} /> HIDE-OUT & DECOY LOGISTICS</h4>
          <div className="mt-1 flex flex-col gap-2.5">
            {renderSafehouseButton()}
            
            <button 
              onClick={() => setShowDeployMenu(!showDeployMenu)}
              className="cia-dispatch-btn font-mono text-center w-full"
              style={{ background: 'rgba(255, 59, 48, 0.05)', border: '1px solid rgba(255, 59, 48, 0.3)', color: '#ff3b30' }}
            >
              {showDeployMenu ? 'HIDE ESPIONAGE OPTIONS' : 'DEPLOY RADAR DEFLECTION OPTIONS'}
            </button>

            {showDeployMenu && (
              <div className="cia-agent-controls animate-fade-in" style={{ borderColor: 'rgba(255, 59, 48, 0.3)' }}>
                <span className="cia-controls-label" style={{ color: '#ff3b30', borderBottomColor: 'rgba(255, 59, 48, 0.15)' }}>RADAR DEFLECTORS</span>
                <div className="flex flex-col gap-2 mt-2">
                  {renderTechButton('DECOY_CCTV', 'DEPLOY DECOY CCTV', 20000)}
                  {renderTechButton('DECOY_SATELLITE', 'DEPLOY DECOY SATELLITE', 40000)}
                  {renderTechButton('JAMMER', 'DEPLOY ACTIVE JAMMER', 30000, true)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Asset Sourcing Hub status */}
        {(isFinanceCity || isLogisticsCity || isHandoverCity) && (
          <div className="cia-section">
            <h4 className="cia-sub-title" style={{ color: '#ff3b30' }}><Archive size={12} /> CLEARANCES & SOURCING</h4>
            <div className="cia-grid-item">
              {isFinanceCity && (
                <div className="cia-sub-item">
                  <span className="label font-mono"><DollarSign size={10} /> FINANCIAL RAILS:</span>
                  <div className="mt-1">
                    {financeSourced ? (
                      <span className="cia-tag green font-mono">✓ FINANCE SOURCED</span>
                    ) : (
                      <span className="cia-tag red font-mono blink">AWAITING VISIT</span>
                    )}
                  </div>
                </div>
              )}
              {isLogisticsCity && (
                <div className="cia-sub-item mt-2">
                  <span className="label font-mono"><Archive size={10} /> LOGISTICS bluePRINT:</span>
                  <div className="mt-1">
                    {logisticsSourced ? (
                      <span className="cia-tag green font-mono">✓ LOGISTICS SOURCED</span>
                    ) : (
                      <span className="cia-tag red font-mono blink">AWAITING VISIT</span>
                    )}
                  </div>
                </div>
              )}
              {isHandoverCity && (
                <div className="cia-sub-item mt-2">
                  <span className="label font-mono"><Activity size={10} /> HANDOVER TARGET SITE:</span>
                  <div className="mt-1">
                    <span className="cia-tag cyan font-mono">HANDOVER AREA</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Connected Nodes Footer */}
      {(() => {
        const connectedNodes = activeScenario?.nodes?.find(n => n.id === cityId)?.connections || [];
        return (
          <div className="cia-box-footer" style={{ flexDirection: 'column', gap: '6px', alignItems: 'stretch', width: '100%' }}>
            <span className="label font-mono text-[8px] text-dim mb-1" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              CONNECTING CORRIDORS:
            </span>
            <div className="flex flex-wrap gap-1.5 w-full">
              {connectedNodes.length === 0 ? (
                <span className="text-[9px] text-dim font-mono">DEAD-END INTERSECTION</span>
              ) : (
                connectedNodes.map(connId => (
                  <button
                    key={connId}
                    onClick={() => {
                      if (isWaiting) return;
                      // Just highlight the city node on the map
                      // Find parent setter if passed
                    }}
                    className="cyber-btn sm"
                    style={{ flex: '1 1 0px', textTransform: 'uppercase', fontSize: '8.5px', padding: '5px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}
                  >
                    ➡️ {connId.replace(/_/g, ' ')}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
