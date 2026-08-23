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
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

@Service
public class GameSessionService {

    private static final Logger log = LoggerFactory.getLogger(GameSessionService.class);

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

    // Modularized helper services
    @Autowired
    private GameSessionLobbyService lobbyService;

    @Autowired
    private DefenderActionService defenderActionService;

    @Autowired
    private CombatResolutionService combatResolutionService;

    @Autowired
    private SourcingMilestoneService sourcingMilestoneService;

    @Autowired
    private SecuritySweepService securitySweepService;

    public List<GameSession> listSessions() {
        return lobbyService.listSessions();
    }

    public List<GameSession> listSessions(String username) {
        return lobbyService.listSessions(username);
    }

    public void deleteSession(UUID sessionId) {
        lobbyService.deleteSession(sessionId);
    }

    public GameSession createSession(String scenarioId) {
        return lobbyService.createSession(scenarioId);
    }

    public GameSession createSession(String scenarioId, String playerRole) {
        return lobbyService.createSession(scenarioId, playerRole);
    }

    public GameSession createSession(String scenarioId, String playerRole, String ownerUsername) {
        return lobbyService.createSession(scenarioId, playerRole, ownerUsername);
    }

    public GameSession createMultiplayerSession(String scenarioId, String playerARole, String ownerUsername, int timerMinutes) {
        return lobbyService.createMultiplayerSession(scenarioId, playerARole, ownerUsername, timerMinutes);
    }

    public GameSession joinSession(UUID sessionId, String inviteeUsername) {
        return lobbyService.joinSession(sessionId, inviteeUsername);
    }

    public GameSession getSession(UUID sessionId) {
        return repository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found with ID: " + sessionId));
    }

    public GameSession saveSession(GameSession session) {
        return repository.save(session);
    }

    public List<ScenarioConfig> getAvailableScenarios() {
        return scenarioConfigRepository.findAll();
    }

    public GameSession assessClue(UUID sessionId, int clueIndex, String assessment) {
        GameSession session = getSession(sessionId);
        if (clueIndex < 0 || clueIndex >= session.getDiscoveredClues().size()) {
            throw new IllegalArgumentException("Invalid clue index: " + clueIndex);
        }

        session.getDiscoveredClues().get(clueIndex).setAssessment(assessment);
        return repository.save(session);
    }

    public GameSession revertTurn(UUID sessionId) {
        GameSession session = getSession(sessionId);
        if (session.getTurnHistory() == null || session.getTurnHistory().isEmpty()) {
            throw new IllegalStateException("No turn history available to revert.");
        }
        
        int lastIndex = session.getTurnHistory().size() - 1;
        String backupJson = session.getTurnHistory().remove(lastIndex);
        
        try {
            ObjectMapper jsonMapper = new ObjectMapper();
            jsonMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
            GameSession previousState = jsonMapper.readValue(backupJson, GameSession.class);
            previousState.setTurnHistory(session.getTurnHistory());
            return repository.save(previousState);
        } catch (Exception e) {
            throw new RuntimeException("Failed to restore previous game turn: " + e.getMessage(), e);
        }
    }

    public GameSession processEndTurn(UUID sessionId, com.spygame.covertops.model.EndTurnRequest request) {
        return processEndTurn(sessionId, request, null);
    }

    private static final ObjectMapper BACKUP_MAPPER = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    public GameSession processEndTurn(UUID sessionId, com.spygame.covertops.model.EndTurnRequest request, String username) {
        long overallStart = System.currentTimeMillis();
        log.info("[TIMING] processEndTurn started for session: {}", sessionId);

        GameSession session = getSession(sessionId);
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new IllegalStateException("Game session is no longer active.");
        }

        final String scenarioId = session.getScenarioId();
        final ScenarioConfig config = scenarioConfigRepository.findById(scenarioId)
                .orElseThrow(() -> new IllegalArgumentException("Scenario configuration not found in database: " + scenarioId));

