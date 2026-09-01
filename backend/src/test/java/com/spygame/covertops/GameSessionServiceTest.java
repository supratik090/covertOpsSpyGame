package com.spygame.covertops;

import com.spygame.covertops.model.EndTurnRequest;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.repository.GameSessionRepository;
import com.spygame.covertops.service.AIAttackerService;
import com.spygame.covertops.service.ClueGenerationEngine;
import com.spygame.covertops.service.GameSessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

public class GameSessionServiceTest {

    private GameSessionService sessionService;
    private GameSessionRepository repository;
    private com.spygame.covertops.repository.ScenarioConfigRepository scenarioConfigRepository;
    private AIAttackerService aiService;
    private com.spygame.covertops.model.ScenarioConfig parsedConfig;

    @BeforeEach
    public void setup() throws Exception {
        sessionService = new GameSessionService();
        repository = Mockito.mock(GameSessionRepository.class);
        scenarioConfigRepository = Mockito.mock(com.spygame.covertops.repository.ScenarioConfigRepository.class);
        aiService = new AIAttackerService();
        ClueGenerationEngine clueEngine = new ClueGenerationEngine();

        com.spygame.covertops.service.AttackerPathfinder pathfinder = new com.spygame.covertops.service.AttackerPathfinder();
        ReflectionTestUtils.setField(aiService, "pathfinder", pathfinder);

        // Load dummy config to return during mock calls
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        parsedConfig = mapper.readValue(new java.io.File("../scenarios/operation_silent_edge.json"), com.spygame.covertops.model.ScenarioConfig.class);
        when(scenarioConfigRepository.findById("operation_silent_edge")).thenReturn(java.util.Optional.of(parsedConfig));

        // Initialize helper services
        com.spygame.covertops.service.GameSessionLobbyService lobbyService = new com.spygame.covertops.service.GameSessionLobbyService();
        com.spygame.covertops.service.DefenderActionService defenderActionService = new com.spygame.covertops.service.DefenderActionService();
        com.spygame.covertops.service.CombatResolutionService combatResolutionService = new com.spygame.covertops.service.CombatResolutionService();
        com.spygame.covertops.service.SourcingMilestoneService sourcingMilestoneService = new com.spygame.covertops.service.SourcingMilestoneService();
        com.spygame.covertops.service.SecuritySweepService securitySweepService = new com.spygame.covertops.service.SecuritySweepService();

        // Inject repositories and sub-services into helper services
        ReflectionTestUtils.setField(lobbyService, "repository", repository);
        ReflectionTestUtils.setField(lobbyService, "scenarioConfigRepository", scenarioConfigRepository);
        
        com.spygame.covertops.service.PlayerDefenderService playerDefenderService = new com.spygame.covertops.service.PlayerDefenderService();
        ReflectionTestUtils.setField(playerDefenderService, "repository", repository);
        ReflectionTestUtils.setField(defenderActionService, "defenderService", playerDefenderService);
        
        ReflectionTestUtils.setField(combatResolutionService, "repository", repository);
        ReflectionTestUtils.setField(combatResolutionService, "milestoneService", sourcingMilestoneService);
        ReflectionTestUtils.setField(securitySweepService, "milestoneService", sourcingMilestoneService);

        // Inject dependencies manually
        ReflectionTestUtils.setField(sessionService, "repository", repository);
        ReflectionTestUtils.setField(sessionService, "scenarioConfigRepository", scenarioConfigRepository);
        ReflectionTestUtils.setField(sessionService, "aiService", aiService);
        ReflectionTestUtils.setField(sessionService, "clueEngine", clueEngine);
        ReflectionTestUtils.setField(sessionService, "lobbyService", lobbyService);
        ReflectionTestUtils.setField(sessionService, "defenderActionService", defenderActionService);
        ReflectionTestUtils.setField(sessionService, "combatResolutionService", combatResolutionService);
        ReflectionTestUtils.setField(sessionService, "sourcingMilestoneService", sourcingMilestoneService);
        ReflectionTestUtils.setField(sessionService, "securitySweepService", securitySweepService);
    }

    @Test
    public void testCreateSession() {
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GameSession session = createTestSession();

        assertNotNull(session);
        assertNotNull(session.getId());
        assertEquals("operation_silent_edge", session.getScenarioId());
        assertEquals(1, session.getCurrentTurn());
        assertEquals(25, session.getMaxTurns());
        assertEquals("ACTIVE", session.getStatus());
        assertEquals(parsedConfig.getStartingBudget(), session.getBudget());

        assertNotNull(session.getAiMasterPlan());
        assertEquals(0, session.getAiMasterPlan().getPrimaryPlan().size());
        assertEquals(0, session.getAiMasterPlan().getFallbackPlan().size());
    }

