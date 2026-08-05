package com.spygame.covertops;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.repository.GameSessionRepository;
import com.spygame.covertops.service.AIAttackerService;
import com.spygame.covertops.service.CombatResolutionService;
import com.spygame.covertops.service.SourcingMilestoneService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

public class CombatOverhaulTest {

    private CombatResolutionService combatService;
    private SourcingMilestoneService milestoneService;
    private AIAttackerService attackerService;
    private GameSessionRepository repository;
    private ScenarioConfig config;

    @BeforeEach
    public void setup() throws Exception {
        combatService = new CombatResolutionService();
        milestoneService = new SourcingMilestoneService();
        attackerService = new AIAttackerService();
        
        repository = Mockito.mock(GameSessionRepository.class);
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ReflectionTestUtils.setField(combatService, "repository", repository);

        ObjectMapper mapper = new ObjectMapper();
        config = mapper.readValue(new File("../scenarios/operation_silent_edge.json"), ScenarioConfig.class);
    }

    @Test
    public void testSecureSafehouseRaidCheckAndDestruction() {
        GameSession session = new GameSession();
        session.setCurrentTurn(5);
        session.setBudget(500000);
        session.setSafehouses(new ArrayList<>());
        session.setAiAttackers(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());
        session.setCityHeat(new HashMap<>());

        // Add a secure hostile safehouse
        GameSession.Safehouse secureSH = new GameSession.Safehouse("karachi", "HOSTILE", "PURCHASED", false, "999");
        secureSH.setSecure(true);
        session.getSafehouses().add(secureSH);

        // Add one attacker
        GameSession.AIAttacker attacker = new GameSession.AIAttacker("Tariq Mahmood", "karachi", "Initial decoy");
        session.getAiAttackers().add(attacker);

        // Set up the raid action
        Map<String, Object> action = new HashMap<>();
        action.put("actionType", "RAID_SAFEHOUSE");
        action.put("cityNode", "karachi");
        action.put("targetSafehouseCode", "999");
        action.put("teamId", 1);
        List<Map<String, Object>> actions = new ArrayList<>();
        actions.add(action);

        // Trigger raid resolution
        GameSession result = combatService.resolveCovertActions(session, actions, null, config);

        // Verify safehouse was destroyed (removed from active list)
        assertTrue(result.getSafehouses().isEmpty(), "Secure safehouse should be destroyed after a raid");

        // Verify attacker is either eliminated (Lost) or escaping (Healing)
        GameSession.AIAttacker updatedAtt = result.getAiAttackers().get(0);
        assertTrue(updatedAtt.isEliminated() || "Healing".equals(updatedAtt.getState()));
        if (!updatedAtt.isEliminated()) {
            assertEquals(5, updatedAtt.getHealingTurnsRemaining(), "Escaping attacker should enter 5 turn healing lockout");
        }
    }

    @Test
    public void testCasualtyProbabilityMatrixForThreeAttackers() {
        GameSession session = new GameSession();
        session.setCurrentTurn(5);
        session.setBudget(500000);
        session.setSafehouses(new ArrayList<>());
        session.setAiAttackers(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());
        session.setCityHeat(new HashMap<>());

        // Add a normal hostile safehouse
        GameSession.Safehouse normalSH = new GameSession.Safehouse("lahore", "HOSTILE", "PURCHASED", true, "123");
        session.getSafehouses().add(normalSH);

        // Add 3 attackers in Lahore
        session.getAiAttackers().add(new GameSession.AIAttacker("Attacker1", "lahore", "Initial decoy"));
        session.getAiAttackers().add(new GameSession.AIAttacker("Attacker2", "lahore", "Initial decoy"));
        session.getAiAttackers().add(new GameSession.AIAttacker("Attacker3", "lahore", "Initial decoy"));

        Map<String, Object> action = new HashMap<>();
        action.put("actionType", "RAID_SAFEHOUSE");
        action.put("cityNode", "lahore");
        action.put("targetSafehouseCode", "123");
        action.put("teamId", 1);
        List<Map<String, Object>> actions = new ArrayList<>();
        actions.add(action);

        // Resolve raid
        GameSession result = combatService.resolveCovertActions(session, actions, null, config);

        // With 3 attackers, the rule says: 2 gets killed, 1 escapes (100% chance if successful roll, or all escape if failed roll)
        long eliminatedCount = result.getAiAttackers().stream().filter(GameSession.AIAttacker::isEliminated).count();
        long healingCount = result.getAiAttackers().stream().filter(a -> "Healing".equals(a.getState())).count();

        // Safehouse is definitely destroyed
        assertTrue(result.getSafehouses().isEmpty());

        if (eliminatedCount == 2) {
            assertEquals(1, healingCount, "One attacker should escape and enter healing");
            GameSession.AIAttacker survivor = result.getAiAttackers().stream().filter(a -> !a.isEliminated()).findFirst().get();
            assertEquals(5, survivor.getHealingTurnsRemaining());
            assertNotEquals("lahore", survivor.getCurrentLocation(), "Survivor should have fled to a connected city");
        } else {
            // Failed roll -> all 3 escape
            assertEquals(3, healingCount);
        }
    }

