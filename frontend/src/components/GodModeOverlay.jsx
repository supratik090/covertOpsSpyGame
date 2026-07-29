import React from 'react';
import { Sliders } from 'lucide-react';

export const GodModeRoutes = ({ replayPlan, replayTurn, nodeCoordinates }) => {
  if (!replayPlan || !replayPlan.primaryPlan || replayPlan.primaryPlan.length === 0) return null;

  const points = [];
  for (let i = 0; i < replayTurn; i++) {
    const step = replayPlan.primaryPlan[i];
    if (step && step.suspectLocation && nodeCoordinates[step.suspectLocation]) {
      points.push(nodeCoordinates[step.suspectLocation]);
    }
  }

  if (points.length === 0) return null;
  const currentPos = points[points.length - 1];

  return (
    <g>
      {points.length > 1 && (
        <polyline 
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#a855f7"
          strokeWidth="3"
          strokeDasharray="6,6"
        />
      )}
      <g transform={`translate(${currentPos.x}, ${currentPos.y})`}>
        <circle r="20" fill="none" stroke="#a855f7" strokeWidth="2" className="animate-ping" />
        <circle r="8" fill="#a855f7" />
      </g>
    </g>
  );
};

export const GodModePanel = ({ replayPlan, replayTurn, setReplayTurn }) => {
  if (!replayPlan || !replayPlan.primaryPlan) return null;
  const maxTurns = replayPlan.primaryPlan.length;

  return (
    <div className="god-mode-panel">
      <div className="god-mode-header">
        <Sliders size={20} />
        <h3>GOD MODE REPLAY ACTIVE</h3>
      </div>
      <p>Analyze suspect movement through the timeline</p>
      <div className="god-mode-controls">
        <input 
          type="range" 
          min="1" 
          max={maxTurns} 
          value={replayTurn} 
          onChange={(e) => setReplayTurn(parseInt(e.target.value, 10))} 
        />
        <span>TURN {replayTurn} / {maxTurns}</span>
      </div>
    </div>
  );
};

export default GodModePanel;
