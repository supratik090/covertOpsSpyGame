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
  setLocalTargetSafehouseCode,
  localRequestFinance,
  setLocalRequestFinance,
  localCollectFinance,
  setLocalCollectFinance,
  localRequestLogistics,
  setLocalRequestLogistics,
  localCollectLogistics,
  setLocalCollectLogistics,
  localBeginHandover,
  setLocalBeginHandover,
  setSelectedCityNode
}) {
  if (!cityId || !session) return null;

  const [showDeployMenu, setShowDeployMenu] = useState(false);

  const currentLoc = session.suspectLocation;
  const isCurrentlyHere = currentLoc === cityId;

  // Territory details
  const nodeData = activeScenario?.nodes?.find(n => n.id === cityId);
  const isFriendlyRaw = nodeData ? nodeData.territory === 'HOME_TERRITORY' : false;
  const isFriendly = session.playerRole === 'ATTACKER' ? !isFriendlyRaw : isFriendlyRaw;

  // Adjacent connection check
  const currentLocNode = activeScenario?.nodes?.find(n => n.id === currentLoc);
  const currentConnections = currentLocNode?.connections || [];
  const isConnected = currentConnections.includes(cityId);

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

  // Sourcing UI Builders
  const renderFinanceSourcing = () => {
    const isCollected = session.financeCollected;
    const requestedCity = session.requestedFinanceCity;
    const turnsRemaining = session.financeCollectionTurnsRemaining;

    if (isCollected) {
      return <span className="cia-tag green font-mono">✓ FINANCE ACQUIRED</span>;
    }

    if (localCollectFinance) {
      return (
        <button
          onClick={() => setLocalCollectFinance(false)}
          className="cyber-btn sm amber w-full text-[10px]"
          disabled={isWaiting}
        >
          ✕ CANCEL FINANCE COLLECTION
        </button>
      );
    }

    if (localRequestFinance) {
      return (
        <button
          onClick={() => setLocalRequestFinance(false)}
          className="cyber-btn sm amber w-full text-[10px]"
          disabled={isWaiting}
        >
          ✕ CANCEL FINANCE REQUEST
        </button>
      );
    }

    if (requestedCity) {
      if (requestedCity === cityId) {
        if (turnsRemaining > 0) {
          return (
            <span className="text-amber font-mono text-[10px]">
              🔒 IN TRANSIT (Ready in {turnsRemaining} turns here)
            </span>
          );
        } else {
          if (isCurrentlyHere) {
            return (
              <button
                onClick={() => setLocalCollectFinance(true)}
                className="cyber-btn sm green w-full text-[10px]"
                disabled={isWaiting}
              >
                📥 COLLECT FINANCE
              </button>
            );
          } else {
            return (
              <span className="text-red font-mono text-[10px]">
                ⚠️ READY: Return to this city to collect
              </span>
            );
          }
        }
      } else {
        return (
          <span className="text-dim font-mono text-[10px]">
            Opened at {requestedCity.replace(/_/g, ' ').toUpperCase()} ({turnsRemaining > 0 ? `${turnsRemaining} turns left` : 'READY TO COLLECT'})
          </span>
        );
      }
    } else {
      // Sourcing unrequested
      if (isCurrentlyHere) {
        return (
          <button
            onClick={() => setLocalRequestFinance(true)}
            className="cyber-btn sm red w-full text-[10px]"
            disabled={isWaiting}
          >
            💰 REQUEST FINANCE SOURCING
          </button>
        );
      } else {
        return (
          <span className="text-dim font-mono text-[10px]">
            Arrive here to request finance channels
          </span>
        );
      }
    }
  };

  const renderLogisticsSourcing = () => {
    const isCollected = session.logisticsCollected;
    const requestedCity = session.requestedLogisticsCity;
    const turnsRemaining = session.logisticsCollectionTurnsRemaining;

    if (isCollected) {
      return <span className="cia-tag green font-mono">✓ LOGISTICS ACQUIRED</span>;
    }

    if (localCollectLogistics) {
      return (
        <button
          onClick={() => setLocalCollectLogistics(false)}
          className="cyber-btn sm amber w-full text-[10px]"
          disabled={isWaiting}
        >
          ✕ CANCEL LOGISTICS COLLECTION
        </button>
      );
    }

    if (localRequestLogistics) {
      return (
        <button
          onClick={() => setLocalRequestLogistics(false)}
          className="cyber-btn sm amber w-full text-[10px]"
          disabled={isWaiting}
        >
          ✕ CANCEL LOGISTICS REQUEST
        </button>
      );
    }

    if (requestedCity) {
      if (requestedCity === cityId) {
        if (turnsRemaining > 0) {
          return (
            <span className="text-amber font-mono text-[10px]">
              🔒 IN TRANSIT (Ready in {turnsRemaining} turns here)
            </span>
          );
        } else {
          if (isCurrentlyHere) {
            return (
              <button
                onClick={() => setLocalCollectLogistics(true)}
                className="cyber-btn sm green w-full text-[10px]"
                disabled={isWaiting}
              >
                📥 COLLECT LOGISTICS
              </button>
            );
          } else {
            return (
              <span className="text-red font-mono text-[10px]">
                ⚠️ READY: Return to this city to collect
              </span>
            );
          }
        }
      } else {
        return (
          <span className="text-dim font-mono text-[10px]">
            Opened at {requestedCity.replace(/_/g, ' ').toUpperCase()} ({turnsRemaining > 0 ? `${turnsRemaining} turns left` : 'READY TO COLLECT'})
          </span>
        );
      }
    } else {
      if (isCurrentlyHere) {
        return (
          <button
            onClick={() => setLocalRequestLogistics(true)}
            className="cyber-btn sm red w-full text-[10px]"
            disabled={isWaiting}
          >
            📦 REQUEST LOGISTICS PIPELINE
          </button>
        );
      } else {
        return (
          <span className="text-dim font-mono text-[10px]">
            Arrive here to request logistical lines
          </span>
        );
      }
    }
  };

  const renderHandoverSourcing = () => {
    const isFinanceReady = session.financeCollected;
    const isLogisticsReady = session.logisticsCollected;
    const isCompleted = session.handoverCompleted;
    const handoverCity = session.handoverCity;
    const turnsRemaining = session.handoverTurnsRemaining;

    if (!isFinanceReady || !isLogisticsReady) {
      return (
        <span className="text-dim font-mono text-[10px]">
          LOCKED: Awaiting Sourcing Collection
        </span>
      );
    }

    if (isCompleted) {
      return <span className="cia-tag green font-mono">✓ HANDOVER PROTOCOL ESTABLISHED</span>;
    }

    if (localBeginHandover) {
      return (
        <button
          onClick={() => setLocalBeginHandover(false)}
          className="cyber-btn sm amber w-full text-[10px]"
          disabled={isWaiting}
        >
          ✕ CANCEL HANDOVER INITIATION
        </button>
      );
    }

    if (handoverCity) {
      if (handoverCity === cityId) {
        if (isCurrentlyHere) {
          return (
            <span className="text-cyber font-mono text-[10px]" style={{ color: '#00f0ff' }}>
              ⚡ HANDOVER UNDERWAY: Stay here ({turnsRemaining} turns left)
            </span>
          );
        } else {
          return (
            <span className="text-red font-mono text-[10px] blink">
              ⚠️ WARNING: Handover interrupted! Return here immediately
            </span>
          );
        }
      } else {
        return (
          <span className="text-dim font-mono text-[10px]">
            Active at {handoverCity.replace(/_/g, ' ').toUpperCase()}
          </span>
        );
      }
    } else {
      const hostileNode = nodeData && nodeData.territory === 'HOSTILE_TERRITORY';
      if (hostileNode) {
        if (isCurrentlyHere) {
          return (
            <button
              onClick={() => setLocalBeginHandover(true)}
              className="cyber-btn sm green w-full text-[10px]"
              disabled={isWaiting}
            >
              🤝 INITIATE HANDOVER
            </button>
          );
        } else {
          return (
            <span className="text-dim font-mono text-[10px]">
              Arrive at this hostile city to begin handover
            </span>
          );
        }
      } else {
        return (
          <span className="text-dim font-mono text-[10px]">
            Handover must be executed in a hostile target city
          </span>
        );
      }
    }
  };

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
          <div className="cia-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {isCurrentlyHere ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(() => {
                  const connectedSafehouses = session.safehouses?.filter(s => 
                    s.ownerFaction === 'HOSTILE' && currentConnections.includes(s.cityNode)
                  ) || [];

                  if (connectedSafehouses.length === 0) {
                    return (
                      <span className="text-dim font-mono text-center py-2" style={{ fontSize: '10px', color: '#ff8888', border: '1px dashed rgba(255,59,48,0.2)', borderRadius: '4px' }}>
                        ✕ Cannot move: no safehouses established in adjacent cities.
                      </span>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {connectedSafehouses.map((s, idx) => {
                        const isTarget = localSuspectMove === s.cityNode && localTargetSafehouseCode === s.safehouseCode;
                        const cityName = s.cityNode.replace(/_/g, ' ').toUpperCase();
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (isWaiting) return;
                              if (isTarget) {
                                setLocalSuspectMove('');
                                setLocalTargetSafehouseCode('');
                                addToast("Operative move cancelled.", "info");
                              } else {
                                setLocalSuspectMove(s.cityNode);
                                setLocalTargetSafehouseCode(s.safehouseCode);
                                addToast(`Move to ${cityName} — #${s.safehouseCode} queued.`, "success");
                              }
                            }}
                            className="cyber-btn sm"
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '10px',
                              padding: '5px 8px',
                              width: '100%',
                              textAlign: 'left',
                              background: isTarget ? 'rgba(255, 204, 0, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                              borderColor: isTarget ? '#ffcc00' : 'rgba(255, 255, 255, 0.08)',
                              color: isTarget ? '#ffcc00' : '#a0a0a0',
                            }}
                            disabled={isWaiting}
                          >
                            <span>Move to {cityName}</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {isTarget ? '✓ QUEUED' : `🏠 #${s.safehouseCode}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="value text-dim" style={{ fontSize: '10px' }}>
                  Operative is currently in <strong style={{ color: '#fff' }}>{currentLoc.replace(/_/g, ' ').toUpperCase()}</strong>.
                </span>
                {isConnected ? (
                  (() => {
                    const thisCitySafehouses = session.safehouses?.filter(s => 
                      s.ownerFaction === 'HOSTILE' && s.cityNode === cityId
                    ) || [];

                    if (thisCitySafehouses.length === 0) {
                      return (
                        <span className="text-dim font-mono" style={{ fontSize: '10px', color: '#ff8888' }}>
                          ✕ Cannot move here: no safehouse established in this city.
                        </span>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                        {thisCitySafehouses.map((s, idx) => {
                          const isTarget = localSuspectMove === cityId && localTargetSafehouseCode === s.safehouseCode;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (isWaiting) return;
                                if (isTarget) {
                                  setLocalSuspectMove('');
                                  setLocalTargetSafehouseCode('');
                                  addToast("Move cancelled.", "info");
                                } else {
                                  setLocalSuspectMove(cityId);
                                  setLocalTargetSafehouseCode(s.safehouseCode);
                                  addToast(`Move to ${cityId.replace(/_/g, ' ').toUpperCase()} — #${s.safehouseCode} queued.`, "success");
                                }
                              }}
                              className="cyber-btn sm"
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '10px',
                                padding: '5px 8px',
                                width: '100%',
                                background: isTarget ? 'rgba(255, 204, 0, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                borderColor: isTarget ? '#ffcc00' : 'rgba(255, 255, 255, 0.08)',
                                color: isTarget ? '#ffcc00' : '#a0a0a0',
                              }}
                              disabled={isWaiting}
                            >
                              <span>Move Suspect here</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {isTarget ? '✓ QUEUED' : `🏠 #${s.safehouseCode}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : (
                  <span className="text-dim font-mono" style={{ fontSize: '9px' }}>LOCKED: Out of range from current location.</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* New Milestones (Sourcing & Handover) Section */}
        <div className="cia-section">
          <h4 className="cia-sub-title" style={{ color: '#ff3b30' }}><Archive size={12} /> CLEARANCES & SOURCING</h4>
          <div className="cia-grid-item">
            <div className="cia-sub-item">
              <span className="label font-mono"><DollarSign size={10} /> FINANCIAL RAILS:</span>
              <div className="mt-1">
                {renderFinanceSourcing()}
              </div>
            </div>
            <div className="cia-sub-item mt-3">
              <span className="label font-mono"><Archive size={10} /> LOGISTICS PIPELINE:</span>
              <div className="mt-1">
                {renderLogisticsSourcing()}
              </div>
            </div>
            <div className="cia-sub-item mt-3">
              <span className="label font-mono"><Activity size={10} /> HANDOVER TARGET SITE:</span>
              <div className="mt-1">
                {renderHandoverSourcing()}
              </div>
            </div>
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
                      if (setSelectedCityNode) {
                        setSelectedCityNode(connId);
                      }
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