    @Test
    public void testHealingTimerTickingAndStateRestoration() {
        GameSession session = new GameSession();
        session.setCurrentTurn(10);
        session.setAiAttackers(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());

        GameSession.AIAttacker attacker = new GameSession.AIAttacker("Zubair Khan", "karachi", "Healing");
        attacker.setHealingTurnsRemaining(1);
        attacker.setFinanceCollected(true); // Completed finance before healing
        session.getAiAttackers().add(attacker);

        // Tick down milestones
        milestoneService.tickAttackerMilestones(session);

        assertEquals(0, attacker.getHealingTurnsRemaining());
        assertEquals("Request Logistic", attacker.getState(), "Should restore state to Request Logistic since finance was collected");
    }

    @Test
    public void testHandoverCityReinitialization() {
        ReflectionTestUtils.setField(attackerService, "pathfinder", new com.spygame.covertops.service.AttackerPathfinder());

        GameSession session = new GameSession();
        session.setCurrentTurn(12);
        session.setStatus("ACTIVE");
        session.setSafehouses(new ArrayList<>());
        session.setAiAttackers(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());
        session.setCityHeat(new HashMap<>());

        GameSession.AIAttacker attacker = new GameSession.AIAttacker("Tariq Mahmood", "karachi", "Handover pending");
        attacker.setFinanceCollected(true);
        attacker.setLogisticsCollected(true);
        attacker.setHandoverCity(null);
        attacker.setHandoverTurnsRemaining(-1);
        session.getAiAttackers().add(attacker);

        GameSession result = attackerService.executeTurn(session, config);

        GameSession.AIAttacker updatedAtt = result.getAiAttackers().get(0);
        assertNotNull(updatedAtt.getHandoverCity(), "Handover city should be re-assigned dynamically if it was reset to null");
        assertEquals(2, updatedAtt.getHandoverTurnsRemaining(), "Handover turns countdown should be reset to 2 turns");
    }

    @Test
    public void testWiretapDoesNotTriggerAfterFinanceCollected() {
        com.spygame.covertops.service.ClueGenerationEngine clueEngine = new com.spygame.covertops.service.ClueGenerationEngine();
        
        GameSession session = new GameSession();
        session.setCurrentTurn(5);
        session.setAiMasterPlan(new com.spygame.covertops.model.AIMasterPlan(new ArrayList<>(), new ArrayList<>()));
        session.setAiAttackers(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());
        session.setEspionageResources(new ArrayList<>());
        session.setAgents(new ArrayList<>());

        GameSession.ActiveResource wiretap = new GameSession.ActiveResource();
        wiretap.setType("WIRE_TAP");
        wiretap.setCityNode("lahore");
        session.getEspionageResources().add(wiretap);

        GameSession.AIAttacker attacker = new GameSession.AIAttacker("Tariq Mahmood", "karachi", "Initial decoy");
        attacker.setRequestedFinanceCity("lahore");
        attacker.setFinanceCollected(false);
        session.getAiAttackers().add(attacker);

        List<GameSession.Clue> clues = clueEngine.generateTurnClues(session, config);
        boolean hasWiretapClue = clues.stream().anyMatch(c -> "WIRE_TAP".equals(c.getSource()));
        assertTrue(hasWiretapClue, "Wiretap should trigger if finance is not collected");

        attacker.setFinanceCollected(true);
        List<GameSession.Clue> cluesAfterCollection = clueEngine.generateTurnClues(session, config);
        boolean hasWiretapClueAfter = cluesAfterCollection.stream().anyMatch(c -> "WIRE_TAP".equals(c.getSource()));
        assertFalse(hasWiretapClueAfter, "Wiretap should not trigger after finance has been collected");
    }

