import React from 'react';

export default function TeamCard({
  team,
  isSelected,
  onNavigate,
  nodesData = []
}) {
  const skills = [
    { id: 'combat', label: 'COMBAT', value: team.skills.combat },
    { id: 'stealth', label: 'STEALTH', value: team.skills.stealth },
    { id: 'mobility', label: 'MOBILITY', value: team.skills.mobility }
  ];

  return (
    <div
      className={`card ${isSelected ? 'selected-red' : ''}`}
      onClick={onNavigate}
      style={{ cursor: 'pointer' }}
    >
      <div className="card-header">
        <span className="red">{team.name} [{team.operatingCountry}]</span>
      </div>
      <div className="card-meta">
        <span>STATION: {team.currentCity.toUpperCase()}</span>
        <span> | COMBAT: {team.skills.combat}</span>
        {team.cooldownRemaining > 0 && (
          <span className="cooldown-badge">COOLDOWN: {team.cooldownRemaining}</span>
        )}
      </div>

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
    </div>
  );
}
