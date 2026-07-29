import React from 'react';
import { X, ShieldAlert, ShieldCheck, Radio, AlertTriangle, Skull, UserX, Home, Siren } from 'lucide-react';

export default function EndTurnReportModal({ report, onClose }) {
  if (!report) return null;

  const hasContent = 
    report.newFinance.length > 0 || 
    report.newLogistics.length > 0 || 
    report.newSafehouses.length > 0 || 
    report.newTech.length > 0 ||
    report.lostAgents?.length > 0 ||
    report.lostTeams?.length > 0 ||
    report.lostSafehouses?.length > 0 ||
    report.newExposedHostileSH?.length > 0 ||
    report.sweepAlerts?.length > 0 ||
    report.sweepLosses?.length > 0;

  if (!hasContent) return null;

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
        border: '1px solid var(--cyan)',
        boxShadow: '0 0 30px rgba(0, 240, 255, 0.25)',
        borderRadius: '8px',
        padding: '24px',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
          paddingBottom: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck className="text-cyber" size={22} />
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'var(--cyan)',
              letterSpacing: '0.05em',
              textShadow: '0 0 8px rgba(0, 240, 255, 0.3)'
            }}>
              TACTICAL RESOLUTION REPORT
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
          
          {/* Sweep Alerts */}
          {report.sweepAlerts?.length > 0 && (
            <div style={{
              border: '1px solid rgba(255, 64, 0, 0.3)',
              background: 'rgba(255, 64, 0, 0.04)',
              padding: '14px',
              borderRadius: '6px'
            }}>
              <span style={{ color: '#ff4000', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Siren size={14} /> SECURITY SWEEP WARNINGS
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.sweepAlerts.map((clue, idx) => (
                  <li key={idx} style={{ color: '#ff6040' }}>{clue.clueText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Asset Losses (from sweep loss clues) */}
          {report.sweepLosses?.length > 0 && (
            <div style={{
              border: '1px solid rgba(255, 0, 64, 0.3)',
              background: 'rgba(255, 0, 64, 0.04)',
              padding: '14px',
              borderRadius: '6px'
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
          {report.lostAgents?.length > 0 && (
            <div style={{
              border: '1px solid rgba(255, 0, 0, 0.25)',
              background: 'rgba(255, 0, 0, 0.03)',
              padding: '14px',
              borderRadius: '6px'
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
          {report.lostTeams?.length > 0 && (
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

          {/* Exposed Hostile Safehouses */}
          {report.newExposedHostileSH?.length > 0 && (
            <div style={{
              border: '1px solid rgba(255, 200, 0, 0.3)',
              background: 'rgba(255, 200, 0, 0.04)',
              padding: '14px',
              borderRadius: '6px'
            }}>
              <span style={{ color: '#ffcc00', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <ShieldAlert size={14} /> ENEMY SAFEHOUSES EXPOSED
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.newExposedHostileSH.map(s => (
                  <li key={s.cityNode}>
                    Hostile safehouse in <strong style={{ color: '#ffcc00' }}>{s.cityNode.toUpperCase()}</strong> uncovered. Code: <span style={{ color: 'var(--cyan)', fontFamily: 'monospace' }}>{s.safehouseCode || '???'}</span>
                    {s.origin !== 'DEFAULT' ? ' — cell eliminated.' : '. Raid to dismantle.'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lost Safehouses */}
          {report.lostSafehouses?.length > 0 && (
            <div style={{
              border: '1px solid rgba(255, 0, 0, 0.25)',
              background: 'rgba(255, 0, 0, 0.03)',
              padding: '14px',
              borderRadius: '6px'
            }}>
              <span style={{ color: '#ff4444', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Home size={14} /> SAFEHOUSES COMPROMISED
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.lostSafehouses.map(s => (
                  <li key={s.cityNode}>
                    Safehouse in <strong style={{ color: '#ff6666' }}>{s.cityNode.toUpperCase()}</strong> discovered and dismantled.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Discovered Hotspots */}
          {(report.newFinance.length > 0 || report.newLogistics.length > 0) && (
            <div style={{
              border: '1px solid rgba(255, 204, 0, 0.2)',
              background: 'rgba(255, 204, 0, 0.02)',
              padding: '14px',
              borderRadius: '6px'
            }}>
              <span style={{ color: 'var(--amber)', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <AlertTriangle size={14} /> ENEMY HOTSPOTS UNCOVERED
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.newFinance.map(city => (
                  <li key={city}>
                    Financial rail hotspot detected in <strong className="text-cyber">{city.toUpperCase()}</strong>.
                  </li>
                ))}
                {report.newLogistics.map(city => (
                  <li key={city}>
                    Logistics shield hotspot detected in <strong className="text-cyber">{city.toUpperCase()}</strong>.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* New Safehouses */}
          {report.newSafehouses.length > 0 && (
            <div style={{
              border: '1px solid rgba(0, 240, 255, 0.2)',
              background: 'rgba(0, 240, 255, 0.02)',
              padding: '14px',
              borderRadius: '6px'
            }}>
              <span style={{ color: 'var(--cyan)', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <ShieldCheck size={14} /> NEW OPERATIONAL SAFEHOUSE
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.newSafehouses.map(s => (
                  <li key={s.cityNode}>
                    {s.ownerFaction === 'DEFENDER' ? (
                      <span>Friendly safehouse constructed in <strong className="text-cyber">{s.cityNode.toUpperCase()}</strong>.</span>
                    ) : (
                      <span className="text-threat">Hostile safehouse sighted in {s.cityNode.toUpperCase()}.</span>
                    )}
                  </li>
                ))}
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
                <Radio size={14} /> TACTICAL EQUIPMENT ONLINE
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {report.newTech.map((r, idx) => (
                  <li key={idx}>
                    <strong style={{ color: '#10b981' }}>{r.type.replace(/_/g, ' ')}</strong> successfully deployed to <span style={{ color: 'var(--text-primary)' }}>{r.cityNode.toUpperCase()}</span>.
                  </li>
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
            style={{ padding: '6px 20px', fontSize: '12px' }}
          >
            CONFIRM RECEIPT
          </button>
        </div>
      </div>
    </div>
  );
}
