import React from 'react';
import { Navigation } from 'lucide-react';
import { DroneIcon } from './GameSymbols';

export default function DroneCard({ drone, session, onNavigate }) {
  const getDroneName = (id) => {
    if (id === 1) return "Drone Alpha";
    if (id === 2) return "Drone Theta";
    return `Drone #${id}`;
  };

  const is1Hop = drone.id !== 2 && drone.type !== '2-HOP';
  const typeLabel = is1Hop ? '1-HOP RECON' : '2-HOP LONG RANGE';
  const typeColor = is1Hop ? 'var(--cyan)' : '#c084fc';
  
  const baseCity = drone.currentCity;
  const isBaseUnderMaint = session?.maintenanceDroneBase === baseCity;

  // Planned op for current turn
  const plannedOp = (session?.covertActions || []).find(
    a => (a.actionType === 'DRONE_RECON' || a.actionType === 'DRONE_ATTACK') && a.droneId === drone.id
  );

  let statusLabel = 'READY';
  let statusColor = '#00ff66';
  if (drone.status === 'SERVICING') {
    statusLabel = `SERVICING (${drone.serviceCooldown || 2}T)`;
    statusColor = '#f59e0b';
  } else if (drone.status === 'SHOT_DOWN') {
    statusLabel = 'SHOT DOWN';
    statusColor = '#ff3b30';
  }

  return (
    <div
      className="card"
      onClick={baseCity && drone.status !== 'SHOT_DOWN' ? onNavigate : undefined}
      style={{ cursor: baseCity && drone.status !== 'SHOT_DOWN' ? 'pointer' : 'default' }}
    >
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <DroneIcon size={14} color={typeColor} />
          <span className="cyan" style={{ color: typeColor }}>{getDroneName(drone.id).toUpperCase()}</span>
        </div>
      </div>

      <div className="card-meta">
        <span>TYPE: {typeLabel}</span>
      </div>

      <div className="card-meta" style={{ marginTop: '-2px' }}>
        <span>STATUS: <span style={{ color: statusColor, fontWeight: 'bold' }}>{statusLabel}</span></span>
      </div>

      <div className="card-meta" style={{ marginTop: '-2px' }}>
        <span>STATIONED BASE: {baseCity ? baseCity.replace(/_/g, ' ').toUpperCase() : 'UNASSIGNED'}</span>
      </div>

      {isBaseUnderMaint && (
        <div className="card-meta" style={{ marginTop: '-2px', color: '#f59e0b', fontWeight: 'bold' }}>
          <span>⚠️ BASE MAINTENANCE IN PROGRESS</span>
        </div>
      )}

      <div className="card-meta" style={{ marginTop: '-2px', marginBottom: '8px' }}>
        <span>PLANNED MISSION: {plannedOp 
          ? `${plannedOp.actionType === 'DRONE_RECON' ? 'RECON' : 'ATTACK'} → ${plannedOp.targetCity.replace(/_/g, ' ').toUpperCase()}`
          : 'IDLE (NO ORDERS)'}</span>
      </div>

      {baseCity && drone.status !== 'SHOT_DOWN' && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate?.(); }}
          className="cia-dispatch-btn font-mono w-full mt-1"
          style={{
            padding: '6px 10px',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            fontFamily: "var(--font-mono)",
            borderColor: 'rgba(0,240,255,0.35)',
            background: 'rgba(0,240,255,0.08)',
            color: '#00f0ff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          <Navigation size={11} /> NAVIGATE TO BASE
        </button>
      )}
    </div>
  );
}
