import React from 'react';

export default function AgentCard({
  agent,
  isSelected,
  onNavigate,
  isLost
}) {
  const skills = [
    { id: 'humint', label: 'HUMINT', value: agent.skills.humint },
    { id: 'sigint', label: 'SIGINT', value: agent.skills.sigint },
    { id: 'infiltration', label: 'INFILTRATION', value: agent.skills.infiltration },
    { id: 'survivability', label: 'SURVIVABILITY', value: agent.skills.survivability }
  ];

  return (
    <div
      className={`card ${isSelected ? 'selected' : ''} ${isLost ? 'lost' : ''}`}
      onClick={isLost ? undefined : onNavigate}
      style={isLost ? { cursor: 'default', opacity: 0.6 } : { cursor: 'pointer' }}
    >
      <div className="card-header">
        <span className={isLost ? 'text-threat' : 'cyan'}>
          {isLost ? 'AGENT: ' + agent.codename + ' — LOST/CAPTURED' : 'AGENT: ' + agent.codename}
        </span>
      </div>
      <div className="card-meta">
        <span>CITY: {agent.currentCity.toUpperCase()}</span>
        {!isLost && agent.cooldownRemaining > 0 && (
          <span className="cooldown-badge">COOLDOWN: {agent.cooldownRemaining}</span>
        )}
      </div>

      {!isLost && (
        <div className="skills-grid">
          {skills.map(skill => (
            <div key={skill.id} className="skill-row">
              <span className="skill-label">{skill.label}</span>
              <div className="skill-track">
                <div className="skill-fill" style={{ width: `${skill.value}%` }} />
              </div>
              <span className="skill-value">{skill.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
