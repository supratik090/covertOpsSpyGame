import React from 'react';
import { motion } from 'framer-motion';

export default function TeamCard({ 
  team, 
  isSelected, 
  onSelect, 
  covertActions, 
  onToggleCovertAction, 
  onTrain,
  nodesData = []
}) {
  const skills = [
    { id: 'combat', label: 'COMBAT', value: team.skills.combat },
    { id: 'stealth', label: 'STEALTH', value: team.skills.stealth },
    { id: 'mobility', label: 'MOBILITY', value: team.skills.mobility }
  ];

  // Build allConnections dynamically from scenario nodesData
  const allConnections = nodesData.map(node => ({
    from: node.id,
    to: node.connections || []
  }));
  const currentConnections = allConnections.find(c => c.from === team.currentCity)?.to || [];
  // isFriendly: derive from scenario territory instead of hardcoded city list
  const currentTeamNode = nodesData.find(n => n.id === team.currentCity);
  const isFriendly = currentTeamNode ? currentTeamNode.territory === 'HOME_TERRITORY' : false;
  const hasHostileConnection = currentConnections.some(connId => {
    const connNode = nodesData.find(n => n.id === connId);
    return connNode ? connNode.territory === 'HOSTILE_TERRITORY' : false;
  });
  const isFriendlyBorder = isFriendly && hasHostileConnection;

  const actions = ['FREEZE_FINANCE', 'RAID_LOGISTICS', 'RAID_SAFEHOUSE'];
  if (isFriendly) {
    actions.push('TRANSIT_CHECKPOINT');
    actions.push('CITY_GRID_LOCKDOWN');
    if (isFriendlyBorder) {
      actions.push('STOP_INFILTRATION');
      actions.push('STOP_EXFILTRATION');
    }
  }

  const isActiveAction = (action) => {
    return covertActions.some(ca => ca.actionType === action && ca.teamId === team.id && ca.cityNode === team.currentCity);
  };

  return (
    <div className={`card ${isSelected ? 'selected-red' : ''}`} onClick={onSelect}>
      <div className="card-header">
        <span className="red">{team.name} [{team.operatingCountry}]</span>
      </div>
      <div className="card-meta">
        <span>STATION: {team.currentCity.toUpperCase()}</span> | <span>COMBAT: {team.skills.combat}</span>
      </div>
      {team.cooldownRemaining > 0 && (
        <div className="cooldown-badge">COOLDOWN: {team.cooldownRemaining}</div>
      )}
      
      <div className="skills-grid">
        {skills.map(skill => (
          <div key={skill.id} className="skill-row">
            <span className="skill-label">{skill.label}</span>
            <div className="skill-track">
              <div className="skill-fill red" style={{ width: `${skill.value}%` }} />
            </div>
            <span className="skill-value">{skill.value}</span>
          </div>
        ))}
      </div>

      {isSelected && (
        <motion.div 
          className="card-expand"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <div className="task-section">
            <h4 className="red">COVERT ACTION PLANNER</h4>
            <p>Plan a threat disruption operation</p>
            <div className="task-grid">
              {actions.map(action => (
                <button 
                  key={action}
                  disabled={team.cooldownRemaining > 0}
                  className={`task-btn ${isActiveAction(action) ? 'active-red' : ''}`}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (team.cooldownRemaining === 0) {
                      onToggleCovertAction(action, team.currentCity, team.id); 
                    }
                  }}
                >
                  {action.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          
          <div className="train-section">
            <h4>Train Skill ($100,000)</h4>
            <div className="train-grid cols-3">
              {skills.map(skill => (
                <button 
                  key={skill.id}
                  className="cyber-btn sm"
                  onClick={(e) => { e.stopPropagation(); onTrain(team.id, skill.id); }}
                >
                  {skill.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
