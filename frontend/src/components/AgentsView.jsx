import React from 'react';
import { Users, Target, Radio } from 'lucide-react';
import AgentCard from './AgentCard';
import TeamCard from './TeamCard';
import DroneCard from './DroneCard';

export default function AgentsView({
  session,
  selectedAgent,
  setSelectedAgent,
  selectedTeam,
  setSelectedTeam,
  setSelectedCityNode,
  setActiveTab,
  lostAgentsList = [],
  nodesData = []
}) {
  const handleAgentSelect = (agent) => {
    setSelectedAgent(agent);
    setSelectedTeam(null);
    setSelectedCityNode(agent.currentCity);
    setActiveTab?.('MAP');
  };

  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    setSelectedAgent(null);
    setSelectedCityNode(team.currentCity);
    setActiveTab?.('MAP');
  };

  const handleDroneSelect = (drone) => {
    if (drone.currentCity) {
      setSelectedCityNode(drone.currentCity);
      setActiveTab?.('MAP');
    }
  };

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
              onNavigate={() => handleAgentSelect(agent)}
              safehouses={session.safehouses || []}
            />
          ))}
          {lostAgentsList.map(agent => (
            <AgentCard
              key={`lost-${agent.id}`}
              agent={agent}
              isLost
              safehouses={session.safehouses || []}
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
              onNavigate={() => handleTeamSelect(team)}
            />
          ))}
        </div>
      </div>

      <div className="agents-column">
        <div className="column-header">
          <Radio className="icon cyan" />
          <h2 className="cyan">DRONE AVIATION FORCE</h2>
        </div>
        <div className="column-content">
          {(!session.drones || session.drones.length === 0) ? (
            <div className="text-dim font-mono text-[11px] p-4 text-center">
              NO DRONE ASSETS PROCURED
            </div>
          ) : (
            session.drones.map(drone => (
              <DroneCard
                key={drone.id}
                drone={drone}
                session={session}
                onNavigate={() => handleDroneSelect(drone)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
