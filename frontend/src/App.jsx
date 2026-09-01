import React, { useState, useEffect } from 'react';
import VerticalTabBar from './components/VerticalTabBar';
import StatusBar from './components/StatusBar';
import HomeScreen from './components/HomeScreen';
import LoginScreen from './components/LoginScreen';
import ScenarioSelect from './components/ScenarioSelect';
import MapView from './components/MapView';
import AgentsView from './components/AgentsView';
import CluesView from './components/CluesView';
import DossierView from './components/DossierView';
import GodModeView from './components/GodModeView';
import ObjectiveBoardView from './components/ObjectiveBoardView';
import HintsView from './components/HintsView';
import CellHqView from './components/CellHqView';
import Toast from './components/Toast';
import EndTurnReportModal from './components/EndTurnReportModal';
import GameOverModal from './components/GameOverModal';
import { GAME_API_BASE } from './config';
import { fetchWithRetry } from './utils/api';
import RetrySpinner from './components/RetrySpinner';
import DeploymentScreen from './components/DeploymentScreen';


const getInitialTab = () =>
  typeof window !== 'undefined' && window.innerWidth <= 768 ? 'TACTICAL' : 'MAP';

const getDefaultMapTab = () =>
  typeof window !== 'undefined' && window.innerWidth <= 768 ? 'TACTICAL' : 'MAP';

