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

        // Load dummy config to return during mock calls
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        parsedConfig = mapper.readValue(new java.io.File("../scenarios/operation_silent_edge.json"), com.spygame.covertops.model.ScenarioConfig.class);
        when(scenarioConfigRepository.findById("operation_silent_edge")).thenReturn(java.util.Optional.of(parsedConfig));

        // Inject dependencies manually
        ReflectionTestUtils.setField(sessionService, "repository", repository);
        ReflectionTestUtils.setField(sessionService, "scenarioConfigRepository", scenarioConfigRepository);
        ReflectionTestUtils.setField(sessionService, "aiService", aiService);
        ReflectionTestUtils.setField(sessionService, "clueEngine", clueEngine);
    }

    @Test
    public void testCreateSession() {
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GameSession session = sessionService.createSession("operation_silent_edge");

        assertNotNull(session);
        assertNotNull(session.getId());
        assertEquals("operation_silent_edge", session.getScenarioId());
        assertEquals(1, session.getCurrentTurn());
        assertEquals(25, session.getMaxTurns());
        assertEquals("ACTIVE", session.getStatus());
        assertEquals(parsedConfig.getStartingBudget(), session.getBudget());

        assertNotNull(session.getAiMasterPlan());
        assertEquals(25, session.getAiMasterPlan().getPrimaryPlan().size());
        assertEquals(28, session.getAiMasterPlan().getFallbackPlan().size());
    }

    @Test
    public void testProcessEndTurnWithFinancePivot() {
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GameSession session = sessionService.createSession("operation_silent_edge");
        UUID sessionId = UUID.randomUUID();
        session.setId(sessionId);

        when(repository.findById(sessionId)).thenReturn(java.util.Optional.of(session));

        session.setCurrentTurn(4);
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
        assertEquals(28, updatedSession.getMaxTurns());
        
        boolean alertLogged = updatedSession.getDiscoveredClues().stream()
                .anyMatch(c -> c.getClueText().contains("fallback"));
        assertTrue(alertLogged);
    }

    @Test
    public void testProcessEndTurnWithCombatEncounter() {
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GameSession session = sessionService.createSession("operation_silent_edge");
        UUID sessionId = UUID.randomUUID();
        session.setId(sessionId);

        when(repository.findById(sessionId)).thenReturn(java.util.Optional.of(session));

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
            assertEquals(8, result.getCurrentTurn(), "Escaping should rewind turn back to 8 (18 - 10)");
            assertEquals(35, result.getMaxTurns(), "Max turns deadline should extend by +10 to 35");
            boolean escapeClue = result.getDiscoveredClues().stream()
                    .anyMatch(c -> c.getClueText().contains("escaped"));
            assertTrue(escapeClue, "Escape announcement should be logged");
        }
    }
}
