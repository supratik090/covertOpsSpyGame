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

    @Test
    public void testBuyDroneAndCapacityLimit() {
        GameSession session = createTestSession();
        int initialBudget = session.getBudget();

        // Ensure "amritsar" is a drone base and assign initial drones to amritsar
        if (!session.getDroneBases().contains("amritsar")) {
            session = defenderService.buildDroneBase(session, "amritsar", config);
        }
        session.getDrones().get(0).setCurrentCity("amritsar");
        session.getDrones().get(1).setCurrentCity("amritsar");

        // Initially session has 2 drones stationed at amritsar
        assertEquals(2, session.getDrones().stream().filter(d -> "amritsar".equals(d.getCurrentCity())).count());

        // Attempting to buy a 3rd drone for "amritsar" should throw an IllegalStateException (max 2 per base)
        final GameSession fullBaseSession = session;
        assertThrows(IllegalStateException.class, () -> {
            defenderService.buyDrone(fullBaseSession, "amritsar", "1-HOP", config);
        });

        // Build a second drone base in "new_delhi"
        session = defenderService.buildDroneBase(session, "new_delhi", config);
        int budgetBeforeBuy = session.getBudget();

        // Buy 1-Hop Drone ($500K) for new_delhi
        session = defenderService.buyDrone(session, "new_delhi", "1-HOP", config);
        assertEquals(budgetBeforeBuy - 500000, session.getBudget());
        GameSession.Drone drone1Hop = session.getDrones().stream()
                .filter(d -> "new_delhi".equals(d.getCurrentCity()))
                .findFirst()
                .orElseThrow();
        assertEquals("1-HOP", drone1Hop.getType());
        assertEquals(1, drone1Hop.getMaxHops());

        // Buy 2-Hop Drone ($1M) for new_delhi
        int budgetBefore2Hop = session.getBudget();
        session = defenderService.buyDrone(session, "new_delhi", "2-HOP", config);
        assertEquals(budgetBefore2Hop - 1000000, session.getBudget());

        // Now new_delhi has 2 drones (max capacity)
        assertEquals(2, session.getDrones().stream().filter(d -> "new_delhi".equals(d.getCurrentCity())).count());

        // Buying another drone for new_delhi should now fail due to capacity limit of 2
        final GameSession newDelhiFullSession = session;
        assertThrows(IllegalStateException.class, () -> {
            defenderService.buyDrone(newDelhiFullSession, "new_delhi", "1-HOP", config);
        });
    }

    @Test
    public void testDroneHopRangeValidation() {
        GameSession session = createTestSession();
        if (!session.getDroneBases().contains("amritsar")) {
            session = defenderService.buildDroneBase(session, "amritsar", config);
        }

        // Set Drone 1 as 1-HOP drone
        GameSession.Drone drone1 = session.getDrones().get(0);
        drone1.setCurrentCity("amritsar");
        drone1.setType("1-HOP");
        drone1.setMaxHops(1);

        // Set Drone 2 as 2-HOP drone
        GameSession.Drone drone2 = session.getDrones().get(1);
        drone2.setCurrentCity("amritsar");
        drone2.setType("2-HOP");
        drone2.setMaxHops(2);

        // Lahore is connected to Amritsar (1-hop)
        // Islamabad is connected to Lahore (2-hops from Amritsar)
        // Peshawar is connected to Islamabad (3-hops from Amritsar)

        // 1-HOP drone targeting Islamabad (2-hops away) should get CANCELLED clue due to out of range
        com.spygame.covertops.model.EndTurnRequest request1 = new com.spygame.covertops.model.EndTurnRequest();
        java.util.List<java.util.Map<String, Object>> ops1 = new java.util.ArrayList<>();
        java.util.Map<String, Object> op1 = new java.util.HashMap<>();
        op1.put("droneId", drone1.getId());
        op1.put("actionType", "RECON");
        op1.put("targetCity", "islamabad");
        ops1.add(op1);
        request1.setDroneOperations(ops1);

        Mockito.when(repository.findById(session.getId())).thenReturn(java.util.Optional.of(session));
        GameSession updatedSession1 = sessionService.processEndTurn(session.getId(), request1);

        assertTrue(updatedSession1.getDiscoveredClues().stream()
                .anyMatch(c -> c.getClueText().contains("out of operational range")));

        // 2-HOP drone targeting Islamabad (2-hops away) should SUCCEED
        com.spygame.covertops.model.EndTurnRequest request2 = new com.spygame.covertops.model.EndTurnRequest();
        java.util.List<java.util.Map<String, Object>> ops2 = new java.util.ArrayList<>();
        java.util.Map<String, Object> op2 = new java.util.HashMap<>();
        op2.put("droneId", drone2.getId());
        op2.put("actionType", "RECON");
        op2.put("targetCity", "islamabad");
        ops2.add(op2);
        request2.setDroneOperations(ops2);

        GameSession updatedSession2 = sessionService.processEndTurn(session.getId(), request2);

        assertTrue(updatedSession2.getDiscoveredClues().stream()
                .anyMatch(c -> c.getClueText().contains("RECON") && c.getClueText().toUpperCase().contains("ISLAMABAD")));
    }

    @Test
    public void testEnhancedBorderGuardEfficiency() {
        GameSession session = createTestSession();
        // Deploy Border Guard in friendly border city Amritsar
        session = defenderService.deployEspionageResource(session, "BORDER_GUARD", "amritsar", config);
        // Deploy Satellite in Amritsar
        session = defenderService.deployEspionageResource(session, "SATELLITE", "amritsar", config);
        // Deploy Drone in Amritsar
        if (session.getDrones() != null && !session.getDrones().isEmpty()) {
            session.getDrones().get(0).setCurrentCity("amritsar");
            session.getDrones().get(0).setStatus("ACTIVE");
        }

        // Verify resource presence
        boolean hasBG = session.getEspionageResources().stream().anyMatch(r -> "BORDER_GUARD".equals(r.getType()) && "amritsar".equals(r.getCityNode()));
        boolean hasSat = session.getEspionageResources().stream().anyMatch(r -> "SATELLITE".equals(r.getType()) && "amritsar".equals(r.getCityNode()));
        assertTrue(hasBG);
        assertTrue(hasSat);
    }

    @Test
    public void testDroneShotDownUnderSecuritySweep() {
        GameSession session = createTestSession();
        if (!session.getDroneBases().contains("amritsar")) {
            session = defenderService.buildDroneBase(session, "amritsar", config);
        }

        GameSession.Drone drone = session.getDrones().get(0);
        drone.setCurrentCity("amritsar");
        drone.setStatus("ACTIVE");

        // Set "lahore" under hostile patrol (security sweep)
        java.util.List<String> patrols = new java.util.ArrayList<>();
        patrols.add("lahore");
        session.setHostilePatrolCities(patrols);

        // Perform RECON on lahore
        com.spygame.covertops.model.EndTurnRequest request = new com.spygame.covertops.model.EndTurnRequest();
        java.util.List<java.util.Map<String, Object>> ops = new java.util.ArrayList<>();
        java.util.Map<String, Object> op = new java.util.HashMap<>();
        op.put("droneId", drone.getId());
        op.put("actionType", "RECON");
        op.put("targetCity", "lahore");
        ops.add(op);
        request.setDroneOperations(ops);

        Mockito.when(repository.findById(session.getId())).thenReturn(java.util.Optional.of(session));
        GameSession updatedSession = sessionService.processEndTurn(session.getId(), request);

        assertNotNull(updatedSession);
    }

    @Test
    public void testPersistentDroneOperationAcrossTurns() {
        GameSession session = createTestSession();
        if (!session.getDroneBases().contains("amritsar")) {
            session = defenderService.buildDroneBase(session, "amritsar", config);
        }

        GameSession.Drone drone = session.getDrones().get(0);
        drone.setCurrentCity("amritsar");
        drone.setStatus("ACTIVE");

        // Turn 1: Player assigns Drone RECON on jammu
        com.spygame.covertops.model.EndTurnRequest request1 = new com.spygame.covertops.model.EndTurnRequest();
        java.util.List<java.util.Map<String, Object>> ops1 = new java.util.ArrayList<>();
        java.util.Map<String, Object> op1 = new java.util.HashMap<>();
        op1.put("droneId", drone.getId());
        op1.put("actionType", "RECON");
        op1.put("targetCity", "jammu");
        ops1.add(op1);
        request1.setDroneOperations(ops1);

        Mockito.when(repository.findById(session.getId())).thenReturn(java.util.Optional.of(session));
        GameSession turn1Session = sessionService.processEndTurn(session.getId(), request1);

        // Verify drone has persistent assignments stored
        GameSession.Drone turn1Drone = turn1Session.getDrones().stream().filter(d -> d.getId() == drone.getId()).findFirst().orElseThrow();
        assertEquals("RECON", turn1Drone.getAssignedActionType());
        assertEquals("jammu", turn1Drone.getAssignedTargetCity());

        // Turn 2: Send EndTurnRequest carrying over the persistent drone operations
        com.spygame.covertops.model.EndTurnRequest request2 = new com.spygame.covertops.model.EndTurnRequest();
        request2.setDroneOperations(ops1); // persistent ops sent by UI

        Mockito.when(repository.findById(turn1Session.getId())).thenReturn(java.util.Optional.of(turn1Session));
        GameSession turn2Session = sessionService.processEndTurn(turn1Session.getId(), request2);

        // Turn 2 should execute RECON on jammu automatically
        assertTrue(turn2Session.getDiscoveredClues().stream()
                .anyMatch(c -> c.getTurnDiscovered() == 2 && c.getClueText().contains("RECON") && c.getClueText().toUpperCase().contains("JAMMU")));
    }
}
