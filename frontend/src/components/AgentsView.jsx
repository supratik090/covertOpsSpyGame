import React from 'react';
import { Users, Target } from 'lucide-react';
import AgentCard from './AgentCard';
import TeamCard from './TeamCard';

export default function AgentsView({
  session,
  selectedAgent,
  setSelectedAgent,
  selectedTeam,
  setSelectedTeam,
  onAssignAgentTask,
  onTrainAgent,
  onTrainTeam,
  covertActions,
  onToggleCovertAction,
  onRelocateAgent,
  localAgentMoves,
  localAgentTasks = {},
  nodesData = []
}) {
  return (
    <div className="agents-view">
      <div className="agents-column">
        <div className="column-header">
          <Users className="icon cyan" />
          <h2 className="cyan">FIELD AGENTS</h2>
        </div>
        <div className="column-content">
          {session.agents.map(agent => (
            <AgentCard 
              key={agent.id}
              agent={agent}
              isSelected={selectedAgent?.id === agent.id}
              onSelect={() => {
                setSelectedAgent(agent);
                setSelectedTeam(null);
              }}
              onAssignTask={onAssignAgentTask}
              onTrain={onTrainAgent}
              onRelocate={onRelocateAgent}
              nodesData={nodesData}
              localAgentMoves={localAgentMoves}
              localAgentTasks={localAgentTasks}
            />
          ))}
        </div>
      </div>
      
      <div className="agents-column">
        <div className="column-header">
          <Target className="icon red" />
          <h2 className="red">TACTICAL TEAMS</h2>
        </div>
        <div className="column-content">
          {session.tacticalTeams.map(team => (
            <TeamCard 
              key={team.id}
              team={team}
              isSelected={selectedTeam?.id === team.id}
              onSelect={() => {
                setSelectedTeam(team);
                setSelectedAgent(null);
              }}
              covertActions={covertActions}
              onToggleCovertAction={onToggleCovertAction}
              onTrain={onTrainTeam}
              nodesData={nodesData}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