    @Test
    public void testProcessEndTurnWithFinancePivot() {
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GameSession session = createTestSession();
        UUID sessionId = UUID.randomUUID();
        session.setId(sessionId);

        when(repository.findById(sessionId)).thenReturn(java.util.Optional.of(session));

        // Pre-populate dummy master/fallback plans for legacy test compatibility
        List<PlanStep> primaryPlan = new ArrayList<>();
        for (int i = 1; i <= 25; i++) {
            PlanStep step = new PlanStep();
            step.setTurn(i);
            step.setSuspectLocation("karachi");
            step.setPhase("TRAIL_BREAKING");
            step.setFinanceCity(i == 4 ? "karachi" : "NONE");
            step.setLogisticsCity("NONE");
            primaryPlan.add(step);
        }
        session.getAiMasterPlan().setPrimaryPlan(primaryPlan);

        List<PlanStep> fallbackPlan = new ArrayList<>();
        for (int i = 1; i <= 28; i++) {
            PlanStep step = new PlanStep();
            step.setTurn(i);
            step.setSuspectLocation("karachi");
            step.setPhase("TRAIL_BREAKING");
            step.setFinanceCity("NONE");
            step.setLogisticsCity("NONE");
            fallbackPlan.add(step);
        }
        session.getAiMasterPlan().setFallbackPlan(fallbackPlan);

        session.setCurrentTurn(4);
        session.setRequestedFinanceCity("karachi");
        PlanStep currentStep = session.getAiMasterPlan().getPrimaryPlan().stream()
                .filter(s -> s.getTurn() == 4)
                .findFirst()
                .orElseThrow();
        
        String financeCity = currentStep.getFinanceCity();
        assertNotNull(financeCity);

        List<Map<String, Object>> covertActions = new ArrayList<>();
        Map<String, Object> action = new HashMap<>();
        action.put("actionType", "FREEZE_FINANCE");
        action.put("cityNode", financeCity);
        covertActions.add(action);

        EndTurnRequest request = new EndTurnRequest();
        request.setCovertActions(covertActions);

        GameSession updatedSession = sessionService.processEndTurn(sessionId, request);

        assertEquals(28, updatedSession.getAiMasterPlan().getPrimaryPlan().size());
        assertTrue(updatedSession.getAiMasterPlan().getFallbackPlan().isEmpty());
        assertEquals(25, updatedSession.getMaxTurns());
        
        boolean alertLogged = updatedSession.getDiscoveredClues().stream()
                .anyMatch(c -> c.getClueText().contains("re-allocation") || c.getClueText().contains("fallback"));
        assertTrue(alertLogged);
    }

    @Test
    public void testProcessEndTurnWithCombatEncounter() {
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GameSession session = createTestSession();
        UUID sessionId = UUID.randomUUID();
        session.setId(sessionId);

        when(repository.findById(sessionId)).thenReturn(java.util.Optional.of(session));

        // Pre-populate dummy master plans for legacy test compatibility
        List<PlanStep> primaryPlan = new ArrayList<>();
        for (int i = 1; i <= 25; i++) {
            PlanStep step = new PlanStep();
            step.setTurn(i);
            step.setSuspectLocation("islamabad");
            step.setPhase("TRAIL_BREAKING");
            step.setFinanceCity("NONE");
            step.setLogisticsCity("NONE");
            primaryPlan.add(step);
        }
        session.getAiMasterPlan().setPrimaryPlan(primaryPlan);

        List<GameSession.AIAttacker> attackers = new ArrayList<>();
        GameSession.AIAttacker attObj = new GameSession.AIAttacker("Tariq Mahmood", "islamabad", "Request Finance");
        attObj.setRequestedFinanceCity("islamabad");
        attObj.setFinanceCollectionTurnsRemaining(5);
        attObj.setBudget(300000);
        attackers.add(attObj);
        session.setAiAttackers(attackers);

        // Move to Turn 18 (Transit phase)
        session.setCurrentTurn(18);
        PlanStep currentStep = session.getAiMasterPlan().getPrimaryPlan().stream()
                .filter(s -> s.getTurn() == 18)
                .findFirst()
                .orElseThrow();

        String suspectLocation = currentStep.getSuspectLocation();
        assertNotNull(suspectLocation);

        // Execute a RAID_SAFEHOUSE action in the suspect's current city
        List<Map<String, Object>> covertActions = new ArrayList<>();
        Map<String, Object> action = new HashMap<>();
        action.put("actionType", "RAID_SAFEHOUSE");
        action.put("cityNode", suspectLocation);
        action.put("teamId", 4); // Delta Team (Combat skill: 90)
        covertActions.add(action);

        EndTurnRequest request = new EndTurnRequest();
        request.setCovertActions(covertActions);

        // Resolve end-turn combat
        GameSession result = sessionService.processEndTurn(sessionId, request);

        // Assert that the outcome resolved into one of the two logical branches:
        // A: Attacker neutralized (status SUCCESS)
        // B: Attacker escaped (rewound current turn to 8, extended deadline by 10 to 35)
        if ("SUCCESS".equals(result.getStatus())) {
            boolean successClue = result.getDiscoveredClues().stream()
                    .anyMatch(c -> c.getClueText().contains("neutralized"));
            assertTrue(successClue, "Capture announcement should be logged");
        } else {
            assertEquals(19, result.getCurrentTurn(), "Turn should advance normally from 18 to 19 without rewinding current turn");
            boolean escapeClue = result.getDiscoveredClues().stream()
                    .anyMatch(c -> c.getClueText().contains("escaped"));
            assertTrue(escapeClue, "Escape announcement should be logged");
        }
    }


