import React from 'react';
import { Activity, LogOut } from 'lucide-react';

const StatusBar = ({ session, covertActions, onEndTurn, loading, onExit }) => {
  if (!session) return null;

  const { budget, currentTurn, maxTurns, heatPercentage, cobraAlertLevel, status } = session;

  const getHeatClass = (heat) => {
    if (heat < 50) return 'cyan';
    if (heat < 75) return 'amber';
    if (heat < 90) return 'orange';
    return 'red';
  };

  const parseCobraLevel = (levelStr) => {
    if (!levelStr) return { level: 5, text: 'LOW' };
    const parts = levelStr.split('_');
    if (parts.length >= 3) {
      return { level: parts[1], text: parts.slice(2).join('_') };
    }
    return { level: 5, text: 'LOW' };
  };

  const cobra = parseCobraLevel(cobraAlertLevel);

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="label">BUDGET</span>
        <span className="value text-green">${budget?.toLocaleString()}</span>
      </div>
      
      <div className="status-divider" />
      
      <div className="status-item">
        <span className="label">TURN</span>
        <span className="value text-amber">{currentTurn} / {maxTurns}</span>
      </div>
      
      <div className="status-divider" />
      
      <div className="status-item heat-gauge">
        <span className="label">HEAT</span>
        <span className={`value text-${getHeatClass(heatPercentage)}`}>{heatPercentage}%</span>
        <div className="heat-bar-track">
          <div 
            className={`heat-bar-fill ${getHeatClass(heatPercentage)}`} 
            style={{ width: `${heatPercentage}%` }} 
          />
        </div>
      </div>
      
      <div className="status-divider" />
      
      <div className={`status-item cobra-badge level-${cobra.level}`}>
        COBRA {cobra.level}: {cobra.text}
      </div>
      
      <div className="status-divider" />
      
      <div className="status-item game-status-badge">
        {status}
      </div>
      
      <div className="status-spacer" />
      
      {covertActions?.length > 0 && (
        <div className="planned-actions-mini">
          {covertActions.length} PLANNED
        </div>
      )}
      
      <button 
        className="end-turn-btn" 
        onClick={onEndTurn}
        disabled={loading || status !== 'ACTIVE'}
      >
        <Activity size={18} />
        <span>TRANSMIT & END TURN</span>
        {covertActions?.length > 0 && <span className="action-badge">{covertActions.length}</span>}
      </button>

      <button className="cyber-btn sm red" onClick={onExit}>
        <LogOut size={18} />
      </button>
    </div>
  );
};

export default StatusBar;
