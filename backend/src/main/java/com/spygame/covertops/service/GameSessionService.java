package com.spygame.covertops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.AIMasterPlan;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.repository.GameSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class GameSessionService {

    @Autowired
    private GameSessionRepository repository;

    @Autowired
    private AIAttackerService aiService;

    @Autowired
    private ClueGenerationEngine clueEngine;

    @Autowired
    private com.spygame.covertops.repository.ScenarioConfigRepository scenarioConfigRepository;

    @Autowired
    private PlayerAttackerService playerAttackerService;

    @Autowired
    private AIDefenderService aiDefenderService;

    private final ObjectMapper mapper = new ObjectMapper();

    // Creates a new Game Session, fetching scenario from MongoDB database
    // and pre-generating a fresh Master and Backup plan for this game.
    // List all sessions
    public List<GameSession> listSessions() {
        return repository.findAll();
    }

    public List<GameSession> listSessions(String username) {
        if (username == null) {
            return repository.findAll();
        }
        return repository.findAll().stream()
                .filter(s -> username.equals(s.getOwnerUsername()) || username.equals(s.getPlayerB()) || (s.getOwnerUsername() == null && s.getPlayerB() == null))
                .collect(Collectors.toList());
    }

    // Delete a session by ID
    public void deleteSession(UUID sessionId) {
        if (!repository.existsById(sessionId)) {
            throw new IllegalArgumentException("Session not found with ID: " + sessionId);
        }
        repository.deleteById(sessionId);
    }

    public GameSession createSession(String scenarioId) {
        return createSession(scenarioId, "DEFENDER", null);
    }

    public GameSession createMultiplayerSession(String scenarioId, String playerARole, String ownerUsername, int timerMinutes) {
        try {
            ScenarioConfig config = scenarioConfigRepository.findById(scenarioId)
                    .orElseThrow(() -> new IllegalArgumentException("Scenario config not found in database for ID: " + scenarioId));

            GameSession session = new GameSession();
            session.setId(UUID.randomUUID());
            session.setScenarioId(config.getScenarioId());
            session.setCurrentTurn(1);
            session.setMaxTurns(config.getMaxTurns());
            session.setBudget(config.getStartingBudget());
            session.setStatus("ACTIVE");
            session.setPlayerRole(playerARole != null ? playerARole.toUpperCase() : "DEFENDER");
            session.setOwnerUsername(ownerUsername);

            session.setMultiplayer(true);
            session.setPlayerA(ownerUsername);
            session.setPlayerARole(playerARole != null ? playerARole.toUpperCase() : "DEFENDER");
            session.setPlayerBRole("ATTACKER".equals(session.getPlayerARole()) ? "DEFENDER" : "ATTACKER");
            session.setTurnTimerDurationMinutes(timerMinutes);
            session.setLobbyStatus("LOBBY_WAITING");

            // Populate attacker names and select actual attacker first
            String actual = "Suspect";
            if (config.getAttackerNames() != null && !config.getAttackerNames().isEmpty()) {
                session.setAttackerNames(config.getAttackerNames());
                java.util.Random rand = new java.util.Random();
                actual = config.getAttackerNames().get(rand.nextInt(config.getAttackerNames().size()));
            }

            if ("ATTACKER".equalsIgnoreCase(playerARole)) {
                actual = "Faizal Khan";
                List<String> names = new ArrayList<>(config.getAttackerNames() != null ? config.getAttackerNames() : List.of());
                if (!names.contains("Faizal Khan")) {
                    if (names.contains("Faisal Shah")) {
                        names.set(names.indexOf("Faisal Shah"), "Faizal Khan");
                    } else {
                        names.add("Faizal Khan");
                    }
                }
                session.setAttackerNames(names);
            }
            session.setActualAttacker(actual);

            // 1. Initialize empty plans (we calculate actions dynamically per turn)
            AIMasterPlan plan = new AIMasterPlan(new java.util.ArrayList<>(), new java.util.ArrayList<>());
            session.setAiMasterPlan(plan);
            session.setSuspectPlans(new java.util.HashMap<>());

            // 1.2 Initialize cityHeat map with 0 for all nodes
            Map<String, Integer> cityHeat = new java.util.HashMap<>();
            if (config.getNodes() != null) {
                for (Node n : config.getNodes()) {
                    cityHeat.put(n.getId(), 0);
                }
            }
            session.setCityHeat(cityHeat);

            // 2. Parse Starting Rosters (Agents & Teams)
            if (config.getAgents() != null) {
                List<GameSession.Agent> agentsList = config.getAgents().stream().map(aMap -> {
                    GameSession.Agent agent = new GameSession.Agent();
                    agent.setId((Integer) aMap.get("id"));
                    agent.setName((String) aMap.get("name"));
                    agent.setCodename((String) aMap.get("codename"));
                    agent.setCurrentCity((String) aMap.get("startingCity"));
                    agent.setActiveTask("FIND_SUSPECT");
                    agent.setSkills((Map<String, Integer>) aMap.get("skills"));
                    agent.setCooldownRemaining(0);
                    return agent;
                }).collect(Collectors.toList());
                session.setAgents(agentsList);
            }

            if (config.getTacticalTeams() != null) {
                List<GameSession.TacticalTeam> teamsList = config.getTacticalTeams().stream().map(tMap -> {
                    GameSession.TacticalTeam team = new GameSession.TacticalTeam();
                    team.setId((Integer) tMap.get("id"));
                    team.setName((String) tMap.get("name"));
                    team.setOperatingCountry((String) tMap.get("operatingCountry"));
                    team.setCurrentCity((String) tMap.get("startingCity"));
                    team.setSkills((Map<String, Integer>) tMap.get("skills"));
                    team.setCooldownRemaining(0);
                    return team;
                }).collect(Collectors.toList());
                session.setTacticalTeams(teamsList);
            }

            // 3. Parse Starting Friendly Safehouses
            List<GameSession.Safehouse> safehousesList = new ArrayList<>();
            if (config.getStartingDefenderSafehouses() != null) {
                safehousesList = config.getStartingDefenderSafehouses().stream()
                        .map(sMap -> new GameSession.Safehouse(sMap.get("cityId"), "DEFENDER", "DEFAULT", true))
                        .collect(Collectors.toList());
            }

            // 3.1 Pre-build hidden hostile safehouses
            List<PlanStep> allSteps = new ArrayList<>();
            if (session.getSuspectPlans() != null) {
                for (List<PlanStep> pathSteps : session.getSuspectPlans().values()) {
                    allSteps.addAll(pathSteps);
                }
            }
            if (session.getAiMasterPlan() != null && session.getAiMasterPlan().getFallbackPlan() != null) {
                allSteps.addAll(session.getAiMasterPlan().getFallbackPlan());
            }
            for (PlanStep step : allSteps) {
                String loc = step.getSuspectLocation();
                if (loc != null && !loc.isEmpty() && !loc.equals("NONE")) {
                    final String targetLoc = loc;
                    boolean exists = safehousesList.stream()
                        .anyMatch(s -> s.getCityNode().equals(targetLoc) && "HOSTILE".equals(s.getOwnerFaction()));
                    if (!exists) {
                        safehousesList.add(new GameSession.Safehouse(loc, "HOSTILE", "DEFAULT", false));
                    }
                }
            }
            session.setSafehouses(safehousesList);

            // 4. Parse Starting Espionage Scanning Resources
            if (config.getStartingEspionageResources() != null) {
                List<GameSession.ActiveResource> resourcesList = config.getStartingEspionageResources().stream()
                        .map(rMap -> new GameSession.ActiveResource(rMap.get("type"), rMap.get("cityId"), 0))
                        .collect(Collectors.toList());
                session.setEspionageResources(resourcesList);
            }

            return repository.save(session);
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize multiplayer session: " + e.getMessage(), e);
        }
    }

    public GameSession joinSession(UUID sessionId, String inviteeUsername) {
        GameSession session = getSession(sessionId);
        if (!session.isMultiplayer()) {
            throw new IllegalArgumentException("This is not a multiplayer game.");
        }
        if (!"LOBBY_WAITING".equals(session.getLobbyStatus())) {
            throw new IllegalStateException("Lobby is already full or game has started/terminated.");
        }
        if (session.getPlayerA().equals(inviteeUsername)) {
            throw new IllegalArgumentException("Creator cannot join their own lobby as Player B.");
        }
        session.setPlayerB(inviteeUsername);
        session.setLobbyStatus("IN_PROGRESS");

        // The attacker starts first
        String attackerUsername = "ATTACKER".equals(session.getPlayerARole()) ? session.getPlayerA() : inviteeUsername;
        session.setActivePlayer(attackerUsername);
        session.setTurnDeadline(java.time.LocalDateTime.now().plusMinutes(session.getTurnTimerDurationMinutes()));

        // Also set up starting budgets / locations for human Attacker if not already configured
        ScenarioConfig config = scenarioConfigRepository.findById(session.getScenarioId())
                .orElseThrow(() -> new IllegalArgumentException("Scenario config not found: " + session.getScenarioId()));
        session.setAttackerBudget(config.getStartingBudget() != 0 ? config.getStartingBudget() : 300000);
        List<Node> hostileNodes = config.getNodes().stream()
                .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                .collect(Collectors.toList());
        if (!hostileNodes.isEmpty()) {
            java.util.Random rand = new java.util.Random();
            session.setSuspectLocation(hostileNodes.get(rand.nextInt(hostileNodes.size())).getId());
        } else {
            session.setSuspectLocation("Berlin");
        }
        session.setActiveAttackerPhase("TRAIL_BREAKING");

        return repository.save(session);
    }

    public GameSession createSession(String scenarioId, String playerRole) {
        return createSession(scenarioId, playerRole, null);
    }

    public GameSession createSession(String scenarioId, String playerRole, String ownerUsername) {
        try {
            ScenarioConfig config = scenarioConfigRepository.findById(scenarioId)
                    .orElseThrow(() -> new IllegalArgumentException("Scenario config not found in database for ID: " + scenarioId));

            GameSession session = new GameSession();
            session.setId(UUID.randomUUID());
            session.setScenarioId(config.getScenarioId());
            session.setCurrentTurn(1);
            session.setMaxTurns(config.getMaxTurns());
            session.setBudget(config.getStartingBudget());
            session.setStatus("ACTIVE");
            session.setPlayerRole(playerRole != null ? playerRole.toUpperCase() : "DEFENDER");
            session.setOwnerUsername(ownerUsername);

            // If player is Attacker, set starting budget and starting location
            if ("ATTACKER".equals(session.getPlayerRole())) {
                session.setAttackerBudget(config.getStartingBudget() != 0 ? config.getStartingBudget() : 300000);
                List<Node> hostileNodes = config.getNodes().stream()
                        .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                        .collect(Collectors.toList());
                if (!hostileNodes.isEmpty()) {
                    java.util.Random rand = new java.util.Random();
                    session.setSuspectLocation(hostileNodes.get(rand.nextInt(hostileNodes.size())).getId());
                } else {
                    session.setSuspectLocation("Berlin");
                }
                session.setActiveAttackerPhase("TRAIL_BREAKING");
            }

            // Populate attacker names and select actual attacker first
            String actual = "Suspect";
            if (config.getAttackerNames() != null && !config.getAttackerNames().isEmpty()) {
                session.setAttackerNames(config.getAttackerNames());
                java.util.Random rand = new java.util.Random();
                actual = config.getAttackerNames().get(rand.nextInt(config.getAttackerNames().size()));
            }

            if ("ATTACKER".equalsIgnoreCase(playerRole)) {
                actual = "Faizal Khan";
                List<String> names = new ArrayList<>(config.getAttackerNames() != null ? config.getAttackerNames() : List.of());
                if (!names.contains("Faizal Khan")) {
                    if (names.contains("Faisal Shah")) {
                        names.set(names.indexOf("Faisal Shah"), "Faizal Khan");
                    } else {
                        names.add("Faizal Khan");
                    }
                }
                session.setAttackerNames(names);
            }
            session.setActualAttacker(actual);

            // 1. Initialize empty plans (we calculate actions dynamically per turn)
            AIMasterPlan plan = new AIMasterPlan(new java.util.ArrayList<>(), new java.util.ArrayList<>());
            session.setAiMasterPlan(plan);
            session.setSuspectPlans(new java.util.HashMap<>());

            // 1.2 Initialize cityHeat map with 0 for all nodes
            Map<String, Integer> cityHeat = new java.util.HashMap<>();
            if (config.getNodes() != null) {
                for (Node n : config.getNodes()) {
                    cityHeat.put(n.getId(), 0);
                }
            }
            session.setCityHeat(cityHeat);

            // 2. Parse Starting Rosters (Agents & Teams)
            if (config.getAgents() != null) {
                List<GameSession.Agent> agentsList = config.getAgents().stream().map(aMap -> {
                    GameSession.Agent agent = new GameSession.Agent();
                    agent.setId((Integer) aMap.get("id"));
                    agent.setName((String) aMap.get("name"));
                    agent.setCodename((String) aMap.get("codename"));
                    agent.setCurrentCity((String) aMap.get("startingCity"));
                    agent.setActiveTask("FIND_SUSPECT");
                    agent.setSkills((Map<String, Integer>) aMap.get("skills"));
                    agent.setCooldownRemaining(0);
                    return agent;
                }).collect(Collectors.toList());
                session.setAgents(agentsList);
            }

            if (config.getTacticalTeams() != null) {
                List<GameSession.TacticalTeam> teamsList = config.getTacticalTeams().stream().map(tMap -> {
                    GameSession.TacticalTeam team = new GameSession.TacticalTeam();
                    team.setId((Integer) tMap.get("id"));
                    team.setName((String) tMap.get("name"));
                    team.setOperatingCountry((String) tMap.get("operatingCountry"));
                    team.setCurrentCity((String) tMap.get("startingCity"));
                    team.setSkills((Map<String, Integer>) tMap.get("skills"));
                    team.setCooldownRemaining(0);
                    return team;
                }).collect(Collectors.toList());
                session.setTacticalTeams(teamsList);
            }

            // 3. Parse Starting Friendly Safehouses
            List<GameSession.Safehouse> safehousesList = new ArrayList<>();
            if (config.getStartingDefenderSafehouses() != null) {
                safehousesList = config.getStartingDefenderSafehouses().stream()
                        .map(sMap -> new GameSession.Safehouse(sMap.get("cityId"), "DEFENDER", "DEFAULT", true))
                        .collect(Collectors.toList());
            }

            // 3.1 Pre-build hidden hostile safehouses for all suspect plan steps in advance
            List<PlanStep> allSteps = new ArrayList<>();
            if (session.getSuspectPlans() != null) {
                for (List<PlanStep> pathSteps : session.getSuspectPlans().values()) {
                    allSteps.addAll(pathSteps);
                }
            }
            if (session.getAiMasterPlan() != null && session.getAiMasterPlan().getFallbackPlan() != null) {
                allSteps.addAll(session.getAiMasterPlan().getFallbackPlan());
            }
            for (PlanStep step : allSteps) {
                String loc = step.getSuspectLocation();
                if (loc != null && !loc.isEmpty() && !loc.equals("NONE")) {
                    final String targetLoc = loc;
                    boolean exists = safehousesList.stream()
                        .anyMatch(s -> s.getCityNode().equals(targetLoc) && "HOSTILE".equals(s.getOwnerFaction()));
                    if (!exists) {
                        // Creates a hidden hostile safehouse (uncovered = false) with a unique random 3-digit code
                        safehousesList.add(new GameSession.Safehouse(loc, "HOSTILE", "DEFAULT", false));
                    }
                }
            }
            session.setSafehouses(safehousesList);

            // 4. Parse Starting Espionage Scanning Resources
            if (config.getStartingEspionageResources() != null) {
                List<GameSession.ActiveResource> resourcesList = config.getStartingEspionageResources().stream()
                        .map(rMap -> new GameSession.ActiveResource(rMap.get("type"), rMap.get("cityId"), 0))
                        .collect(Collectors.toList());
                session.setEspionageResources(resourcesList);
            }

            return repository.save(session);

        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize game session: " + e.getMessage(), e);
        }
    }

    public GameSession getSession(UUID sessionId) {
        return repository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found with ID: " + sessionId));
    }

    // Fetches all scenario documents stored in the database
    public List<ScenarioConfig> getAvailableScenarios() {
        return scenarioConfigRepository.findAll();
    }

    // Updates a clue's assessment status (ACCEPT, REJECT, DOUBT)
    public GameSession assessClue(UUID sessionId, int clueIndex, String assessment) {
        GameSession session = getSession(sessionId);
        if (clueIndex < 0 || clueIndex >= session.getDiscoveredClues().size()) {
            throw new IllegalArgumentException("Invalid clue index: " + clueIndex);
        }

        session.getDiscoveredClues().get(clueIndex).setAssessment(assessment);
        return repository.save(session);
    }

    @Autowired
    private PlayerDefenderService defenderService;

    // Resolves all turn-end scans and checks roadblocks.
    // Ticks the timeline forward.
    public GameSession processEndTurn(UUID sessionId, com.spygame.covertops.model.EndTurnRequest request) {
        return processEndTurn(sessionId, request, null);
    }

    public GameSession processEndTurn(UUID sessionId, com.spygame.covertops.model.EndTurnRequest request, String username) {
        GameSession session = getSession(sessionId);
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new IllegalStateException("Game session is no longer active.");
        }

        final String scenarioId = session.getScenarioId();
        final ScenarioConfig config = scenarioConfigRepository.findById(scenarioId)
                .orElseThrow(() -> new IllegalArgumentException("Scenario configuration not found in database: " + scenarioId));

        if (session.isMultiplayer()) {
            if (!"IN_PROGRESS".equals(session.getLobbyStatus())) {
                throw new IllegalStateException("Multiplayer game lobby is not in progress.");
            }
            if (username != null && !username.equals(session.getActivePlayer())) {
                throw new IllegalStateException("It is not your turn to submit selections.");
            }

            boolean isAttacker = false;
            if (username != null) {
                if (username.equals(session.getPlayerA())) {
                    isAttacker = "ATTACKER".equals(session.getPlayerARole());
                } else if (username.equals(session.getPlayerB())) {
                    isAttacker = "ATTACKER".equals(session.getPlayerBRole());
                }
            } else {
                isAttacker = "ATTACKER".equals(session.getActivePlayer().equals(session.getPlayerA()) ? session.getPlayerARole() : session.getPlayerBRole());
            }

            if (isAttacker) {
                // Apply Attacker's moves
                session = playerAttackerService.applyAttackerActions(session, request, config);

                if (!"ACTIVE".equals(session.getStatus())) {
                    return repository.save(session);
                }

                // Switch turn to Defender
                String defenderUsername = session.getPlayerA().equals(session.getActivePlayer()) ? session.getPlayerB() : session.getPlayerA();
                session.setActivePlayer(defenderUsername);
                session.setPlayerRole("DEFENDER");
                session.setTurnDeadline(java.time.LocalDateTime.now().plusMinutes(session.getTurnTimerDurationMinutes()));
                
                return repository.save(session);
            }
            session.setPlayerRole("DEFENDER");
        }

        if ("ATTACKER".equals(session.getPlayerRole())) {
            int currentTurn = session.getCurrentTurn();

            // 1. Process human attacker actions (move suspect, tools, permissions, etc.)
            session = playerAttackerService.applyAttackerActions(session, request, config);

            if (!"ACTIVE".equals(session.getStatus())) {
                return repository.save(session);
            }

            // 2. Process AI Defender actions (scanners, agent moves, safehouse raids, lockdowns)
            session = aiDefenderService.executeTurn(session, config);

            if (!"ACTIVE".equals(session.getStatus())) {
                return repository.save(session);
            }

            // 3. Process automated clues generated by suspect moves/decoys/satellites
            List<GameSession.Clue> turnIntel = clueEngine.generateTurnClues(session, config);
            session.getDiscoveredClues().addAll(turnIntel);

            // Tick down active technologically scanner durations and remove expired ones
            if (session.getEspionageResources() != null) {
                List<GameSession.ActiveResource> activeResources = new ArrayList<>();
                for (GameSession.ActiveResource res : session.getEspionageResources()) {
                    int left = res.getCooldownRemaining() - 1;
                    if (left > 0) {
                        res.setCooldownRemaining(left);
                        activeResources.add(res);
                    }
                }
                session.setEspionageResources(activeResources);
            }

            // Update Attacker sourcing and handover timers
            tickAttackerMilestones(session);

            // Advance turn
            session.setCurrentTurn(currentTurn + 1);

            // Check Defeat: if currentTurn exceeds deadline limit
            if (session.getCurrentTurn() > session.getMaxTurns()) {
                session.setStatus("COMPROMISED");
                session.getDiscoveredClues().add(new GameSession.Clue(session.getCurrentTurn(), "TACTICAL_FORCE", 
                        "Crisis level alert: Strike executed. Strike initiated. Mission failed."));
            }

            // If suspect exfiltrated undetected back to home soil after strike, set victory
            boolean reachedHome = false;
            String loc = session.getSuspectLocation();
            Node node = config.getNodes().stream().filter(n -> n.getId().equals(loc)).findFirst().orElse(null);
            if (node != null && "HOSTILE_TERRITORY".equals(node.getTerritory())) {
                reachedHome = true;
            }
            if ("EXFILTRATION".equals(session.getActiveAttackerPhase()) && reachedHome) {
                session.setStatus("SUCCESS");
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "TACTICAL_FORCE",
                        "MISSION SUCCESS! operative successfully returned back to home soil undetected. Victory achieved."
                ));
            }

            return repository.save(session);
        }

        // Apply relocations before resolving clues and combat
        if (request.getAgentRelocations() != null) {
            for (Map.Entry<Integer, String> entry : request.getAgentRelocations().entrySet()) {
                try {
                    final GameSession currentSession = session;
                    session = defenderService.relocateAgent(currentSession, entry.getKey(), entry.getValue(), config);
                } catch (Exception e) {
                    System.err.println("Failed agent relocation: " + e.getMessage());
                }
            }
        }

        if (request.getTeamRelocations() != null) {
            for (Map.Entry<Integer, String> entry : request.getTeamRelocations().entrySet()) {
                try {
                    session = defenderService.relocateTacticalTeam(session, entry.getKey(), entry.getValue(), config);
                } catch (Exception e) {
                    System.err.println("Failed team relocation: " + e.getMessage());
                }
            }
        }

        // Resolve security sweeps (Local patrols raid nodes)
        int currentTurn = session.getCurrentTurn();
        java.util.Random rollRand = new java.util.Random();

        // 1. Resolve Warned Sweeps (hostilePatrolCities): Complete loss if present
        if (session.getHostilePatrolCities() != null && !session.getHostilePatrolCities().isEmpty()) {
            List<String> swept = session.getHostilePatrolCities();
            
            // Apprehend agents in swept cities
            List<GameSession.Agent> survivingAgents = new ArrayList<>();
            for (GameSession.Agent agent : session.getAgents()) {
                if (swept.contains(agent.getCurrentCity())) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Agent " + agent.getCodename() + " was caught in a warned security sweep in " + agent.getCurrentCity().toUpperCase() + " and has been disavowed.",
                            agent.getCurrentCity(),
                            "HQ Communications"
                    ));
                } else {
                    survivingAgents.add(agent);
                }
            }
            session.setAgents(survivingAgents);

            // Wipe out tactical teams in swept cities
            List<GameSession.TacticalTeam> survivingTeams = new ArrayList<>();
            for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
                if (swept.contains(team.getCurrentCity())) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Tactical Team " + team.getName() + " was intercepted and neutralized during a warned security sweep in " + team.getCurrentCity().toUpperCase() + ".",
                            team.getCurrentCity(),
                            "HQ Communications"
                    ));
                } else {
                    survivingTeams.add(team);
                }
            }
            session.setTacticalTeams(survivingTeams);

            // Dismantle safehouses in swept cities
            List<GameSession.Safehouse> safehousesLeft = new ArrayList<>();
            for (GameSession.Safehouse sh : session.getSafehouses()) {
                if (swept.contains(sh.getCityNode()) && "DEFENDER".equals(sh.getOwnerFaction())) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Friendly Safehouse in " + sh.getCityNode().toUpperCase() + " was discovered and dismantled by local security forces during a warned sweep.",
                            sh.getCityNode(),
                            "HQ Communications"
                    ));
                } else {
                    safehousesLeft.add(sh);
                }
            }
            session.setSafehouses(safehousesLeft);

            // After warned sweep resolves, set cooldown on swept cities
            if (session.getSweepCooldownCities() == null) {
                session.setSweepCooldownCities(new java.util.HashMap<>());
            }
            for (String sweptCity : swept) {
                session.getSweepCooldownCities().put(sweptCity, 3);
            }
        }

        // 2. Resolve Surprise Sweeps (surprisePatrolCities): 33% chance of capture/destruction for each resource independently
        if (session.getSurprisePatrolCities() != null && !session.getSurprisePatrolCities().isEmpty()) {
            List<String> swept = session.getSurprisePatrolCities();

            // Resolve surprise sweeps for agents
            List<GameSession.Agent> survivingAgents = new ArrayList<>();
            for (GameSession.Agent agent : session.getAgents()) {
                if (swept.contains(agent.getCurrentCity()) && rollRand.nextDouble() < 0.33) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Agent " + agent.getCodename() + " was caught in a surprise security sweep in " + agent.getCurrentCity().toUpperCase() + " and has been disavowed.",
                            agent.getCurrentCity(),
                            "HQ Communications"
                    ));
                } else {
                    survivingAgents.add(agent);
                }
            }
            session.setAgents(survivingAgents);

            // Resolve surprise sweeps for tactical teams
            List<GameSession.TacticalTeam> survivingTeams = new ArrayList<>();
            for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
                if (swept.contains(team.getCurrentCity()) && rollRand.nextDouble() < 0.33) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Tactical Team " + team.getName() + " was intercepted and neutralized during a surprise security sweep in " + team.getCurrentCity().toUpperCase() + ".",
                            team.getCurrentCity(),
                            "HQ Communications"
                    ));
                } else {
                    survivingTeams.add(team);
                }
            }
            session.setTacticalTeams(survivingTeams);

            // Resolve surprise sweeps for safehouses
            List<GameSession.Safehouse> safehousesLeft = new ArrayList<>();
            for (GameSession.Safehouse sh : session.getSafehouses()) {
                if (swept.contains(sh.getCityNode()) && "DEFENDER".equals(sh.getOwnerFaction()) && rollRand.nextDouble() < 0.33) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Friendly Safehouse in " + sh.getCityNode().toUpperCase() + " was discovered and dismantled during a surprise security sweep.",
                            sh.getCityNode(),
                            "HQ Communications"
                    ));
                } else {
                    safehousesLeft.add(sh);
                }
            }
            session.setSafehouses(safehousesLeft);

            // After surprise sweep resolves, set cooldown on swept cities
            if (session.getSweepCooldownCities() == null) {
                session.setSweepCooldownCities(new java.util.HashMap<>());
            }
            for (String sweptCity : swept) {
                session.getSweepCooldownCities().put(sweptCity, 3);
            }
        }

        // Apply task assignments
        if (request.getAgentTasks() != null) {
            for (Map.Entry<Integer, String> entry : request.getAgentTasks().entrySet()) {
                try {
                    session = defenderService.assignAgentTask(session, entry.getKey(), entry.getValue());
                } catch (Exception e) {
                    System.err.println("Failed agent task assignment: " + e.getMessage());
                }
            }
        }

        // Apply safehouse builds
        if (request.getSafehouseBuilds() != null) {
            for (String cityNode : request.getSafehouseBuilds()) {
                try {
                    session = defenderService.buildSafehouse(session, cityNode, config);
                } catch (Exception e) {
                    System.err.println("Failed safehouse build: " + e.getMessage());
                }
            }
        }

        // Apply tech deployments
        if (request.getTechDeployments() != null) {
            for (Map<String, String> deploy : request.getTechDeployments()) {
                try {
                    String type = deploy.get("type");
                    String cityNode = deploy.get("cityNode");
                    session = defenderService.deployEspionageResource(session, type, cityNode, config);
                } catch (Exception e) {
                    System.err.println("Failed tech deployment: " + e.getMessage());
                }
            }
        }

        // 0. Apply clue assessments submitted in this turn transaction
        if (request.getClueAssessments() != null) {
            for (Map.Entry<Integer, String> entry : request.getClueAssessments().entrySet()) {
                int index = entry.getKey();
                String status = entry.getValue();
                if (index >= 0 && index < session.getDiscoveredClues().size()) {
                    session.getDiscoveredClues().get(index).setAssessment(status);
                }
            }
        }

        List<Map<String, Object>> covertActions = request.getCovertActions();
        if (covertActions == null) {
            covertActions = new ArrayList<>();
        }
        
        // 1. Fetch or execute AI plan step dynamically for current turn
        PlanStep currentStep = null;
        if (!session.isMultiplayer() && "DEFENDER".equals(session.getPlayerRole())) {
            session = aiService.executeTurn(session, config);
        }

        currentStep = new PlanStep();
        currentStep.setTurn(currentTurn);
        currentStep.setSuspectLocation(session.getSuspectLocation() != null ? session.getSuspectLocation() : "karachi");
        currentStep.setPhase(session.getActiveAttackerPhase() != null ? session.getActiveAttackerPhase() : "TRAIL_BREAKING");
        currentStep.setFinanceCity(session.getRequestedFinanceCity() != null ? session.getRequestedFinanceCity() : "NONE");
        currentStep.setLogisticsCity(session.getRequestedLogisticsCity() != null ? session.getRequestedLogisticsCity() : "NONE");

        if (currentStep != null || session.isMultiplayer()) {
            // 2. Resolve Player's Covert Actions for this turn
            for (Map<String, Object> action : covertActions) {
                String type = (String) action.get("actionType"); 
                String city = (String) action.get("cityNode");
                
                // 2.1 Enforce friendly territory constraint for city defense actions
                Node actionNode = config.getNodes().stream().filter(n -> n.getId().equals(city)).findFirst().orElse(null);
                if (actionNode != null) {
                    if (!"HOME_TERRITORY".equals(actionNode.getTerritory())) {
                        if ("TRANSIT_CHECKPOINT".equals(type) || "ROADBLOCK".equals(type) || "CITY_GRID_LOCKDOWN".equals(type) || "LOCKDOWN".equals(type)) {
                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                                    "Operation " + type + " in " + city + " aborted: City defense is only available in friendly cities."));
                            continue;
                        }
                    }
                    if ("STOP_INFILTRATION".equals(type) || "STOP_EXFILTRATION".equals(type)) {
                        if (!isFriendlyBorderCity(city, config)) {
                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                                    "Operation " + type + " in " + city + " aborted: Border defense is only available in friendly border cities."));
                            continue;
                        }
                    }
                }

                // 2.2 Enforce costs (doubled in hostile territory)
                int cost = 0;
                if ("FREEZE_FINANCE".equals(type)) cost = 50000;
                else if ("RAID_LOGISTICS".equals(type)) cost = 50000;
                else if ("RAID_SAFEHOUSE".equals(type)) cost = 100000;
                else if ("TRANSIT_CHECKPOINT".equals(type) || "ROADBLOCK".equals(type)) cost = 80000;
                else if ("CITY_GRID_LOCKDOWN".equals(type) || "LOCKDOWN".equals(type)) cost = 100000;
                else if ("STOP_INFILTRATION".equals(type)) cost = 35000;
                else if ("STOP_EXFILTRATION".equals(type)) cost = 40000;

                if (actionNode != null && "HOSTILE_TERRITORY".equals(actionNode.getTerritory())) {
                    cost *= 2;
                }

                if (session.getBudget() < cost) {
                    session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER", 
                            "Operation " + type + " in " + city + " cancelled: Insufficient budget."));
                    continue;
                }
                session.setBudget(session.getBudget() - cost);

                // 2A. Resolve Safehouse Raid Combat Encounter
                boolean isSuspectAtRaid = false;
                if (session.isMultiplayer()) {
                    isSuspectAtRaid = city.equals(session.getSuspectLocation());
                } else {
                    isSuspectAtRaid = currentStep != null && city.equals(currentStep.getSuspectLocation());
                }

                if ("RAID_SAFEHOUSE".equals(type) && isSuspectAtRaid) {
                    // Extract chosen targetSafehouseCode from user action
                    String targetCode = action.containsKey("targetSafehouseCode") ? (String) action.get("targetSafehouseCode") : "";
                    
                    // Verify if suspect is actually in this specific raided safehouse code
                    boolean isCorrectCode = true;
                    if (targetCode != null && !targetCode.trim().isEmpty()) {
                        boolean codeExists = session.getSafehouses().stream()
                            .anyMatch(s -> s.getCityNode().equals(city) && "HOSTILE".equals(s.getOwnerFaction()) && targetCode.equals(s.getSafehouseCode()));
                        if (!codeExists) {
                            isCorrectCode = false;
                        }
                    }

                    int teamId = action.containsKey("teamId") ? (Integer) action.get("teamId") : 1;
                    GameSession.TacticalTeam team = session.getTacticalTeams().stream()
                            .filter(t -> t.getId() == teamId)
                            .findFirst()
                            .orElse(null);

                    int combatSkill = team != null ? team.getSkills().getOrDefault("combat", 50) : 50;
                    java.util.Random rand = new java.util.Random();
                    int roll = rand.nextInt(100);

                    if (isCorrectCode && (roll <= combatSkill || session.isSuspectEscapedBefore())) {
                        session.setStatus("SUCCESS");
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE", 
                                "COMBAT SUCCESS! Actual threat agent (" + session.getActualAttacker() + ") was cornered and neutralized inside Hostile Safehouse [" + targetCode + "] by " + (team != null ? team.getName() : "Vanguard Unit") + " in " + city + ". Threat eliminated."));
                        return repository.save(session);
                    } else {
                        int newTurn = Math.max(1, currentTurn - 10);
                        session.setCurrentTurn(newTurn);
                        session.setMaxTurns(session.getMaxTurns() + 10);
                        session.setSuspectEscapedBefore(true);
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE", 
                                "COMBAT ENGAGEMENT: " + (team != null ? team.getName() : "Delta Team") + " raided the safehouse [" + targetCode + "] in " + city + ". " + (isCorrectCode ? "The suspect was there but escaped!" : "Intel breach! The raided code was empty. Suspect was elsewhere.") + " The actual threat agent (" + session.getActualAttacker() + ") escaped the dragnet but suffered a 10-turn operational setback. Sourcing timeline delayed."));
                        
                        if (actionNode != null && "HOSTILE_TERRITORY".equals(actionNode.getTerritory())) {
                            int stealth = team != null ? team.getSkills().getOrDefault("stealth", 50) : 50;
                            if (rand.nextInt(100) > stealth) {
                                if (rand.nextBoolean()) {
                                    session.getTacticalTeams().remove(team);
                                    session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                            "COMPROMISED RAID: Tactical Team " + (team != null ? team.getName() : "Delta Team") + " was captured in " + city.toUpperCase() + " after the failed raid."));
                                } else {
                                    int currentCityHeat = session.getCityHeat().getOrDefault(city, 0);
                                    session.getCityHeat().put(city, Math.min(100, currentCityHeat + 20));
                                    session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                            "COMPROMISED RAID: Tactical Team " + (team != null ? team.getName() : "Delta Team") + " was detected in " + city.toUpperCase() + " after the failed raid. City detection heat increased by +20%."));
                                }
                            }
                            int currentCityHeat = session.getCityHeat().getOrDefault(city, 0);
                            session.getCityHeat().put(city, Math.min(100, currentCityHeat + 40));
                        }
                        return repository.save(session);
                    }
                }

                boolean isFinanceLogisticsMatch = false;
                if ("FREEZE_FINANCE".equals(type)) {
                    if (session.isMultiplayer()) {
                        isFinanceLogisticsMatch = city.equals(session.getRequestedFinanceCity());
                    } else {
                        isFinanceLogisticsMatch = currentStep != null && city.equals(currentStep.getFinanceCity());
                    }
                } else if ("RAID_LOGISTICS".equals(type)) {
                    if (session.isMultiplayer()) {
                        isFinanceLogisticsMatch = city.equals(session.getRequestedLogisticsCity());
                    } else {
                        isFinanceLogisticsMatch = currentStep != null && city.equals(currentStep.getLogisticsCity());
                    }
                }

                if (isFinanceLogisticsMatch) {
                    if (session.isMultiplayer()) {
                        if ("FREEZE_FINANCE".equals(type)) {
                            session.setRequestedFinanceCity(null);
                            session.setFinanceCollectionTurnsRemaining(0);
                            session.setFinanceCollected(false);
                            session.setActiveAttackerPhase("FINANCE_SOURCING");
                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER", 
                                    "FREEZE FINANCE: Defender has frozen your finance pipeline in " + city.toUpperCase() + "! Sourcing defeated. You must request finance in a different city."));
                        } else {
                            session.setRequestedLogisticsCity(null);
                            session.setLogisticsCollectionTurnsRemaining(0);
                            session.setLogisticsCollected(false);
                            session.setActiveAttackerPhase("LOGISTICS_SOURCING");
                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER", 
                                    "RAID LOGISTICS: Defender has raided your logistics cache in " + city.toUpperCase() + "! Sourcing defeated. You must request logistics in a different city."));
                        }
                    } else {
                        reallocateAiSourcing(session, city, "FREEZE_FINANCE".equals(type), config);
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER", 
                                "OPERATION SUCCESS: Defender " + type + " in " + city.toUpperCase() + " disrupted the suspect's sourcing. Attacker plan defeated, forcing resource re-allocation."));
                    }
                    continue; 
                }

                boolean isMatch = false;
                if (("ROADBLOCK".equals(type) || "TRANSIT_CHECKPOINT".equals(type))) {
                    if (session.isMultiplayer()) {
                        isMatch = city.equals(session.getSuspectLocation());
                    } else {
                        isMatch = currentStep != null && city.equals(currentStep.getSuspectLocation());
                    }
                } else if ("STOP_INFILTRATION".equals(type)) {
                    if (session.isMultiplayer()) {
                        isMatch = city.equals(session.getSuspectLocation()) && "BORDER_CROSSING".equals(session.getActiveAttackerPhase());
                    } else {
                        isMatch = currentStep != null && city.equals(currentStep.getSuspectLocation()) && currentStep.isSmuggling();
                    }
                } else if ("STOP_EXFILTRATION".equals(type)) {
                    if (session.isMultiplayer()) {
                        isMatch = city.equals(session.getSuspectLocation()) && "EXFILTRATION".equals(session.getActiveAttackerPhase());
                    } else {
                        PlanStep strikeStep = session.getAiMasterPlan().getPrimaryPlan().get(session.getAiMasterPlan().getPrimaryPlan().size() - 1);
                        if (city.equals(strikeStep.getEscapeNode())) {
                            isMatch = true;
                        }
                    }
                } else if (("LOCKDOWN".equals(type) || "CITY_GRID_LOCKDOWN".equals(type))) {
                    if (session.isMultiplayer()) {
                        final String finalSuspectLoc = session.getSuspectLocation();
                        boolean suspectCurrentlyHere = city.equals(finalSuspectLoc);
                        boolean suspectMovingHere = false;
                        Node suspectNode = config.getNodes().stream().filter(n -> n.getId().equals(finalSuspectLoc)).findFirst().orElse(null);
                        if (suspectNode != null && suspectNode.getConnections() != null) {
                            suspectMovingHere = suspectNode.getConnections().contains(city);
                        }
                        if (suspectCurrentlyHere || suspectMovingHere) {
                            isMatch = true;
                        }
                    } else {
                        boolean suspectCurrentlyHere = city.equals(session.getSuspectLocation());
                        if (suspectCurrentlyHere) {
                            isMatch = true;
                        }
                    }
                }

                if (isMatch) {
                    session.setMaxTurns(session.getMaxTurns() + 3);
                    session.setSuspectEscapedBefore(true);
                    session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER", 
                            "Alert! Operative path disrupted in " + city.toUpperCase() + ". Sourcing delayed. Timeline extended by 3 turns."));
                    
                    // Force dynamic AI relocation away from the locked-down / matched node
                    List<Node> hostiles = config.getNodes().stream()
                            .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()) && !n.getId().equals(city))
                            .collect(Collectors.toList());
                    if (!hostiles.isEmpty()) {
                        session.setSuspectLocation(hostiles.get(new java.util.Random().nextInt(hostiles.size())).getId());
                    }
                    break;
                } else {
                    if (actionNode != null && "HOSTILE_TERRITORY".equals(actionNode.getTerritory())) {
                        int teamId = action.containsKey("teamId") ? (Integer) action.get("teamId") : 1;
                        GameSession.TacticalTeam team = session.getTacticalTeams().stream()
                                .filter(t -> t.getId() == teamId)
                                .findFirst()
                                .orElse(null);
                        int stealth = team != null ? team.getSkills().getOrDefault("stealth", 50) : 50;
                        java.util.Random rand = new java.util.Random();
                        int roll = rand.nextInt(100);
                        if (roll > stealth) {
                            if (rand.nextBoolean()) {
                                session.getTacticalTeams().remove(team);
                                session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                        "COMPROMISED OPERATION: Tactical Team " + (team != null ? team.getName() : "Delta Team") + " was captured during a failed operation in " + city.toUpperCase() + "."));
                            } else {
                                int currentCityHeat = session.getCityHeat().getOrDefault(city, 0);
                                session.getCityHeat().put(city, Math.min(100, currentCityHeat + 20));
                                session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                        "COMPROMISED OPERATION: Tactical Team " + (team != null ? team.getName() : "Delta Team") + " was detected in " + city.toUpperCase() + " but escaped. City detection heat increased by +20%."));
                            }
                        }
                        int currentCityHeat = session.getCityHeat().getOrDefault(city, 0);
                        session.getCityHeat().put(city, Math.min(100, currentCityHeat + 40));
                    }
                }
            }
        }
        // 3.5 Process active Biometric Scans, Border Guards, and Signal Jammers
        int lastTurn = currentTurn - 1;
        if (session.getEspionageResources() != null && session.getSuspectPlans() != null && lastTurn >= 1) {
            for (GameSession.ActiveResource resource : session.getEspionageResources()) {
                String resCity = resource.getCityNode();
                String resType = resource.getType();

                for (String suspectName : session.getAttackerNames()) {
                    List<PlanStep> suspectPlan = session.getSuspectPlans().get(suspectName);
                    if (suspectPlan == null) continue;
                    PlanStep suspectLastStep = null;
                    if (session.isMultiplayer()) {
                        suspectLastStep = new PlanStep();
                        if (suspectName.equals(session.getActualAttacker())) {
                            suspectLastStep.setSuspectLocation(session.getSuspectLocation());
                            suspectLastStep.setPhase(session.getActiveAttackerPhase() != null ? session.getActiveAttackerPhase() : "TRAIL_BREAKING");
                            PlanStep planStep = suspectPlan.stream().filter(s -> s.getTurn() == currentTurn).findFirst().orElse(null);
                            if (planStep != null) {
                                suspectLastStep.setFinanceCity(planStep.getFinanceCity());
                                suspectLastStep.setLogisticsCity(planStep.getLogisticsCity());
                                suspectLastStep.setSmuggling(planStep.isSmuggling());
                            } else {
                                suspectLastStep.setFinanceCity("NONE");
                                suspectLastStep.setLogisticsCity("NONE");
                                suspectLastStep.setSmuggling(false);
                            }
                        } else {
                            final String name = suspectName;
                            GameSession.ActiveDecoy decoy = session.getActiveDecoys().stream()
                                    .filter(d -> d.getCityNode() != null)
                                    .findFirst()
                                    .orElse(null);
                            if (decoy != null) {
                                suspectLastStep.setSuspectLocation(decoy.getCityNode());
                                suspectLastStep.setPhase("DECOY");
                            } else {
                                continue;
                            }
                        }
                    } else {
                        suspectLastStep = suspectPlan.stream().filter(s -> s.getTurn() == lastTurn).findFirst().orElse(null);
                        if (suspectLastStep == null) continue;
                    }

                    // 1. Biometric Scan Alert
                    if ("BIOMETRIC_SCAN".equals(resType) && resCity.equals(suspectLastStep.getSuspectLocation())) {
                        Node node = config.getNodes().stream().filter(n -> n.getId().equals(resCity)).findFirst().orElse(null);
                        String cityName = node != null ? node.getName() : resCity;
                        session.getDiscoveredClues().add(new GameSession.Clue(
                                currentTurn,
                                "BIOMETRIC_SCAN",
                                "Biometric Scan Alert: Facial match confirmed for suspect " + suspectName + " at checkpoint scanner in " + cityName + ".",
                                resCity,
                                "Biometric Scanner"
                        ));
                        int currentCityHeat = session.getCityHeat().getOrDefault(resCity, 0);
                        session.getCityHeat().put(resCity, Math.min(100, currentCityHeat + 25));
                    }

                    // 2. Border Guard Mobilization — intercept crossing + 10% capture risk, fallback on failure
                    if ("BORDER_GUARD".equals(resType) && resCity.equals(suspectLastStep.getSuspectLocation()) && (suspectLastStep.isSmuggling() || "BORDER_CROSSING".equals(suspectLastStep.getPhase()))) {
                        Node node = config.getNodes().stream().filter(n -> n.getId().equals(resCity)).findFirst().orElse(null);
                        String cityName = node != null ? node.getName() : resCity;

                        if (suspectName.equals(session.getActualAttacker())) {
                            java.util.Random borderRoll = new java.util.Random();
                            if (borderRoll.nextDouble() < 0.10) {
                                session.setStatus("SUCCESS");
                                session.getDiscoveredClues().add(new GameSession.Clue(
                                        currentTurn,
                                        "BORDER_GUARD",
                                        "BORDER CAPTURE: Suspect " + session.getActualAttacker() + " was intercepted and captured by border patrol at " + cityName + " crossing. Threat neutralized.",
                                        resCity,
                                        "Border Guard Command"
                                ));
                                return repository.save(session);
                            }

                            // Crossing detected but suspect escaped — trigger fallback plan
                            session.getDiscoveredClues().add(new GameSession.Clue(
                                    currentTurn,
                                    "BORDER_GUARD",
                                    "BORDER INTERDICTION: Border patrol intercepted suspect " + session.getActualAttacker() + " at " + cityName + " crossing. The suspect escaped but the crossing has failed and the cell must reroute through an alternate network.",
                                    resCity,
                                    "Border Guard Command"
                            ));
                            if (!session.getAiMasterPlan().getFallbackPlan().isEmpty()) {
                                session.getAiMasterPlan().setPrimaryPlan(session.getAiMasterPlan().getFallbackPlan());
                                session.getAiMasterPlan().setFallbackPlan(new ArrayList<>());
                                session.getSuspectPlans().put(session.getActualAttacker(), session.getAiMasterPlan().getPrimaryPlan());
                                session.setMaxTurns(session.getMaxTurns() + 3);
                            } else {
                                session.setMaxTurns(session.getMaxTurns() + 2);
                                session.setCurrentTurn(Math.max(1, session.getCurrentTurn() - 2));
                            }
                        }
                    }

                    // 3. Signal Jammer — intercept attacker comms for any phase
                    if ("SIGNAL_JAMMER".equals(resType) && resCity.equals(suspectLastStep.getSuspectLocation())) {
                        Node node = config.getNodes().stream().filter(n -> n.getId().equals(resCity)).findFirst().orElse(null);
                        String cityName = node != null ? node.getName() : resCity;
                        String phaseLabel = suspectLastStep.getPhase().replace("_", " ");
                        String commsDetail = "comms intercept: Suspect " + suspectName + " (" + phaseLabel + ") — " +
                            (suspectLastStep.getFinanceCity() != null && resCity.equals(suspectLastStep.getFinanceCity()) ?
                                "financial transaction routing through " + cityName :
                             suspectLastStep.getLogisticsCity() != null && resCity.equals(suspectLastStep.getLogisticsCity()) ?
                                "logistics coordination active in " + cityName :
                                "command signals relayed through " + cityName);
                        session.getDiscoveredClues().add(new GameSession.Clue(
                                currentTurn,
                                "SIGNAL_JAMMER",
                                "Signal Jammer Alert: " + commsDetail + ".",
                                resCity,
                                "Signal Jammer Tech"
                        ));
                        if (suspectName.equals(session.getActualAttacker())) {
                            // If fallback plan has not been activated yet, trigger fallback pivot
                            if (!session.getAiMasterPlan().getFallbackPlan().isEmpty()) {
                                session.getAiMasterPlan().setPrimaryPlan(session.getAiMasterPlan().getFallbackPlan());
                                session.getAiMasterPlan().setFallbackPlan(new ArrayList<>());
                                session.getSuspectPlans().put(session.getActualAttacker(), session.getAiMasterPlan().getPrimaryPlan());
                                session.setMaxTurns(session.getMaxTurns() + 3);
                            } else {
                                // Already pivoted: add 2 turns delay
                                session.setMaxTurns(session.getMaxTurns() + 2);
                                session.setCurrentTurn(Math.max(1, session.getCurrentTurn() - 2));
                            }
                        }
                    }
                }
            }
        }

        // 3. Execute Clue Generation Engine (Decks, tech scans, and T-5 footprints)
        List<GameSession.Clue> turnIntel = clueEngine.generateTurnClues(session, config);
        session.getDiscoveredClues().addAll(turnIntel);

        // Also check if any spy unmasked a hostile safehouse or investigated hotspots
        for (GameSession.Agent agent : session.getAgents()) {
            if (agent.getCooldownRemaining() > 0) continue;
            String city = agent.getCurrentCity();
            
            if ("UNCOVER_SAFEHOUSE".equals(agent.getActiveTask())) {
                // Expose existing hidden hostile safehouse in that city if any
                session.getSafehouses().stream()
                    .filter(s -> s.getCityNode().equals(city) && "HOSTILE".equals(s.getOwnerFaction()) && !s.isUncovered())
                    .forEach(s -> s.setUncovered(true));
            } else if ("MONITOR_FINANCE".equals(agent.getActiveTask())) {
                if (session.getUncoveredFinanceCities() == null) {
                    session.setUncoveredFinanceCities(new ArrayList<>());
                }
                if (!session.getUncoveredFinanceCities().contains(city)) {
                    session.getUncoveredFinanceCities().add(city);
                }
            } else if ("MONITOR_LOGISTICS".equals(agent.getActiveTask())) {
                if (session.getUncoveredLogisticsCities() == null) {
                    session.setUncoveredLogisticsCities(new ArrayList<>());
                }
                if (!session.getUncoveredLogisticsCities().contains(city)) {
                    session.getUncoveredLogisticsCities().add(city);
                }
            }
        }

        // Tick down active technological scanner durations and remove expired ones
        if (session.getEspionageResources() != null) {
            List<GameSession.ActiveResource> activeResources = new ArrayList<>();
            for (GameSession.ActiveResource res : session.getEspionageResources()) {
                int left = res.getCooldownRemaining() - 1;
                if (left > 0) {
                    res.setCooldownRemaining(left);
                    activeResources.add(res);
                } else {
                    session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "MATRIX_LOGS", 
                            "System notice: Technological scanner feed (" + res.getType() + ") in " + res.getCityNode().toUpperCase() + " has expired after 10 turns of deployment."));
                }
            }
            session.setEspionageResources(activeResources);
        }

        // 4. Tick down lockout/cooldown timers
        for (GameSession.Agent agent : session.getAgents()) {
            if (agent.getCooldownRemaining() > 0) {
                agent.setCooldownRemaining(agent.getCooldownRemaining() - 1);
                if (agent.getCooldownRemaining() == 0 && "TRAINING".equals(agent.getActiveTask())) {
                    agent.setActiveTask("FIND_SUSPECT");
                }
            }
        }
        for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
            if (team.getCooldownRemaining() > 0) {
                team.setCooldownRemaining(team.getCooldownRemaining() - 1);
            }
        }

        // Update Heat Percentage and COBRA Alert Level
        updateHeatLevel(session, currentStep, config);

        // Update Attacker sourcing and handover timers
        tickAttackerMilestones(session);

        // 5. Advance timeline
        session.setCurrentTurn(currentTurn + 1);

        // Check Defeat: if currentTurn exceeds deadline limit
        if (session.getCurrentTurn() > session.getMaxTurns()) {
            session.setStatus("COMPROMISED");
            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE", 
                    "Crisis level alert: Strike executed. Strike initiated. Mission failed."));
        }

        // 6. Roll next turn's hostile security sweep targets (Warned Sweeps & Surprise Sweeps)
        List<String> nextWarnedPatrols = new ArrayList<>();
        List<String> nextSurprisePatrols = new ArrayList<>();

        // Decrement sweep cooldowns and remove expired
        if (session.getSweepCooldownCities() != null) {
            java.util.Map<String, Integer> cooldowns = new java.util.HashMap<>();
            for (java.util.Map.Entry<String, Integer> entry : session.getSweepCooldownCities().entrySet()) {
                int remaining = entry.getValue() - 1;
                if (remaining > 0) {
                    cooldowns.put(entry.getKey(), remaining);
                }
            }
            session.setSweepCooldownCities(cooldowns);
        }

        // Build eligible city pool (exclude cities on cooldown)
        List<String> allHostileIds = config.getNodes().stream()
                .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                .map(com.spygame.covertops.model.Node::getId)
                .collect(java.util.stream.Collectors.toList());
        java.util.Set<String> onCooldown = session.getSweepCooldownCities() != null
                ? session.getSweepCooldownCities().keySet() : java.util.Collections.emptySet();
        List<String> eligibleHostileCities = allHostileIds.stream()
                .filter(id -> !onCooldown.contains(id))
                .collect(java.util.stream.Collectors.toList());

        java.util.Random sweepRand = new java.util.Random();
        int nextTurn = session.getCurrentTurn();

        if (!eligibleHostileCities.isEmpty()) {
            // First determine if any high-heat city gets targeted as warned sweep
            List<String> highHeatHostileCities = new ArrayList<>();
            if (session.getCityHeat() != null) {
                for (Map.Entry<String, Integer> entry : session.getCityHeat().entrySet()) {
                    if (entry.getValue() > 50 && eligibleHostileCities.contains(entry.getKey())) {
                        highHeatHostileCities.add(entry.getKey());
                    }
                }
            }

            if (!highHeatHostileCities.isEmpty()) {
                // High-heat cities are targeted by warned sweeps
                nextWarnedPatrols.addAll(highHeatHostileCities);
            } else {
                // Standard rolling logic for warned sweeps
                double warnedSweepChance = nextTurn <= 8 ? 0.20 : (nextTurn <= 16 ? 0.40 : 0.60);
                int maxWarned = 2;
                if (sweepRand.nextDouble() < warnedSweepChance) {
                    List<String> shuffleHostile = new ArrayList<>(eligibleHostileCities);
                    java.util.Collections.shuffle(shuffleHostile, sweepRand);
                    for (int i = 0; i < Math.min(maxWarned, shuffleHostile.size()); i++) {
                        nextWarnedPatrols.add(shuffleHostile.get(i));
                    }
                }
            }

            // Roll for surprise sweeps (which must be distinct from warned sweeps)
            double surpriseSweepChance = nextTurn <= 8 ? 0.15 : (nextTurn <= 16 ? 0.30 : 0.45);
            int maxSurprise = nextTurn <= 16 ? 1 : 2;
            if (sweepRand.nextDouble() < surpriseSweepChance) {
                List<String> potentialSurpriseCities = eligibleHostileCities.stream()
                        .filter(id -> !nextWarnedPatrols.contains(id))
                        .collect(java.util.stream.Collectors.toList());
                if (!potentialSurpriseCities.isEmpty()) {
                    java.util.Collections.shuffle(potentialSurpriseCities, sweepRand);
                    for (int i = 0; i < Math.min(maxSurprise, potentialSurpriseCities.size()); i++) {
                        nextSurprisePatrols.add(potentialSurpriseCities.get(i));
                    }
                }
            }
        }

        session.setHostilePatrolCities(nextWarnedPatrols);
        session.setSurprisePatrolCities(nextSurprisePatrols);

        // Generate SECURITY_SWEEP_ALERT clues for the NEXT turn's warned sweeps
        // This gives the player a full turn to react before the sweep hits.
        for (String patrolCityId : nextWarnedPatrols) {
            Node patrolNode = config.getNodes().stream()
                    .filter(n -> n.getId().equals(patrolCityId))
                    .findFirst()
                    .orElse(null);
            String patrolCityName = patrolNode != null ? patrolNode.getName() : patrolCityId.toUpperCase();
            session.getDiscoveredClues().add(new GameSession.Clue(
                    session.getCurrentTurn(),
                    "SECURITY_SWEEP_ALERT",
                    "⚠ SWEEP WARNING: Local security forces are planning a raid sweep in " + patrolCityName + " next turn. ASSETS MUST VACATE or face absolute capture/destruction.",
                    patrolCityId,
                    "Field Intercept"
            ));
        }

        if (session.isMultiplayer()) {
            String attackerUsername = session.getPlayerA().equals(session.getActivePlayer()) ? session.getPlayerB() : session.getPlayerA();
            session.setActivePlayer(attackerUsername);
            session.setPlayerRole("ATTACKER");
            session.setTurnDeadline(java.time.LocalDateTime.now().plusMinutes(session.getTurnTimerDurationMinutes()));
        }

        return repository.save(session);
    }

    private void updateHeatLevel(GameSession session, PlanStep currentStep, ScenarioConfig config) {
        if (currentStep == null && !session.isMultiplayer()) return;
        
        // 1. Decay detection heat for all hostile cities by 10%
        if (session.getCityHeat() == null) {
            session.setCityHeat(new java.util.HashMap<>());
        }
        for (Node node : config.getNodes()) {
            if ("HOSTILE_TERRITORY".equals(node.getTerritory())) {
                int heat = session.getCityHeat().getOrDefault(node.getId(), 0);
                session.getCityHeat().put(node.getId(), Math.max(0, heat - 10));
            } else {
                session.getCityHeat().put(node.getId(), 0); // Friendly is always 0
            }
        }

        // 2. Add +10% detection heat for each tactical team in a hostile city
        for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
            String teamCity = team.getCurrentCity();
            Node node = config.getNodes().stream().filter(n -> n.getId().equals(teamCity)).findFirst().orElse(null);
            if (node != null && "HOSTILE_TERRITORY".equals(node.getTerritory())) {
                int heat = session.getCityHeat().getOrDefault(teamCity, 0);
                session.getCityHeat().put(teamCity, Math.min(100, heat + 10));
            }
        }

        // 3. Add +15% * (N - 1) detection heat if multiple (N >= 2) agents are in the same hostile city
        java.util.Map<String, Integer> agentCounts = new java.util.HashMap<>();
        for (GameSession.Agent agent : session.getAgents()) {
            String agentCity = agent.getCurrentCity();
            Node node = config.getNodes().stream().filter(n -> n.getId().equals(agentCity)).findFirst().orElse(null);
            if (node != null && "HOSTILE_TERRITORY".equals(node.getTerritory())) {
                agentCounts.put(agentCity, agentCounts.getOrDefault(agentCity, 0) + 1);
            }
        }
        for (Map.Entry<String, Integer> entry : agentCounts.entrySet()) {
            int count = entry.getValue();
            if (count >= 2) {
                int extraHeat = 15 * (count - 1);
                int heat = session.getCityHeat().getOrDefault(entry.getKey(), 0);
                session.getCityHeat().put(entry.getKey(), Math.min(100, heat + extraHeat));
            }
        }

        // 4. Add +30% detection heat if any agent is in the same city as any suspect (actual or decoy) this turn
        for (GameSession.Agent agent : session.getAgents()) {
            String agentCity = agent.getCurrentCity();
            Node node = config.getNodes().stream().filter(n -> n.getId().equals(agentCity)).findFirst().orElse(null);
            if (node != null && "HOSTILE_TERRITORY".equals(node.getTerritory())) {
                boolean overlap = false;
                for (Map.Entry<String, List<PlanStep>> entry : session.getSuspectPlans().entrySet()) {
                    PlanStep suspectStep = entry.getValue().stream()
                            .filter(s -> s.getTurn() == session.getCurrentTurn())
                            .findFirst()
                            .orElse(null);
                    if (suspectStep != null && agentCity.equals(suspectStep.getSuspectLocation())) {
                        overlap = true;
                        break;
                    }
                }
                if (overlap) {
                    int heat = session.getCityHeat().getOrDefault(agentCity, 0);
                    session.getCityHeat().put(agentCity, Math.min(100, heat + 30));
                }
            }
        }

        // 5. Calculate base Operations Heat
        int baseHeat = 10;
        String phase = currentStep != null ? currentStep.getPhase() : (session.getActiveAttackerPhase() != null ? session.getActiveAttackerPhase() : "TRAIL_BREAKING");
        String loc = currentStep != null ? currentStep.getSuspectLocation() : session.getSuspectLocation();

        if ("TRAIL_BREAKING".equals(phase) || "FINANCE_SOURCING".equals(phase)) {
            baseHeat = 15;
        } else if ("LOGISTICS_SOURCING".equals(phase) || "HANDOVER".equals(phase)) {
            baseHeat = 30;
        } else if ("BORDER_CROSSING".equals(phase) || currentStep.isSmuggling()) {
            baseHeat = 50;
        } else if ("ATTACK_PREP".equals(phase)) {
            if ("new_delhi".equals(loc)) {
                baseHeat = 90;
            } else if ("chandigarh".equals(loc)) {
                baseHeat = 80;
            } else {
                baseHeat = 65;
            }
        } else if ("STRIKE".equals(phase)) {
            baseHeat = 98;
        }

        // Fallback pivot adds +10% heat
        boolean isPivoted = session.getAiMasterPlan().getFallbackPlan().isEmpty();
        if (isPivoted) {
            baseHeat += 10;
        }
        
        // Attacker escape adds +15% heat
        if (session.isSuspectEscapedBefore()) {
            baseHeat += 15;
        }

        // Add max city detection heat / 2
        int maxCityHeat = 0;
        for (int h : session.getCityHeat().values()) {
            if (h > maxCityHeat) {
                maxCityHeat = h;
            }
        }
        baseHeat += maxCityHeat / 2;

        int heat = Math.max(0, Math.min(100, baseHeat));
        session.setHeatPercentage(heat);

        if (heat <= 25) {
            session.setCobraAlertLevel("COBRA_5_LOW");
        } else if (heat <= 50) {
            session.setCobraAlertLevel("COBRA_4_GUARDED");
        } else if (heat <= 75) {
            session.setCobraAlertLevel("COBRA_3_ELEVATED");
        } else if (heat <= 90) {
            session.setCobraAlertLevel("COBRA_2_HIGH");
        } else {
            session.setCobraAlertLevel("COBRA_1_SEVERE");
        }
    }

    private void tickAttackerMilestones(GameSession session) {
        if (session.getFinanceCollectionTurnsRemaining() > 0) {
            session.setFinanceCollectionTurnsRemaining(session.getFinanceCollectionTurnsRemaining() - 1);
            if (session.getFinanceCollectionTurnsRemaining() == 0) {
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "FINANCE_COLLECTIBLE",
                        "Finance collection channels are ready. Return to " + session.getRequestedFinanceCity().toUpperCase() + " to collect."
                ));
            }
        }
        if (session.getLogisticsCollectionTurnsRemaining() > 0) {
            session.setLogisticsCollectionTurnsRemaining(session.getLogisticsCollectionTurnsRemaining() - 1);
            if (session.getLogisticsCollectionTurnsRemaining() == 0) {
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "LOGISTICS_COLLECTIBLE",
                        "Logistics collection channels are ready. Return to " + session.getRequestedLogisticsCity().toUpperCase() + " to collect."
                ));
            }
        }
        if (session.getHandoverCity() != null && !session.isHandoverCompleted()) {
            if (session.getHandoverCity().equals(session.getSuspectLocation())) {
                session.setHandoverTurnsRemaining(session.getHandoverTurnsRemaining() - 1);
                if (session.getHandoverTurnsRemaining() == 0) {
                    session.setHandoverCompleted(true);
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            session.getCurrentTurn(),
                            "HANDOVER_COMPLETE",
                            "Handover complete. Operational clearance to cross border can now be requested."
                    ));
                    session.setActiveAttackerPhase("HANDOVER");
                }
            } else {
                // Reset handover if suspect left the city
                session.setHandoverCity(null);
                session.setHandoverTurnsRemaining(-1);
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "HANDOVER_INTERRUPTED",
                        "WARNING: Handover interrupted. Operative left the handover city before completion."
                ));
                session.setActiveAttackerPhase(session.isFinanceCollected() && session.isLogisticsCollected() ? "HANDOVER" : "TRAIL_BREAKING");
            }
        }

        // Tick down active decoys (10 turns standard duration)
        if (session.getActiveDecoys() != null) {
            List<GameSession.ActiveDecoy> nextDecoys = new ArrayList<>();
            for (GameSession.ActiveDecoy d : session.getActiveDecoys()) {
                int rem = d.getTurnsRemaining() - 1;
                if (rem > 0) {
                    d.setTurnsRemaining(rem);
                    nextDecoys.add(d);
                } else {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            session.getCurrentTurn(),
                            "DECOY_EXPIRED",
                            "Decoy decoy " + d.getType() + " at " + d.getCityNode().toUpperCase() + " has expired."
                    ));
                }
            }
            session.setActiveDecoys(nextDecoys);
        }

        // Tick down secure safehouse turns (5 turns standard duration)
        if (session.getSecureSafehouseTurns() != null) {
            java.util.Map<String, Integer> nextSecureSafehouses = new java.util.HashMap<>();
            for (java.util.Map.Entry<String, Integer> entry : session.getSecureSafehouseTurns().entrySet()) {
                int left = entry.getValue() - 1;
                if (left > 0) {
                    nextSecureSafehouses.put(entry.getKey(), left);
                } else {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            session.getCurrentTurn(),
                            "SAFEHOUSE_EXPOSED",
                            "Secure safehouse cover at " + entry.getKey().toUpperCase() + " has expired. It is now vulnerable to Defender scans."
                    ));
                }
            }
            session.setSecureSafehouseTurns(nextSecureSafehouses);
        }
    }

    private void reallocateAiSourcing(GameSession session, String frozenCity, boolean isFinance, ScenarioConfig config) {
        if (isFinance) {
            session.setRequestedFinanceCity(null);
            session.setFinanceCollectionTurnsRemaining(0);
            session.setFinanceCollected(false);
            session.setActiveAttackerPhase("FINANCE_SOURCING");
        } else {
            session.setRequestedLogisticsCity(null);
            session.setLogisticsCollectionTurnsRemaining(0);
            session.setLogisticsCollected(false);
            session.setActiveAttackerPhase("LOGISTICS_SOURCING");
        }
        session.setMaxTurns(session.getMaxTurns() + 5);
    }

    private boolean isFriendlyBorderCity(String cityNodeId, ScenarioConfig config) {
        Node node = config.getNodes().stream().filter(n -> n.getId().equals(cityNodeId)).findFirst().orElse(null);
        if (node == null || !"HOME_TERRITORY".equals(node.getTerritory())) {
            return false;
        }
        if (node.getConnections() != null) {
            for (String connId : node.getConnections()) {
                Node connNode = config.getNodes().stream().filter(n -> n.getId().equals(connId)).findFirst().orElse(null);
                if (connNode != null && "HOSTILE_TERRITORY".equals(connNode.getTerritory())) {
                    return true;
                }
            }
        }
        return false;
    }
}
