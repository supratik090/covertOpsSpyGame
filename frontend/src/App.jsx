import React, { useState, useEffect } from 'react';
import VerticalTabBar from './components/VerticalTabBar';
import StatusBar from './components/StatusBar';
import LoginScreen from './components/LoginScreen';
import ScenarioSelect from './components/ScenarioSelect';
import MapView from './components/MapView';
import AgentsView from './components/AgentsView';
import CluesView from './components/CluesView';
import DossierView from './components/DossierView';
import GodModeView from './components/GodModeView';
import ResourcesView from './components/ResourcesView';
import ObjectiveBoardView from './components/ObjectiveBoardView';
import Toast from './components/Toast';
import EndTurnReportModal from './components/EndTurnReportModal';
import GameOverModal from './components/GameOverModal';
import { GAME_API_BASE } from './config';

export default function App() {
  const [screen, setScreen] = useState('LOGIN'); // 'LOGIN', 'SELECT', 'GAME'
  const [activeTab, setActiveTab] = useState('MAP'); // 'MAP', 'AGENTS', 'CLUES', 'RESOURCES'
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toasts, setToasts] = useState([]);

  // Selections
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedCityNode, setSelectedCityNode] = useState(null);
  
  // Planned actions & Assessments
  const [covertActions, setCovertActions] = useState([]);
  const [localAssessments, setLocalAssessments] = useState({});

  // Buffered mid-turn actions (sent with EndTurnRequest)
  const [localAgentTasks, setLocalAgentTasks] = useState({});      // agentId -> task
  const [localSafehouseBuilds, setLocalSafehouseBuilds] = useState([]); // [cityNode, ...]
  const [localTechDeploys, setLocalTechDeploys] = useState([]);     // [{type, cityNode}, ...]

  // God Mode Replay
  const [replayPlan, setReplayPlan] = useState(null);
  const [replayTurn, setReplayTurn] = useState(1);
  const [showGodMode, setShowGodMode] = useState(false);
  const [endTurnReport, setEndTurnReport] = useState(null);
  const [showGameOver, setShowGameOver] = useState(false);

  // Lost agents accumulated across turns (render in AgentsView instead of disappearing)
  const [lostAgentsList, setLostAgentsList] = useState([]);

  // Load scenarios on mount or success
  const fetchScenarios = async () => {
    try {
      const res = await fetch(`${GAME_API_BASE}/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data);
        if (data.length > 0) {
          setSelectedScenarioId(data[0].scenarioId);
        }
      }
    } catch (err) {
      console.error("Failed to load scenario list", err);
      addToast("Failed to fetch scenarios from database.", "error");
    }
  };

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Start new game
  const handleStartNewGame = async () => {
    if (!selectedScenarioId) {
      addToast("Please select a scenario config.", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${GAME_API_BASE}/create?scenarioId=${selectedScenarioId}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to create new game session.');
      const data = await res.json();
      setSession(data);
      localStorage.setItem('spy_game_session_id', data.id);
      setLocalAssessments({});
      setCovertActions([]);
      setLocalAgentTasks({});
      setLocalSafehouseBuilds([]);
      setLocalTechDeploys([]);
      setLostAgentsList([]);
      setActiveTab('OBJECTIVES');
      setScreen('GAME');
      setShowGodMode(false);
      setReplayPlan(null);
      fetchReplayData(data.id, true);
      addToast("Operation initiated successfully.", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Continue existing game
  const handleContinueGame = async () => {
    const savedId = localStorage.getItem('spy_game_session_id');
    if (!savedId) {
      addToast("No active local campaign feed found. Start a new operation.", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${GAME_API_BASE}/${savedId}`);
      if (!res.ok) throw new Error('Save feed no longer active on backend.');
      const data = await res.json();
      setSession(data);
      const loadedAssessments = {};
      data.discoveredClues.forEach((c, idx) => {
        loadedAssessments[idx] = c.assessment || 'UNASSESSED';
      });
      setLocalAssessments(loadedAssessments);
      setCovertActions([]);
      setLocalAgentTasks({});
      setLocalSafehouseBuilds([]);
      setLocalTechDeploys([]);
      setLostAgentsList([]);
      setActiveTab('MAP');
      setScreen('GAME');
      setShowGodMode(false);
      setReplayPlan(null);
      fetchReplayData(data.id, true);
      addToast("Campaign feed reconnected.", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Assign agent task (buffered locally)
  const handleAssignAgentTask = (agentId, task) => {
    if (!session) return;
    const agent = session.agents.find(a => a.id === agentId);
    if (!agent) return;
    setLocalAgentTasks(prev => ({ ...prev, [agentId]: task }));
    addToast(`${agent.codename} directive queued: ${task.replace(/_/g, ' ')}`, "success");
  };

  // Local states to buffer agent and team relocation choices during the turn
  const [localAgentMoves, setLocalAgentMoves] = useState({}); // maps agentId -> targetCity
  const [localTeamMoves, setLocalTeamMoves] = useState({});   // maps teamId -> targetCity

  // Relocate agent locally
  const handleRelocateAgent = (agentId, targetCity) => {
    if (!session) return;
    
    // Check if agent is currently locked out by cooldown/training
    const agent = session.agents.find(a => a.id === agentId);
    if (!agent) return;
    if (agent.cooldownRemaining > 0) {
      addToast(`${agent.codename} is currently locked out by cooldown.`, "error");
      return;
    }

    // Enforce 1-move-per-turn limit
    if (localAgentMoves[agentId]) {
      addToast(`${agent.codename} has already relocated this turn.`, "error");
      return;
    }

    // Check safehouse rule locally
    const targetHasSafehouse = session.safehouses.some(s => s.cityNode === targetCity && s.ownerFaction === 'DEFENDER');
    if (!targetHasSafehouse) {
      addToast(`Cannot relocate agent to ${targetCity.toUpperCase()}: No active friendly safehouse.`, "error");
      return;
    }

    // Set move locally
    setLocalAgentMoves(prev => ({ ...prev, [agentId]: targetCity }));
    setSelectedAgent(null);
    addToast(`${agent.codename} queued for relocation to ${targetCity.toUpperCase()}`, "success");
  };

  // Relocate tactical team locally
  const handleRelocateTacticalTeam = (teamId, targetCity) => {
    if (!session) return;

    const team = session.tacticalTeams.find(t => t.id === teamId);
    if (!team) return;
    if (team.cooldownRemaining > 0) {
      addToast(`${team.name} is currently locked out by cooldown.`, "error");
      return;
    }

    if (localTeamMoves[teamId]) {
      addToast(`${team.name} has already relocated this turn.`, "error");
      return;
    }

    const targetHasSafehouse = session.safehouses.some(s => s.cityNode === targetCity && s.ownerFaction === 'DEFENDER');
    if (!targetHasSafehouse) {
      addToast(`Cannot relocate combat force to ${targetCity.toUpperCase()}: No active friendly safehouse.`, "error");
      return;
    }

    setLocalTeamMoves(prev => ({ ...prev, [teamId]: targetCity }));
    addToast(`${team.name} queued for relocation to ${targetCity.toUpperCase()}`, "success");
  };

  // Build safehouse (buffered locally)
  const handleBuildSafehouse = (cityNode) => {
    if (!session) return;
    if (localSafehouseBuilds.includes(cityNode)) {
      setLocalSafehouseBuilds(prev => prev.filter(c => c !== cityNode));
      addToast(`Safehouse construction cancelled for ${cityNode.toUpperCase()}`, "info");
    } else {
      setLocalSafehouseBuilds(prev => [...prev, cityNode]);
      addToast(`Safehouse construction queued in ${cityNode.toUpperCase()}`, "success");
    }
  };

  // Deploy tech resource (buffered locally)
  const handleDeployTech = (type, cityNode) => {
    if (!session) return;
    setLocalTechDeploys(prev => {
      const exists = prev.some(d => d.type === type && d.cityNode === cityNode);
      if (exists) {
        addToast(`${type.replace(/_/g, ' ')} deployment cancelled.`, "info");
        return prev.filter(d => !(d.type === type && d.cityNode === cityNode));
      } else {
        addToast(`${type.replace(/_/g, ' ')} deployment queued for ${cityNode.toUpperCase()}`, "success");
        return [...prev, { type, cityNode }];
      }
    });
  };

  // Covert Actions Planner
  const toggleCovertAction = (actionType, cityNode, teamId, targetSafehouseCode = "") => {
    const existingIdx = covertActions.findIndex(a => a.teamId === teamId);
    let newActions = [...covertActions];
    if (existingIdx >= 0) {
      if (newActions[existingIdx].actionType === actionType && newActions[existingIdx].targetSafehouseCode === targetSafehouseCode) {
        // Deselect if clicked the same active action
        newActions.splice(existingIdx, 1);
        addToast("Tactical order revoked.", "info");
      } else {
        // Replace with new action
        newActions[existingIdx] = { actionType, cityNode, teamId, targetSafehouseCode };
        addToast(`Tactical order revised: ${actionType.replace('_', ' ')}`, "info");
      }
    } else {
      newActions.push({ actionType, cityNode, teamId, targetSafehouseCode });
      addToast(`Tactical order queued: ${actionType.replace('_', ' ')}`, "success");
    }
    setCovertActions(newActions);
  };

  // Clue Assessment Toggle
  const setClueAssessment = (clueIdx, status) => {
    setLocalAssessments((prev) => {
      const updated = { ...prev, [clueIdx]: status };
      addToast(`Clue assessment marked as: ${status}`, "info");
      return updated;
    });
  };

  // End turn - submit actions, assessments, agent relocations, and team relocations
  const handleEndTurn = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const prevFinance = session.uncoveredFinanceCities || [];
      const prevLogistics = session.uncoveredLogisticsCities || [];
      const prevSafehouses = session.safehouses || [];
      const prevTech = session.espionageResources || [];
      const prevAgents = session.agents || [];
      const prevTeams = session.tacticalTeams || [];
      const prevClueCount = (session.discoveredClues || []).length;

      const payload = {
        covertActions: covertActions,
        clueAssessments: localAssessments,
        agentRelocations: localAgentMoves,
        teamRelocations: localTeamMoves,
        agentTasks: localAgentTasks,
        safehouseBuilds: localSafehouseBuilds,
        techDeployments: localTechDeploys
      };

      const res = await fetch(`${GAME_API_BASE}/${session.id}/end-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Turn resolution rejected by security cluster.');
      const updated = await res.json();
      
      const newFinance = (updated.uncoveredFinanceCities || []).filter(c => !prevFinance.includes(c));
      const newLogistics = (updated.uncoveredLogisticsCities || []).filter(c => !prevLogistics.includes(c));
      const newSafehouses = (updated.safehouses || []).filter(s => !prevSafehouses.some(ps => ps.cityNode === s.cityNode && ps.ownerFaction === s.ownerFaction));
      const newTech = (updated.espionageResources || []).filter(r => !prevTech.some(pr => pr.type === r.type && pr.cityNode === r.cityNode));

      const lostAgents = prevAgents.filter(a => !updated.agents.some(ua => ua.id === a.id));
      const lostTeams = prevTeams.filter(t => !updated.tacticalTeams.some(ut => ut.id === t.id));
      const prevDefenderSH = prevSafehouses.filter(s => s.ownerFaction === 'DEFENDER');
      const updatedDefenderSH = (updated.safehouses || []).filter(s => s.ownerFaction === 'DEFENDER');
      const lostSafehouses = prevDefenderSH.filter(s => !updatedDefenderSH.some(us => us.cityNode === s.cityNode));

      const newExposedHostileSH = (updated.safehouses || []).filter(s =>
        s.ownerFaction === 'HOSTILE' && s.uncovered &&
        !prevSafehouses.some(ps => ps.cityNode === s.cityNode && ps.ownerFaction === 'HOSTILE' && ps.uncovered)
      );

      const newClues = (updated.discoveredClues || []).slice(prevClueCount);
      const sweepAlertClues = newClues.filter(c => c.source === 'SECURITY_SWEEP_ALERT');
      const sweepLossClues = newClues.filter(c => c.source === 'SECURITY_SWEEP_LOSS');

      if (newFinance.length > 0 || newLogistics.length > 0 || newSafehouses.length > 0 || newTech.length > 0 || lostAgents.length > 0 || lostTeams.length > 0 || lostSafehouses.length > 0 || newExposedHostileSH.length > 0 || sweepAlertClues.length > 0 || sweepLossClues.length > 0) {
        setEndTurnReport({
          newFinance,
          newLogistics,
          newSafehouses,
          newTech,
          lostAgents,
          lostTeams,
          lostSafehouses,
          newExposedHostileSH,
          sweepAlerts: sweepAlertClues,
          sweepLosses: sweepLossClues
        });
      }

      setSession(updated);
      setCovertActions([]);
      setLocalAgentMoves({});
      setLocalTeamMoves({});
      setLocalAgentTasks({});
      setLocalSafehouseBuilds([]);
      setLocalTechDeploys([]);
      setLostAgentsList(prev => [...prev, ...lostAgents]);
      
      const nextAssessments = {};
      updated.discoveredClues.forEach((c, idx) => {
        nextAssessments[idx] = c.assessment || 'UNASSESSED';
      });
      setLocalAssessments(nextAssessments);
      setSelectedAgent(null);
      setSelectedTeam(null);
      setSelectedCityNode(null);

      addToast(`Turn resolved. Round ${updated.currentTurn} active.`, "success");

      if (updated.status !== 'ACTIVE') {
        addToast(`Operation terminated: Status ${updated.status}`, updated.status === 'SUCCESS' ? 'success' : 'error');
        fetchReplayData(updated.id);
        // Show grand game-over modal after a brief delay
        setTimeout(() => setShowGameOver(true), 800);
      }
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Replay data fetch
  const fetchReplayData = async (gameId, silent = false) => {
    try {
      const res = await fetch(`${GAME_API_BASE}/${gameId}/replay`);
      if (res.ok) {
        const data = await res.json();
        setReplayPlan(data);
        if (!silent) {
          setShowGodMode(true);
          setActiveTab('MAP');
          addToast("God Mode decrypted. Replay timeline loaded.", "success");
        }
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        addToast("Failed to fetch campaign replay telemetry.", "error");
      }
    }
  };

  const handleExit = () => {
    setSession(null);
    setScreen('SELECT');
    setShowGodMode(false);
    setReplayPlan(null);
    setSelectedAgent(null);
    setSelectedTeam(null);
    setSelectedCityNode(null);
  };

  const onLoginSuccess = () => {
    fetchScenarios();
    setScreen('SELECT');
  };

  const activeScenario = scenarios.find(s => s.scenarioId === session?.scenarioId);

  const unassessedCluesCount = session
    ? session.discoveredClues.filter((clue, idx) => {
        return (localAssessments[idx] || 'UNASSESSED') === 'UNASSESSED';
      }).length
    : 0;

  const acceptedCluesCount = session
    ? session.discoveredClues.filter((clue, idx) => {
        return (localAssessments[idx] || 'UNASSESSED') === 'ACCEPT';
      }).length
    : 0;

  return (
    <div className={`app-layout ${screen !== 'GAME' ? 'no-sidebar' : ''}`}>
      <div className="crt-overlay"></div>
      <Toast toasts={toasts} removeToast={removeToast} />

      {screen === 'LOGIN' && (
        <LoginScreen onLoginSuccess={onLoginSuccess} />
      )}

      {screen === 'SELECT' && (
        <ScenarioSelect
          scenarios={scenarios}
          selectedScenarioId={selectedScenarioId}
          setSelectedScenarioId={setSelectedScenarioId}
          onStartNewGame={handleStartNewGame}
          onContinueGame={handleContinueGame}
          loading={loading}
          errorMsg={errorMsg}
        />
      )}

      {screen === 'GAME' && session && (
        <>
          <VerticalTabBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            clueCount={unassessedCluesCount}
            acceptedCount={acceptedCluesCount}
            actionCount={covertActions.length}
          />

          <main className="tab-content">
            {activeTab === 'OBJECTIVES' && (
              <ObjectiveBoardView
                session={session}
                activeScenario={activeScenario}
                onClose={() => setActiveTab('MAP')}
              />
            )}

            {activeTab === 'MAP' && (
              <MapView
                session={session}
                activeScenario={activeScenario}
                selectedAgent={selectedAgent}
                selectedTeam={selectedTeam}
                selectedCityNode={selectedCityNode}
                setSelectedCityNode={setSelectedCityNode}
                onRelocateAgent={handleRelocateAgent}
                onRelocateTacticalTeam={handleRelocateTacticalTeam}
                localAgentMoves={localAgentMoves}
                localTeamMoves={localTeamMoves}
                localAgentTasks={localAgentTasks}
                onBuildSafehouse={handleBuildSafehouse}
                onDeployTech={handleDeployTech}
                onAssignAgentTask={handleAssignAgentTask}
                showGodMode={showGodMode}
                replayPlan={replayPlan}
                replayTurn={replayTurn}
                covertActions={covertActions}
                onToggleCovertAction={toggleCovertAction}
                localTechDeploys={localTechDeploys}
                localSafehouseBuilds={localSafehouseBuilds}
                addToast={addToast}
              />
            )}

            {activeTab === 'AGENTS' && (
              <AgentsView
                session={session}
                selectedAgent={selectedAgent}
                setSelectedAgent={setSelectedAgent}
                selectedTeam={selectedTeam}
                setSelectedTeam={setSelectedTeam}
                setSelectedCityNode={setSelectedCityNode}
                setActiveTab={setActiveTab}
                lostAgentsList={lostAgentsList}
                nodesData={activeScenario?.nodes || []}
              />
            )}

            {activeTab === 'CLUES' && (
              <CluesView
                session={session}
                localAssessments={localAssessments}
                onSetClueAssessment={setClueAssessment}
              />
            )}

            {activeTab === 'DOSSIER' && (
              <DossierView
                session={session}
                localAssessments={localAssessments}
                onSetClueAssessment={setClueAssessment}
              />
            )}

            {activeTab === 'RESOURCES' && (
              <ResourcesView
                session={session}
                nodes={activeScenario?.nodes || []}
                onBuildSafehouse={handleBuildSafehouse}
                onDeployTech={handleDeployTech}
                addToast={addToast}
              />
            )}

            {activeTab === 'GOD_MODE' && (
              <GodModeView
                replayPlan={replayPlan}
                replayTurn={replayTurn}
                setReplayTurn={setReplayTurn}
                showGodMode={showGodMode}
                setShowGodMode={setShowGodMode}
                session={session}
              />
            )}
          </main>

          <StatusBar
            session={session}
            covertActions={covertActions}
            onEndTurn={handleEndTurn}
            loading={loading}
            onExit={handleExit}
          />
        </>
      )}
      {endTurnReport && (
        <EndTurnReportModal
          report={endTurnReport}
          onClose={() => setEndTurnReport(null)}
        />
      )}

      {/* Grand Game-Over Modal */}
      {showGameOver && session && (
        <GameOverModal
          session={session}
          replayPlan={replayPlan}
          onConfirm={() => {
            setShowGameOver(false);
            handleExit();
            fetchScenarios();
          }}
        />
      )}
    </div>
  );
}
