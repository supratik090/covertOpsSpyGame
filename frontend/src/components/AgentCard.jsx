import React from 'react';
import { motion } from 'framer-motion';

export default function AgentCard({ 
  agent, 
  isSelected, 
  onSelect, 
  onAssignTask, 
  onTrain,
  onRelocate,
  nodesData = [],
  localAgentMoves = {},
  localAgentTasks = {}
}) {
  const effectiveTask = localAgentTasks[agent.id] || agent.activeTask;
  const isIdle = !effectiveTask || effectiveTask === 'NONE' || effectiveTask === '';

  const skills = [
    { id: 'humint', label: 'HUMINT', value: agent.skills.humint },
    { id: 'sigint', label: 'SIGINT', value: agent.skills.sigint },
    { id: 'infiltration', label: 'INFILTRATION', value: agent.skills.infiltration },
    { id: 'survivability', label: 'SURVIVABILITY', value: agent.skills.survivability }
  ];

  const tasks = ['FIND_SUSPECT', 'MONITOR_FINANCE', 'MONITOR_LOGISTICS', 'UNCOVER_SAFEHOUSE'];

  // Build allConnections dynamically from scenario nodesData
  const allConnections = nodesData.map(node => ({
    from: node.id,
    to: node.connections || []
  }));

  const currentConnections = allConnections.find(c => c.from === agent.currentCity)?.to || [];
  const isMoved = localAgentMoves[agent.id] !== undefined;

  return (
    <div className={`card ${isSelected ? 'selected' : ''} ${isMoved ? 'moved-locked' : ''}`} onClick={onSelect}>
      <div className="card-header">
        <span className="cyan">AGENT: {agent.codename}</span>
      </div>
      <div className="card-meta">
        <span>CITY: {isMoved ? `IN TRANSIT -> ${localAgentMoves[agent.id].toUpperCase()}` : agent.currentCity.toUpperCase()}</span> | <span>TASK: {isMoved ? 'TRANSIT' : (
          isIdle ? <span className="text-amber blink">⚠ NO TASK ASSIGNED</span> : (effectiveTask === 'FIND_SUSPECT' ? 'GATHER INTELLIGENCE' : effectiveTask.replace(/_/g, ' '))
        )}</span>
      </div>
      {agent.cooldownRemaining > 0 && (
        <div className="cooldown-badge">COOLDOWN: {agent.cooldownRemaining}</div>
      )}
      
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

      {isSelected && !isMoved && (
        <motion.div 
          className="card-expand"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <div className="task-section">
            <h4 className="cyan">SPY DISPATCH CONSOLE</h4>
            <p>Assign a field task</p>
            <div className="task-grid">
              {tasks.map(task => {
                let label = '';
                if (task === 'FIND_SUSPECT') label = ' Gather Intelligence ';
                else if (task === 'MONITOR_FINANCE') label = ' Investigate Finance ';
                else if (task === 'MONITOR_LOGISTICS') label = ' Investigate Logistics ';
                else if (task === 'UNCOVER_SAFEHOUSE') label = ' Uncover Safehouse ';

                return (
                  <button 
                    key={task}
                    className={`task-btn ${effectiveTask === task ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onAssignTask(agent.id, task); }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {agent.cooldownRemaining === 0 && (
            <div className="task-section mt-3">
              <h4 className="cyan">MOVE TO CONNECTING CENTER</h4>
              <p>Relocate agent along border transit nodes</p>
              <div className="dispatch-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {currentConnections.length === 0 ? (
                  <span className="text-[10px] text-dim font-mono">NO CONNECTING NODE PATHS</span>
                ) : (
                  currentConnections.map(connId => (
                    <button
                      key={connId}
                      className="cyber-btn sm"
                      onClick={(e) => { e.stopPropagation(); onRelocate(agent.id, connId); }}
                    >
                      {connId.toUpperCase()}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          
          <div className="train-section">
            <h4>Train Skill ($50,000)</h4>
            <div className="train-grid">
              {skills.map(skill => (
                <button 
                  key={skill.id}
                  className="cyber-btn sm"
                  onClick={(e) => { e.stopPropagation(); onTrain(agent.id, skill.id); }}
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
