package com.spygame.covertops.service;

import com.spygame.covertops.model.AIMasterPlan;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.model.ScenarioConfig;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
public class AIAttackerService {

    private final Random random = new Random();

    // Generates a complete 25-turn plan containing both Primary and Fallback/Backup arrays.
    public AIMasterPlan generateMasterPlan(ScenarioConfig config, String actualAttacker) {
        List<Node> hostileNodes = config.getNodes().stream()
                .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                .collect(Collectors.toList());

        List<Node> homeNodes = config.getNodes().stream()
                .filter(n -> "HOME_TERRITORY".equals(n.getTerritory()))
                .collect(Collectors.toList());

        // Extract mappings
        String financeMethod = "Direct Account Transfer";
        if (config.getFinanceMapping() != null && config.getFinanceMapping().containsKey(config.getAttackForm())) {
            financeMethod = (String) config.getFinanceMapping().get(config.getAttackForm()).getOrDefault("itemName", financeMethod);
        }

        String logisticsMethod = "Sniper Assembly Kits";
        if (config.getLogisticsMapping() != null && config.getLogisticsMapping().containsKey(config.getAttackForm())) {
            logisticsMethod = (String) config.getLogisticsMapping().get(config.getAttackForm()).getOrDefault("itemName", logisticsMethod);
        }

        // Generate primary path
        List<PlanStep> primaryPlan = generateSinglePath(config, hostileNodes, homeNodes, financeMethod, logisticsMethod, false);

        // Generate fallback path (with different locations, and +3 turn deadline offset)
        List<PlanStep> fallbackPlan = generateSinglePath(config, hostileNodes, homeNodes, financeMethod, logisticsMethod, true);

        AIMasterPlan masterPlan = new AIMasterPlan(primaryPlan, fallbackPlan);
        masterPlan.setBriefing(config.getBriefing());
        return masterPlan;
    }

    public List<PlanStep> generateDecoyPath(ScenarioConfig config) {
        List<Node> hostileNodes = config.getNodes().stream()
                .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                .collect(Collectors.toList());

        List<Node> homeNodes = config.getNodes().stream()
                .filter(n -> "HOME_TERRITORY".equals(n.getTerritory()))
                .collect(Collectors.toList());

        String financeMethod = "Direct Account Transfer";
        if (config.getFinanceMapping() != null && config.getFinanceMapping().containsKey(config.getAttackForm())) {
            financeMethod = (String) config.getFinanceMapping().get(config.getAttackForm()).getOrDefault("itemName", financeMethod);
        }

        String logisticsMethod = "Sniper Assembly Kits";
        if (config.getLogisticsMapping() != null && config.getLogisticsMapping().containsKey(config.getAttackForm())) {
            logisticsMethod = (String) config.getLogisticsMapping().get(config.getAttackForm()).getOrDefault("itemName", logisticsMethod);
        }

        List<PlanStep> steps = generateSinglePath(config, hostileNodes, homeNodes, financeMethod, logisticsMethod, false);
        
        // Modify the final step to make sure they do not do the final strike action
        if (!steps.isEmpty()) {
            PlanStep finalStep = steps.get(steps.size() - 1);
            finalStep.setPhase("DISPERSAL");
            finalStep.setAction("DISPERSE");
            if (steps.size() > 1) {
                finalStep.setSuspectLocation(steps.get(steps.size() - 2).getSuspectLocation());
                finalStep.setCovertTeamLocation(steps.get(steps.size() - 2).getSuspectLocation());
            } else {
                finalStep.setSuspectLocation("NONE");
                finalStep.setCovertTeamLocation("NONE");
            }
            finalStep.setEscapeMethod("NONE");
            finalStep.setEscapeNode("NONE");
        }
        return steps;
    }