    @Test
    public void testHandoverExecutionAndCompletion() {
        GameSession session = new GameSession();
        session.setCurrentTurn(10);
        session.setAiAttackers(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());

        GameSession.AIAttacker attacker = new GameSession.AIAttacker("Tariq Mahmood", "karachi", "Handover pending");
        attacker.setFinanceCollected(true);
        attacker.setLogisticsCollected(true);
        attacker.setHandoverCity("karachi");
        attacker.setHandoverTurnsRemaining(2);
        session.getAiAttackers().add(attacker);

        // Turn 1: stay in Karachi, decrement turns remaining from 2 to 1
        milestoneService.tickAttackerMilestones(session);
        assertEquals(1, attacker.getHandoverTurnsRemaining());
        assertFalse(attacker.isHandoverCompleted());
        assertEquals("Handover pending", attacker.getState());

        boolean hasStartedClue = session.getDiscoveredClues().stream()
                .anyMatch(c -> "HANDOVER_STARTED".equals(c.getSource()));
        assertTrue(hasStartedClue);

        // Turn 2: stay, decrement turns from 1 to 0, completion triggered
        milestoneService.tickAttackerMilestones(session);
        assertEquals(0, attacker.getHandoverTurnsRemaining());
        assertTrue(attacker.isHandoverCompleted());
        assertEquals("Permission to cross border", attacker.getState());

        boolean hasCompleteClue = session.getDiscoveredClues().stream()
                .anyMatch(c -> "HANDOVER_COMPLETE".equals(c.getSource()));
        assertTrue(hasCompleteClue);

        boolean hasCrossingRequestedClue = session.getDiscoveredClues().stream()
                .anyMatch(c -> "BORDER_CROSSING_REQUESTED".equals(c.getSource()));
        assertTrue(hasCrossingRequestedClue);
    }

    @Test
    public void testHandoverTravelNoReset() {
        GameSession session = new GameSession();
        session.setCurrentTurn(10);
        session.setAiAttackers(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());

        GameSession.AIAttacker attacker = new GameSession.AIAttacker("Tariq Mahmood", "lahore", "Handover pending");
        attacker.setFinanceCollected(true);
        attacker.setLogisticsCollected(true);
        attacker.setHandoverCity("karachi");
        attacker.setHandoverTurnsRemaining(2);
        session.getAiAttackers().add(attacker);

        // Ticking milestones while traveling (not in karachi) should NOT reset handover
        milestoneService.tickAttackerMilestones(session);
        assertEquals("karachi", attacker.getHandoverCity());
        assertEquals(2, attacker.getHandoverTurnsRemaining());
        assertEquals("Handover pending", attacker.getState());
        
        // If they had started (remaining = 1) and then left/was not in karachi, it SHOULD reset
        attacker.setHandoverTurnsRemaining(1);
        milestoneService.tickAttackerMilestones(session);
        assertNull(attacker.getHandoverCity());
        assertEquals(-1, attacker.getHandoverTurnsRemaining());
    }

    @Test
    public void testSoughtAndReceivedPermissionClues() {
        GameSession session = new GameSession();
        session.setStatus("ACTIVE");
        session.setCurrentTurn(10);
        session.setAiAttackers(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());
        session.setSafehouses(new ArrayList<>());
        session.setCityHeat(new HashMap<>());

        org.springframework.test.util.ReflectionTestUtils.setField(attackerService, "pathfinder", new com.spygame.covertops.service.AttackerPathfinder());

        GameSession.AIAttacker attacker = new GameSession.AIAttacker("Tariq Mahmood", "karachi", "Handover pending");
        attacker.setFinanceCollected(true);
        attacker.setLogisticsCollected(true);
        attacker.setHandoverCity("karachi");
        attacker.setHandoverTurnsRemaining(0);
        attacker.setHandoverCompleted(false);
        session.getAiAttackers().add(attacker);

        // Turn 10: execute turn.
        // It transitions to "Permission to cross border" (sought) and then immediately to "Border crossed" (received).
        // Both clues are generated with turnDiscovered = 11.
        attackerService.executeTurn(session, config);

        assertEquals("Border crossed", attacker.getState());

        System.err.println("DISCOVERED CLUES IN TEST:");
        for (GameSession.Clue clue : session.getDiscoveredClues()) {
            System.err.println("Clue: source=" + clue.getSource() + ", text=" + clue.getClueText() + ", turnDiscovered=" + clue.getTurnDiscovered());
        }

        boolean hasCrossingRequestClue = session.getDiscoveredClues().stream()
                .anyMatch(c -> "BORDER_CROSSING_REQUESTED".equals(c.getSource()) && c.getTurnDiscovered() == 11);
        assertTrue(hasCrossingRequestClue);

        boolean hasCrossingApprovedClue = session.getDiscoveredClues().stream()
                .anyMatch(c -> "STATE_INTELLIGENCE".equals(c.getSource()) && c.getClueText().contains("permission granted to suspect") && c.getTurnDiscovered() == 11);
        assertTrue(hasCrossingApprovedClue);

        // Now move to target city and test attack request
        session.setCurrentTurn(11);
        attacker.setCurrentLocation("new_delhi"); // target city
        attackerService.executeTurn(session, config); // reaches target city, transitions to "Permission to engage", then "Attack initiated", then "Exfiltration"
        assertEquals("Exfiltration", attacker.getState());

        boolean hasAttackRequestClue = session.getDiscoveredClues().stream()
                .anyMatch(c -> "ATTACK_REQUESTED".equals(c.getSource()) && c.getTurnDiscovered() == 12);
        assertTrue(hasAttackRequestClue);

        boolean hasAttackApprovedClue = session.getDiscoveredClues().stream()
                .anyMatch(c -> "STATE_INTELLIGENCE".equals(c.getSource()) && c.getClueText().contains("Permission to engage target has been granted") && c.getTurnDiscovered() == 12);
        assertTrue(hasAttackApprovedClue);
    }

