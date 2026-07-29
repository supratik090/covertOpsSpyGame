package com.spygame.covertops;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.AIMasterPlan;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.service.AIAttackerService;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class AIAttackerServiceTest {

    private final AIAttackerService service = new AIAttackerService();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    public void testGenerateMasterPlan() throws Exception {
        // Load the scenario file
        File configFile = new File("../scenarios/operation_silent_edge.json");
        assertTrue(configFile.exists(), "Scenario configuration file should exist");

        ScenarioConfig config = mapper.readValue(configFile, ScenarioConfig.class);
        assertNotNull(config, "Scenario configuration should be parsed correctly");
        assertEquals("operation_silent_edge", config.getScenarioId());

        // Generate plans
        AIMasterPlan plan = service.generateMasterPlan(config, "Tariq Mahmood");
        assertNotNull(plan, "Master plan should not be null");

        // Verify Primary Plan (25 turns)
        List<PlanStep> primary = plan.getPrimaryPlan();
        assertNotNull(primary);
        assertEquals(25, primary.size(), "Primary plan should have exactly 25 turns");

        // Verify Fallback Plan (28 turns due to +3 delay)
        List<PlanStep> fallback = plan.getFallbackPlan();
        assertNotNull(fallback);
        assertEquals(28, fallback.size(), "Fallback plan should have exactly 28 turns due to penalty");

        // Verify specific phases exist
        boolean hasTrailBreaking = primary.stream().anyMatch(s -> "TRAIL_BREAKING".equals(s.getPhase()));
        boolean hasFinance = primary.stream().anyMatch(s -> "FINANCE_SOURCING".equals(s.getPhase()));
        boolean hasLogistics = primary.stream().anyMatch(s -> "LOGISTICS_SOURCING".equals(s.getPhase()));
        boolean hasHandover = primary.stream().anyMatch(s -> "HANDOVER".equals(s.getPhase()));
        boolean hasCrossing = primary.stream().anyMatch(s -> "BORDER_CROSSING".equals(s.getPhase()));
        boolean hasTransit = primary.stream().anyMatch(s -> "ATTACK_PREP".equals(s.getPhase()));
        boolean hasStrike = primary.stream().anyMatch(s -> "STRIKE".equals(s.getPhase()));

        assertTrue(hasTrailBreaking, "Primary plan should have Trail Breaking");
        assertTrue(hasFinance, "Primary plan should have Finance Sourcing");
        assertTrue(hasLogistics, "Primary plan should have Logistics Sourcing");
        assertTrue(hasHandover, "Primary plan should have Handover Meeting");
        assertTrue(hasCrossing, "Primary plan should have Border Crossing");
        assertTrue(hasTransit, "Primary plan should have Attack Prep Transit");
        assertTrue(hasStrike, "Primary plan should have Strike");

        // Print sample output to console
        String jsonOutput = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(plan);
        System.out.println("Generated Plan Output:\n" + jsonOutput);
    }
}
