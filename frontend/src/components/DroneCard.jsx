import React from 'react';
import { Wrench, Navigation, AlertTriangle } from 'lucide-react';
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

  let statusBadge = { label: 'READY', color: '#00ff66', bg: 'rgba(0,255,102,0.1)', border: 'rgba(0,255,102,0.3)' };
  if (drone.status === 'SERVICING') {
    statusBadge = { 
      label: `SERVICING (${drone.serviceCooldown || 2}T)`, 
      color: '#f59e0b', 
      bg: 'rgba(245,158,11,0.12)', 
      border: 'rgba(245,158,11,0.4)' 
    };
  } else if (drone.status === 'SHOT_DOWN') {
    statusBadge = { label: 'SHOT DOWN', color: '#ff3b30', bg: 'rgba(255,59,48,0.12)', border: 'rgba(255,59,48,0.4)' };
  }

  return (
    <div 
      className="agent-card drone-card" 
      style={{ 
        background: 'rgba(0,240,255,0.02)', 
        border: '1px solid rgba(0,240,255,0.18)',
        borderRadius: '6px',
        padding: '12px 14px',
        marginBottom: '10px',
        transition: 'all 0.2s'
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div dangerouslySetInnerHTML={{ __html: DroneIcon({ size: 16, color: typeColor }) }} />
          <div>
            <h3 className="font-mono text-[13px] font-bold text-white uppercase tracking-wider m-0">
              {getDroneName(drone.id)}
            </h3>
            <span 
              className="font-mono text-[8.5px] font-bold px-1.5 py-0.5 rounded inline-block mt-0.5"
              style={{ background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}40` }}
            >
              {typeLabel}
            </span>
          </div>
        </div>

        <span 
          className="font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase"
          style={{
            background: statusBadge.bg,
            color: statusBadge.color,
            border: `1px solid ${statusBadge.border}`
          }}
        >
          {statusBadge.label}
        </span>
      </div>

      <div className="agent-details font-mono text-[10px] space-y-1.5 my-2.5" style={{ color: 'var(--text-secondary)' }}>
        <div className="flex justify-between">
          <span className="text-dim">STATIONED BASE:</span>
          <span className="font-bold text-white">
            {baseCity ? baseCity.replace('_', ' ').toUpperCase() : 'UNASSIGNED'}
          </span>
        </div>

        {isBaseUnderMaint && (
          <div className="flex items-center gap-1 text-[#f59e0b] text-[9px] font-bold bg-[rgba(245,158,11,0.1)] p-1 rounded">
            <AlertTriangle size={11} /> BASE MAINTENANCE IN PROGRESS (INACTIVE)
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-dim">PLANNED MISSION:</span>
          <span className="font-bold" style={{ color: plannedOp ? 'var(--cyan)' : 'var(--text-dim)' }}>
            {plannedOp 
              ? `${plannedOp.actionType === 'DRONE_RECON' ? '🔍 RECON' : '🚀 ATTACK'} → ${plannedOp.targetCity.replace('_', ' ').toUpperCase()}`
              : 'IDLE (NO ORDERS)'}
          </span>
        </div>
      </div>

      {baseCity && drone.status !== 'SHOT_DOWN' && (
        <button
          onClick={onNavigate}
          className="cia-dispatch-btn font-mono w-full mt-2"
          style={{
            padding: '6px 10px',
            justifyContent: 'center',
            fontSize: '9px',
            borderColor: 'rgba(0,240,255,0.3)',
            background: 'rgba(0,240,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Navigation size={11} /> NAVIGATE TO BASE
        </button>
      )}
    </div>
  );
}
