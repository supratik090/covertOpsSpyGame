package com.spygame.covertops.service;

import com.spygame.covertops.model.AIMasterPlan;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.GameSessionRepository;
import com.spygame.covertops.repository.ScenarioConfigRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class GameSessionLobbyService {

    @Autowired
    private GameSessionRepository repository;

    @Autowired
    private ScenarioConfigRepository scenarioConfigRepository;

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

    public void deleteSession(UUID sessionId) {
        if (!repository.existsById(sessionId)) {
            throw new IllegalArgumentException("Session not found with ID: " + sessionId);
        }
        repository.deleteById(sessionId);
    }

    public GameSession createSession(String scenarioId) {
        return createSession(scenarioId, "DEFENDER", null);
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

            session.setAttackerBudget(config.getStartingBudget() != 0 ? config.getStartingBudget() : 300000);

            if ("ATTACKER".equals(session.getPlayerRole())) {
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

            List<String> names = config.getAttackerNames();
            if (names == null || names.isEmpty()) {
                names = new ArrayList<>(Arrays.asList("Tariq Mahmood", "Zubair Khan", "Faisal Shah"));
            }
            session.setAttackerNames(names);

            List<Node> hostileNodes = config.getNodes().stream()
                    .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                    .collect(Collectors.toList());
            String startLoc = !hostileNodes.isEmpty() ? hostileNodes.get(0).getId() : "karachi";

            List<GameSession.AIAttacker> aiAttackersList = new ArrayList<>();
            for (int i = 0; i < names.size(); i++) {
                String locNode = startLoc;
                if (!hostileNodes.isEmpty()) {
                    locNode = hostileNodes.get(i % hostileNodes.size()).getId();
                }
                GameSession.AIAttacker attacker = new GameSession.AIAttacker(names.get(i), locNode, "Initial decoy");
                attacker.setBudget(config.getStartingBudget() != 0 ? config.getStartingBudget() : 300000);
                aiAttackersList.add(attacker);
            }
            session.setAiAttackers(aiAttackersList);

            String actual = names.get(0);
            if ("ATTACKER".equalsIgnoreCase(playerRole)) {
                actual = "Faizal Khan";
                List<String> attackerNamesList = new ArrayList<>(names);
                if (!attackerNamesList.contains("Faizal Khan")) {
                    if (attackerNamesList.contains("Faisal Shah")) {
                        attackerNamesList.set(attackerNamesList.indexOf("Faisal Shah"), "Faizal Khan");
                    } else {
                        attackerNamesList.add("Faizal Khan");
                    }
                }
                session.setAttackerNames(attackerNamesList);
            }
            session.setActualAttacker(actual);
            session.setSuspectLocation(aiAttackersList.get(0).getCurrentLocation());

            AIMasterPlan plan = new AIMasterPlan(new java.util.ArrayList<>(), new java.util.ArrayList<>());
            session.setAiMasterPlan(plan);
            session.setSuspectPlans(new java.util.HashMap<>());

            Map<String, Integer> cityHeat = new java.util.HashMap<>();
            if (config.getNodes() != null) {
                for (Node n : config.getNodes()) {
                    cityHeat.put(n.getId(), 0);
                }
            }
            session.setCityHeat(cityHeat);

            // For DEFENDER players, mark deployment as pending — agents/teams get cities from the deployment screen.
            // For ATTACKER players (AI defense), keep config defaults as-is.
            boolean isDefender = "DEFENDER".equals(session.getPlayerRole());

            if (config.getAgents() != null) {
                List<GameSession.Agent> agentsList = config.getAgents().stream().map(aMap -> {
                    GameSession.Agent agent = new GameSession.Agent();
                    agent.setId((Integer) aMap.get("id"));
                    agent.setName((String) aMap.get("name"));
                    agent.setCodename((String) aMap.get("codename"));
                    // DEFENDER players choose starting city during deployment screen
                    agent.setCurrentCity(isDefender ? null : (String) aMap.get("startingCity"));
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
                    // DEFENDER players choose starting city during deployment screen
                    team.setCurrentCity(isDefender ? null : (String) tMap.get("startingCity"));
                    team.setSkills((Map<String, Integer>) tMap.get("skills"));
                    team.setCooldownRemaining(0);
                    return team;
                }).collect(Collectors.toList());
                session.setTacticalTeams(teamsList);
            }

            List<GameSession.Safehouse> safehousesList = new ArrayList<>();
            if (!isDefender && config.getStartingDefenderSafehouses() != null) {
                // ATTACKER session: load defender safehouses from config for AI defense
                safehousesList = config.getStartingDefenderSafehouses().stream()
                        .map(sMap -> new GameSession.Safehouse(sMap.get("cityId"), "DEFENDER", "DEFAULT", true))
                        .collect(Collectors.toList());
            }
            if (!isDefender && session.getSuspectLocation() != null) {
                String spawnLoc = session.getSuspectLocation();
                boolean exists = safehousesList.stream()
                        .anyMatch(s -> s.getCityNode().equals(spawnLoc) && "HOSTILE".equals(s.getOwnerFaction()));
                if (!exists) {
                    safehousesList.add(new GameSession.Safehouse(spawnLoc, "HOSTILE", "DEFAULT", false));
                }
            }
            // DEFENDER session: no pre-placed safehouses — player places them in deployment screen

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

            // Initialize drones
            String defaultHomeCity = "amritsar"; // fallback
            if (config.getNodes() != null) {
                for (com.spygame.covertops.model.Node node : config.getNodes()) {
                    if ("HOME_TERRITORY".equals(node.getTerritory())) {
                        defaultHomeCity = node.getId();
                        break;
                    }
                }
            }

            List<GameSession.Drone> initialDrones = new ArrayList<>();
            initialDrones.add(new GameSession.Drone(1, defaultHomeCity, "ACTIVE"));
            initialDrones.add(new GameSession.Drone(2, defaultHomeCity, "ACTIVE"));
            session.setDrones(initialDrones);

            List<String> initialDroneBases = new ArrayList<>();
            initialDroneBases.add(defaultHomeCity);
            session.setDroneBases(initialDroneBases);

            // Mark deployment pending for DEFENDER — player must place assets before turn 1
            if (isDefender) {
                session.setDeploymentPending(true);
            }

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
            session.setAttackerBudget(config.getStartingBudget() != 0 ? config.getStartingBudget() : 300000);

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

            AIMasterPlan plan = new AIMasterPlan(new java.util.ArrayList<>(), new java.util.ArrayList<>());
            session.setAiMasterPlan(plan);
            session.setSuspectPlans(new java.util.HashMap<>());

            Map<String, Integer> cityHeat = new java.util.HashMap<>();
            if (config.getNodes() != null) {
                for (Node n : config.getNodes()) {
                    cityHeat.put(n.getId(), 0);
                }
            }
            session.setCityHeat(cityHeat);

            // For DEFENDER players, mark deployment as pending — agents/teams get cities from the deployment screen.
            boolean isDefenderMP = "DEFENDER".equals(session.getPlayerRole());

            if (config.getAgents() != null) {
                List<GameSession.Agent> agentsList = config.getAgents().stream().map(aMap -> {
                    GameSession.Agent agent = new GameSession.Agent();
                    agent.setId((Integer) aMap.get("id"));
                    agent.setName((String) aMap.get("name"));
                    agent.setCodename((String) aMap.get("codename"));
                    agent.setCurrentCity(isDefenderMP ? null : (String) aMap.get("startingCity"));
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
                    team.setCurrentCity(isDefenderMP ? null : (String) tMap.get("startingCity"));
                    team.setSkills((Map<String, Integer>) tMap.get("skills"));
                    team.setCooldownRemaining(0);
                    return team;
                }).collect(Collectors.toList());
                session.setTacticalTeams(teamsList);
            }

            List<GameSession.Safehouse> safehousesList = new ArrayList<>();
            if (!isDefenderMP && config.getStartingDefenderSafehouses() != null) {
                safehousesList = config.getStartingDefenderSafehouses().stream()
                        .map(sMap -> new GameSession.Safehouse(sMap.get("cityId"), "DEFENDER", "DEFAULT", true))
                        .collect(Collectors.toList());
            }
            if (!isDefenderMP && session.getSuspectLocation() != null) {
                String startLoc = session.getSuspectLocation();
                boolean exists = safehousesList.stream()
                        .anyMatch(s -> s.getCityNode().equals(startLoc) && "HOSTILE".equals(s.getOwnerFaction()));
                if (!exists) {
                    safehousesList.add(new GameSession.Safehouse(startLoc, "HOSTILE", "DEFAULT", false));
                }
            }

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

            // Initialize drones
            String defaultHomeCityMP = "amritsar"; // fallback
            if (config.getNodes() != null) {
                for (com.spygame.covertops.model.Node node : config.getNodes()) {
                    if ("HOME_TERRITORY".equals(node.getTerritory())) {
                        defaultHomeCityMP = node.getId();
                        break;
                    }
                }
            }

            List<GameSession.Drone> initialDronesMP = new ArrayList<>();
            initialDronesMP.add(new GameSession.Drone(1, defaultHomeCityMP, "ACTIVE"));
            initialDronesMP.add(new GameSession.Drone(2, defaultHomeCityMP, "ACTIVE"));
            session.setDrones(initialDronesMP);

            List<String> initialDroneBasesMP = new ArrayList<>();
            initialDroneBasesMP.add(defaultHomeCityMP);
            session.setDroneBases(initialDroneBasesMP);

            // Mark deployment pending for DEFENDER — player must place assets before turn 1
            if (isDefenderMP) {
                session.setDeploymentPending(true);
            }

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
        GameSession session = repository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found with ID: " + sessionId));
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

        String attackerUsername = "ATTACKER".equals(session.getPlayerARole()) ? session.getPlayerA() : inviteeUsername;
        session.setActivePlayer(attackerUsername);
        session.setTurnDeadline(java.time.LocalDateTime.now().plusMinutes(session.getTurnTimerDurationMinutes()));

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
}
