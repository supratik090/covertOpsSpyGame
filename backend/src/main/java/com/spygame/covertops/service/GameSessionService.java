package com.spygame.covertops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.AIMasterPlan;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.GameSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

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

        // Save turn history backup before applying actions
        long backupStart = System.currentTimeMillis();
        try {
            ObjectMapper jsonMapper = new ObjectMapper();
            jsonMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
            
            // Temporary clear history from clone to prevent exponential serialization bloat!
            List<String> tempHistory = session.getTurnHistory();
            session.setTurnHistory(new ArrayList<>());
            String sessionBackup = jsonMapper.writeValueAsString(session);
            session.setTurnHistory(tempHistory);
            
            session.getTurnHistory().add(sessionBackup);
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

        // 1. Apply Defender actions (agent/team relocations, builds, tasks, resources)
        long defActionsStart = System.currentTimeMillis();
        session = defenderActionService.applyDefenderActions(session, request, config);
        log.info("[TIMING] applyDefenderActions took: {} ms", System.currentTimeMillis() - defActionsStart);

        List<Map<String, Object>> covertActions = request.getCovertActions();
        if (covertActions == null) {
            covertActions = new ArrayList<>();
        }

        // 2. Fetch or execute AI plan step dynamically for current turn
        long aiStart = System.currentTimeMillis();
        PlanStep currentStep = null;
        if (!session.isMultiplayer() && "DEFENDER".equals(session.getPlayerRole())) {
            session = aiService.executeTurn(session, config);
        }
        log.info("[TIMING] aiService.executeTurn took: {} ms", System.currentTimeMillis() - aiStart);

        currentStep = new PlanStep();
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
}