export default function App() {
  // Check if user is already authenticated; skip HOME if so
  const isAlreadyAuthed = typeof window !== 'undefined' && !!localStorage.getItem('spy_game_token');
  const [screen, setScreen] = useState(isAlreadyAuthed ? 'SELECT' : 'HOME'); // 'HOME', 'LOGIN', 'SELECT', 'GAME'
  const [activeTab, setActiveTab] = useState('MAP'); // 'MAP', 'AGENTS', 'CLUES', 'RESOURCES'
  const [scenarios, setScenarios] = useState([]);
  const [sessions, setSessions] = useState([]);
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
  const [localDroneBaseBuilds, setLocalDroneBaseBuilds] = useState([]); // [cityNode, ...]
  const [localDroneDeployments, setLocalDroneDeployments] = useState({}); // droneId -> target base city
  const [localDroneOperations, setLocalDroneOperations] = useState([]); // [{droneId, actionType, targetCity}, ...]
  const [localDronesToBuy, setLocalDronesToBuy] = useState([]); // [{cityNode, type}, ...]

  // Attacker-specific buffered turn actions
  const [localSuspectMove, setLocalSuspectMove] = useState('');
  const [localTargetSafehouseCode, setLocalTargetSafehouseCode] = useState('');
  const [localBuiltSafehouses, setLocalBuiltSafehouses] = useState([]);
  const [localBuiltSecureSafehouses, setLocalBuiltSecureSafehouses] = useState([]);
  const [localDecoyDeployments, setLocalDecoyDeployments] = useState([]);
  const [localActiveJammerTarget, setLocalActiveJammerTarget] = useState('');
  const [localSeekPermissionType, setLocalSeekPermissionType] = useState('');
  const [localTriggerStrike, setLocalTriggerStrike] = useState(false);
  const [localTriggerExfiltration, setLocalTriggerExfiltration] = useState(false);

  const [localRequestFinance, setLocalRequestFinance] = useState(false);
  const [localCollectFinance, setLocalCollectFinance] = useState(false);
  const [localRequestLogistics, setLocalRequestLogistics] = useState(false);
  const [localCollectLogistics, setLocalCollectLogistics] = useState(false);
  const [localBeginHandover, setLocalBeginHandover] = useState(false);

  // Helper to reset all local turn states (covert actions, moves, builds, drone purchases, etc.)
  const resetTurnStates = () => {
    setCovertActions([]);
    setLocalAgentMoves({});
    setLocalTeamMoves({});
    setLocalAgentTasks({});
    setLocalSafehouseBuilds([]);
    setLocalTechDeploys([]);
    setLocalDroneBaseBuilds([]);
    setLocalDroneDeployments({});
    setLocalDroneOperations([]);
    setLocalDronesToBuy([]);
    setLocalServicedDrones([]);

    // Reset Attacker states
    setLocalSuspectMove('');
    setLocalTargetSafehouseCode('');
    setLocalBuiltSafehouses([]);
    setLocalBuiltSecureSafehouses([]);
    setLocalDecoyDeployments([]);
    setLocalActiveJammerTarget('');
    setLocalSeekPermissionType('');
    setLocalTriggerStrike(false);
    setLocalTriggerExfiltration(false);
    setLocalRequestFinance(false);
    setLocalCollectFinance(false);
    setLocalRequestLogistics(false);
    setLocalCollectLogistics(false);
    setLocalBeginHandover(false);
  };

  // God Mode Replay
  const [replayPlan, setReplayPlan] = useState(null);
  const [replayTurn, setReplayTurn] = useState(1);
  const [showGodMode, setShowGodMode] = useState(false);
  const [endTurnReport, setEndTurnReport] = useState(null);
  const [pendingEndTurnReport, setPendingEndTurnReport] = useState(null);
  const [showGameOver, setShowGameOver] = useState(false);

  // Lost agents accumulated across turns (render in AgentsView instead of disappearing)
  const [lostAgentsList, setLostAgentsList] = useState([]);

  // Retry spinner state
  const [retryState, setRetryState] = useState(null);
  const [countdownText, setCountdownText] = useState('');

  // Load scenarios on mount or success
  const fetchScenarios = async () => {
    try {
      const res = await fetchWithRetry(`${GAME_API_BASE}/scenarios`, {}, (a, m) => setRetryState({ attempt: a, max: m }));
      setRetryState(null);
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

  const fetchSessions = async () => {
    try {
      const res = await fetchWithRetry(`${GAME_API_BASE}/list`, {}, (a, m) => setRetryState({ attempt: a, max: m }));
      setRetryState(null);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to fetch session list", err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('spy_game_token');
    if (token) {
      setScreen('SELECT');
      fetchScenarios();
      fetchSessions();
    }

    const handleUnauthorized = () => {
      handleLogout();
    };

    window.addEventListener('unauthorized_logout', handleUnauthorized);
    return () => {
      window.removeEventListener('unauthorized_logout', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (!session || !session.isMultiplayer) return;

    const currentUser = localStorage.getItem('covert_ops_operator_user');
    const isWaiting = session.lobbyStatus === 'LOBBY_WAITING' || session.activePlayer !== currentUser;

    if (!isWaiting) return;

    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('spy_game_token');
        const res = await fetch(`${GAME_API_BASE}/${session.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (
            data.lobbyStatus !== session.lobbyStatus || 
            data.activePlayer !== session.activePlayer || 
            data.currentTurn !== session.currentTurn ||
            data.status !== session.status
          ) {
            setSession(data);
            if (data.activePlayer === currentUser) {
              addToast("It is your turn! Prepare your operations.", "success");
            }
          }
        } else if (res.status === 401) {
          localStorage.removeItem('spy_game_token');
          localStorage.removeItem('covert_ops_operator_user');
          localStorage.removeItem('spy_game_session_id');
          window.dispatchEvent(new Event('unauthorized_logout'));
        }
      } catch (err) {
        console.error("Failed to poll session status", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [session]);

  // Sync persistent drone operations from session.drones on turn load
  useEffect(() => {
    if (session && session.drones) {
      const persistentDroneOps = session.drones
        .filter(d => d.status === 'ACTIVE' && d.assignedActionType && d.assignedTargetCity)
        .map(d => ({
          droneId: d.id,
          actionType: d.assignedActionType,
          targetCity: d.assignedTargetCity
        }));
      setLocalDroneOperations(persistentDroneOps);
    }
  }, [session?.currentTurn, session?.id]);

  const [hintsCount, setHintsCount] = useState(0);

  useEffect(() => {
    if (!session || !session.id) return;
    const fetchHintsCount = async () => {
      try {
        const res = await fetchWithRetry(`${GAME_API_BASE}/${session.id}/hints`, {}, () => null);
        if (res.ok) {
          const data = await res.json();
          setHintsCount(data?.length || 0);
        }
      } catch (err) {
        console.error("Failed to fetch hints count", err);
      }
    };
    fetchHintsCount();
  }, [session?.id, session?.currentTurn]);

  useEffect(() => {
    if (!session || !session.turnDeadline) {
      setCountdownText('');
      return;
    }

    const updateTimer = () => {
      const deadline = new Date(session.turnDeadline).getTime();
      const now = new Date().getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setCountdownText('EXPIRED');
        const currentUser = localStorage.getItem('covert_ops_operator_user');
        if (session.activePlayer === currentUser && session.status === 'ACTIVE') {
          addToast("TIME LIMIT EXPIRED. Executing scheduled transmission automatically.", "warning");
          handleEndTurn();
        }
        clearInterval(timer);
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdownText(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [session]);

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      return next.slice(-4);
    });
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Start new game
  const handleStartNewGame = async (role = 'DEFENDER', isMultiplayer = false, timerMinutes = 5) => {
    if (!selectedScenarioId) {
      addToast("Please select a scenario config.", "warning");
      return;
    }
    setLoading(true);
    try {
      const endpoint = isMultiplayer
        ? `${GAME_API_BASE}/create-multiplayer?scenarioId=${selectedScenarioId}&playerRole=${role}&timerMinutes=${timerMinutes}`
        : `${GAME_API_BASE}/create?scenarioId=${selectedScenarioId}&playerRole=${role}`;
      const res = await fetchWithRetry(endpoint, {
        method: 'POST'
      }, (a, m) => setRetryState({ attempt: a, max: m }));
      setRetryState(null);
      if (!res.ok) throw new Error('Failed to create new game session.');
      const data = await res.json();
      setSession(data);
      localStorage.setItem('spy_game_session_id', data.id);
      setLocalAssessments({});
      resetTurnStates();
      setLostAgentsList([]);

      setActiveTab(getInitialTab());
      setScreen('GAME');
      setShowGodMode(false);
      setReplayPlan(null);
      fetchReplayData(data.id, true);
      fetchSessions();
      addToast(isMultiplayer ? "Multiplayer lobby created successfully." : "Operation initiated successfully.", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Join multiplayer game
  const handleJoinGame = async (token) => {
    if (!token) {
      addToast("Please enter a valid game token.", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithRetry(`${GAME_API_BASE}/join?gameToken=${token.trim()}`, {
        method: 'POST'
      }, (a, m) => setRetryState({ attempt: a, max: m }));
      setRetryState(null);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to join game session.');
      }
      const data = await res.json();
      setSession(data);
      localStorage.setItem('spy_game_session_id', data.id);
      setLocalAssessments({});
      resetTurnStates();
      setLostAgentsList([]);

      setActiveTab(getInitialTab());
      setScreen('GAME');
      setShowGodMode(false);
      setReplayPlan(null);
      fetchSessions();
      addToast("Successfully joined operation.", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const checkWaiting = () => {
    const currentUser = localStorage.getItem('covert_ops_operator_user');
    const waiting = session && session.isMultiplayer && (session.lobbyStatus === 'LOBBY_WAITING' || session.activePlayer !== currentUser);
    return waiting;
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
      const res = await fetchWithRetry(`${GAME_API_BASE}/${savedId}`, {}, (a, m) => setRetryState({ attempt: a, max: m }));
      setRetryState(null);
      if (!res.ok) throw new Error('Save feed no longer active on backend.');
      const data = await res.json();
      setSession(data);
      const loadedAssessments = {};
      data.discoveredClues.forEach((c, idx) => {
        loadedAssessments[idx] = c.assessment || 'UNASSESSED';
      });
      setLocalAssessments(loadedAssessments);
      resetTurnStates();
      setLostAgentsList([]);
      setActiveTab(getInitialTab());
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

  // Load a specific session by ID (from the saved games list)
  const handleLoadGame = async (sessionId) => {
    setLoading(true);
    try {
      const res = await fetchWithRetry(`${GAME_API_BASE}/${sessionId}`, {}, (a, m) => setRetryState({ attempt: a, max: m }));
      setRetryState(null);
      if (!res.ok) throw new Error('Failed to load session.');
      const data = await res.json();
      setSession(data);
      localStorage.setItem('spy_game_session_id', data.id);
      const loadedAssessments = {};
      data.discoveredClues.forEach((c, idx) => {
        loadedAssessments[idx] = c.assessment || 'UNASSESSED';
      });
      setLocalAssessments(loadedAssessments);
      resetTurnStates();
      setLostAgentsList([]);
      setActiveTab(getInitialTab());
      setScreen('GAME');
      setShowGodMode(false);
      setReplayPlan(null);
      fetchReplayData(data.id, true);
      addToast("Operation resumed.", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Delete a session by ID
  const handleDeleteGame = async (sessionId) => {
    setLoading(true);
    try {
      const res = await fetchWithRetry(`${GAME_API_BASE}/${sessionId}`, { method: 'DELETE' }, (a, m) => setRetryState({ attempt: a, max: m }));
      setRetryState(null);
      if (!res.ok) throw new Error('Failed to delete session.');
      if (localStorage.getItem('spy_game_session_id') === sessionId) {
        localStorage.removeItem('spy_game_session_id');
      }
      fetchSessions();
      addToast("Campaign record purged.", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Assign agent task (buffered locally)
  const handleAssignAgentTask = (agentId, task) => {
    if (checkWaiting()) {
      addToast("It is not your turn.", "warning");
      return;
    }
    if (!session) return;
    const agent = session.agents.find(a => a.id === agentId);
    if (!agent) return;
    setLocalAgentTasks(prev => ({ ...prev, [agentId]: task }));
    addToast(`${agent.codename} directive queued: ${task.replace(/_/g, ' ')}`, "success");
  };

  // Buy a new drone for a drone base city (Queued locally to prevent screen freeze & state out-of-sync)
  const handleBuyDrone = (cityNode, type) => {
    if (checkWaiting()) {
      addToast("It is not your turn.", "warning");
      return;
    }
    if (!session) return;

    const isBaseQueued = localDroneBaseBuilds.includes(cityNode);
    const isBaseInSession = session.droneBases?.includes(cityNode);

    if (!isBaseInSession && !isBaseQueued) {
      addToast(`No drone base in ${cityNode.toUpperCase()}. Build a Drone Base first!`, "warning");
      return;
    }

    const cost = type === '2-HOP' ? 400000 : 200000;

    // Check station capacity (Max 2 drones per base including queued purchases)
    const existingStationedCount = (session.drones || []).filter(d => {
      const plannedBase = localDroneDeployments[d.id];
      if (plannedBase) return plannedBase === cityNode;
      return d.currentCity === cityNode && d.status !== 'SHOT_DOWN';
    }).length;
    const queuedCount = localDronesToBuy.filter(b => b.cityNode === cityNode).length;

    if (existingStationedCount + queuedCount >= 2) {
      addToast(`Drone Base in ${cityNode.toUpperCase()} has reached max capacity (2 drones max).`, "error");
      return;
    }

    // Compute effective budget accounting for all local pending actions
    const pendingTechCost = (localTechDeploys || []).reduce((sum, t) => sum + (session.defensiveAssetCosts?.[t.type] || 30000), 0);
    const pendingSHCost = (localSafehouseBuilds || []).length * 40000;
    const pendingBaseCost = (localDroneBaseBuilds || []).length * 300000;
    const pendingDroneBuyCost = (localDronesToBuy || []).reduce((sum, d) => sum + (d.type === '2-HOP' ? 400000 : 200000), 0);
    const pendingServicingCost = (localServicedDrones || []).length * 10000;
    const totalPendingCost = pendingTechCost + pendingSHCost + pendingBaseCost + pendingDroneBuyCost + pendingServicingCost;

    const effectiveBudget = session.budget - totalPendingCost;

    if (effectiveBudget < cost) {
      addToast(`Insufficient budget ($${(cost / 1000).toFixed(0)}K required) to purchase ${type} Drone.`, "error");
      return;
    }

    setLocalDronesToBuy(prev => [...prev, { cityNode, type }]);
    addToast(`Queued ${type} Drone purchase for base in ${cityNode.toUpperCase()} (-$${(cost / 1000).toFixed(0)}K)`, "success");
  };

  const [localServicedDrones, setLocalServicedDrones] = useState([]);

  // Queue drone technical servicing locally (committed on turn end)
  const handleServiceDrone = (droneId) => {
    if (checkWaiting()) {
      addToast("It is not your turn.", "warning");
      return;
    }
    if (!session) return;

    if (localServicedDrones.includes(droneId)) {
      setLocalServicedDrones(prev => prev.filter(id => id !== droneId));
      addToast(`Cancelled servicing order for Drone #${droneId}`, "info");
      return;
    }

    const pendingTechCost = (localTechDeploys || []).reduce((sum, t) => sum + (session.defensiveAssetCosts?.[t.type] || 30000), 0);
    const pendingSHCost = (localSafehouseBuilds || []).length * 40000;
    const pendingBaseCost = (localDroneBaseBuilds || []).length * 300000;
    const pendingDroneBuyCost = (localDronesToBuy || []).reduce((sum, d) => sum + (d.type === '2-HOP' ? 400000 : 200000), 0);
    const pendingServicingCost = (localServicedDrones || []).length * 10000;
    const totalPendingCost = pendingTechCost + pendingSHCost + pendingBaseCost + pendingDroneBuyCost + pendingServicingCost;

    const effectiveBudget = session.budget - totalPendingCost;

    if (effectiveBudget < 10000) {
      addToast("Insufficient budget ($10K required) to service drone.", "error");
      return;
    }

    setLocalServicedDrones(prev => [...prev, droneId]);
    addToast(`Queued technical servicing for Drone #${droneId} ($10K). 2-turn repair starts on turn end.`, "success");
  };

  // Local states to buffer agent and team relocation choices during the turn
  const [localAgentMoves, setLocalAgentMoves] = useState({}); // maps agentId -> targetCity
  const [localTeamMoves, setLocalTeamMoves] = useState({});   // maps teamId -> targetCity

  // Relocate agent locally
  const handleRelocateAgent = (agentId, targetCity) => {
    if (checkWaiting()) {
      addToast("It is not your turn.", "warning");
      return;
    }
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
    if (checkWaiting()) {
      addToast("It is not your turn.", "warning");
      return;
    }
    if (!session) return;

    const team = session.tacticalTeams.find(t => t.id === teamId);
    if (!team) return;

    // Frozen teams (cooldownRemaining > 0) can still move; only covert actions are blocked
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
  const handleBuildSafehouse = (cityNode, isSecure = false) => {
    if (checkWaiting()) {
      addToast("It is not your turn.", "warning");
      return;
    }
    if (!session) return;
    const isAttacker = session.playerRole === 'ATTACKER';
    if (isAttacker) {
      if (isSecure) {
        if (localBuiltSecureSafehouses.includes(cityNode)) {
          setLocalBuiltSecureSafehouses(prev => prev.filter(c => c !== cityNode));
          addToast(`Secure Safehouse construction cancelled for ${cityNode.toUpperCase()}`, "info");
        } else {
          setLocalBuiltSecureSafehouses(prev => [...prev, cityNode]);
          addToast(`Secure Safehouse construction queued in ${cityNode.toUpperCase()}`, "success");
        }
      } else {
        if (localBuiltSafehouses.includes(cityNode)) {
          setLocalBuiltSafehouses(prev => prev.filter(c => c !== cityNode));
          addToast(`Safehouse construction cancelled for ${cityNode.toUpperCase()}`, "info");
        } else {
          setLocalBuiltSafehouses(prev => [...prev, cityNode]);
          addToast(`Safehouse construction queued in ${cityNode.toUpperCase()}`, "success");
        }
      }
    } else {
      if (localSafehouseBuilds.includes(cityNode)) {
        setLocalSafehouseBuilds(prev => prev.filter(c => c !== cityNode));
        addToast(`Safehouse construction cancelled for ${cityNode.toUpperCase()}`, "info");
      } else {
        setLocalSafehouseBuilds(prev => [...prev, cityNode]);
        addToast(`Safehouse construction queued in ${cityNode.toUpperCase()}`, "success");
      }
    }
  };

  // Deploy tech resource (buffered locally)
  const handleDeployTech = (type, cityNode) => {
    if (checkWaiting()) {
      addToast("It is not your turn.", "warning");
      return;
    }
    if (!session) return;
    const isAttacker = session.playerRole === 'ATTACKER';
    if (isAttacker) {
      if (type === 'JAMMER') {
        if (localActiveJammerTarget === cityNode) {
          setLocalActiveJammerTarget('');
          addToast(`Active Jammer deployment cancelled.`, "info");
        } else {
          setLocalActiveJammerTarget(cityNode);
          addToast(`Active Jammer deployment queued in ${cityNode.toUpperCase()}`, "success");
        }
      } else if (type.startsWith('DECOY_')) {
        const decoyType = type.replace('DECOY_', '');
        setLocalDecoyDeployments(prev => {
          const exists = prev.some(d => d.type === decoyType && d.cityNode === cityNode);
          if (exists) {
            addToast(`Decoy ${decoyType} cancelled.`, "info");
            return prev.filter(d => !(d.type === decoyType && d.cityNode === cityNode));
          } else {
            addToast(`Decoy ${decoyType} queued in ${cityNode.toUpperCase()}`, "success");
            return [...prev, { type: decoyType, cityNode }];
          }
        });
      }
    } else {
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
    }
  };

  // Covert Actions Planner
  const toggleCovertAction = (actionType, cityNode, teamId, targetSafehouseCode = "") => {
    if (checkWaiting()) {
      addToast("It is not your turn.", "warning");
      return;
    }
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

  const setMultipleClueAssessments = (assessmentsMap) => {
    setLocalAssessments((prev) => {
      const updated = { ...prev, ...assessmentsMap };
      addToast(`Accepted all clues before current turn`, "info");
      return updated;
    });
  };

  // Revert last turn
  const handleRevertTurn = async () => {
    if (!session) return;
    if (!window.confirm("Are you sure you want to revert the last turn? This will erase the current turn and reload the previous state.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithRetry(`${GAME_API_BASE}/${session.id}/revert-turn`, {
        method: 'POST'
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
        setReplayTurn(updated.currentTurn);
        setCovertActions([]);
        setLocalAgentMoves({});
        setLocalTeamMoves({});
        setLocalAgentTasks({});
        setLocalSafehouseBuilds([]);
        setLocalTechDeploys([]);
        addToast(`Game successfully reverted to Turn ${updated.currentTurn}.`, "info");
      } else {
        const errorData = await res.text();
        addToast(`Failed to revert turn: ${errorData}`, "error");
      }
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
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
        techDeployments: localTechDeploys,
        droneBasesToBuild: localDroneBaseBuilds,
        droneDeployments: localDroneDeployments,
        droneOperations: localDroneOperations,
        dronesToBuy: localDronesToBuy,
        servicedDroneIds: localServicedDrones,
        
        // Attacker specific fields
        suspectMoveTarget: localSuspectMove,
        targetSafehouseCode: localTargetSafehouseCode,
        builtSafehouses: localBuiltSafehouses,
        builtSecureSafehouses: localBuiltSecureSafehouses,
        decoyDeployments: localDecoyDeployments,
        activeJammerTarget: localActiveJammerTarget,
        seekPermissionType: localSeekPermissionType,
        triggerStrike: localTriggerStrike,
        triggerExfiltration: localTriggerExfiltration,
        
        requestFinance: localRequestFinance,
        collectFinance: localCollectFinance,
        requestLogistics: localRequestLogistics,
        collectLogistics: localCollectLogistics,
        beginHandover: localBeginHandover
      };

      const res = await fetchWithRetry(`${GAME_API_BASE}/${session.id}/end-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, (a, m) => setRetryState({ attempt: a, max: m }));
      setRetryState(null);
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
      const combatOpClues = newClues.filter(c =>
        c.source === 'TACTICAL_FORCE' || c.source === 'BORDER_INCIDENT' || c.source === 'BORDER_GUARD' || c.source === 'BORDER_CROSSING_FOOTPRINT' || c.source === 'COMMAND_CENTER' || c.source === 'SAFEHOUSE_ATTACK' || c.source === 'DRONE_RECON' || c.source === 'DRONE_ATTACK'
      );
      // Permission & Major Progression events (handover complete, border crossing permission, border crossed, attack permission)
      const permissionClues = newClues.filter(c =>
        c.source === 'BORDER_PERMISSION' ||
        c.source === 'BORDER_CROSSING' ||
        c.source === 'ATTACK_REQUESTED' ||
        c.source === 'ATTACK_APPROVED' ||
        c.source === 'HANDOVER_UNLOCKED' ||
        c.source === 'HANDOVER_COMPLETED' ||
        (c.clueText && (
          c.clueText.toLowerCase().includes('handover') ||
          c.clueText.toLowerCase().includes('border crossing') ||
          c.clueText.toLowerCase().includes('border breach') ||
          c.clueText.toLowerCase().includes('border crossed') ||
          c.clueText.toLowerCase().includes('permission') ||
          c.clueText.toLowerCase().includes('engage')
        ))
      );
      const handoverClues = newClues.filter(c => c.source === 'HANDOVER_UNLOCKED' || c.source === 'HANDOVER_COMPLETED');
      const strikeClues = newClues.filter(c => c.source === 'STRIKE_EXECUTED');
      const droneMaintenanceClues = newClues.filter(c => c.source === 'DRONE_MAINTENANCE' || (c.source === 'ADVANCE_WARNING' && c.clueText && c.clueText.includes('Drone Base')));
      const droneServicedClues = newClues.filter(c => c.source === 'DRONE_SERVICED');
      const droneDefenseClues = newClues.filter(c => c.source === 'DRONE_DEFENSE_ACTIVATED' || c.source === 'DRONE_DEFENSE_STRIKE');
      const droneInterdictionClues = newClues.filter(c =>
        c.source === 'DRONE_DAMAGED' ||
        c.source === 'DRONE_SHOT_DOWN' ||
        (c.clueText && (c.clueText.includes('DRONE DAMAGED') || c.clueText.includes('DRONE DOWN')))
      );

      if (newFinance.length > 0 || newLogistics.length > 0 || newSafehouses.length > 0 || newTech.length > 0 || lostAgents.length > 0 || lostTeams.length > 0 || lostSafehouses.length > 0 || newExposedHostileSH.length > 0 || sweepAlertClues.length > 0 || sweepLossClues.length > 0 || combatOpClues.length > 0 || permissionClues.length > 0 || handoverClues.length > 0 || strikeClues.length > 0 || droneMaintenanceClues.length > 0 || droneServicedClues.length > 0 || droneDefenseClues.length > 0 || droneInterdictionClues.length > 0) {
        setPendingEndTurnReport({
          newFinance,
          newLogistics,
          newSafehouses,
          newTech,
          lostAgents,
          lostTeams,
          lostSafehouses,
          newExposedHostileSH,
          sweepAlerts: sweepAlertClues,
          sweepLosses: sweepLossClues,
          combatOps: combatOpClues,
          permissionAlerts: permissionClues,
          handoverAlerts: handoverClues,
          strikeEvents: strikeClues,
          droneMaintenanceAlerts: droneMaintenanceClues,
          droneServicedAlerts: droneServicedClues,
          droneDefenseAlerts: droneDefenseClues,
          droneInterdictionAlerts: droneInterdictionClues
        });
      }

      setSession(updated);
      resetTurnStates();

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
      const res = await fetchWithRetry(`${GAME_API_BASE}/${gameId}/replay`, {}, (a, m) => setRetryState({ attempt: a, max: m }));
      setRetryState(null);
      if (res.ok) {
        const data = await res.json();
        setReplayPlan(data);
        if (!silent) {
          setShowGodMode(true);
          setActiveTab(getInitialTab());
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

  const handleExtendGame = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetchWithRetry(`${GAME_API_BASE}/${session.id}/extend`, {
        method: 'POST'
      }, (a, m) => setRetryState({ attempt: a, max: m }));
      setRetryState(null);
      if (!res.ok) throw new Error('Failed to extend game session.');
      const updated = await res.json();
      setSession(updated);
      setShowGameOver(false);
      setLostAgentsList([]);
      addToast("Operation extended! Additional budget granted, forces reinstated, and hostile threat monitoring active.", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
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
    fetchSessions();
  };

  // Called by MapView when all post-turn animations finish playing
  const handleMapAnimationComplete = () => {
    if (pendingEndTurnReport) {
      setEndTurnReport(pendingEndTurnReport);
      setPendingEndTurnReport(null);
    }
  };

  const onLoginSuccess = () => {
    fetchScenarios();
    fetchSessions();
    setScreen('SELECT');
  };

  const handleLogout = () => {
    localStorage.removeItem('spy_game_token');
    localStorage.removeItem('covert_ops_operator_user');
    localStorage.removeItem('spy_game_session_id');
    setScreen('HOME');
    setSession(null);
    setSessions([]);
    addToast("Logged out successfully.", "info");
  };

  const hasActiveGame = sessions.some(s => s.status === 'ACTIVE');
  const activeScenario = scenarios.find(s => s.scenarioId === session?.scenarioId);

  const unassessedCluesCount = session
    ? session.discoveredClues.filter((clue, idx) => {
        return clue.turnDiscovered <= session.currentTurn && (localAssessments[idx] || 'UNASSESSED') === 'UNASSESSED';
      }).length
    : 0;

  const acceptedCluesCount = session
    ? session.discoveredClues.filter((clue, idx) => {
        return clue.turnDiscovered <= session.currentTurn && (localAssessments[idx] || 'UNASSESSED') === 'ACCEPT';
      }).length
    : 0;

  const isWaiting = checkWaiting();

  return (
    <div className={`app-layout ${screen !== 'GAME' ? 'no-sidebar' : ''}`}>
      <div className="crt-overlay"></div>
      <Toast toasts={toasts} removeToast={removeToast} />
      {retryState && <RetrySpinner attempt={retryState.attempt} max={retryState.max} />}

      {screen === 'HOME' && (
        <HomeScreen onPlay={() => setScreen('LOGIN')} />
      )}

      {screen === 'LOGIN' && (
        <LoginScreen onLoginSuccess={onLoginSuccess} />
      )}

      {screen === 'SELECT' && (
        <ScenarioSelect
          scenarios={scenarios}
          sessions={sessions}
          selectedScenarioId={selectedScenarioId}
          setSelectedScenarioId={setSelectedScenarioId}
          onStartNewGame={handleStartNewGame}
          onLoadGame={handleLoadGame}
          onDeleteGame={handleDeleteGame}
          onJoinGame={handleJoinGame}
          loading={loading}
          errorMsg={errorMsg}
          onLogout={handleLogout}
        />
      )}

      {screen === 'GAME' && session && (
        <>
          {session.deploymentPending && session.playerRole === 'DEFENDER' && (
            <DeploymentScreen
              session={session}
              activeScenario={activeScenario}
              onDeploymentComplete={(updated) => setSession(updated)}
              addToast={addToast}
            />
          )}
          <VerticalTabBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            clueCount={unassessedCluesCount}
            acceptedCount={acceptedCluesCount}
            hintCount={hintsCount}
            actionCount={covertActions.length}
            playerRole={session.playerRole}
          />

          <main className={`tab-content ${activeTab === 'MAP' || activeTab === 'TACTICAL' ? 'tab-content-map' : ''}`}>
            {activeTab === 'OBJECTIVES' && (
              <ObjectiveBoardView
                session={session}
                activeScenario={activeScenario}
                onClose={() => setActiveTab(getDefaultMapTab())}
              />
            )}

            {activeTab === 'HINTS' && (
              <HintsView
                session={session}
              />
            )}

            {activeTab === 'CELL_HQ' && (
              <CellHqView
                session={session}
                activeScenario={activeScenario}
                localSeekPermissionType={localSeekPermissionType}
                setLocalSeekPermissionType={setLocalSeekPermissionType}
                localTriggerStrike={localTriggerStrike}
                setLocalTriggerStrike={setLocalTriggerStrike}
                localTriggerExfiltration={localTriggerExfiltration}
                setLocalTriggerExfiltration={setLocalTriggerExfiltration}
                addToast={addToast}
                localRequestFinance={localRequestFinance}
                setLocalRequestFinance={setLocalRequestFinance}
                localCollectFinance={localCollectFinance}
                setLocalCollectFinance={setLocalCollectFinance}
                localRequestLogistics={localRequestLogistics}
                setLocalRequestLogistics={setLocalRequestLogistics}
                localCollectLogistics={localCollectLogistics}
                setLocalCollectLogistics={setLocalCollectLogistics}
                localBeginHandover={localBeginHandover}
                setLocalBeginHandover={setLocalBeginHandover}
              />
            )}

            {(activeTab === 'MAP' || activeTab === 'TACTICAL') && (
              <MapView
                session={session}
                isTacticalView={activeTab === 'TACTICAL'}
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
                localDroneBaseBuilds={localDroneBaseBuilds}
                setLocalDroneBaseBuilds={setLocalDroneBaseBuilds}
                localDroneDeployments={localDroneDeployments}
                setLocalDroneDeployments={setLocalDroneDeployments}
                localDroneOperations={localDroneOperations}
                setLocalDroneOperations={setLocalDroneOperations}
                localDronesToBuy={localDronesToBuy}
                setLocalDronesToBuy={setLocalDronesToBuy}
                onBuyDrone={handleBuyDrone}
                onServiceDrone={handleServiceDrone}
                addToast={addToast}
                isWaiting={isWaiting}
                localSuspectMove={localSuspectMove}
                setLocalSuspectMove={setLocalSuspectMove}
                localTargetSafehouseCode={localTargetSafehouseCode}
                setLocalTargetSafehouseCode={setLocalTargetSafehouseCode}
                localBuiltSafehouses={localBuiltSafehouses}
                localBuiltSecureSafehouses={localBuiltSecureSafehouses}
                localActiveJammerTarget={localActiveJammerTarget}
                localDecoyDeployments={localDecoyDeployments}
                localRequestFinance={localRequestFinance}
                setLocalRequestFinance={setLocalRequestFinance}
                localCollectFinance={localCollectFinance}
                setLocalCollectFinance={setLocalCollectFinance}
                localRequestLogistics={localRequestLogistics}
                setLocalRequestLogistics={setLocalRequestLogistics}
                localCollectLogistics={localCollectLogistics}
                setLocalCollectLogistics={setLocalCollectLogistics}
                localBeginHandover={localBeginHandover}
                setLocalBeginHandover={setLocalBeginHandover}
                setReplayTurn={setReplayTurn}
                onAnimationComplete={handleMapAnimationComplete}
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
                onSetMultipleClueAssessments={setMultipleClueAssessments}
                isAttacker={session ? session.playerRole === 'ATTACKER' : false}
              />
            )}

            {activeTab === 'DOSSIER' && (
              <DossierView
                session={session}
                localAssessments={localAssessments}
                onSetClueAssessment={setClueAssessment}
                lastTurnReport={endTurnReport || pendingEndTurnReport}
                onReopenReport={(rpt) => setPendingEndTurnReport(rpt || endTurnReport || pendingEndTurnReport)}
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
                isAttacker={session ? session.playerRole === 'ATTACKER' : false}
                onRevertTurn={handleRevertTurn}
                nodes={activeScenario?.nodes || []}
              />
            )}
          </main>

          <StatusBar
            session={session}
            covertActions={covertActions}
            onEndTurn={handleEndTurn}
            loading={loading}
            onExit={handleExit}
            isWaiting={isWaiting}
            countdownText={countdownText}
          />
        </>
      )}
      {endTurnReport && (
        <EndTurnReportModal
          report={endTurnReport}
          onClose={() => setEndTurnReport(null)}
          isAttacker={session ? session.playerRole === 'ATTACKER' : false}
        />
      )}

      {/* Grand Game-Over Modal */}
      {showGameOver && session && (
        <GameOverModal
          session={session}
          replayPlan={replayPlan}
          lastTurnReport={endTurnReport || pendingEndTurnReport}
          onConfirm={() => {
            setShowGameOver(false);
            handleExit();
            fetchScenarios();
          }}
          onExtendGame={handleExtendGame}
          onViewReplay={() => {
            setShowGameOver(false);
            setShowGodMode(true);
          }}
        />
      )}
    </div>
  );
}
