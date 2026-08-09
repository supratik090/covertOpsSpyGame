package com.spygame.covertops.service;

import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.model.GameSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AIAttackerService {

    private final Random random = new Random();

    @Autowired
    private AttackerPathfinder pathfinder;

    // Dynamic per-turn decision execution loop for AI Attacker
    public GameSession executeTurn(GameSession session, ScenarioConfig config) {
        if (!"ACTIVE".equals(session.getStatus())) {
            return session;
        }

        int currentTurn = session.getCurrentTurn();
        int maxTurns = session.getMaxTurns();
        int turnsRemaining = maxTurns - currentTurn;
        int clueTurn = "DEFENDER".equals(session.getPlayerRole()) ? currentTurn + 5 : currentTurn;

        if (session.getAiAttackers() == null || session.getAiAttackers().isEmpty()) {
            List<String> names = config.getAttackerNames();
            if (names == null || names.isEmpty()) {
                names = new ArrayList<>(Arrays.asList("Tariq Mahmood", "Zubair Khan", "Faisal Shah"));
            }
            List<GameSession.AIAttacker> list = new ArrayList<>();
            List<Node> hostileNodes = config.getNodes().stream()
                    .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                    .collect(Collectors.toList());
            String startLoc = !hostileNodes.isEmpty() ? hostileNodes.get(0).getId() : "karachi";
            for (int i = 0; i < names.size(); i++) {
                String locNode = startLoc;
                if (!hostileNodes.isEmpty()) {
                    locNode = hostileNodes.get(i % hostileNodes.size()).getId();
                }
                GameSession.AIAttacker att = new GameSession.AIAttacker(names.get(i), locNode, "Initial decoy");
                att.setBudget(config.getStartingBudget() != 0 ? config.getStartingBudget() : 300000);
                list.add(att);
            }
            session.setAiAttackers(list);
        }

        // Process each attacker independently
        for (GameSession.AIAttacker attacker : session.getAiAttackers()) {
            if (attacker.isEliminated()) {
                continue;
            }

            String loc = attacker.getCurrentLocation();
            if (loc == null || loc.isEmpty() || "NONE".equals(loc)) {
                loc = "karachi";
                attacker.setCurrentLocation(loc);
            }

            long safehousesInLoc = session.getSafehouses().stream()
                    .filter(s -> s.getCityNode().equals(attacker.getCurrentLocation()) && "HOSTILE".equals(s.getOwnerFaction()))
                    .count();
            int budget = attacker.getBudget();
            int shCost = attacker.getCurrentLocation().toLowerCase().contains("mumbai") || attacker.getCurrentLocation().toLowerCase().contains("delhi") ? 150000 : 50000;

            Node currentLocNode = pathfinder.getNode(attacker.getCurrentLocation(), config);
            boolean isCurrentInHome = currentLocNode != null && "HOME_TERRITORY".equals(currentLocNode.getTerritory());
            boolean capReached = false;
            if (isCurrentInHome) {
                long homeShs = session.getSafehouses().stream()
                        .filter(s -> "HOSTILE".equals(s.getOwnerFaction()))
                        .filter(s -> {
                            Node n = pathfinder.getNode(s.getCityNode(), config);
                            return n != null && "HOME_TERRITORY".equals(n.getTerritory());
                        })
                        .count();
                if (homeShs >= 6) {
                    capReached = true;
                }
            }

            boolean shouldBuild = !capReached && ((safehousesInLoc == 0) || (safehousesInLoc < 4 && budget >= shCost * 2 && random.nextDouble() < 0.40));
            
            if (shouldBuild && budget >= shCost) {
                boolean buildSecure = budget >= shCost * 2 && random.nextBoolean();
                int finalCost = buildSecure ? shCost * 2 : shCost;
                attacker.setBudget(budget - finalCost);
                String code = String.valueOf(100 + random.nextInt(900));
                
                GameSession.Safehouse sh = new GameSession.Safehouse(attacker.getCurrentLocation(), "HOSTILE", "PURCHASED", !buildSecure, code);
                sh.setAttackerName(attacker.getName());
                sh.setSecure(buildSecure);
                session.getSafehouses().add(sh);
                
                if (buildSecure) {
                    if (session.getSecureSafehouseTurns() == null) {
                        session.setSecureSafehouseTurns(new java.util.HashMap<>());
                    }
                    session.getSecureSafehouseTurns().put(attacker.getCurrentLocation(), 5);
                    
                    Node shNode = pathfinder.getNode(attacker.getCurrentLocation(), config);
                    String territoryType = shNode != null && "HOSTILE_TERRITORY".equals(shNode.getTerritory()) ? "hostile" : "friendly";
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SAFEHOUSE_ESTABLISHED",
                            "AI ATTACKER: High-security secure safehouse [REDACTED] established in " + territoryType + " city [REDACTED]."
                    ));
                } else {
                    Node shNode = pathfinder.getNode(attacker.getCurrentLocation(), config);
                    String territoryType = shNode != null && "HOSTILE_TERRITORY".equals(shNode.getTerritory()) ? "hostile" : "friendly";
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SAFEHOUSE_ESTABLISHED",
                            "AI ATTACKER: Safehouse [REDACTED] established in " + territoryType + " city [REDACTED]."
                    ));
                }
            }

            if (attacker.getHealingTurnsRemaining() <= 0) {

            // 2. Finance sourcing
            if ("Initial decoy".equals(attacker.getState())) {
                String requested = config.getNodes().stream()
                        .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()) && !n.getId().equals(attacker.getCurrentLocation()))
                        .map(Node::getId)
                        .findFirst()
                        .orElse(attacker.getCurrentLocation());
                attacker.setRequestedFinanceCity(requested);
                attacker.setFinanceCollectionTurnsRemaining(2);
                attacker.setState("Request Finance");
            }
            if ("Request Finance".equals(attacker.getState())) {
                if (loc.equalsIgnoreCase(attacker.getRequestedFinanceCity()) && attacker.getFinanceCollectionTurnsRemaining() <= 0) {
                    attacker.setFinanceCollected(true);
                    attacker.setState("Request Logistic");
                }
            }

            // 3. Logistics sourcing
            if ("Request Logistic".equals(attacker.getState()) && attacker.isFinanceCollected()) {
                String requestedLogistics = config.getNodes().stream()
                        .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()) && !n.getId().equals(attacker.getCurrentLocation()))
                        .map(Node::getId)
                        .findFirst()
                        .orElse(attacker.getCurrentLocation());
                attacker.setRequestedLogisticsCity(requestedLogistics);
                attacker.setLogisticsCollectionTurnsRemaining(3);
                attacker.setState("Requesting Sourcing");
            }
            if ("Requesting Sourcing".equals(attacker.getState())) {
                if (loc.equalsIgnoreCase(attacker.getRequestedLogisticsCity()) && attacker.getLogisticsCollectionTurnsRemaining() <= 0) {
                    attacker.setLogisticsCollected(true);
                    
                    List<String> friendlyCities = config.getNodes().stream()
                            .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                            .map(Node::getId)
                            .collect(Collectors.toList());
                    if (friendlyCities.isEmpty()) {
                        friendlyCities = config.getNodes().stream().map(Node::getId).collect(Collectors.toList());
                    }
                    String chosen = friendlyCities.get(random.nextInt(friendlyCities.size()));
                    
                    attacker.setHandoverCity(chosen);
                    attacker.setHandoverTurnsRemaining(2);
                    attacker.setState("Handover pending");
                }
            }

            // 4. Handover & Permission
            if ("Handover pending".equals(attacker.getState())) {
                if (attacker.getHandoverCity() == null) {
                    List<String> friendlyCities = config.getNodes().stream()
                            .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                            .map(Node::getId)
                            .collect(Collectors.toList());
                    if (friendlyCities.isEmpty()) {
                        friendlyCities = config.getNodes().stream().map(Node::getId).collect(Collectors.toList());
                    }
                    String chosen = friendlyCities.get(random.nextInt(friendlyCities.size()));
                    attacker.setHandoverCity(chosen);
                    attacker.setHandoverTurnsRemaining(2);
                }
                if (loc.equalsIgnoreCase(attacker.getHandoverCity()) && attacker.getHandoverTurnsRemaining() <= 0) {
                    attacker.setHandoverCompleted(true);
                    attacker.setState("Permission to cross border");

                    GameSession.Clue soughtClue = new GameSession.Clue(
                            currentTurn + 1,
                            "BORDER_CROSSING_REQUESTED",
                            "STATE INTELLIGENCE: Signals intercept suggests suspect (" + attacker.getName() + ") has requested clearance to cross the border.",
                            loc,
                            "Signals Intelligence"
                    );
                    soughtClue.setTurnOccurred(currentTurn);
                    session.getDiscoveredClues().add(soughtClue);
                }
            }

            if ("Permission to cross border".equals(attacker.getState())) {
                long crossingCount = session.getAiAttackers().stream()
                        .filter(GameSession.AIAttacker::isPermissionToCrossBorderApproved)
                        .count();
                if (crossingCount < 2) {
                    attacker.setPermissionToCrossBorderApproved(true);
                    // FIX 2: Use internal 'Clearance approved' state — 'Border crossed' is set only
                    // after the attacker physically steps from HOSTILE into HOME territory below.
                    attacker.setState("Clearance approved");
                    
                    GameSession.Clue crossingClue = new GameSession.Clue(
                            currentTurn + 1,
                            "BORDER_PERMISSION",
                            "STATE INTELLIGENCE: Signals intercept confirms border infiltration permission granted to suspect (" + attacker.getName() + ") into Defender Territory. Prepare border defenses!",
                            loc,
                            "Signals Intelligence"
                    );
                    crossingClue.setTurnOccurred(currentTurn);
                    session.getDiscoveredClues().add(crossingClue);
                }
            }

            if ("Border crossed".equals(attacker.getState()) || "Clearance approved".equals(attacker.getState())) {
                if (loc.equalsIgnoreCase(config.getTargetCity())) {
                    attacker.setState("Permission to engage");

                    GameSession.Clue soughtClue = new GameSession.Clue(
                            currentTurn + 1,
                            "ATTACK_REQUESTED",
                            "STATE INTELLIGENCE: Critical Alert! Signals intercept suggests hostile operative (" + attacker.getName() + ") has requested permission to attack target in " + config.getTargetCity().toUpperCase() + ".",
                            config.getTargetCity(),
                            "Signals Intelligence"
                    );
                    soughtClue.setTurnOccurred(currentTurn);
                    session.getDiscoveredClues().add(soughtClue);
                }
            }

            if ("Permission to engage".equals(attacker.getState())) {
                long engagementCount = session.getAiAttackers().stream()
                        .filter(GameSession.AIAttacker::isPermissionToEngageApproved)
                        .count();
                if (engagementCount < 1) {
                    attacker.setPermissionToEngageApproved(true);
                    attacker.setState("Attack initiated");
                    
                    GameSession.Clue engageClue = new GameSession.Clue(
                            currentTurn + 1,
                            "ATTACK_APPROVED",
                            "STATE INTELLIGENCE: Critical Alert! Permission to engage target has been granted to hostile operative (" + attacker.getName() + ") in " + config.getTargetCity().toUpperCase() + ". Prepare for final defense!",
                            config.getTargetCity(),
                            "Signals Intelligence"
                    );
                    engageClue.setTurnOccurred(currentTurn);
                    session.getDiscoveredClues().add(engageClue);
                }
            }

            // 5. Strike execution
            if ("Attack initiated".equals(attacker.getState())) {
                if (loc.equalsIgnoreCase(config.getTargetCity())) {
                    attacker.setState("Exfiltration");
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "STRIKE_EXECUTED",
                            "💥 TARGET STRIKE EXECUTED successfully by " + attacker.getName() + " in " + loc.toUpperCase() + "! Exfiltration protocol active.",
                            config.getTargetCity(),
                            "Signals Intelligence"
                    ));
                }
            }
            }

            if ("Handover pending".equals(attacker.getState()) && loc.equalsIgnoreCase(attacker.getHandoverCity())) {
                continue;
            }

            // 6. Dynamic Routing: Calculate next target node
            boolean hasSafehouseInLocCurrent = session.getSafehouses().stream()
                    .anyMatch(s -> s.getCityNode().equals(attacker.getCurrentLocation()) && "HOSTILE".equals(s.getOwnerFaction()));

            if (hasSafehouseInLocCurrent) {
                String targetDestination = determineNextTargetDestination(attacker, config);
                String nextStepNode = pathfinder.findOptimalPathNode(attacker, session, loc, targetDestination, config, turnsRemaining);

                if (nextStepNode != null && !nextStepNode.equals(loc)) {
                    Node startNode = pathfinder.getNode(loc, config);
                    Node endNode = pathfinder.getNode(nextStepNode, config);
                    boolean isBorderCrossing = startNode != null && endNode != null && !startNode.getTerritory().equals(endNode.getTerritory());

                    // FIX 1: Destination safehouse gate for HOME_TERRITORY.
                    // When moving into friendly territory the attacker must have a HOSTILE safehouse
                    // at the destination city — just like in hostile territory. If none exists,
                    // skip movement this turn and instead try to build one at the current city
                    // so the attacker can move there next turn.
                    if (endNode != null && "HOME_TERRITORY".equals(endNode.getTerritory())) {
                        final String currentLoc = loc; // final alias for lambda capture
                        final String destLoc = nextStepNode; // final alias for lambda capture
                        boolean hasSafehouseAtDest = session.getSafehouses().stream()
                                .anyMatch(s -> s.getCityNode().equals(destLoc) && "HOSTILE".equals(s.getOwnerFaction()));
                        if (!hasSafehouseAtDest) {
                            boolean hasClearance = "Clearance approved".equals(attacker.getState()) 
                                    || "Permission to cross border".equals(attacker.getState()) 
                                    || "Border crossed".equals(attacker.getState());
                            if (hasClearance) {
                                long homeShs = session.getSafehouses().stream()
                                        .filter(s -> "HOSTILE".equals(s.getOwnerFaction()))
                                        .filter(s -> {
                                            Node n = pathfinder.getNode(s.getCityNode(), config);
                                            return n != null && "HOME_TERRITORY".equals(n.getTerritory());
                                        })
                                        .count();
                                if (homeShs >= 6) {
                                    continue; // Cap reached, cannot build safehouse in HOME_TERRITORY
                                }

                                int targetShCost = destLoc.toLowerCase().contains("mumbai") || destLoc.toLowerCase().contains("delhi") ? 150000 : 50000;
                                boolean buildSecure = attacker.getBudget() >= targetShCost * 2 && random.nextBoolean();
                                int finalCost = buildSecure ? targetShCost * 2 : targetShCost;
                                if (attacker.getBudget() >= finalCost) {
                                    attacker.setBudget(attacker.getBudget() - finalCost);
                                    String shCode = String.valueOf(100 + random.nextInt(900));
                                    GameSession.Safehouse newSh = new GameSession.Safehouse(destLoc, "HOSTILE", "PURCHASED", !buildSecure, shCode);
                                    newSh.setAttackerName(attacker.getName());
                                    newSh.setSecure(buildSecure);
                                    session.getSafehouses().add(newSh);
                                    
                                    if (buildSecure) {
                                        if (session.getSecureSafehouseTurns() == null) {
                                            session.setSecureSafehouseTurns(new java.util.HashMap<>());
                                        }
                                        session.getSecureSafehouseTurns().put(destLoc, 5);
                                    }

                                    session.getDiscoveredClues().add(new GameSession.Clue(
                                            currentTurn,
                                            "SAFEHOUSE_ESTABLISHED",
                                            "AI ATTACKER: " + (buildSecure ? "High-security secure safehouse" : "Safehouse") + " [REDACTED] established in friendly city [REDACTED]."
                                    ));
                                } else {
                                    continue;
                                }
                            } else {
                                // Build a safehouse at current location first (pre-staging for next turn)
                                long shsHere = session.getSafehouses().stream()
                                        .filter(s -> s.getCityNode().equals(currentLoc) && "HOSTILE".equals(s.getOwnerFaction()))
                                        .count();
                                int stagingCost = 50000;
                                if (shsHere < 4 && attacker.getBudget() >= stagingCost) {
                                    attacker.setBudget(attacker.getBudget() - stagingCost);
                                    String stageCode = String.valueOf(100 + random.nextInt(900));
                                    GameSession.Safehouse stageSh = new GameSession.Safehouse(currentLoc, "HOSTILE", "PURCHASED", true, stageCode);
                                    stageSh.setAttackerName(attacker.getName());
                                    session.getSafehouses().add(stageSh);
                                    Node locNode = pathfinder.getNode(currentLoc, config);
                                    String locTerrType = locNode != null && "HOSTILE_TERRITORY".equals(locNode.getTerritory()) ? "hostile" : "friendly";
                                    session.getDiscoveredClues().add(new GameSession.Clue(
                                            currentTurn,
                                            "SAFEHOUSE_ESTABLISHED",
                                            "AI ATTACKER: Safehouse [REDACTED] established in " + locTerrType + " city [REDACTED] (staging for advance)."
                                    ));
                                }
                                // Cannot move — no safehouse at destination yet and no clearance
                                continue;
                            }
                        }
                    }

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
                                attacker.setEliminated(true);
                                attacker.setState("Lost");

                                boolean allEliminated = session.getAiAttackers().stream().allMatch(GameSession.AIAttacker::isEliminated);
                                if (allEliminated) {
                                    session.setStatus("SUCCESS");
                                }

                                addLaggedClue(
                                        session,
                                        clueTurn,
                                        currentTurn,
                                        "TRANSIT_CHECKPOINT",
                                        "TRANSIT CAPTURE: Suspect " + attacker.getName() + " was intercepted and captured by border patrol at transit checkpoint in " + cityName + ". " + (allEliminated ? "All threats neutralized." : "Other threat agents remain in play."),
                                        nextStepNode,
                                        "Transit Security Command"
                                );
                                continue;
                            }
                        } else if (isBorderGuardActive) {
                            if (random.nextDouble() < 0.50) {
                                addLaggedClue(
                                        session,
                                        clueTurn,
                                        currentTurn,
                                        "BORDER_GUARD",
                                        "BORDER INTERDICTION: Infiltration foiled. Target " + attacker.getName() + " detected attempting border crossing. Relocation blocked.",
                                        nextStepNode,
                                        "Border Guard Command"
                                );
                                continue;
                            }
                        }
                    }

                    attacker.setCurrentLocation(nextStepNode);
                    Node targetNode = pathfinder.getNode(nextStepNode, config);
                    String displayCityName = targetNode != null ? targetNode.getName() : nextStepNode.toUpperCase();

                    if (isBorderCrossing) {
                        // FIX 2: Set 'Border crossed' state only NOW — after physical territory crossing
                        attacker.setState("Border crossed");
                        session.getDiscoveredClues().add(new GameSession.Clue(
                                currentTurn,
                                "BORDER_CROSSING",
                                "🚨 BORDER BREACH: Hostile operative " + attacker.getName() + " has crossed the border into friendly territory at " + displayCityName + ".",
                                nextStepNode,
                                "Border Surveillance Radar"
                        ));
                    }

                    // FIX 3: Build a HOSTILE safehouse at the NEW location immediately after moving
                    // so the destination gate is satisfied for the next turn's move.
                    long shsAtNewLoc = session.getSafehouses().stream()
                            .filter(s -> s.getCityNode().equals(nextStepNode) && "HOSTILE".equals(s.getOwnerFaction()))
                            .count();
                    int newLocShCost = 50000;
                    if (shsAtNewLoc == 0 && attacker.getBudget() >= newLocShCost) {
                        attacker.setBudget(attacker.getBudget() - newLocShCost);
                        String newCode = String.valueOf(100 + random.nextInt(900));
                        GameSession.Safehouse newSh = new GameSession.Safehouse(nextStepNode, "HOSTILE", "PURCHASED", true, newCode);
                        newSh.setAttackerName(attacker.getName());
                        session.getSafehouses().add(newSh);
                        Node newNode = pathfinder.getNode(nextStepNode, config);
                        String newTerrType = newNode != null && "HOSTILE_TERRITORY".equals(newNode.getTerritory()) ? "hostile" : "friendly";
                        session.getDiscoveredClues().add(new GameSession.Clue(
                                currentTurn,
                                "SAFEHOUSE_ESTABLISHED",
                                "AI ATTACKER: Safehouse [REDACTED] established in " + newTerrType + " city [REDACTED]."
                        ));
                    }

                    addLaggedClue(
                            session,
                            clueTurn,
                            currentTurn,
                            "SUSPECT_RELOCATION",
                            "Operative " + attacker.getName() + " relocated to " + displayCityName + " (Turn " + currentTurn + ")",
                            nextStepNode
                    );

                    if ("Exfiltration".equals(attacker.getState())) {
                        Node finalNode = pathfinder.getNode(nextStepNode, config);
                        if (finalNode != null && "HOSTILE_TERRITORY".equals(finalNode.getTerritory())) {
                            session.setStatus("COMPROMISED");
                            session.getDiscoveredClues().add(new GameSession.Clue(
                                    currentTurn,
                                    "TACTICAL_FORCE",
                                    "MISSION FAILURE! Suspect " + attacker.getName() + " successfully completed exfiltration back to friendly territory. Defender compromised."
                            ));
                            return session;
                        }
                    }
                }
            }
        }

        // Update legacy session.suspectLocation to first active suspect location for safety
        session.getAiAttackers().stream()
                .filter(a -> !a.isEliminated())
                .findFirst()
                .ifPresent(a -> session.setSuspectLocation(a.getCurrentLocation()));

        return session;
    }

    private String determineNextTargetDestination(GameSession.AIAttacker attacker, ScenarioConfig config) {
        if (!attacker.isFinanceCollected()) {
            if (attacker.getRequestedFinanceCity() != null) return attacker.getRequestedFinanceCity();
            return config.getNodes().stream()
                    .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                    .map(Node::getId)
                    .findFirst().orElse("karachi");
        }
        if (!attacker.isLogisticsCollected()) {
            if (attacker.getRequestedLogisticsCity() != null) return attacker.getRequestedLogisticsCity();
            return config.getNodes().stream()
                    .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                    .map(Node::getId)
                    .findFirst().orElse("lahore");
        }
        if (!attacker.isHandoverCompleted()) {
            return attacker.getHandoverCity();
        }
        if (!"Exfiltration".equals(attacker.getState())) {
            return config.getTargetCity();
        }
        List<Node> hostileNodes = config.getNodes().stream()
                .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                .collect(Collectors.toList());
        return !hostileNodes.isEmpty() ? hostileNodes.get(0).getId() : "karachi";
    }

    private void addLaggedClue(GameSession session, int turnDiscovered, int turnOccurred, String source, String text, String cityName) {
        GameSession.Clue clue = new GameSession.Clue(turnDiscovered, source, text, cityName, null);
        clue.setTurnOccurred(turnOccurred);
        session.getDiscoveredClues().add(clue);
    }

    private void addLaggedClue(GameSession session, int turnDiscovered, int turnOccurred, String source, String text, String cityName, String discoveredByAgent) {
        GameSession.Clue clue = new GameSession.Clue(turnDiscovered, source, text, cityName, discoveredByAgent);
        clue.setTurnOccurred(turnOccurred);
        session.getDiscoveredClues().add(clue);
    }
}