    private List<PlanStep> generateSinglePath(ScenarioConfig config, List<Node> hostileNodes, List<Node> homeNodes,
                                              String financeMethod, String logisticsMethod, boolean isFallback) {
        List<PlanStep> steps = new ArrayList<>();
        int maxTurns = isFallback ? config.getMaxTurns() + 3 : config.getMaxTurns();

        // 1. Pick Sourcing & Meeting Nodes in Hostile Territory
        // To keep paths diverse between Primary and Fallback, we shuffle hostile nodes.
        List<Node> hostileShuffle = new ArrayList<>(hostileNodes);
        Collections.shuffle(hostileShuffle, random);

        Node financeNode = hostileShuffle.get(0);
        Node logisticsNode = hostileShuffle.get(1 % hostileShuffle.size());
        Node handoverNode = hostileShuffle.get(2 % hostileShuffle.size());

        // 2. Define Phase Turn Timings
        int trailBreakingTurns = isFallback ? 3 : 2; // Trail-breaking turns (idle/moving)
        int financeStart = trailBreakingTurns + 1;
        int financeEnd = trailBreakingTurns + 5;
        int logisticsStart = financeEnd + 1;
        int logisticsEnd = financeEnd + 5;
        int handoverStart = logisticsEnd + 1;
        int handoverEnd = logisticsEnd + 3; // 3 rounds handover meeting
        int crossingTurn = handoverEnd + 1; // Enters border node

        // 3. Find path through Home territory to target
        List<String> homeTransitPath = findTransitPath(config, crossingTurn, maxTurns, homeNodes);

        String currentSuspectCity = hostileShuffle.get(3 % hostileShuffle.size()).getId();

        for (int turn = 1; turn <= maxTurns; turn++) {
            PlanStep step = new PlanStep();
            step.setTurn(turn);

            if (turn <= trailBreakingTurns) {
                // PHASE: Trail Breaking (Moves between hostile nodes to shake trail)
                step.setPhase("TRAIL_BREAKING");
                step.setAction("MOVE");
                currentSuspectCity = getNextConnectedHostile(config, currentSuspectCity, hostileNodes);
                step.setSuspectLocation(currentSuspectCity);
                step.setCovertTeamLocation(currentSuspectCity);
            } else if (turn >= financeStart && turn <= financeEnd) {
                // PHASE: Finance Sourcing (Stays in Finance city for 5 turns)
                step.setPhase("FINANCE_SOURCING");
                step.setAction(turn == financeStart ? "INITIATE_TRANSACTION" : "CLEAR_FUNDS");
                currentSuspectCity = financeNode.getId();
                step.setSuspectLocation(currentSuspectCity);
                step.setFinanceCity(currentSuspectCity);
                step.setFinanceMethod(financeMethod);
                step.setCovertTeamLocation(currentSuspectCity);
            } else if (turn >= logisticsStart && turn <= logisticsEnd) {
                // PHASE: Logistics Sourcing (Stays in Logistics city for 5 turns)
                step.setPhase("LOGISTICS_SOURCING");
                step.setAction(turn == logisticsStart ? "PROCURE_CARGO" : "ASSEMBLE_PAYLOAD");
                currentSuspectCity = logisticsNode.getId();
                step.setSuspectLocation(currentSuspectCity);
                step.setLogisticsCity(currentSuspectCity);
                step.setLogisticsMethod(logisticsMethod);
                step.setCovertTeamLocation(currentSuspectCity);
            } else if (turn >= handoverStart && turn <= handoverEnd) {
                // PHASE: Handover Meeting (Operatives meet in safehouse for 3 turns)
                step.setPhase("HANDOVER");
                step.setAction("SAFEHOUSE_MEETING");
                currentSuspectCity = handoverNode.getId();
                step.setSuspectLocation(currentSuspectCity);
                step.setCovertTeamLocation(currentSuspectCity);
            } else if (turn == crossingTurn) {
                // PHASE: Border Crossing (Smuggling smuggling methods)
                step.setPhase("BORDER_CROSSING");
                step.setAction("SMUGGLE");
                step.setSmuggling(true);
                step.setSmugglingMethod("Land Border (Direct Fence)");
                currentSuspectCity = homeTransitPath.get(0);
                step.setSuspectLocation(currentSuspectCity);
                step.setCovertTeamLocation(currentSuspectCity);
            } else if (turn > crossingTurn && turn < maxTurns) {
                // PHASE: Attack Prep Transit (Moves to target)
                step.setPhase("ATTACK_PREP");
                step.setAction("MOVE_SAFEHOUSE");
                int pathIndex = turn - crossingTurn;
                if (pathIndex < homeTransitPath.size()) {
                    currentSuspectCity = homeTransitPath.get(pathIndex);
                } else {
                    currentSuspectCity = config.getTargetCity();
                }
                step.setSuspectLocation(currentSuspectCity);
                step.setCovertTeamLocation(currentSuspectCity);
            } else {
                // PHASE: Strike / Escape Plan
                step.setPhase("STRIKE");
                step.setAction("EXECUTE_ATTACK");
                step.setSuspectLocation(config.getTargetCity());
                step.setCovertTeamLocation(config.getTargetCity());
                step.setEscapeMethod("Airport Exfiltration");
                step.setEscapeNode(config.getTargetCity());
            }

            steps.add(step);
        }

        return steps;
    }

    private String getNextConnectedHostile(ScenarioConfig config, String current, List<Node> hostileNodes) {
        Node node = config.getNodes().stream().filter(n -> n.getId().equals(current)).findFirst().orElse(null);
        if (node != null && node.getConnections() != null) {
            List<String> connectedHostiles = node.getConnections().stream()
                    .filter(cId -> hostileNodes.stream().anyMatch(hn -> hn.getId().equals(cId)))
                    .collect(Collectors.toList());
            if (!connectedHostiles.isEmpty()) {
                return connectedHostiles.get(random.nextInt(connectedHostiles.size()));
            }
        }
        return hostileNodes.get(random.nextInt(hostileNodes.size())).getId();
    }

    private List<String> findTransitPath(ScenarioConfig config, int crossingTurn, int maxTurns, List<Node> homeNodes) {
        // Generates path of nodes in Home Territory ending in targetCity
        List<String> path = new ArrayList<>();
        int stepsNeeded = maxTurns - crossingTurn;

        // Try to trace back from targetCity
        String target = config.getTargetCity();
        path.add(target);

        String current = target;
        for (int i = 0; i < stepsNeeded; i++) {
            final String curr = current;
            Node node = config.getNodes().stream().filter(n -> n.getId().equals(curr)).findFirst().orElse(null);
            if (node != null && node.getConnections() != null) {
                List<String> homeConnections = node.getConnections().stream()
                        .filter(cId -> homeNodes.stream().anyMatch(hn -> hn.getId().equals(cId)))
                        .collect(Collectors.toList());
                if (!homeConnections.isEmpty()) {
                    current = homeConnections.get(random.nextInt(homeConnections.size()));
                    path.add(0, current); // Add to beginning of transit path
                    continue;
                }
            }
            // Fallback: pick random home node
            current = homeNodes.get(random.nextInt(homeNodes.size())).getId();
            path.add(0, current);
        }

        return path;
    }
}