        // Save turn history backup before applying actions (capped to 3 turns to prevent DB bloat)
        long backupStart = System.currentTimeMillis();
        try {
            List<String> tempHistory = session.getTurnHistory();
            session.setTurnHistory(new ArrayList<>());
            String sessionBackup = BACKUP_MAPPER.writeValueAsString(session);
            session.setTurnHistory(tempHistory);
            
            session.getTurnHistory().add(sessionBackup);
            while (session.getTurnHistory().size() > 3) {
                session.getTurnHistory().remove(0);
            }
        } catch (Exception e) {
            log.error("Failed to serialize session backup", e);
        }
        log.info("[TIMING] Serialization backup took: {} ms", System.currentTimeMillis() - backupStart);

        if (session.isMultiplayer()) {
            long mpStart = System.currentTimeMillis();
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
                session = playerAttackerService.applyAttackerActions(session, request, config);

                if (!"ACTIVE".equals(session.getStatus())) {
                    long saveStart = System.currentTimeMillis();
                    GameSession saved = repository.save(session);
                    log.info("[TIMING] Attacker early save took: {} ms", System.currentTimeMillis() - saveStart);
                    return saved;
                }

                String defenderUsername = session.getPlayerA().equals(session.getActivePlayer()) ? session.getPlayerB() : session.getPlayerA();
                session.setActivePlayer(defenderUsername);
                session.setPlayerRole("DEFENDER");
                session.setTurnDeadline(java.time.LocalDateTime.now().plusMinutes(session.getTurnTimerDurationMinutes()));
                
                long saveStart = System.currentTimeMillis();
                GameSession saved = repository.save(session);
                log.info("[TIMING] Attacker regular save took: {} ms", System.currentTimeMillis() - saveStart);
                return saved;
            }
            session.setPlayerRole("DEFENDER");
            log.info("[TIMING] Multiplayer check & processing took: {} ms", System.currentTimeMillis() - mpStart);
        }

        int currentTurn = session.getCurrentTurn();

        // 1. Apply actions and execute AI turn based on player role
        if (!session.isMultiplayer()) {
            if ("ATTACKER".equals(session.getPlayerRole())) {
                // Apply Human Attacker actions
                long attActionsStart = System.currentTimeMillis();
                session = playerAttackerService.applyAttackerActions(session, request, config);
                log.info("[TIMING] applyAttackerActions took: {} ms", System.currentTimeMillis() - attActionsStart);

                // Execute AI Defender turn
                long aiStart = System.currentTimeMillis();
                session = aiDefenderService.executeTurn(session, config);
                log.info("[TIMING] aiDefenderService.executeTurn took: {} ms", System.currentTimeMillis() - aiStart);
            } else {
                // Execute AI Attacker turn (Attacker Phase & Movements) FIRST
                long aiStart = System.currentTimeMillis();
                session = aiService.executeTurn(session, config);
                log.info("[TIMING] aiService.executeTurn took: {} ms", System.currentTimeMillis() - aiStart);

                // Apply Human Defender actions (Drone Attacks, Tactical Raids, Scanners) SECOND
                long defActionsStart = System.currentTimeMillis();
                session = defenderActionService.applyDefenderActions(session, request, config);
                log.info("[TIMING] applyDefenderActions took: {} ms", System.currentTimeMillis() - defActionsStart);
            }
        } else {
            // Multiplayer Mode: Only apply Defender actions here since Attacker actions 
            // were already applied and saved during the Attacker's active sub-turn.
            long defActionsStart = System.currentTimeMillis();
            session = defenderActionService.applyDefenderActions(session, request, config);
            log.info("[TIMING] applyDefenderActions (Multiplayer) took: {} ms", System.currentTimeMillis() - defActionsStart);
        }

        List<Map<String, Object>> covertActions = request.getCovertActions();
        if (covertActions == null) {
            covertActions = new ArrayList<>();
        }

        PlanStep currentStep = new PlanStep();
        currentStep.setTurn(currentTurn);
        currentStep.setSuspectLocation(session.getSuspectLocation() != null ? session.getSuspectLocation() : "karachi");
        currentStep.setPhase(session.getActiveAttackerPhase() != null ? session.getActiveAttackerPhase() : "TRAIL_BREAKING");
        currentStep.setFinanceCity(session.getRequestedFinanceCity() != null ? session.getRequestedFinanceCity() : "NONE");
        currentStep.setLogisticsCity(session.getRequestedLogisticsCity() != null ? session.getRequestedLogisticsCity() : "NONE");

        List<PlanStep.AttackerHistory> histories = new ArrayList<>();
        if (session.getAiAttackers() != null && !session.getAiAttackers().isEmpty()) {
            for (GameSession.AIAttacker att : session.getAiAttackers()) {
                histories.add(new PlanStep.AttackerHistory(att.getName(), att.getCurrentLocation(), att.getState(), att.isEliminated()));
            }
        } else {
            histories.add(new PlanStep.AttackerHistory(
                session.getActualAttacker() != null ? session.getActualAttacker() : "Suspect",
                session.getSuspectLocation() != null ? session.getSuspectLocation() : "karachi",
                session.getActiveAttackerPhase() != null ? session.getActiveAttackerPhase() : "TRAIL_BREAKING",
                false
            ));
        }
        currentStep.setAttackerHistories(histories);

        if (session.getAiMasterPlan() == null) {
            session.setAiMasterPlan(new AIMasterPlan(new ArrayList<>(), new ArrayList<>()));
        }
        if (session.getAiMasterPlan().getPrimaryPlan() == null) {
            session.getAiMasterPlan().setPrimaryPlan(new ArrayList<>());
        }
        final int fTurn = currentTurn;
        session.getAiMasterPlan().getPrimaryPlan().removeIf(s -> s.getTurn() == fTurn);
        session.getAiMasterPlan().getPrimaryPlan().add(currentStep);

        // 3. Resolve Player's Covert Actions (combat, finance freeze, roadblock, etc.)
        long combatStart = System.currentTimeMillis();
        session = combatResolutionService.resolveCovertActions(session, covertActions, currentStep, config);
        log.info("[TIMING] resolveCovertActions took: {} ms", System.currentTimeMillis() - combatStart);

        // Rotate Drone Base Maintenance: promote advance warning to active maintenance for current turn
        session.setMaintenanceDroneBase(session.getNextTurnMaintenanceDroneBase());
        session.setNextTurnMaintenanceDroneBase(null);

        // Schedule new Drone Base Maintenance advance warning ~once every 7 turns (when currentTurn % 7 == 0)
        if (currentTurn % 7 == 0 && session.getDroneBases() != null && !session.getDroneBases().isEmpty()) {
            List<String> activeBases = new java.util.ArrayList<>(session.getDroneBases());
            final String lastMaintBase = session.getMaintenanceDroneBase();
            if (activeBases.size() > 1 && lastMaintBase != null) {
                activeBases.removeIf(b -> b.equalsIgnoreCase(lastMaintBase));
            }
            String chosenBase = activeBases.get(java.util.concurrent.ThreadLocalRandom.current().nextInt(activeBases.size()));
            session.setNextTurnMaintenanceDroneBase(chosenBase);
            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "ADVANCE_WARNING",
                    "TECHNICAL ADVISORY: Drone Base in " + chosenBase.toUpperCase() + " is scheduled for 24h technical maintenance in Turn " + (currentTurn + 1) + ". All drone launches from " + chosenBase.toUpperCase() + " will be suspended next turn."));
        }

        if (session.getMaintenanceDroneBase() != null) {
            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_MAINTENANCE",
                    "MAINTENANCE ACTIVE: Drone Base in " + session.getMaintenanceDroneBase().toUpperCase() + " is currently offline for scheduled 24h technical maintenance. No drone operations could originate from this base this turn."));
        }

        // Rotate Drone Defense Activated Event (~1 in 7 turns, 1 turn in 1 enemy city)
        session.setActiveDroneDefenseCity(null);
        if (currentTurn % 7 == 3 && config != null && config.getNodes() != null) {
            List<String> hostileCities = config.getNodes().stream()
                    .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                    .map(Node::getId)
                    .collect(java.util.stream.Collectors.toList());
            if (!hostileCities.isEmpty()) {
                // Monitor city heat: prioritize hostile cities with elevated heat levels (>30%)
                List<String> highHeatHostileCities = new java.util.ArrayList<>();
                if (session.getCityHeat() != null) {
                    for (Map.Entry<String, Integer> entry : session.getCityHeat().entrySet()) {
                        if (entry.getValue() > 30 && hostileCities.stream().anyMatch(c -> c.equalsIgnoreCase(entry.getKey()))) {
                            highHeatHostileCities.add(entry.getKey());
                        }
                    }
                }
                List<String> candidateCities = !highHeatHostileCities.isEmpty() ? highHeatHostileCities : hostileCities;
                String chosenDefenseCity = candidateCities.get(java.util.concurrent.ThreadLocalRandom.current().nextInt(candidateCities.size()));
                session.setActiveDroneDefenseCity(chosenDefenseCity);
                int cityHeat = session.getCityHeat() != null ? session.getCityHeat().getOrDefault(chosenDefenseCity.toLowerCase(), 0) : 0;
                session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_DEFENSE_ACTIVATED",
                        "🚨 DRONE DEFENSE ACTIVATED: Hostile SAM air defense batteries activated in " + chosenDefenseCity.toUpperCase() + " for 24h",
                        chosenDefenseCity,
                        "SIGINT Advisory"));
            }
        }

        // 3.4. Progress Drone Servicing Cooldowns (2-turn technical repair)
        if (session.getDrones() != null) {
            for (GameSession.Drone drone : session.getDrones()) {
                if ("SERVICING".equalsIgnoreCase(drone.getStatus())) {
                    int remaining = drone.getServiceCooldown() - 1;
                    if (remaining <= 0) {
                        drone.setStatus("ACTIVE");
                        drone.setServiceCooldown(0);
                        session.getDiscoveredClues().add(new GameSession.Clue(
                                currentTurn,
                                "DRONE_SERVICED",
                                "🔧 REPAIR COMPLETE: Drone #" + drone.getId() + " servicing complete. Aircraft is back online and ready for deployment.",
                                drone.getCurrentCity(),
                                "Base Technical Operations"
                        ));
                    } else {
                        drone.setServiceCooldown(remaining);
                    }
                }
            }
        }

        // 3.5. Resolve Drone Operations
        if (session.getDrones() != null && !session.getDrones().isEmpty()) {
            Random rand = new Random();
            for (GameSession.Drone drone : session.getDrones()) {
                if (drone == null || !"ACTIVE".equals(drone.getStatus())) continue;
                String actionType = drone.getAssignedActionType();
                String targetCity = drone.getAssignedTargetCity();
                if (actionType == null || targetCity == null) continue;

                int droneId = drone.getId();
                try {
                    String baseCity = drone.getCurrentCity();

                    // Check if housing Drone Base is under 24h scheduled maintenance
                    if (baseCity != null && baseCity.equalsIgnoreCase(session.getMaintenanceDroneBase())) {
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_MAINTENANCE",
                                "Drone #" + droneId + " operation " + actionType + " in " + targetCity.toUpperCase() +
                                " CANCELLED: Drone Base in " + baseCity.toUpperCase() + " is offline for scheduled technical maintenance."));
                        drone.setAssignedActionType(null);
                        drone.setAssignedTargetCity(null);
                        continue;
                    }

                    // 1. Check if housing Drone Base is damaged / inactive
                    if (baseCity != null && session.getDroneBaseCooldowns() != null) {
                        int cooldown = session.getDroneBaseCooldowns().getOrDefault(baseCity.toLowerCase(), 0);
                        if (cooldown > 0) {
                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_RECON",
                                    "Drone #" + droneId + " operation " + actionType + " in " + targetCity.toUpperCase() +
                                    " CANCELLED: Drone Base in " + baseCity.toUpperCase() + " is damaged and offline (" + cooldown + " turn(s) remaining)."));
                            drone.setAssignedActionType(null);
                            drone.setAssignedTargetCity(null);
                            continue;
                        }
                    }

                    // 1.5. Hop range validation
                    int requiredHops = calculateHops(baseCity, targetCity, config);
                    int maxAllowedHops = (drone.getId() == 2 || "2-HOP".equalsIgnoreCase(drone.getType())) ? 2 : (drone.getMaxHops() > 0 ? drone.getMaxHops() : 1);
                    if (requiredHops > maxAllowedHops) {
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_RECON",
                                "Drone #" + droneId + " operation " + actionType + " in " + targetCity.toUpperCase() +
                                " CANCELLED: Target is out of operational range (" + requiredHops + " hops required, max " + maxAllowedHops + " hop(s) allowed)."));
                        drone.setAssignedActionType(null);
                        drone.setAssignedTargetCity(null);
                        continue;
                    }

                    // 2. Deduct operation cost
                    int opCost = "ATTACK".equalsIgnoreCase(actionType) ? 50000 : 15000;
                    if (session.getBudget() < opCost) {
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_RECON",
                                "Drone #" + droneId + " operation " + actionType + " in " + targetCity + " cancelled: Insufficient budget."));
                        drone.setAssignedActionType(null);
                        drone.setAssignedTargetCity(null);
                        continue;
                    }
                    session.setBudget(session.getBudget() - opCost);

                    Node targetNode = config.getNodes().stream()
                            .filter(n -> n.getId().equalsIgnoreCase(targetCity))
                            .findFirst()
                            .orElse(null);
                    boolean isEnemyNode = (targetNode != null) && "HOSTILE_TERRITORY".equals(targetNode.getTerritory());

                    boolean isCityUnderSweep = (session.getHostilePatrolCities() != null && session.getHostilePatrolCities().stream().anyMatch(c -> c.equalsIgnoreCase(targetCity)))
                            || (session.getSurprisePatrolCities() != null && session.getSurprisePatrolCities().stream().anyMatch(c -> c.equalsIgnoreCase(targetCity)));
                    boolean isDroneDefenseActive = (targetCity != null && targetCity.equalsIgnoreCase(session.getActiveDroneDefenseCity()));

                    // Interdiction risk caps: Max 10% shot down (lost) and 15% damaged during active drone defense
                    int shotDownChance = isEnemyNode ? (isDroneDefenseActive ? 10 : (isCityUnderSweep ? 10 : 5)) : 0;
                    int damagedChance  = isEnemyNode ? (isDroneDefenseActive ? 15 : (isCityUnderSweep ? 10 : 5)) : 0;
                    int totalRisk = shotDownChance + damagedChance;
                    int roll = rand.nextInt(100);

                    // Increase heat if repeated drone strikes in active drone defense city
                    if (isDroneDefenseActive) {
                        int currentHeat = session.getCityHeat() != null ? session.getCityHeat().getOrDefault(targetCity.toLowerCase(), 0) : 0;
                        int newHeat = Math.min(100, currentHeat + 25);
                        if (session.getCityHeat() != null) {
                            session.getCityHeat().put(targetCity.toLowerCase(), newHeat);
                        }
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_DEFENSE_STRIKE",
                                "🚨 REPEATED DRONE STRIKE IN DEFENDED AIRSPACE: Active SAM defenses in " + targetCity.toUpperCase() +
                                " tracked the drone flight path! City Heat increased to " + newHeat + "% (+25% increase)."));
                    }

                    if (roll < shotDownChance) {
                        drone.setStatus("SHOT_DOWN");
                        drone.setCurrentCity(targetCity);
                        drone.setAssignedActionType(null);
                        drone.setAssignedTargetCity(null);
                        String defenseType = isDroneDefenseActive ? "active SAM air defense battery" : (isCityUnderSweep ? "heightened security sweep air defenses" : "hostile air defenses");
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_SHOT_DOWN",
                                "DRONE DOWN: Drone #" + droneId + " was SHOT DOWN by " + defenseType + " during " + actionType + " in " + targetCity.toUpperCase() + "! (" + shotDownChance + "% shot down risk, " + totalRisk + "% total interdiction risk)",
                                targetCity,
                                "Drone Operations"));
                        continue;
                    } else if (roll < totalRisk) {
                        drone.setStatus("DAMAGED");
                        drone.setServiceCooldown(0);
                        drone.setAssignedActionType(null);
                        drone.setAssignedTargetCity(null);
                        String defenseType = isDroneDefenseActive ? "active SAM anti-air missile fire" : (isCityUnderSweep ? "heightened security sweep AA fire" : "hostile anti-air fire");
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_DAMAGED",
                                "DRONE DAMAGED: Drone #" + droneId + " sustained anti-aircraft damage from " + defenseType + " during " + actionType + " in " + targetCity.toUpperCase() + "! (" + damagedChance + "% damage risk) Requires $10K technical servicing (2-turn repair).",
                                targetCity,
                                "Drone Operations"));
                        continue;
                    }

                    boolean hasSatelliteView = session.getEspionageResources() != null && session.getEspionageResources().stream()
                            .anyMatch(r -> "SATELLITE".equalsIgnoreCase(r.getType()) && targetCity.equalsIgnoreCase(r.getCityNode()));

                    boolean hasAgentInCity = session.getAgents() != null && session.getAgents().stream()
                            .anyMatch(a -> targetCity.equalsIgnoreCase(a.getCurrentCity()));

                    boolean isEnhancedRecon = hasSatelliteView || hasAgentInCity;

                    if ("RECON".equals(actionType)) {
                        List<GameSession.Safehouse> targetSHs = session.getSafehouses().stream()
                                .filter(s -> s.getCityNode().equalsIgnoreCase(targetCity) && "HOSTILE".equals(s.getOwnerFaction()) && !s.isUncovered())
                                .filter(s -> isEnhancedRecon || !s.isSecure())
                                .collect(Collectors.toList());

                        int countToUncover = isEnhancedRecon
                                ? Math.min(targetSHs.size(), 2 + rand.nextInt(3))
                                : Math.min(targetSHs.size(), rand.nextInt(4));

                        Collections.shuffle(targetSHs, rand);
                        List<String> uncoveredCodes = new ArrayList<>();
                        for (int i = 0; i < countToUncover; i++) {
                            GameSession.Safehouse sh = targetSHs.get(i);
                            sh.setUncovered(true);
                            uncoveredCodes.add("#" + sh.getSafehouseCode() + (sh.isSecure() ? " [SECURE]" : ""));
                        }

                        if (uncoveredCodes.isEmpty()) {
                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_RECON",
                                    "Drone " + droneId + " completed RECON in " + targetCity.toUpperCase() + ": No new hostile safehouses discovered."));
                        } else {
                            String reconTag = "RECON SUCCESS: ";
                            if (hasSatelliteView && hasAgentInCity) {
                                reconTag = "RECON SUCCESS (SATELLITE & GROUND AGENT ENHANCED): ";
                            } else if (hasSatelliteView) {
                                reconTag = "RECON SUCCESS (SATELLITE ENHANCED): ";
                            } else if (hasAgentInCity) {
                                reconTag = "RECON SUCCESS (GROUND AGENT ENHANCED): ";
                            }
                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_RECON",
                                    reconTag + "Drone " + droneId + " uncovered " + uncoveredCodes.size() + " hostile safehouse(s) in " + targetCity.toUpperCase() + ": " + String.join(", ", uncoveredCodes)));
                        }
                    } else if ("ATTACK".equals(actionType)) {
                        List<GameSession.Safehouse> exposedSHs = session.getSafehouses().stream()
                                .filter(s -> s.getCityNode().equalsIgnoreCase(targetCity) && "HOSTILE".equals(s.getOwnerFaction()) && s.isUncovered())
                                .collect(Collectors.toList());

                        if (exposedSHs.isEmpty()) {
                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_ATTACK",
                                    "Drone " + droneId + " completed ATTACK run in " + targetCity.toUpperCase() + ": No exposed hostile safehouses found."));
                        } else {
                            List<String> attackedCodes = new ArrayList<>();
                            List<String> neutralizedAttackers = new ArrayList<>();
                            
                            for (GameSession.Safehouse sh : exposedSHs) {
                                attackedCodes.add("#" + sh.getSafehouseCode());

                                List<GameSession.AIAttacker> activeAttackersInSH = session.getAiAttackers().stream()
                                        .filter(a -> !a.isEliminated() && targetCity.equalsIgnoreCase(a.getCurrentLocation()))
                                        .filter(a -> sh.getAttackerName() == null || sh.getAttackerName().equalsIgnoreCase(a.getName()))
                                        .collect(Collectors.toList());

                                if (!activeAttackersInSH.isEmpty()) {
                                    boolean success = false;
                                    if (isEnhancedRecon) {
                                        success = rand.nextInt(100) < 90;
                                    } else if (sh.isSecure()) {
                                        success = rand.nextInt(100) < 50;
                                    } else {
                                        success = (rand.nextInt(100) < 50) || session.isSuspectEscapedBefore();
                                    }

                                    if (success) {
                                        int count = activeAttackersInSH.size();
                                        int toKill = count == 1 ? ((rand.nextInt(100) < 80) ? 1 : 0) : 2;
                                        Collections.shuffle(activeAttackersInSH, rand);
                                        for (int i = 0; i < Math.min(count, toKill); i++) {
                                            GameSession.AIAttacker att = activeAttackersInSH.get(i);
                                            att.setEliminated(true);
                                            neutralizedAttackers.add(att.getName());
                                        }
                                    }
                                }
                            }

                            session.getSafehouses().removeAll(exposedSHs);

                            String combatLog = "";
                            if (!neutralizedAttackers.isEmpty()) {
                                combatLog = " AI Operative(s) neutralized: " + String.join(", ", neutralizedAttackers);
                            } else {
                                combatLog = " Operatives escaped.";
                            }

                            String strikeTag = "DRONE STRIKE: ";
                            if (hasSatelliteView && hasAgentInCity) {
                                strikeTag = "DRONE STRIKE (SATELLITE & AGENT GUIDED): ";
                            } else if (hasSatelliteView) {
                                strikeTag = "DRONE STRIKE (SATELLITE GUIDED): ";
                            } else if (hasAgentInCity) {
                                strikeTag = "DRONE STRIKE (GROUND AGENT GUIDED): ";
                            }

                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "DRONE_ATTACK",
                                    strikeTag + "Drone " + droneId + " attacked and destroyed hostile safehouses (" + String.join(", ", attackedCodes) + ") in " + targetCity.toUpperCase() + "!" + combatLog));
                        }
                    }

                    // Clear drone action directive so it DOES NOT automatically repeat next turn
                    drone.setAssignedActionType(null);
                    drone.setAssignedTargetCity(null);
                } catch (Exception e) {
                    log.error("Failed drone operation for drone {}: {}", drone.getId(), e.getMessage());
                    drone.setAssignedActionType(null);
                    drone.setAssignedTargetCity(null);
                }
            }
        }

        if (!"ACTIVE".equals(session.getStatus())) {
            long saveStart = System.currentTimeMillis();
            GameSession saved = repository.save(session);
            log.info("[TIMING] Early combat finish save took: {} ms", System.currentTimeMillis() - saveStart);
            return saved;
        }

        // 4. Resolve Clue Generation Engine (Decks, tech scans, and footprints)
        long clueStart = System.currentTimeMillis();
        List<GameSession.Clue> turnIntel = clueEngine.generateTurnClues(session, config);
        session.getDiscoveredClues().addAll(turnIntel);
        log.info("[TIMING] generateTurnClues took: {} ms", System.currentTimeMillis() - clueStart);

        // Count agents tasked with UNCOVER_SAFEHOUSE per city and resolve safehouse uncovers
        long uncoverStart = System.currentTimeMillis();
        resolveSafehouseUncovers(session);
        log.info("[TIMING] resolveSafehouseUncovers took: {} ms", System.currentTimeMillis() - uncoverStart);

        // Also check if any spy investigated hotspots
        for (GameSession.Agent agent : session.getAgents()) {
            if (agent.getCooldownRemaining() > 0) continue;
            String city = agent.getCurrentCity();
            
            if ("MONITOR_FINANCE".equals(agent.getActiveTask())) {
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

        // 5. Resolve security sweeps (sweeps, timeline advance, next patrol zones, active player swaps)
        long sweepStart = System.currentTimeMillis();
        session = securitySweepService.resolveSecuritySweeps(session, currentStep, config);
        log.info("[TIMING] resolveSecuritySweeps took: {} ms", System.currentTimeMillis() - sweepStart);

        if (session.isMultiplayer()) {
            String attackerUsername = session.getPlayerA().equals(session.getActivePlayer()) ? session.getPlayerB() : session.getPlayerA();
            session.setActivePlayer(attackerUsername);
            session.setPlayerRole("ATTACKER");
            session.setTurnDeadline(java.time.LocalDateTime.now().plusMinutes(session.getTurnTimerDurationMinutes()));
        }

        com.spygame.covertops.util.SafehouseUtils.ensureAllSafehousesHavePlaces(session, config);
        long dbSaveStart = System.currentTimeMillis();
        GameSession saved = repository.save(session);
        log.info("[TIMING] Final DB save took: {} ms", System.currentTimeMillis() - dbSaveStart);
        log.info("[TIMING] Total processEndTurn took: {} ms", System.currentTimeMillis() - overallStart);

        return saved;
    }

    private void resolveSafehouseUncovers(GameSession session) {
        Map<String, Integer> uncoverAgentsCount = new java.util.HashMap<>();
        for (GameSession.Agent agent : session.getAgents()) {
            if (agent.getCooldownRemaining() > 0) continue;
            if ("UNCOVER_SAFEHOUSE".equals(agent.getActiveTask())) {
                String city = agent.getCurrentCity();
                uncoverAgentsCount.put(city, uncoverAgentsCount.getOrDefault(city, 0) + 1);
            }
        }

        java.util.Random uncoverRand = new java.util.Random();
        for (GameSession.Safehouse sh : session.getSafehouses()) {
            if ("HOSTILE".equals(sh.getOwnerFaction()) && !sh.isUncovered()) {
                String city = sh.getCityNode();
                int agentsCount = uncoverAgentsCount.getOrDefault(city, 0);
                if (agentsCount > 0) {
                    boolean isSecureSH = session.getSecureSafehouseTurns() != null && session.getSecureSafehouseTurns().getOrDefault(city, 0) > 0;
                    if (isSecureSH) {
                        if (agentsCount >= 2) {
                            sh.setUncovered(true);
                            session.getDiscoveredClues().add(new GameSession.Clue(
                                    session.getCurrentTurn(),
                                    "SAFEHOUSE_EXPOSED",
                                    "INTELLIGENCE BRIEF: Combined surveillance team unmasked secure hostile safehouse of suspect " + session.getActualAttacker() + " in " + city.toUpperCase() + ".",
                                    city,
                                    "Field Intelligence Unit"
                            ));
                        }
                    } else {
                        if (uncoverRand.nextInt(100) < 80) {
                            sh.setUncovered(true);
                            session.getDiscoveredClues().add(new GameSession.Clue(
                                    session.getCurrentTurn(),
                                    "SAFEHOUSE_EXPOSED",
                                    "INTELLIGENCE BRIEF: Surveillance team unmasked hostile safehouse of suspect " + session.getActualAttacker() + " in " + city.toUpperCase() + ".",
                                    city,
                                    "Field Intelligence Unit"
                            ));
                        }
                    }
                }
            }
        }
    }

    private int calculateHops(String baseCity, String targetCity, ScenarioConfig config) {
        if (baseCity == null || targetCity == null) return 999;
        if (baseCity.equalsIgnoreCase(targetCity)) return 0;

        Node baseNode = config.getNodes().stream()
                .filter(n -> n.getId().equalsIgnoreCase(baseCity))
                .findFirst()
                .orElse(null);

        if (baseNode == null || baseNode.getConnections() == null) return 999;

        // Check 1-hop distance
        for (String conn1 : baseNode.getConnections()) {
            if (conn1.equalsIgnoreCase(targetCity)) return 1;
        }

        // Check 2-hop distance
        for (String conn1 : baseNode.getConnections()) {
            Node node1 = config.getNodes().stream()
                    .filter(n -> n.getId().equalsIgnoreCase(conn1))
                    .findFirst()
                    .orElse(null);
            if (node1 != null && node1.getConnections() != null) {
                for (String conn2 : node1.getConnections()) {
                    if (conn2.equalsIgnoreCase(targetCity)) return 2;
                }
            }
        }

        return 3; // > 2 hops
    }
}