    @Test
    public void testNoCluesGeneratedForEliminatedAttacker() {
        com.spygame.covertops.service.ClueGenerationEngine clueEngine = new com.spygame.covertops.service.ClueGenerationEngine();
        
        GameSession session = new GameSession();
        session.setCurrentTurn(10);
        session.setAiAttackers(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());
        session.setEspionageResources(new ArrayList<>());
        session.setAgents(new ArrayList<>());

        // Add a mock master plan with historical step for Tariq Mahmood at turn 4 (which is T-6)
        List<PlanStep> steps = new ArrayList<>();
        PlanStep step4 = new PlanStep();
        step4.setTurn(4);
        List<PlanStep.AttackerHistory> histList = new ArrayList<>();
        PlanStep.AttackerHistory hist = new PlanStep.AttackerHistory();
        hist.setName("Tariq Mahmood");
        hist.setLocation("karachi");
        hist.setEliminated(false);
        histList.add(hist);
        step4.setAttackerHistories(histList);
        steps.add(step4);
        session.setAiMasterPlan(new com.spygame.covertops.model.AIMasterPlan(steps, new ArrayList<>()));

        // Add an agent in Karachi doing FIND_SUSPECT
        GameSession.Agent agent = new GameSession.Agent();
        agent.setId(1);
        agent.setCodename("Vance");
        agent.setCurrentCity("karachi");
        agent.setActiveTask("FIND_SUSPECT");
        agent.setCooldownRemaining(0);
        session.getAgents().add(agent);

        // Add a tech resource (PHONE_TAP) in Karachi
        GameSession.ActiveResource phoneTap = new GameSession.ActiveResource();
        phoneTap.setType("PHONE_TAP");
        phoneTap.setCityNode("karachi");
        session.getEspionageResources().add(phoneTap);

        // Scenario 1: Attacker is NOT eliminated. Clues SHOULD be generated!
        GameSession.AIAttacker attacker = new GameSession.AIAttacker("Tariq Mahmood", "karachi", "Initial decoy");
        attacker.setEliminated(false);
        session.getAiAttackers().add(attacker);

        List<GameSession.Clue> clues = clueEngine.generateTurnClues(session, config);
        assertFalse(clues.isEmpty(), "Clues should be generated for active attacker");
        
        boolean hasHistoricalClue = clues.stream().anyMatch(c -> "HISTORICAL_INTEL".equals(c.getSource()));
        assertTrue(hasHistoricalClue, "Should generate historical footprint clue");

        boolean hasCctvOrPhoneClue = clues.stream().anyMatch(c -> "PHONE_TAP".equals(c.getSource()));
        assertTrue(hasCctvOrPhoneClue, "Should generate phone tap tech scan clue");

        // Scenario 2: Attacker IS eliminated. No clues for Tariq Mahmood should be generated!
        attacker.setEliminated(true);
        List<GameSession.Clue> cluesAfterElimination = clueEngine.generateTurnClues(session, config);
        
        boolean containsTariq = cluesAfterElimination.stream().anyMatch(c -> c.getClueText().contains("Tariq Mahmood"));
        assertFalse(containsTariq, "No clues should mention Tariq Mahmood once he is eliminated");

        boolean hasHistoricalClueAfter = cluesAfterElimination.stream().anyMatch(c -> "HISTORICAL_INTEL".equals(c.getSource()));
        assertFalse(hasHistoricalClueAfter, "Should not generate historical footprint clue for eliminated attacker");
    }
}
