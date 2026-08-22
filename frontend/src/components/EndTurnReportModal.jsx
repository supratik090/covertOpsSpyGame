import React from 'react';
import { X, ShieldAlert, ShieldCheck, Radio, AlertTriangle, Skull, UserX, Siren, Crosshair, Activity } from 'lucide-react';
import { SafehouseIcon, HostileSafehouseIcon, ExposedSafehouseIcon } from './GameSymbols';

export default function EndTurnReportModal({ report, onClose, isAttacker }) {
  if (!report) return null;

  const hasContent = isAttacker
    ? (report.newSafehouses.length > 0 || report.sweepAlerts?.length > 0 || report.lostSafehouses?.length > 0 || report.newTech.length > 0)
    : (
        report.newFinance.length > 0 || 
        report.newLogistics.length > 0 || 
        report.newSafehouses.length > 0 || 
        report.newTech.length > 0 ||
        report.lostAgents?.length > 0 ||
        report.lostTeams?.length > 0 ||
        report.lostSafehouses?.length > 0 ||
        report.newExposedHostileSH?.length > 0 ||
        report.sweepAlerts?.length > 0 ||
        report.sweepLosses?.length > 0 ||
        report.combatOps?.length > 0 || 
        report.permissionAlerts?.length > 0 || 
        report.handoverAlerts?.length > 0 ||
        report.strikeEvents?.length > 0 ||
        report.droneDefenseAlerts?.length > 0
      );

  if (!hasContent) return null;

  const primaryColor = isAttacker ? '#ff3b30' : 'var(--cyan)';
  const shadowColor = isAttacker ? 'rgba(255, 59, 48, 0.25)' : 'rgba(0, 240, 255, 0.25)';
  const reportTitle = isAttacker ? 'OPERATIVE TACTICAL RESOLUTION' : 'TACTICAL RESOLUTION REPORT';
  const Icon = isAttacker ? ShieldAlert : ShieldCheck;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(2, 4, 10, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      fontFamily: 'monospace'
    }}>
      <div className="cyber-panel" style={{
        width: '100%',
        maxWidth: '540px',
        background: '#060c1c',
        border: `1px solid ${primaryColor}`,
        boxShadow: `0 0 30px ${shadowColor}`,
        borderRadius: '8px',
        padding: '24px',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${isAttacker ? 'rgba(255, 59, 48, 0.2)' : 'rgba(0, 240, 255, 0.2)'}`,
          paddingBottom: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon style={{ color: primaryColor }} size={22} />
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 'bold',
              color: primaryColor,
              letterSpacing: '0.05em',
              textShadow: `0 0 8px ${isAttacker ? 'rgba(255, 59, 48, 0.3)' : 'rgba(0, 240, 255, 0.3)'}`
            }}>
              {reportTitle}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="cyber-btn sm" 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Report Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '360px', overflowY: 'auto' }}>
          <style>{`
            @keyframes reportCardSlideIn {
              from { opacity: 0; transform: translateY(10px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .report-card {
              animation: reportCardSlideIn 0.35s ease both;
            }
          `}</style>
          
          {/* Critical Security Strike Events */}
          {!isAttacker && report.strikeEvents?.length > 0 && (
            <div className="report-card" style={{
              border: '2px dashed rgba(255, 59, 48, 0.85)',
              background: 'rgba(255, 59, 48, 0.08)',
              padding: '14px',
              borderRadius: '6px',
              boxShadow: '0 0 16px rgba(255, 59, 48, 0.25)',
              animationDelay: '0ms'
            }}>
              <span style={{ color: '#ff3b30', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', letterSpacing: '0.05em' }}>
                <Skull size={14} /> 💥 CRITICAL Espionage IMPACT
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#ff8880', lineHeight: '1.6', fontWeight: 'bold' }}>
                {report.strikeEvents.map((clue, idx) => (
                  <li key={idx}>{clue.clueText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Combat Operations */}
          {!isAttacker && report.combatOps?.length > 0 && (
            <div className="report-card" style={{
              border: '1px solid rgba(255, 59, 48, 0.35)',
              background: 'rgba(255, 59, 48, 0.04)',
              padding: '14px',
              borderRadius: '6px',
              animationDelay: '60ms'
            }}>
              <span style={{ color: '#ff3b30', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Crosshair size={14} /> {isAttacker ? 'TACTICAL RAIDS / DETECTIONS' : 'COMBAT OPERATIONS'}
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.combatOps.map((clue, idx) => (
                  <li key={idx} style={{ color: '#ff6b60' }}>{clue.clueText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Sweep Alerts */}
          {report.sweepAlerts?.length > 0 && (
            <div className="report-card" style={{
              border: '1px solid rgba(255, 64, 0, 0.3)',
              background: 'rgba(255, 64, 0, 0.04)',
              padding: '14px',
              borderRadius: '6px',
              animationDelay: '120ms'
            }}>
              <span style={{ color: '#ff4000', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Siren size={14} /> {isAttacker ? 'GRID SEARCH / SWEEP ALERTS' : 'SECURITY SWEEP WARNINGS'}
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.sweepAlerts.map((clue, idx) => (
                  <li key={idx} style={{ color: '#ff6040' }}>{clue.clueText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Drone Defense Activated Events */}
          {report.droneDefenseAlerts?.length > 0 && (
            <div className="report-card" style={{
              border: '1px solid rgba(239, 68, 68, 0.45)',
              background: 'rgba(239, 68, 68, 0.08)',
              padding: '14px',
              borderRadius: '6px',
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.25)',
              animationDelay: '130ms'
            }}>
              <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', letterSpacing: '0.05em' }}>
                <Siren size={14} /> 🚨 DRONE DEFENSE ACTIVATED
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#fca5a5', lineHeight: '1.6', fontWeight: 'bold' }}>
                {report.droneDefenseAlerts.map((clue, idx) => (
                  <li key={idx}>{clue.clueText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Drone Base Maintenance Alerts & Advance Warnings */}
          {report.droneMaintenanceAlerts?.length > 0 && (
            <div className="report-card" style={{
              border: '1px solid rgba(245, 158, 11, 0.4)',
              background: 'rgba(245, 158, 11, 0.06)',
              padding: '14px',
              borderRadius: '6px',
              animationDelay: '150ms'
            }}>
              <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Activity size={14} /> 🛠️ DRONE BASE MAINTENANCE ADVISORY
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#fbbf24', lineHeight: '1.6', fontWeight: '500' }}>
                {report.droneMaintenanceAlerts.map((clue, idx) => (
                  <li key={idx}>{clue.clueText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Drone Serviced / Repair Completed */}
          {report.droneServicedAlerts?.length > 0 && (
            <div className="report-card" style={{
              border: '1px solid rgba(0, 255, 102, 0.5)',
              background: 'rgba(0, 255, 102, 0.08)',
              padding: '14px',
              borderRadius: '6px',
              boxShadow: '0 0 16px rgba(0, 255, 102, 0.2)',
              animationDelay: '160ms'
            }}>
              <span style={{ color: '#00ff66', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', letterSpacing: '0.05em' }}>
                <Activity size={14} /> 🛠️ DRONE SERVICING & REPAIR COMPLETE
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#66ffb2', lineHeight: '1.6', fontWeight: 'bold' }}>
                {report.droneServicedAlerts.map((clue, idx) => (
                  <li key={idx}>{clue.clueText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Asset Losses (from sweep loss clues) */}
          {!isAttacker && report.sweepLosses?.length > 0 && (
            <div className="report-card" style={{
              border: '1px solid rgba(255, 0, 64, 0.3)',
              background: 'rgba(255, 0, 64, 0.04)',
              padding: '14px',
              borderRadius: '6px',
              animationDelay: '180ms'
            }}>
              <span style={{ color: '#ff0040', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Skull size={14} /> CASUALTY REPORT
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.sweepLosses.map((clue, idx) => (
                  <li key={idx} style={{ color: '#ff4060' }}>{clue.clueText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Lost Agents */}
          {!isAttacker && report.lostAgents?.length > 0 && (
            <div className="report-card" style={{
              border: '1px solid rgba(255, 0, 0, 0.25)',
              background: 'rgba(255, 0, 0, 0.03)',
              padding: '14px',
              borderRadius: '6px',
              animationDelay: '240ms'
            }}>
              <span style={{ color: '#ff4444', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <UserX size={14} /> AGENTS DISAVOWED
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.lostAgents.map(a => (
                  <li key={a.id}>
                    Agent <strong style={{ color: '#ff6666' }}>{a.codename}</strong> lost in <span style={{ color: 'var(--text-primary)' }}>{a.currentCity?.toUpperCase()}</span>.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lost Teams */}
          {!isAttacker && report.lostTeams?.length > 0 && (
            <div style={{
              border: '1px solid rgba(255, 0, 0, 0.25)',
              background: 'rgba(255, 0, 0, 0.03)',
              padding: '14px',
              borderRadius: '6px'
            }}>
              <span style={{ color: '#ff4444', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <ShieldAlert size={14} /> TACTICAL TEAMS NEUTRALIZED
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.lostTeams.map(t => (
                  <li key={t.id}>
                    Team <strong style={{ color: '#ff6666' }}>{t.name}</strong> lost in <span style={{ color: 'var(--text-primary)' }}>{t.currentCity?.toUpperCase()}</span>.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Exposed Safehouses */}
          {!isAttacker && report.newExposedHostileSH?.length > 0 && (
            <div className="report-card" style={{
              border: '1px solid rgba(255, 200, 0, 0.3)',
              background: 'rgba(255, 200, 0, 0.04)',
              padding: '14px',
              borderRadius: '6px',
              animationDelay: '360ms'
            }}>
              <span style={{ color: '#ffcc00', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <ExposedSafehouseIcon size={14} />
                {isAttacker ? 'YOUR SAFEHOUSE LOCATIONS UNCOVERED' : 'ENEMY SAFEHOUSES EXPOSED'}
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.newExposedHostileSH.map(s => (
                  <li key={s.cityNode}>
                    {isAttacker ? (
                      <span>Your safehouse in <strong style={{ color: '#ffcc00' }}>{s.cityNode.toUpperCase()}</strong> uncovered. Code: <span style={{ color: 'var(--cyan)', fontFamily: 'monospace' }}>#{s.safehouseCode || '???'}{s.subLocality ? ` - ${s.subLocality}` : ''}</span> — evasion protocol failed.</span>
                    ) : (
                      <span>Hostile safehouse in <strong style={{ color: '#ffcc00' }}>{s.cityNode.toUpperCase()}</strong> uncovered. Code: <span style={{ color: 'var(--cyan)', fontFamily: 'monospace' }}>#{s.safehouseCode || '???'}{s.subLocality ? ` - ${s.subLocality}` : ''}</span>. Raid to dismantle.</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lost Safehouses */}
          {report.lostSafehouses?.length > 0 && (
            <div className="report-card" style={{
              border: '1px solid rgba(255, 0, 0, 0.25)',
              background: 'rgba(255, 0, 0, 0.03)',
              padding: '14px',
              borderRadius: '6px',
              animationDelay: '300ms'
            }}>
              <span style={{ color: '#ff4444', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <HostileSafehouseIcon size={14} />
                {isAttacker ? 'YOUR SAFEHOUSE DESTROYED' : 'SAFEHOUSES COMPROMISED'}
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.lostSafehouses.map(s => (
                  <li key={s.cityNode}>
                    Safehouse in <strong style={{ color: '#ff6666' }}>{s.cityNode.toUpperCase()}</strong> discovered and dismantled by enemy tactical raid.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Discovered Hotspots */}
          {!isAttacker && (report.newFinance.length > 0 || report.newLogistics.length > 0) && (
            <div style={{
              border: '1px solid rgba(255, 204, 0, 0.2)',
              background: 'rgba(255, 204, 0, 0.02)',
              padding: '14px',
              borderRadius: '6px'
            }}>
              <span style={{ color: 'var(--amber)', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <AlertTriangle size={14} /> {isAttacker ? 'YOUR HOTSPOTS DETECTED' : 'ENEMY HOTSPOTS UNCOVERED'}
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.newFinance.map(city => (
                  <li key={city}>
                    {isAttacker ? (
                      <span>Your financial rail hotspot detected in <strong className="text-cyber">{city.toUpperCase()}</strong>.</span>
                    ) : (
                      <span>Financial rail hotspot detected in <strong className="text-cyber">{city.toUpperCase()}</strong>.</span>
                    )}
                  </li>
                ))}
                {report.newLogistics.map(city => (
                  <li key={city}>
                    {isAttacker ? (
                      <span>Your logistics pipeline hotspot detected in <strong className="text-cyber">{city.toUpperCase()}</strong>.</span>
                    ) : (
                      <span>Logistics shield hotspot detected in <strong className="text-cyber">{city.toUpperCase()}</strong>.</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* New Safehouses */}
          {report.newSafehouses.length > 0 && (
            <div className="report-card" style={{
              border: `1px solid ${isAttacker ? 'rgba(255, 59, 48, 0.25)' : 'rgba(0, 240, 255, 0.2)'}`,
              background: isAttacker ? 'rgba(255, 59, 48, 0.04)' : 'rgba(0, 240, 255, 0.02)',
              padding: '14px',
              borderRadius: '6px',
              animationDelay: '420ms'
            }}>
              <span style={{ color: primaryColor, fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <SafehouseIcon size={14} color={primaryColor} />
                {isAttacker ? 'NEW HIDE-OUT OPERATIONAL' : 'NEW OPERATIONAL SAFEHOUSE'}
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.newSafehouses.map(s => {
                  const isFriendly = isAttacker ? s.ownerFaction === 'HOSTILE' : s.ownerFaction === 'DEFENDER';
                  return (
                    <li key={s.cityNode}>
                      {isFriendly ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <SafehouseIcon size={11} color={isAttacker ? '#ff7070' : 'var(--cyan)'} secure={s.secure} />
                          {s.secure ? 'Secure' : 'Standard'} safehouse established in{' '}
                          <strong style={{ color: isAttacker ? '#ff7070' : 'var(--cyan)' }}>{s.cityNode.toUpperCase()}</strong>.
                          Code: <span style={{ color: 'var(--cyan)', fontFamily: 'monospace', fontWeight: 'bold' }}>#{s.safehouseCode}{s.subLocality ? ` - ${s.subLocality}` : ''}</span>
                        </span>
                      ) : (
                        <span className="text-threat">
                          {isAttacker ? 'Counter-intelligence safehouse sighted' : 'Hostile safehouse sighted'} in {s.cityNode.toUpperCase()}.
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Tech/Surveillance Deployments */}
          {report.newTech.length > 0 && (
            <div style={{
              border: '1px solid rgba(16, 185, 129, 0.2)',
              background: 'rgba(16, 185, 129, 0.02)',
              padding: '14px',
              borderRadius: '6px'
            }}>
              <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Radio size={14} /> {isAttacker ? 'RADAR DEFLECTION ONLINE' : 'TACTICAL EQUIPMENT ONLINE'}
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.newTech.map((r, idx) => (
                  <li key={idx}>
                    <strong style={{ color: '#10b981' }}>{r.type.replace(/_/g, ' ')}</strong> successfully active in <span style={{ color: 'var(--text-primary)' }}>{r.cityNode.toUpperCase()}</span>.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Major Progression Events (Handover Complete, Border Permission, Border Crossed, Attack Authorization) */}
          {report.permissionAlerts?.length > 0 && (
            <div className="report-card" style={{
              border: '1px solid rgba(0, 240, 255, 0.4)',
              background: 'rgba(0, 240, 255, 0.06)',
              padding: '14px',
              borderRadius: '6px',
              boxShadow: '0 0 12px rgba(0, 240, 255, 0.15)',
              animationDelay: '480ms'
            }}>
              <span style={{ color: 'var(--cyan)', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', letterSpacing: '0.05em' }}>
                <Activity size={14} /> 📡 MAJOR OPERATIONAL & PROGRESSION EVENTS
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#00f0ff', lineHeight: '1.6', fontWeight: 'bold' }}>
                {report.permissionAlerts.map((clue, idx) => (
                  <li key={idx}>{clue.clueText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Handover Target Site Confirmations */}
          {!isAttacker && report.handoverAlerts?.length > 0 && (
            <div style={{
              border: '1px solid rgba(0, 240, 255, 0.3)',
              background: 'rgba(0, 240, 255, 0.04)',
              padding: '14px',
              borderRadius: '6px'
            }}>
              <span style={{ color: 'var(--cyan)', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Activity size={14} /> HANDOVER TARGET ALLOCATED
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.handoverAlerts.map((clue, idx) => (
                  <li key={idx} style={{ color: 'var(--cyan)' }}>{clue.clueText}</li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button 
            onClick={onClose} 
            className="cyber-btn"
            style={{ padding: '6px 20px', fontSize: '12px', color: primaryColor, borderColor: primaryColor }}
          >
            CONFIRM RECEIPT
          </button>
        </div>
      </div>
    </div>
  );
}
