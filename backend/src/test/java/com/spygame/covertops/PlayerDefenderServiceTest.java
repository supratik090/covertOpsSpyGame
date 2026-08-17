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

        com.spygame.covertops.service.AttackerPathfinder pathfinder = new com.spygame.covertops.service.AttackerPathfinder();
        ReflectionTestUtils.setField(aiService, "pathfinder", pathfinder);

        // Load config once for tests
        ObjectMapper mapper = new ObjectMapper();
        config = mapper.readValue(new File("../scenarios/operation_silent_edge.json"), ScenarioConfig.class);
        
        when(scenarioConfigRepository.findById("operation_silent_edge")).thenReturn(java.util.Optional.of(config));
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Initialize helper services
        com.spygame.covertops.service.GameSessionLobbyService lobbyService = new com.spygame.covertops.service.GameSessionLobbyService();
        com.spygame.covertops.service.DefenderActionService defenderActionService = new com.spygame.covertops.service.DefenderActionService();
        com.spygame.covertops.service.CombatResolutionService combatResolutionService = new com.spygame.covertops.service.CombatResolutionService();
        com.spygame.covertops.service.SourcingMilestoneService sourcingMilestoneService = new com.spygame.covertops.service.SourcingMilestoneService();
        com.spygame.covertops.service.SecuritySweepService securitySweepService = new com.spygame.covertops.service.SecuritySweepService();

        // Inject repositories and sub-services into helper services
        ReflectionTestUtils.setField(lobbyService, "repository", repository);
        ReflectionTestUtils.setField(lobbyService, "scenarioConfigRepository", scenarioConfigRepository);
        ReflectionTestUtils.setField(defenderActionService, "defenderService", defenderService);
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
        ReflectionTestUtils.setField(defenderService, "repository", repository);
    }

    @Test
    public void testRelocateAgentWithSafehouse() {
        GameSession session = createTestSession();
        
        // Find Agent 1 (Marcus Vance - starts in New Delhi)
        GameSession.Agent analyst = session.getAgents().stream()
                .filter(a -> a.getId() == 1)
                .findFirst()
                .orElseThrow();
        assertEquals("new_delhi", analyst.getCurrentCity());

        // Peshawar has a starting friendly safehouse, so moving there should succeed
        // However, New Delhi -> Peshawar crosses territory borders (Home -> Hostile), so it must trigger 2-turn lay-low
        session = defenderService.relocateAgent(session, 1, "peshawar", config);
        
        GameSession.Agent currentAnalyst = session.getAgents().stream()
                .filter(a -> a.getId() == 1)
                .findFirst()
                .orElse(null);
        if (currentAnalyst != null) {
            assertEquals("peshawar", currentAnalyst.getCurrentCity());
            assertEquals(2, currentAnalyst.getCooldownRemaining(), "Moving between territories triggers 2 turns of lay-low");
        } else {
            // Captured! Verify border incident clue is logged
            boolean hasIncident = session.getDiscoveredClues().stream()
                    .anyMatch(c -> "BORDER_INCIDENT".equals(c.getSource()));
            assertTrue(hasIncident);
        }
    }

    @Test
    public void testRelocateAgentWithoutSafehouseThrowsException() {
        GameSession session = createTestSession();
        
        // Srinagar does NOT have a starting friendly safehouse built in the list
        // Attempting to move there must throw an Exception
        assertThrows(IllegalArgumentException.class, () -> {
            defenderService.relocateAgent(session, 1, "srinagar", config);
        });
    }

    @Test
    public void testBuildSafehouse() {
        GameSession session = createTestSession();
        int startingBudget = session.getBudget();

        // Build safehouse in Srinagar (Home territory, cost $20,000)
        session = defenderService.buildSafehouse(session, "srinagar", config);

        assertEquals(startingBudget - 20000, session.getBudget());
        boolean hasSrinagarSafehouse = session.getSafehouses().stream()
                .anyMatch(s -> s.getCityNode().equals("srinagar") && "DEFENDER".equals(s.getOwnerFaction()));
        assertTrue(hasSrinagarSafehouse);

        // Build safehouse in Islamabad (Hostile territory, cost $40,000)
        session = defenderService.buildSafehouse(session, "islamabad", config);
        assertEquals(startingBudget - 60000, session.getBudget());
    }

    @Test
    public void testRelocationToSafehouseBuiltInSameTurn() {
        // Create session
        GameSession session = createTestSession();
        UUID sessionId = UUID.randomUUID();
        session.setId(sessionId);
        when(repository.findById(sessionId)).thenReturn(java.util.Optional.of(session));

        // Verify Srinagar has no friendly safehouse initially
        boolean hasSrinagarSafehouse = session.getSafehouses().stream()
                .anyMatch(s -> s.getCityNode().equals("srinagar") && "DEFENDER".equals(s.getOwnerFaction()));
        assertFalse(hasSrinagarSafehouse);

        // Find Agent 1 (Marcus Vance - starts in New Delhi)
        GameSession.Agent analyst = session.getAgents().stream()
                .filter(a -> a.getId() == 1)
                .findFirst()
                .orElseThrow();
        assertEquals("new_delhi", analyst.getCurrentCity());

        // Prepare EndTurnRequest: Build safehouse in Srinagar and relocate Agent 1 to Srinagar in same turn
        com.spygame.covertops.model.EndTurnRequest request = new com.spygame.covertops.model.EndTurnRequest();
        
        java.util.List<String> builds = new java.util.ArrayList<>();
        builds.add("srinagar");
        request.setSafehouseBuilds(builds);

        java.util.Map<Integer, String> relocations = new java.util.HashMap<>();
        relocations.put(1, "srinagar");
        request.setAgentRelocations(relocations);

        // Process End Turn
        GameSession updatedSession = sessionService.processEndTurn(sessionId, request);

        // The safehouse in Srinagar should be built
        boolean built = updatedSession.getSafehouses().stream()
                .anyMatch(s -> s.getCityNode().equals("srinagar") && "DEFENDER".equals(s.getOwnerFaction()));
        assertTrue(built);

        // The agent should be successfully relocated to Srinagar
        GameSession.Agent updatedAgent = updatedSession.getAgents().stream()
                .filter(a -> a.getId() == 1)
                .findFirst()
                .orElseThrow();
        assertEquals("srinagar", updatedAgent.getCurrentCity());
    }

    @Test
    public void testSecuritySweepCoolingPeriod() {
        // Create session
        GameSession session = createTestSession();
        UUID sessionId = UUID.randomUUID();
        session.setId(sessionId);
        when(repository.findById(sessionId)).thenReturn(java.util.Optional.of(session));

        // Manually set a warned sweep city for the current turn
        java.util.List<String> patrols = new java.util.ArrayList<>();
        patrols.add("quetta");
        session.setHostilePatrolCities(patrols);
        session.setSurprisePatrolCities(new java.util.ArrayList<>());

        com.spygame.covertops.model.EndTurnRequest request = new com.spygame.covertops.model.EndTurnRequest();

        // Process turn: this should trigger warned sweep on quetta and then set cooling period
        GameSession sessionAfterSweep = sessionService.processEndTurn(sessionId, request);

        // After this turn, since sweeps happened, the next turn's patrols should be forced to empty lists (cooling period)
        assertTrue(sessionAfterSweep.getHostilePatrolCities().isEmpty(), "Hostile patrols must be empty due to cooling period");
        assertTrue(sessionAfterSweep.getSurprisePatrolCities().isEmpty(), "Surprise patrols must be empty due to cooling period");

        // Process another turn: now that patrols were empty, sweepHappened is false, so it should roll new patrols normally
        GameSession sessionAfterCooling = sessionService.processEndTurn(sessionId, request);

        // Since it rolled patrols normally, the lists should not be null
        assertNotNull(sessionAfterCooling.getHostilePatrolCities());
        assertNotNull(sessionAfterCooling.getSurprisePatrolCities());
    }

    @Test
    public void testTurnLimitVictoryForDefenderAndDefeatForAttacker() {
        com.spygame.covertops.service.SecuritySweepService securitySweepService = new com.spygame.covertops.service.SecuritySweepService();
        com.spygame.covertops.service.SourcingMilestoneService milestone = new com.spygame.covertops.service.SourcingMilestoneService();
        org.springframework.test.util.ReflectionTestUtils.setField(securitySweepService, "milestoneService", milestone);

        com.spygame.covertops.model.AIMasterPlan mockPlan = new com.spygame.covertops.model.AIMasterPlan(new java.util.ArrayList<>(), new java.util.ArrayList<>());

        // Case 1: Player is DEFENDER. Turning limit reached -> SUCCESS
        GameSession sessionDefender = new GameSession();
        sessionDefender.setPlayerRole("DEFENDER");
        sessionDefender.setCurrentTurn(35);
        sessionDefender.setMaxTurns(35);
        sessionDefender.setAiMasterPlan(mockPlan);
        sessionDefender.setAgents(new java.util.ArrayList<>());
        sessionDefender.setTacticalTeams(new java.util.ArrayList<>());
        sessionDefender.setHostilePatrolCities(new java.util.ArrayList<>());
        sessionDefender.setSurprisePatrolCities(new java.util.ArrayList<>());
        sessionDefender.setCityHeat(new java.util.HashMap<>());

        com.spygame.covertops.model.PlanStep planStep = new com.spygame.covertops.model.PlanStep();
        securitySweepService.resolveSecuritySweeps(sessionDefender, planStep, config);

        assertEquals("SUCCESS", sessionDefender.getStatus());
        assertTrue(sessionDefender.getDiscoveredClues().stream().anyMatch(c -> c.getClueText().contains("DEFENDER VICTORY")));

        // Case 2: Player is ATTACKER. Turning limit reached -> COMPROMISED
        GameSession sessionAttacker = new GameSession();
        sessionAttacker.setPlayerRole("ATTACKER");
        sessionAttacker.setCurrentTurn(35);
        sessionAttacker.setMaxTurns(35);
        sessionAttacker.setAiMasterPlan(mockPlan);
        sessionAttacker.setAgents(new java.util.ArrayList<>());
        sessionAttacker.setTacticalTeams(new java.util.ArrayList<>());
        sessionAttacker.setHostilePatrolCities(new java.util.ArrayList<>());
        sessionAttacker.setSurprisePatrolCities(new java.util.ArrayList<>());
        sessionAttacker.setCityHeat(new java.util.HashMap<>());

        securitySweepService.resolveSecuritySweeps(sessionAttacker, planStep, config);

        assertEquals("COMPROMISED", sessionAttacker.getStatus());
        assertTrue(sessionAttacker.getDiscoveredClues().stream().anyMatch(c -> c.getClueText().contains("MISSION FAILURE")));
    }

    private GameSession createTestSession() {
        GameSession session = sessionService.createSession("operation_silent_edge");
        session.setDeploymentPending(false);
        if (config.getAgents() != null) {
            for (GameSession.Agent agent : session.getAgents()) {
                java.util.Map<String, Object> aMap = config.getAgents().stream()
                        .filter(m -> ((Integer) m.get("id")).equals(agent.getId()))
                        .findFirst()
                        .orElse(null);
                if (aMap != null) {
                    agent.setCurrentCity((String) aMap.get("startingCity"));
                }
            }
        }
        if (config.getTacticalTeams() != null) {
            for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
                java.util.Map<String, Object> tMap = config.getTacticalTeams().stream()
                        .filter(m -> ((Integer) m.get("id")).equals(team.getId()))
                        .findFirst()
                        .orElse(null);
                if (tMap != null) {
                    team.setCurrentCity((String) tMap.get("startingCity"));
                }
            }
        }
        if (config.getStartingDefenderSafehouses() != null) {
            java.util.List<GameSession.Safehouse> safehousesList = config.getStartingDefenderSafehouses().stream()
                    .map(sMap -> new GameSession.Safehouse(sMap.get("cityId"), "DEFENDER", "DEFAULT", true))
                    .collect(java.util.stream.Collectors.toList());
            session.setSafehouses(safehousesList);
        }
        return session;
    }

    @Test
    public void testDroneAviationSystem() {
        GameSession session = createTestSession();
        
        assertNotNull(session.getDrones());
        assertEquals(2, session.getDrones().size());
        assertEquals("ACTIVE", session.getDrones().get(0).getStatus());

        // amritsar already has a drone base by default, so we can check that or build a new one
        if (!session.getDroneBases().contains("amritsar")) {
            session = defenderService.buildDroneBase(session, "amritsar", config);
        }
        assertTrue(session.getDroneBases().contains("amritsar"));

        GameSession.Drone drone = session.getDrones().get(0);
        drone.setCurrentCity("amritsar");
        drone.setStatus("ACTIVE");
        
        com.spygame.covertops.model.EndTurnRequest request = new com.spygame.covertops.model.EndTurnRequest();
        java.util.List<java.util.Map<String, Object>> ops = new java.util.ArrayList<>();
        java.util.Map<String, Object> op = new java.util.HashMap<>();
        op.put("droneId", drone.getId());
        op.put("actionType", "RECON");
        op.put("targetCity", "jammu");
        ops.add(op);
        request.setDroneOperations(ops);

        Mockito.when(repository.findById(session.getId())).thenReturn(java.util.Optional.of(session));
        session = sessionService.processEndTurn(session.getId(), request);

        assertTrue(session.getDiscoveredClues().stream()
                .anyMatch(c -> c.getClueText().contains("RECON") && c.getClueText().toUpperCase().contains("JAMMU")));
    }
}