    @Test
    public void testExtendSession_FullDefenderVictory() {
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GameSession session = createTestSession();
        UUID sessionId = session.getId();
        when(repository.findById(sessionId)).thenReturn(java.util.Optional.of(session));

        // Simulate game end full defender victory at turn 25
        session.setCurrentTurn(25);
        session.setMaxTurns(25);
        session.setBudget(500000);
        session.setStatus("SUCCESS");

        // Kill 1 agent and 1 team
        session.getAgents().remove(0); // Remove Agent 1
        session.getTacticalTeams().remove(0); // Remove Team 1

        // Kill 1 attacker, keep 1 attacker active
        session.getAiAttackers().get(0).setEliminated(true);
        session.getAiAttackers().get(1).setEliminated(false);
        session.getAiAttackers().get(1).setCurrentLocation("lahore");

        // Extend session
        GameSession extended = sessionService.extendSession(sessionId);

        assertNotNull(extended);
        assertEquals("ACTIVE", extended.getStatus());
        assertEquals(25, extended.getCurrentTurn()); // turn preserved!
        assertEquals(50, extended.getMaxTurns()); // 25 + 25 = 50 max turns!
        assertEquals(500000 + parsedConfig.getStartingBudget(), extended.getBudget()); // budget topped up!

        // Dead agent restored
        assertTrue(extended.getAgents().stream().anyMatch(a -> a.getId() == 1));

        // Dead team restored
        assertTrue(extended.getTacticalTeams().stream().anyMatch(t -> t.getId() == 1));

        // Dead attacker 0 revived
        assertFalse(extended.getAiAttackers().get(0).isEliminated());

        // Active attacker 1 remains active in lahore
        assertFalse(extended.getAiAttackers().get(1).isEliminated());
        assertEquals("lahore", extended.getAiAttackers().get(1).getCurrentLocation());
    }

    @Test
    public void testExtendSession_FailsIfNotSuccess() {
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));
        GameSession session = createTestSession();
        UUID sessionId = session.getId();
        session.setStatus("COMPROMISED");
        when(repository.findById(sessionId)).thenReturn(java.util.Optional.of(session));

        assertThrows(IllegalStateException.class, () -> sessionService.extendSession(sessionId));
    }

    private GameSession createTestSession() {
        GameSession session = sessionService.createSession("operation_silent_edge");
        session.setDeploymentPending(false);
        if (parsedConfig.getAgents() != null) {
            for (GameSession.Agent agent : session.getAgents()) {
                java.util.Map<String, Object> aMap = parsedConfig.getAgents().stream()
                        .filter(m -> ((Integer) m.get("id")).equals(agent.getId()))
                        .findFirst()
                        .orElse(null);
                if (aMap != null) {
                    agent.setCurrentCity((String) aMap.get("startingCity"));
                }
            }
        }
        if (parsedConfig.getTacticalTeams() != null) {
            for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
                java.util.Map<String, Object> tMap = parsedConfig.getTacticalTeams().stream()
                        .filter(m -> ((Integer) m.get("id")).equals(team.getId()))
                        .findFirst()
                        .orElse(null);
                if (tMap != null) {
                    team.setCurrentCity((String) tMap.get("startingCity"));
                }
            }
        }
        if (parsedConfig.getStartingDefenderSafehouses() != null) {
            java.util.List<GameSession.Safehouse> safehousesList = parsedConfig.getStartingDefenderSafehouses().stream()
                    .map(sMap -> new GameSession.Safehouse(sMap.get("cityId"), "DEFENDER", "DEFAULT", true))
                    .collect(java.util.stream.Collectors.toList());
            session.setSafehouses(safehousesList);
        }
        return session;
    }
}
