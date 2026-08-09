import React, { useState, useEffect } from 'react';
import { Shield, Compass, Cpu, Radio, Archive, DollarSign, Activity, Users } from 'lucide-react';

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

  const [activeOperativeOpen, setActiveOperativeOpen] = useState(false);
  const [showDeployMenu, setShowDeployMenu] = useState(false);

  const currentLoc = session.suspectLocation;
  const isCurrentlyHere = currentLoc === cityId;
  const isSuspectPlannedHere = localSuspectMove === cityId;
  const showSuspectInCity = isCurrentlyHere || isSuspectPlannedHere;

  // Node details & Territory
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

  // Auto-expand operative controls when selecting their current city
  useEffect(() => {
    if (isCurrentlyHere) {
      setActiveOperativeOpen(true);
    } else {
      setActiveOperativeOpen(false);
    }
  }, [cityId, isCurrentlyHere]);

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

  // Safehouse build options matching CIA styling
  const renderSafehouseButton = () => {
    if (hasSafehouse) return null;

    const standardCost = isFriendly ? 50000 : 150000;
    const secureCost = isFriendly ? 100000 : 300000;

    const isBuildQueued = localBuiltSafehouses.includes(cityId);
    const isSecureBuildQueued = localBuiltSecureSafehouses.includes(cityId);

    let stdBtnStyle = { 
      fontSize: '10.5px',
      fontWeight: '300',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
      width: '100%'
    };
    let stdBtnClass = "cia-dispatch-btn font-mono text-center px-4 py-2 mt-2";
    if (isBuildQueued) {
      stdBtnStyle.background = 'rgba(16, 185, 129, 0.08)';
      stdBtnStyle.border = '1px solid #10b981';
      stdBtnStyle.color = '#10b981';
    } else {
      stdBtnStyle.background = 'rgba(255, 255, 255, 0.02)';
      stdBtnStyle.border = '1px solid rgba(255, 255, 255, 0.15)';
    }

    let secBtnStyle = { 
      fontSize: '10.5px',
      fontWeight: '300',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
      width: '100%'
    };
    let secBtnClass = "cia-dispatch-btn font-mono text-center px-4 py-2 mt-2";
    if (isSecureBuildQueued) {
      secBtnStyle.background = 'rgba(16, 185, 129, 0.08)';
      secBtnStyle.border = '1px solid #10b981';
      secBtnStyle.color = '#10b981';
    } else {
      secBtnStyle.background = 'rgba(255, 255, 255, 0.02)';
      secBtnStyle.border = '1px solid rgba(255, 255, 255, 0.15)';
    }

    return (
      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={() => handleBuild(false)}
          className={stdBtnClass}
          style={stdBtnStyle}
          disabled={isWaiting}
        >
          <span>ESTABLISH HIDE-OUT</span>
          {isBuildQueued ? (
            <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.2)] text-emerald-400">&#10003;&nbsp; ADDED</span>
          ) : (
            <span className="text-muted text-[9.5px]">${standardCost.toLocaleString()}</span>
          )}
        </button>
        <button
          onClick={() => handleBuild(true)}
          className={secBtnClass}
          style={secBtnStyle}
          disabled={isWaiting}
        >
          <span>ESTABLISH SECURE SAFEHOUSE</span>
          {isSecureBuildQueued ? (
            <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.2)] text-emerald-400">&#10003;&nbsp; ADDED</span>
          ) : (
            <span className="text-muted text-[9.5px]">${secureCost.toLocaleString()}</span>
          )}
        </button>
      </div>
    );
  };

  // Tech deflector options matching CIA styling
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
    if (disabled) {
      btnClass += " opacity-50 cursor-not-allowed";
    }

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
          <span className="text-[8.5px] text-dim" style={{ textTransform: 'uppercase' }}>REQUIRES OPERATIVE</span>
        ) : (
          <span className="text-amber text-[10px] font-bold" style={{ marginLeft: '12px' }}>${cost.toLocaleString()}</span>
        )}
      </button>
    );
  };

  // Task directive sourcing helper buttons (Inside expanded Operative Status)
  const renderFinanceSourcingBtn = () => {
    const isCollected = session.financeCollected;
    const requestedCity = session.requestedFinanceCity;
    const turnsRemaining = session.financeCollectionTurnsRemaining;

    if (isCollected) {
      return (
        <button className="cia-task-btn font-mono border-emerald-500 text-emerald-400 bg-[rgba(16,185,129,0.08)] cursor-not-allowed w-full text-center" disabled>
          💰 FINANCE ACQUIRED
        </button>
      );
    }

    if (localCollectFinance) {
      return (
        <button
          onClick={() => {
            setLocalCollectFinance(false);
            addToast("Finance Sourcing Collection cancelled.", "info");
          }}
          className="cia-task-btn font-mono active w-full text-center"
          style={{
            color: '#ff4d4d',
            borderColor: '#ff4d4d',
            background: 'rgba(255, 77, 77, 0.15)',
            fontSize: '9.5px',
            fontWeight: 'bold'
          }}
          disabled={isWaiting}
        >
          ✕ CANCEL FINANCE COLLECTION
        </button>
      );
    }

    if (localRequestFinance) {
      return (
        <button
          onClick={() => {
            setLocalRequestFinance(false);
            addToast("Finance Sourcing Request cancelled.", "info");
          }}
          className="cia-task-btn font-mono active w-full text-center"
          style={{
            color: '#ff4d4d',
            borderColor: '#ff4d4d',
            background: 'rgba(255, 77, 77, 0.15)',
            fontSize: '9.5px',
            fontWeight: 'bold'
          }}
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
            <button className="cia-task-btn font-mono opacity-50 cursor-not-allowed w-full text-center" style={{ fontSize: '9.5px' }} disabled>
              🔒 IN TRANSIT ({turnsRemaining} turns left)
            </button>
          );
        } else {
          if (isCurrentlyHere) {
            return (
              <button
                onClick={() => {
                  setLocalCollectFinance(true);
                  addToast("Finance Sourcing Collection queued.", "success");
                }}
                className="cia-task-btn font-mono w-full text-center"
                style={{
                  color: 'var(--green)',
                  borderColor: 'var(--green)',
                  background: 'rgba(16, 185, 129, 0.06)',
                  fontSize: '9.5px',
                  fontWeight: 'bold',
                  boxShadow: '0 0 10px rgba(16, 185, 129, 0.15)'
                }}
                disabled={isWaiting}
              >
                📥 CLAIM FINANCE
              </button>
            );
          } else {
            return (
              <button
                className="cia-task-btn font-mono opacity-60 cursor-not-allowed w-full text-center"
                style={{
                  color: '#ff9000',
                  borderColor: 'rgba(255, 144, 0, 0.3)',
                  background: 'rgba(255, 144, 0, 0.02)',
                  fontSize: '9.5px'
                }}
                disabled
              >
                🔒 ARRIVE IN {requestedCity.replace(/_/g, ' ').toUpperCase()} TO CLAIM
              </button>
            );
          }
        }
      } else {
        const locationName = requestedCity.replace(/_/g, ' ').toUpperCase();
        return (
          <button className="cia-task-btn font-mono opacity-50 cursor-not-allowed w-full text-center" style={{ fontSize: '9.5px' }} disabled>
            🔒 FINANCE SOURCING AT {locationName} {turnsRemaining > 0 ? `(${turnsRemaining}t left)` : '(AWAITING CLAIM)'}
          </button>
        );
      }
    } else {
      if (isCurrentlyHere) {
        return (
          <button
            onClick={() => {
              setLocalRequestFinance(true);
              addToast("Finance Sourcing Request queued. Completes in 5 turns.", "success");
            }}
            className="cia-task-btn font-mono w-full text-center"
            style={{ fontSize: '9.5px' }}
            disabled={isWaiting}
          >
            💰 REQUEST FINANCE SOURCING
          </button>
        );
      } else {
        return (
          <button className="cia-task-btn font-mono opacity-50 cursor-not-allowed w-full text-center" style={{ fontSize: '9.5px' }} disabled>
            🔒 ARRIVE HERE TO REQUEST FINANCE
          </button>
        );
      }
    }
  };

  const renderLogisticsSourcingBtn = () => {
    const isCollected = session.logisticsCollected;
    const requestedCity = session.requestedLogisticsCity;
    const turnsRemaining = session.logisticsCollectionTurnsRemaining;

    if (isCollected) {
      return (
        <button className="cia-task-btn font-mono border-emerald-500 text-emerald-400 bg-[rgba(16,185,129,0.08)] cursor-not-allowed w-full text-center" disabled>
          📦 LOGISTICS ACQUIRED
        </button>
      );
    }

    if (localCollectLogistics) {
      return (
        <button
          onClick={() => {
            setLocalCollectLogistics(false);
            addToast("Logistics Sourcing Collection cancelled.", "info");
          }}
          className="cia-task-btn font-mono active w-full text-center"
          style={{
            color: '#ff4d4d',
            borderColor: '#ff4d4d',
            background: 'rgba(255, 77, 77, 0.15)',
            fontSize: '9.5px',
            fontWeight: 'bold'
          }}
          disabled={isWaiting}
        >
          ✕ CANCEL LOGISTICS COLLECTION
        </button>
      );
    }

    if (localRequestLogistics) {
      return (
        <button
          onClick={() => {
            setLocalRequestLogistics(false);
            addToast("Logistics Sourcing Request cancelled.", "info");
          }}
          className="cia-task-btn font-mono active w-full text-center"
          style={{
            color: '#ff4d4d',
            borderColor: '#ff4d4d',
            background: 'rgba(255, 77, 77, 0.15)',
            fontSize: '9.5px',
            fontWeight: 'bold'
          }}
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
            <button className="cia-task-btn font-mono opacity-50 cursor-not-allowed w-full text-center" style={{ fontSize: '9.5px' }} disabled>
              🔒 IN TRANSIT ({turnsRemaining} turns left)
            </button>
          );
        } else {
          if (isCurrentlyHere) {
            return (
              <button
                onClick={() => {
                  setLocalCollectLogistics(true);
                  addToast("Logistics Sourcing Collection queued.", "success");
                }}
                className="cia-task-btn font-mono w-full text-center"
                style={{
                  color: 'var(--green)',
                  borderColor: 'var(--green)',
                  background: 'rgba(16, 185, 129, 0.06)',
                  fontSize: '9.5px',
                  fontWeight: 'bold',
                  boxShadow: '0 0 10px rgba(16, 185, 129, 0.15)'
                }}
                disabled={isWaiting}
              >
                📥 CLAIM LOGISTICS
              </button>
            );
          } else {
            return (
              <button
                className="cia-task-btn font-mono opacity-60 cursor-not-allowed w-full text-center"
                style={{
                  color: '#ff9000',
                  borderColor: 'rgba(255, 144, 0, 0.3)',
                  background: 'rgba(255, 144, 0, 0.02)',
                  fontSize: '9.5px'
                }}
                disabled
              >
                🔒 ARRIVE IN {requestedCity.replace(/_/g, ' ').toUpperCase()} TO CLAIM
              </button>
            );
          }
        }
      } else {
        const locationName = requestedCity.replace(/_/g, ' ').toUpperCase();
        return (
          <button className="cia-task-btn font-mono opacity-50 cursor-not-allowed w-full text-center" style={{ fontSize: '9.5px' }} disabled>
            🔒 LOGISTICS SOURCING AT {locationName} {turnsRemaining > 0 ? `(${turnsRemaining}t left)` : '(AWAITING CLAIM)'}
          </button>
        );
      }
    } else {
      if (isCurrentlyHere) {
        return (
          <button
            onClick={() => {
              setLocalRequestLogistics(true);
              addToast("Logistics Sourcing Request queued. Completes in 5 turns.", "success");
            }}
            className="cia-task-btn font-mono w-full text-center"
            style={{ fontSize: '9.5px' }}
            disabled={isWaiting}
          >
            📦 REQUEST LOGISTICS PIPELINE
          </button>
        );
      } else {
        return (
          <button className="cia-task-btn font-mono opacity-50 cursor-not-allowed w-full text-center" style={{ fontSize: '9.5px' }} disabled>
            🔒 ARRIVE HERE TO REQUEST LOGISTICS
          </button>
        );
      }
    }
  };

  const renderHandoverSourcingBtn = () => {
    const isFinanceReady = session.financeCollected;
    const isLogisticsReady = session.logisticsCollected;
    const isCompleted = session.handoverCompleted;
    const handoverCity = session.handoverCity;
    const turnsRemaining = session.handoverTurnsRemaining;

    if (!isFinanceReady || !isLogisticsReady) {
      return (
        <button 
          className="cia-task-btn font-mono cursor-not-allowed w-full text-center" 
          style={{
            color: 'rgba(255, 255, 255, 0.25)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.01)',
            fontSize: '9.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }} 
          disabled
        >
          🔒 HANDOVER (AWAITING FINANCE/LOGISTICS)
        </button>
      );
    }

    if (isCompleted) {
      return (
        <button className="cia-task-btn font-mono border-emerald-500 text-emerald-400 bg-[rgba(16,185,129,0.08)] cursor-not-allowed w-full text-center" disabled>
          🤝 HANDOVER ESTABLISHED
        </button>
      );
    }

    if (localBeginHandover) {
      return (
        <button
          onClick={() => {
            setLocalBeginHandover(false);
            addToast("Handover initiation cancelled.", "info");
          }}
          className="cia-task-btn font-mono active w-full text-center"
          style={{
            color: '#ff4d4d',
            borderColor: '#ff4d4d',
            background: 'rgba(255, 77, 77, 0.15)',
            fontSize: '9.5px',
            fontWeight: 'bold'
          }}
          disabled={isWaiting}
        >
          ✕ CANCEL HANDOVER INITIATION
        </button>
      );
    }

    if (handoverCity) {
      if (handoverCity === cityId) {
        return (
          <button className="cia-task-btn font-mono border-cyan-500 text-cyan-300 bg-[rgba(0,240,255,0.12)] cursor-not-allowed w-full font-bold text-center animate-pulse" disabled>
            ⚡ HANDOVER UNDERWAY ({turnsRemaining} turns left)
          </button>
        );
      } else {
        return (
          <button className="cia-task-btn font-mono opacity-50 cursor-not-allowed w-full text-center" disabled>
            🔒 HANDOVER ACTIVE AT {handoverCity.replace(/_/g, ' ').toUpperCase()}
          </button>
        );
      }
    } else {
      const hostileNode = nodeData && nodeData.territory === 'HOSTILE_TERRITORY';
      if (hostileNode) {
        if (isCurrentlyHere) {
          return (
            <button
              onClick={() => {
                setLocalBeginHandover(true);
                addToast("Handover process initiated. Keep operative present in city to complete.", "success");
              }}
              className="cia-task-btn font-mono w-full text-center"
              disabled={isWaiting}
            >
              🤝 INITIATE HANDOVER
            </button>
          );
        } else {
          return (
            <button className="cia-task-btn font-mono opacity-50 cursor-not-allowed w-full text-center" disabled>
              🔒 ARRIVE HERE TO INITIATE HANDOVER
            </button>
          );
        }
      } else {
        return (
          <button className="cia-task-btn font-mono opacity-50 cursor-not-allowed w-full text-center" disabled>
            🔒 HANDOVER REQUIRES HOSTILE CITY
          </button>
        );
      }
    }
  };

  // Active decoys/jammers details in this city
  const localDecoys = session.activeDecoys?.filter(d => d.cityNode === cityId) || [];
  const localJammers = session.espionageResources?.filter(r => r.cityNode === cityId && r.type === 'ATTACKER_JAMMER') || [];
  const activeDeflectorsCount = localDecoys.length + localJammers.length;

  return (
    <div className="cia-intel-box cyber-panel animate-fade-in" style={{ borderColor: '#ff3b30' }}>
      {/* Header */}
      <div className="cia-box-header" style={{ borderBottomColor: 'rgba(255, 59, 48, 0.3)' }}>
        <div className="cia-glow-indicator animate-ping" style={{ backgroundColor: '#ff3b30', boxShadow: '0 0 8px #ff3b30' }}></div>
        <h3 className="text-cyber" style={{ color: '#ff3b30', textShadow: '0 0 8px rgba(255, 59, 48, 0.3)' }}>OPERATIVE COMMAND</h3>
        {onClose && (
          <button onClick={onClose} className="cia-close-btn" title="Close Panel">✕</button>
        )}
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
            <span className={`value font-mono font-bold ${isFriendly ? 'text-success' : 'text-threat'}`}>
              {session.cityHeat?.[cityId] || 0}%
            </span>
          </div>
        </div>

        {/* Hide-out Assets Status */}
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
                      {isSecureSafehouse ? '🛡️' : '🏠'} $#{s.safehouseCode} {isSecureSafehouse ? '(SECURE)' : ''}
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
                          addToast(`Target safehouse set to $#${s.safehouseCode}`, "success");
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
                        $#{s.safehouseCode}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Operative status block (Mirrors CIA field agent block structure) */}
        {isCurrentlyHere && (
          <div className="cia-section">
            <h4 className="cia-sub-title" style={{ color: '#ff3b30' }}><Users size={12} /> OPERATIVE STATUS</h4>
            <div className="cia-list">
              <div className="cia-agent-block">
                {/* Expandable main bar */}
                <div 
                  className={`cia-list-item cursor-pointer ${activeOperativeOpen ? 'active-select' : ''} ${isSuspectPlannedHere ? 'moved-locked' : ''}`}
                  onClick={() => {
                    if (isSuspectPlannedHere) return;
                    setActiveOperativeOpen(!activeOperativeOpen);
                  }}
                >
                  <span className="value text-threat" style={{ color: '#ff3b30' }}>
                    {`OPERATIVE: ${session.actualAttacker || 'Faizal Khan'}`}
                  </span>
                  <span className="label font-mono text-[9px]">
                    {isSuspectPlannedHere ? (
                      `TRANSIT -> ${cityId.replace(/_/g, ' ').toUpperCase()}`
                    ) : (
                      (session.activeAttackerPhase || 'TRAIL_BREAKING').replace(/_/g, ' ')
                    )}
                  </span>
                </div>

                {/* Expanded controls */}
                {activeOperativeOpen && !isSuspectPlannedHere && (
                  <div className="cia-agent-controls animate-fade-in" style={{ borderColor: 'rgba(255, 59, 48, 0.3)' }}>
                    <>
                      {/* Task Directives */}
                      <div>
                        <span className="cia-controls-label" style={{ color: '#ff3b30', borderBottomColor: 'rgba(255, 59, 48, 0.15)' }}>TASK DIRECTIVES</span>
                        <div className="flex flex-col gap-2 mt-2">
                          {renderFinanceSourcingBtn()}
                          {renderLogisticsSourcingBtn()}
                          {renderHandoverSourcingBtn()}
                        </div>
                      </div>

                      {/* Movement Options */}
                      <div className="mt-3">
                        <span className="cia-controls-label" style={{ color: '#ff3b30', borderBottomColor: 'rgba(255, 59, 48, 0.15)' }}>MOVE TO CONNECTING CENTER</span>
                        <div className="cia-dispatch-list mt-2">
                          {(() => {
                            const connectedSafehouses = session.safehouses?.filter(s => 
                              s.ownerFaction === 'HOSTILE' && currentConnections.includes(s.cityNode)
                            ) || [];

                            if (connectedSafehouses.length === 0) {
                              return (
                                <div style={{
                                  border: '1px dashed rgba(255, 59, 48, 0.25)',
                                  background: 'rgba(255, 59, 48, 0.02)',
                                  color: '#ff8880',
                                  padding: '8px',
                                  borderRadius: '4px',
                                  fontSize: '9.5px',
                                  textAlign: 'center',
                                  fontFamily: 'monospace',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '4px',
                                  width: '100%'
                                }}>
                                  <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    ⚠️ NO ADJACENT HIDE-OUTS
                                  </span>
                                  <span style={{ fontSize: '8px', opacity: 0.7 }}>
                                    Establish a safehouse at an adjacent node first to enable movement pathways.
                                  </span>
                                </div>
                              );
                            }

                            return connectedSafehouses.map((s, idx) => {
                              const isTarget = localSuspectMove === s.cityNode && localTargetSafehouseCode === s.safehouseCode;
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
                                      addToast(`Move to ${s.cityNode.replace(/_/g, ' ').toUpperCase()} — $#${s.safehouseCode} queued.`, "success");
                                    }
                                  }}
                                  className={`cia-dispatch-btn font-mono ${isTarget ? 'active-select' : ''}`}
                                  style={{
                                    background: isTarget ? 'rgba(255, 204, 0, 0.15)' : '',
                                    borderColor: isTarget ? '#ffcc00' : '',
                                    color: isTarget ? '#ffcc00' : ''
                                  }}
                                >
                                  <span>Move to {s.cityNode.replace(/_/g, ' ').toUpperCase()}</span>
                                  <span style={{ marginLeft: '8px' }}>$#{s.safehouseCode}</span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Global Sourcing & Clearances Passive Section */}
        {isCurrentlyHere && (
          <div className="cia-section">
            <h4 className="cia-sub-title" style={{ color: '#ff3b30' }}><Archive size={12} /> CLEARANCES & SOURCING</h4>
            <div className="cia-grid-item">
              <div className="cia-sub-item">
                <span className="label font-mono"><DollarSign size={10} /> FINANCIAL RAILS:</span>
                <div className="mt-1 font-mono text-[9.5px]">
                  {session.financeCollected ? (
                    <span className="cia-tag green">✓ FINANCE ACQUIRED</span>
                  ) : session.requestedFinanceCity ? (
                    <span className="text-amber font-semibold">
                      IN TRANSIT AT {session.requestedFinanceCity.replace(/_/g, ' ').toUpperCase()} ({session.financeCollectionTurnsRemaining} turns left)
                    </span>
                  ) : (
                    <span className="text-dim">NOT REQUESTED (Arrive in Hostile territory to request)</span>
                  )}
                </div>
              </div>
              
              <div className="cia-sub-item mt-3">
                <span className="label font-mono"><Archive size={10} /> LOGISTICS PIPELINE:</span>
                <div className="mt-1 font-mono text-[9.5px]">
                  {session.logisticsCollected ? (
                    <span className="cia-tag green">✓ LOGISTICS ACQUIRED</span>
                  ) : session.requestedLogisticsCity ? (
                    <span className="text-amber font-semibold">
                      IN TRANSIT AT {session.requestedLogisticsCity.replace(/_/g, ' ').toUpperCase()} ({session.logisticsCollectionTurnsRemaining} turns left)
                    </span>
                  ) : (
                    <span className="text-dim">NOT REQUESTED (Arrive in Hostile territory to request)</span>
                  )}
                </div>
              </div>

              <div className="cia-sub-item mt-3">
                <span className="label font-mono"><Activity size={10} /> HANDOVER TARGET SITE:</span>
                <div className="mt-1 font-mono text-[9.5px]">
                  {session.handoverCompleted ? (
                    <span className="cia-tag green">✓ HANDOVER COMPLETED</span>
                  ) : session.handoverCity ? (
                    <span className="text-cyan font-semibold">
                      ACTIVE SITE: {session.handoverCity.replace(/_/g, ' ').toUpperCase()} ({session.handoverTurnsRemaining} turns left)
                  </span>
                  ) : (
                    <span className="text-dim">LOCKED (Collect Finance & Logistics first)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deploy Decoys & Defense Tech Console */}
        <div className="cia-section">
          <h4 className="cia-sub-title" style={{ color: '#ff3b30' }}><Cpu size={12} /> DEPLOY HIDE-OUT & ESPIONAGE</h4>
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

        {/* Active Decoys/Jammers (Radar Deflection Matrix) Tag list */}
        <div className="cia-section">
          <h4 className="cia-sub-title" style={{ color: '#ff3b30' }}><Radio size={12} /> RADAR DEFLECTION MATRIX</h4>
          {activeDeflectorsCount === 0 ? (
            <div className="text-dim font-mono text-[10px] py-1">NO RADAR DEFLECTORS ACTIVE</div>
          ) : (
            <div className="cia-tag-list">
              {localDecoys.map((d, i) => (
                <span key={`decoy-${i}`} className="cia-tag red font-mono animate-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>📡</span>
                  <span>DECOY {d.type}</span>
                </span>
              ))}
              {localJammers.map((j, i) => (
                <span key={`jam-${i}`} className="cia-tag cyan font-mono animate-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>📡</span>
                  <span>JAMMER (T-{j.cooldownRemaining})</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Connected Nodes Footer Navigation */}
      {(() => {
        const connections = activeScenario?.nodes?.find(n => n.id === cityId)?.connections || [];
        return (
          <div className="cia-box-footer" style={{ flexDirection: 'column', gap: '6px', alignItems: 'stretch', width: '100%' }}>
            <span className="label font-mono text-[8px] text-dim mb-1" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ADJACENT REGIONS:
            </span>
            <div className="flex flex-wrap gap-1.5 w-full">
              {connections.length === 0 ? (
                <span className="text-[9px] text-dim font-mono">NO CONNECTED SECTORS</span>
              ) : (
                connections.map(connId => (
                  <button
                    key={connId}
                    onClick={() => {
                      if (isWaiting) return;
                      setSelectedCityNode?.(connId);
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
