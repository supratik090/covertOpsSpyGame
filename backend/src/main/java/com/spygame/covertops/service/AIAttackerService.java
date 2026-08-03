package com.spygame.covertops.service;

import com.spygame.covertops.model.AIMasterPlan;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.model.GameSession;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AIAttackerService {

    private final Random random = new Random();

    // Generates a blank AI Master Plan object at startup to satisfy type constraints
    public AIMasterPlan generateMasterPlan(ScenarioConfig config, String actualAttacker) {
        AIMasterPlan masterPlan = new AIMasterPlan(new ArrayList<>(), new ArrayList<>());
        masterPlan.setBriefing(config.getBriefing());
        return masterPlan;
    }

    public List<PlanStep> generateDecoyPath(ScenarioConfig config) {
        return new ArrayList<>();
    }

    // Dynamic per-turn decision execution loop for AI Attacker
    public GameSession executeTurn(GameSession session, ScenarioConfig config) {
        if (!"ACTIVE".equals(session.getStatus())) {
            return session;
        }

        int currentTurn = session.getCurrentTurn();
        int maxTurns = session.getMaxTurns();
        int turnsRemaining = maxTurns - currentTurn;
        int clueTurn = "DEFENDER".equals(session.getPlayerRole()) ? currentTurn + 5 : currentTurn;

        String loc = session.getSuspectLocation();
        if (loc == null || loc.isEmpty() || "NONE".equals(loc)) {
            List<Node> hostileNodes = config.getNodes().stream()
                    .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                    .collect(Collectors.toList());
            loc = !hostileNodes.isEmpty() ? hostileNodes.get(0).getId() : "karachi";
            session.setSuspectLocation(loc);
        }

        // 1. Heat Defense Check: construct safehouse if in a city without a safehouse and heat is rising
        boolean hasSafehouseInLoc = session.getSafehouses().stream()
                .anyMatch(s -> s.getCityNode().equals(session.getSuspectLocation()) && "HOSTILE".equals(s.getOwnerFaction()));
        int budget = session.getAttackerBudget();
        int shCost = session.getSuspectLocation().toLowerCase().contains("mumbai") || session.getSuspectLocation().toLowerCase().contains("delhi") ? 150000 : 50000;
        
        if (!hasSafehouseInLoc && budget >= shCost) {
            boolean buildSecure = budget >= shCost * 2 && random.nextBoolean();
            int finalCost = buildSecure ? shCost * 2 : shCost;
            session.setAttackerBudget(budget - finalCost);
            String code = String.valueOf(100 + random.nextInt(900));
            session.getSafehouses().add(new GameSession.Safehouse(session.getSuspectLocation(), "HOSTILE", "PURCHASED", !buildSecure, code));
            
            if (buildSecure) {
                if (session.getSecureSafehouseTurns() == null) {
                    session.setSecureSafehouseTurns(new java.util.HashMap<>());
                }
                session.getSecureSafehouseTurns().put(session.getSuspectLocation(), 5);
                session.getDiscoveredClues().add(new GameSession.Clue(
                        clueTurn,
                        "SAFEHOUSE_EXPOSED",
                        "Alert: Signals intelligence indicates the enemy has created a secure safehouse.",
                        session.getSuspectLocation(),
                        "Signals Intelligence"
                ));
            } else {
                session.getDiscoveredClues().add(new GameSession.Clue(
                        clueTurn,
                        "SAFEHOUSE_EXPOSED",
                        "NEW OPERATIONAL SAFEHOUSE: Operative established a hideout in " + session.getSuspectLocation().toUpperCase() + " (Code: " + code + ")",
                        session.getSuspectLocation(),
                        "Hostile Cell Operations"
                ));
            }
        }

        // 2. Resolve Sourcing Actions
        boolean isFinanceCollected = session.isFinanceCollected();
        boolean isLogisticsCollected = session.isLogisticsCollected();

        if (!isFinanceCollected && session.getRequestedFinanceCity() == null) {
            Node node = getNode(loc, config);
            if (node != null && "HOSTILE_TERRITORY".equals(node.getTerritory())) {
                session.setRequestedFinanceCity(loc);
                session.setFinanceCollectionTurnsRemaining(5);
                session.setActiveAttackerPhase("FINANCE_SOURCING");
                session.getDiscoveredClues().add(new GameSession.Clue(
                        clueTurn,
                        "FINANCE_REQUESTED",
                        "Finance pipeline request initialized in " + loc.toUpperCase() + ". Collection channels opening."
                ));
                return session;
            }
        }

        if (session.getRequestedFinanceCity() != null && !isFinanceCollected) {
            if (session.getRequestedFinanceCity().equals(loc) && session.getFinanceCollectionTurnsRemaining() <= 0) {
                session.setFinanceCollected(true);
                session.setActiveAttackerPhase("TRAIL_BREAKING");
                session.getDiscoveredClues().add(new GameSession.Clue(
                        clueTurn,
                        "FINANCE_SOURCED",
                        "Capital acquired. Finance sourcing completed."
                ));
                checkHandoverUnlock(session, config);
                return session;
            }
        }

        if (isFinanceCollected && !isLogisticsCollected && session.getRequestedLogisticsCity() == null) {
            Node node = getNode(loc, config);
            if (node != null && "HOSTILE_TERRITORY".equals(node.getTerritory())) {
                session.setRequestedLogisticsCity(loc);
                session.setLogisticsCollectionTurnsRemaining(5);
                session.setActiveAttackerPhase("LOGISTICS_SOURCING");
                session.getDiscoveredClues().add(new GameSession.Clue(
                        clueTurn,
                        "LOGISTICS_REQUESTED",
                        "Logistical lines mapped in " + loc.toUpperCase() + ". Sourcing Assembly Kits."
                ));
                return session;
            }
        }

        if (session.getRequestedLogisticsCity() != null && !isLogisticsCollected) {
            if (session.getRequestedLogisticsCity().equals(loc) && session.getLogisticsCollectionTurnsRemaining() <= 0) {
                session.setLogisticsCollected(true);
                session.setActiveAttackerPhase("TRAIL_BREAKING");
                session.getDiscoveredClues().add(new GameSession.Clue(
                        clueTurn,
                        "LOGISTICS_SOURCED",
                        "Equipment acquired. Logistics sourcing completed."
                ));
                checkHandoverUnlock(session, config);
                return session;
            }
        }

        // 3. Resolve Handover Meeting
        if (isFinanceCollected && isLogisticsCollected && !session.isHandoverCompleted()) {
            if (session.getHandoverCity() != null && session.getHandoverCity().equals(loc)) {
                if (session.getHandoverTurnsRemaining() <= 0) {
                    session.setHandoverCompleted(true);
                    session.setActiveAttackerPhase("BORDER_CROSSING");
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            clueTurn,
                            "HANDOVER_COMPLETED",
                            "Meeting finalized. Handover complete. Operative authorized for border infiltration."
                    ));
                    return session;
                } else if (session.getHandoverTurnsRemaining() == 3) {
                    session.setActiveAttackerPhase("HANDOVER");
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            clueTurn,
                            "HANDOVER_INITIATED",
                            "Handover protocol initiated at " + loc.toUpperCase() + ". Operational materials exchanged."
                    ));
                    return session;
                }
            }
        }

        // 4. Infiltration Approval
        if (session.isHandoverCompleted() && !session.isInfiltrationGoAheadApproved()) {
            session.setInfiltrationGoAheadApproved(true);
            session.getDiscoveredClues().add(new GameSession.Clue(
                    clueTurn,
                    "INFILTRATION_APPROVED",
                    "HQ border clearance approved. Path to home soil opened."
            ));
        }

        // 5. Strike execution
        if (session.isInfiltrationGoAheadApproved() && !session.isStrikeGoAheadApproved()) {
            if (loc.equalsIgnoreCase(config.getTargetCity())) {
                session.setStrikeGoAheadApproved(true);
                session.setActiveAttackerPhase("EXFILTRATION");
                session.getDiscoveredClues().add(new GameSession.Clue(
                        currentTurn,
                        "STRIKE_EXECUTED",
                        "💥 TARGET STRIKE EXECUTED successfully in " + loc.toUpperCase() + "! Exfiltration protocol active."
                ));
                return session;
            }
        }

        // 6. Dynamic Routing: Calculate next target node (Only allowed to relocate if we have a safehouse in current city)
        final String finalLoc = loc;
        boolean hasSafehouseInLocCurrent = session.getSafehouses().stream()
                .anyMatch(s -> s.getCityNode().equals(finalLoc) && "HOSTILE".equals(s.getOwnerFaction()));
        if (hasSafehouseInLocCurrent) {
            String targetDestination = determineNextTargetDestination(session, config);
            
            // Find best adjacent node to move to targetDestination
            String nextStepNode = findOptimalPathNode(session, loc, targetDestination, config, turnsRemaining);
            if (nextStepNode != null && !nextStepNode.equals(loc)) {
                // Check if crossing the border
                Node startNode = getNode(loc, config);
                Node endNode = getNode(nextStepNode, config);
                boolean isBorderCrossing = startNode != null && endNode != null && !startNode.getTerritory().equals(endNode.getTerritory());
                
                // Check if border guard or transit checkpoint is active in the target city
                boolean isBorderGuardActive = false;
                boolean isTransitCheckpointActive = false;
                if (session.getEspionageResources() != null) {
                    isBorderGuardActive = session.getEspionageResources().stream()
                            .anyMatch(r -> "BORDER_GUARD".equals(r.getType()) && r.getCityNode().equals(nextStepNode));
                    isTransitCheckpointActive = session.getEspionageResources().stream()
                            .anyMatch(r -> "TRANSIT_CHECKPOINT".equals(r.getType()) && r.getCityNode().equals(nextStepNode));
                }
                
                if (isBorderCrossing) {
                    if (isTransitCheckpointActive) {
                        if (random.nextDouble() < 0.80) {
                            String cityName = endNode.getName();
                            session.setStatus("SUCCESS"); // Defender victory
                            session.getDiscoveredClues().add(new GameSession.Clue(
                                    clueTurn,
                                    "TRANSIT_CHECKPOINT",
                                    "TRANSIT CAPTURE: Suspect " + session.getActualAttacker() + " was intercepted and captured by border patrol at transit checkpoint in " + cityName + ". Threat neutralized.",
                                    nextStepNode,
                                    "Transit Security Command"
                            ));
                            return session;
                        }
                    } else if (isBorderGuardActive) {
                        if (random.nextDouble() < 0.50) {
                            String cityName = endNode.getName();
                            session.getDiscoveredClues().add(new GameSession.Clue(
                                    clueTurn,
                                    "BORDER_GUARD",
                                    "BORDER INTERDICTION: Infiltration foiled in " + cityName + ". Target detected attempting border crossing. Relocation blocked.",
                                    nextStepNode,
                                    "Border Guard Command"
                            ));
                            return session;
                        }
                    }
                }
                
                session.setSuspectLocation(nextStepNode);
                session.getDiscoveredClues().add(new GameSession.Clue(
                        clueTurn,
                        "SUSPECT_RELOCATION",
                        "Operative relocated to " + nextStepNode.replace("_", " ").toUpperCase() + " (Turn " + currentTurn + ")"
                ));
            }
        }

        return session;
    }

    private void checkHandoverUnlock(GameSession session, ScenarioConfig config) {
        if (session.isFinanceCollected() && session.isLogisticsCollected()) {
            session.setActiveAttackerPhase("HANDOVER");
            List<String> friendlyCities = config.getNodes().stream()
                    .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                    .map(Node::getId)
                    .collect(Collectors.toList());
            if (friendlyCities.isEmpty()) {
                friendlyCities = config.getNodes().stream().map(Node::getId).collect(Collectors.toList());
            }
            String chosen = friendlyCities.get(random.nextInt(friendlyCities.size()));
            session.setHandoverCity(chosen);
            session.setHandoverTurnsRemaining(3);

            int clueTurn = "DEFENDER".equals(session.getPlayerRole()) ? session.getCurrentTurn() + 5 : session.getCurrentTurn();
            session.getDiscoveredClues().add(new GameSession.Clue(
                    clueTurn,
                    "HANDOVER_UNLOCKED",
                    "Sourcing completed. Handover site confirmed: " + chosen.replace("_", " ").toUpperCase() + ". Navigate there to begin the meeting."
            ));
        }
    }

    private String determineNextTargetDestination(GameSession session, ScenarioConfig config) {
        if (!session.isFinanceCollected()) {
            if (session.getRequestedFinanceCity() != null) return session.getRequestedFinanceCity();
            return config.getNodes().stream()
                    .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                    .map(Node::getId)
                    .findFirst().orElse("karachi");
        }
        if (!session.isLogisticsCollected()) {
            if (session.getRequestedLogisticsCity() != null) return session.getRequestedLogisticsCity();
            return config.getNodes().stream()
                    .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                    .map(Node::getId)
                    .findFirst().orElse("lahore");
        }
        if (!session.isHandoverCompleted()) {
            return session.getHandoverCity();
        }
        if (!session.isStrikeGoAheadApproved()) {
            return config.getTargetCity();
        }
        List<Node> hostileNodes = config.getNodes().stream()
                .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                .collect(Collectors.toList());
        return !hostileNodes.isEmpty() ? hostileNodes.get(0).getId() : "karachi";
    }

    private String findOptimalPathNode(GameSession session, String currentLoc, String targetDest, ScenarioConfig config, int turnsRemaining) {
        // If current city is under lockdown, we cannot exit
        boolean isCurrentLocked = session.getHostilePatrolCities().contains(currentLoc) || session.getSurprisePatrolCities().contains(currentLoc);
        if (isCurrentLocked) {
            return currentLoc;
        }

        Node currentNode = getNode(currentLoc, config);
        if (currentNode == null || currentNode.getConnections() == null || currentNode.getConnections().isEmpty()) {
            return currentLoc;
        }

        List<String> options = currentNode.getConnections();
        String bestOption = null;
        double lowestThreat = Double.MAX_VALUE;

        for (String nextCity : options) {
            // Cannot enter target city if it is under lockdown
            boolean isTargetLocked = session.getHostilePatrolCities().contains(nextCity) || session.getSurprisePatrolCities().contains(nextCity);
            if (isTargetLocked) {
                continue;
            }

            double threat = getThreatScore(session, nextCity, targetDest, config, turnsRemaining);
            if (threat < lowestThreat) {
                lowestThreat = threat;
                bestOption = nextCity;
            }
        }
        return bestOption != null ? bestOption : currentLoc;
    }

    private double getThreatScore(GameSession session, String city, String destination, ScenarioConfig config, int turnsRemaining) {
        double score = 0.0;

        int dist = getShortestDistance(city, destination, config);
        score += dist * 50.0;

        if (turnsRemaining <= dist + 2) {
            score += dist * 1000.0;
        }

        boolean isLockedDown = session.getHostilePatrolCities().contains(city) || session.getSurprisePatrolCities().contains(city);
        if (isLockedDown) {
            score += 1500.0;
        }

        int heat = session.getCityHeat().getOrDefault(city, 0);
        score += heat * 2.0;

        boolean hasScanners = false;
        if (session.getEspionageResources() != null) {
            hasScanners = session.getEspionageResources().stream()
                    .anyMatch(r -> r.getCityNode().equals(city));
        }
        if (hasScanners) {
            score += 150.0;
        }

        boolean hasSH = session.getSafehouses().stream()
                .anyMatch(s -> s.getCityNode().equals(city) && "HOSTILE".equals(s.getOwnerFaction()));
        if (hasSH) {
            score -= 60.0;
        }

        return score;
    }

    private int getShortestDistance(String start, String end, ScenarioConfig config) {
        if (start.equals(end)) return 0;
        Queue<String> queue = new LinkedList<>();
        Map<String, Integer> distMap = new HashMap<>();
        queue.add(start);
        distMap.put(start, 0);

        while (!queue.isEmpty()) {
            String curr = queue.poll();
            int currDist = distMap.get(curr);
            if (curr.equals(end)) return currDist;

            Node node = getNode(curr, config);
            if (node != null && node.getConnections() != null) {
                for (String conn : node.getConnections()) {
                    if (!distMap.containsKey(conn)) {
                        distMap.put(conn, currDist + 1);
                        queue.add(conn);
                    }
                }
            }
        }
        return 99;
    }

    private Node getNode(String id, ScenarioConfig config) {
        return config.getNodes().stream()
                .filter(n -> n.getId().equals(id))
                .findFirst()
                .orElse(null);
    }
}
