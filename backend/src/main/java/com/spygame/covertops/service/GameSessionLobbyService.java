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
        return repository.findAll().stream()
                .filter(s -> !"INACTIVE".equals(s.getStatus()))
                .collect(Collectors.toList());
    }

    public List<GameSession> listSessions(String username) {
        List<GameSession> activeList = repository.findAll().stream()
                .filter(s -> !"INACTIVE".equals(s.getStatus()))
                .collect(Collectors.toList());
        if (username == null) {
            return activeList;
        }
        return activeList.stream()
                .filter(s -> username.equals(s.getOwnerUsername()) || s.getOwnerUsername() == null)
                .collect(Collectors.toList());
    }

    public void deleteSession(UUID sessionId) {
        GameSession session = repository.findById(sessionId).orElse(null);
        if (session != null) {
            session.setStatus("INACTIVE");
            repository.save(session);
        }
    }

    public GameSession createSession(String scenarioId) {
        return createSession(scenarioId, "DEFENDER", null, false);
    }

    public GameSession createSession(String scenarioId, String playerRole) {
        return createSession(scenarioId, playerRole, null, false);
    }

    public GameSession createSession(String scenarioId, String playerRole, String ownerUsername) {
        return createSession(scenarioId, playerRole, ownerUsername, false);
    }

    public GameSession createSession(String scenarioId, String playerRole, String ownerUsername, boolean isFirstTimeUser) {
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

            boolean isDefender = "DEFENDER".equals(session.getPlayerRole());

            // Evaluate if this user is a first-time user based on explicit flag
            boolean effectiveFirstTime = isFirstTimeUser;

            if (config.getAgents() != null) {
                final boolean skipDeploy = effectiveFirstTime;
                List<GameSession.Agent> agentsList = config.getAgents().stream().map(aMap -> {
                    GameSession.Agent agent = new GameSession.Agent();
                    agent.setId((Integer) aMap.get("id"));
                    agent.setName((String) aMap.get("name"));
                    agent.setCodename((String) aMap.get("codename"));
                    agent.setCurrentCity((isDefender && !skipDeploy) ? null : (String) aMap.get("startingCity"));
                    agent.setActiveTask("UNCOVER_SAFEHOUSE");
                    agent.setSkills((Map<String, Integer>) aMap.get("skills"));
                    agent.setCooldownRemaining(0);
                    return agent;
                }).collect(Collectors.toList());
                session.setAgents(agentsList);
            }

            if (config.getTacticalTeams() != null) {
                final boolean skipDeploy = effectiveFirstTime;
                List<GameSession.TacticalTeam> teamsList = config.getTacticalTeams().stream().map(tMap -> {
                    GameSession.TacticalTeam team = new GameSession.TacticalTeam();
                    team.setId((Integer) tMap.get("id"));
                    team.setName((String) tMap.get("name"));
                    team.setOperatingCountry((String) tMap.get("operatingCountry"));
                    team.setCurrentCity((isDefender && !skipDeploy) ? null : (String) tMap.get("startingCity"));
                    team.setSkills((Map<String, Integer>) tMap.get("skills"));
                    team.setCooldownRemaining(0);
                    return team;
                }).collect(Collectors.toList());
                session.setTacticalTeams(teamsList);
            }

            List<GameSession.Safehouse> safehousesList = new ArrayList<>();
            if ((!isDefender || effectiveFirstTime) && config.getStartingDefenderSafehouses() != null) {
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
            com.spygame.covertops.util.SafehouseUtils.ensureAllSafehousesHavePlaces(session, config);

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
            initialDrones.add(new GameSession.Drone(1, defaultHomeCity, "ACTIVE", "1-HOP", 1));
            initialDrones.add(new GameSession.Drone(2, defaultHomeCity, "ACTIVE", "2-HOP", 2));
            session.setDrones(initialDrones);

            List<String> initialDroneBases = new ArrayList<>();
            initialDroneBases.add(defaultHomeCity);
            session.setDroneBases(initialDroneBases);

            // Mandatorily skip deployment phase for first-time users by clearing deploymentPending flag
            if (isDefender && !effectiveFirstTime) {
                session.setDeploymentPending(true);
            } else {
                session.setDeploymentPending(false);
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
}
