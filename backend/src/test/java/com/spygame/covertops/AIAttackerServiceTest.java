package com.spygame.covertops;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.service.AIAttackerService;
import com.spygame.covertops.service.AttackerPathfinder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;

public class AIAttackerServiceTest {

    private AIAttackerService service;
    private AttackerPathfinder pathfinder;
    private final ObjectMapper mapper = new ObjectMapper();
    private ScenarioConfig config;

    @BeforeEach
    public void setup() throws Exception {
        service = new AIAttackerService();
        pathfinder = new AttackerPathfinder();
        ReflectionTestUtils.setField(service, "pathfinder", pathfinder);

        File configFile = new File("../scenarios/operation_silent_edge.json");
        assertTrue(configFile.exists(), "Scenario configuration file should exist");
        config = mapper.readValue(configFile, ScenarioConfig.class);
    }

    @Test
    public void testExecuteTurnInitialization() {
        GameSession session = new GameSession();
        session.setCurrentTurn(1);
        session.setMaxTurns(25);
        session.setStatus("ACTIVE");
        session.setSafehouses(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());
        session.setCityHeat(new java.util.HashMap<>());

        // Verify executeTurn initializes the 3 attackers at turn 1
        GameSession updatedSession = service.executeTurn(session, config);
        assertNotNull(updatedSession.getAiAttackers());
        assertEquals(3, updatedSession.getAiAttackers().size());

        // Verify initial phase state is Request Finance
        for (GameSession.AIAttacker attacker : updatedSession.getAiAttackers()) {
            assertEquals("Request Finance", attacker.getState());
            assertNotNull(attacker.getRequestedFinanceCity());
            assertTrue(attacker.getFinanceCollectionTurnsRemaining() > 0);
        }
    }

    @Test
    public void testExecuteTurnRouting() {
        GameSession session = new GameSession();
        session.setCurrentTurn(2);
        session.setMaxTurns(25);
        session.setStatus("ACTIVE");
        session.setSafehouses(new ArrayList<>());
        session.setDiscoveredClues(new ArrayList<>());
        session.setCityHeat(new java.util.HashMap<>());
        session.setHostilePatrolCities(new ArrayList<>());
        session.setSurprisePatrolCities(new ArrayList<>());

        // Manually setup an active attacker
        ArrayList<GameSession.AIAttacker> attackers = new ArrayList<>();
        GameSession.AIAttacker att = new GameSession.AIAttacker("Tariq Mahmood", "karachi", "Request Finance");
        att.setRequestedFinanceCity("islamabad");
        att.setFinanceCollectionTurnsRemaining(0);
        att.setBudget(300000);
        attackers.add(att);
        session.setAiAttackers(attackers);

        // Add safehouse in Karachi so attacker can move
        GameSession.Safehouse sh = new GameSession.Safehouse("karachi", "HOSTILE", "PURCHASED", true, "123");
        sh.setAttackerName("Tariq Mahmood");
        session.getSafehouses().add(sh);

        GameSession updatedSession = service.executeTurn(session, config);
        GameSession.AIAttacker updatedAtt = updatedSession.getAiAttackers().get(0);

        // Verify attacker started moving towards the finance city target
        assertNotEquals("karachi", updatedAtt.getCurrentLocation(), "AI attacker should evaluate moves and route towards target");
    }
}
