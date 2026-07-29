package com.spygame.covertops;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.GameSessionRepository;
import com.spygame.covertops.service.AIAttackerService;
import com.spygame.covertops.service.GameSessionService;
import com.spygame.covertops.service.PlayerDefenderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

public class PlayerDefenderServiceTest {

    private GameSessionService sessionService;
    private PlayerDefenderService defenderService;
    private GameSessionRepository repository;
    private com.spygame.covertops.repository.ScenarioConfigRepository scenarioConfigRepository;
    private AIAttackerService aiService;
    private ScenarioConfig config;

    @BeforeEach
    public void setup() throws Exception {
        sessionService = new GameSessionService();
        defenderService = new PlayerDefenderService();
        repository = Mockito.mock(GameSessionRepository.class);
        scenarioConfigRepository = Mockito.mock(com.spygame.covertops.repository.ScenarioConfigRepository.class);
        aiService = new AIAttackerService();
        com.spygame.covertops.service.ClueGenerationEngine clueEngine = new com.spygame.covertops.service.ClueGenerationEngine();

        // Load config once for tests
        ObjectMapper mapper = new ObjectMapper();
        config = mapper.readValue(new File("../scenarios/operation_silent_edge.json"), ScenarioConfig.class);
        
        when(scenarioConfigRepository.findById("operation_silent_edge")).thenReturn(java.util.Optional.of(config));
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ReflectionTestUtils.setField(sessionService, "repository", repository);
        ReflectionTestUtils.setField(sessionService, "scenarioConfigRepository", scenarioConfigRepository);
        ReflectionTestUtils.setField(sessionService, "aiService", aiService);
        ReflectionTestUtils.setField(sessionService, "clueEngine", clueEngine);
        ReflectionTestUtils.setField(defenderService, "repository", repository);
    }

    @Test
    public void testRelocateAgentWithSafehouse() {
        GameSession session = sessionService.createSession("operation_silent_edge");
        
        // Find Agent 1 (Marcus Vance - starts in New Delhi)
        GameSession.Agent analyst = session.getAgents().stream()
                .filter(a -> a.getId() == 1)
                .findFirst()
                .orElseThrow();
        assertEquals("new_delhi", analyst.getCurrentCity());

        // Peshawar has a starting friendly safehouse, so moving there should succeed
        // However, New Delhi -> Peshawar crosses territory borders (Home -> Hostile), so it must trigger 2-turn lay-low
        session = defenderService.relocateAgent(session, 1, "peshawar", config);
        
        assertEquals("peshawar", analyst.getCurrentCity());
        assertEquals(2, analyst.getCooldownRemaining(), "Moving between territories triggers 2 turns of lay-low");
    }

    @Test
    public void testRelocateAgentWithoutSafehouseThrowsException() {
        GameSession session = sessionService.createSession("operation_silent_edge");
        
        // Srinagar does NOT have a starting friendly safehouse built in the list
        // Attempting to move there must throw an Exception
        assertThrows(IllegalArgumentException.class, () -> {
            defenderService.relocateAgent(session, 1, "srinagar", config);
        });
    }

    @Test
    public void testBuildSafehouse() {
        GameSession session = sessionService.createSession("operation_silent_edge");
        int startingBudget = session.getBudget();

        // Build safehouse in Srinagar (Home territory, cost $40,000)
        session = defenderService.buildSafehouse(session, "srinagar", config);

        assertEquals(startingBudget - 40000, session.getBudget());
        boolean hasSrinagarSafehouse = session.getSafehouses().stream()
                .anyMatch(s -> s.getCityNode().equals("srinagar") && "DEFENDER".equals(s.getOwnerFaction()));
        assertTrue(hasSrinagarSafehouse);

        // Build safehouse in Islamabad (Hostile territory, cost $100,000)
        session = defenderService.buildSafehouse(session, "islamabad", config);
        assertEquals(startingBudget - 140000, session.getBudget());
    }
}
