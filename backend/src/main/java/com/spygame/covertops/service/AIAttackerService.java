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

            considerSafehouseAttack(attacker, session, config);
            if (attacker.isEliminated()) {
                continue;
            }

            considerDroneBaseAttack(attacker, session, config);
            if (attacker.isEliminated()) {
                continue;
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
                
                GameSession.Safehouse sh = new GameSession.Safehouse(attacker.getCurrentLocation(), "HOSTILE", "PURCHASED", false, code);
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

            // 6. Dynamic Routing & Replanning: Calculate target destination & attack path
            boolean hasSafehouseInLocCurrent = session.getSafehouses().stream()
                    .anyMatch(s -> s.getCityNode().equals(attacker.getCurrentLocation()) && "HOSTILE".equals(s.getOwnerFaction()));

            if (!hasSafehouseInLocCurrent) {
                // Safehouse at current location was destroyed or missing — trigger REPLANNING
                boolean isLocLocked = session.getHostilePatrolCities().contains(loc) || session.getSurprisePatrolCities().contains(loc);
                int currentHeat = session.getCityHeat().getOrDefault(loc, 0);

                if (!isLocLocked && currentHeat < 70 && attacker.getBudget() >= 50000) {
                    // Re-establish safehouse at current location
                    attacker.setBudget(attacker.getBudget() - 50000);
                    String code = String.valueOf(100 + random.nextInt(900));
                    GameSession.Safehouse rebuildSh = new GameSession.Safehouse(loc, "HOSTILE", "PURCHASED", false, code);
                    rebuildSh.setAttackerName(attacker.getName());
                    session.getSafehouses().add(rebuildSh);
                    Node locNode = pathfinder.getNode(loc, config);
                    String terrType = locNode != null && "HOSTILE_TERRITORY".equals(locNode.getTerritory()) ? "hostile" : "friendly";
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SAFEHOUSE_ESTABLISHED",
                            "AI ATTACKER: Safehouse [REDACTED] re-established in " + terrType + " city [REDACTED] after safehouse loss."
                    ));
                } else {
                    // High heat or locked down — REPLAN ROUTE to pivot to an alternative node
                    String targetDestination = determineNextTargetDestination(attacker, config);
                    String pivotNode = pathfinder.findOptimalPathNode(attacker, session, loc, targetDestination, config, turnsRemaining);
                    if (pivotNode != null && !pivotNode.equalsIgnoreCase(loc)) {
                        boolean hasShAtPivot = session.getSafehouses().stream()
                                .anyMatch(s -> s.getCityNode().equals(pivotNode) && "HOSTILE".equals(s.getOwnerFaction()));
                        if (!hasShAtPivot && attacker.getBudget() >= 50000) {
                            attacker.setBudget(attacker.getBudget() - 50000);
                            String code = String.valueOf(100 + random.nextInt(900));
                            GameSession.Safehouse pivotSh = new GameSession.Safehouse(pivotNode, "HOSTILE", "PURCHASED", false, code);
                            pivotSh.setAttackerName(attacker.getName());
                            session.getSafehouses().add(pivotSh);
                            session.getDiscoveredClues().add(new GameSession.Clue(
                                    currentTurn,
                                    "SAFEHOUSE_ESTABLISHED",
                                    "AI ATTACKER: Safehouse [REDACTED] established at pivot city [REDACTED] (route replan due to safehouse loss)."
                            ));
                        }
                    }
                }
            } else {
                String targetDestination = determineNextTargetDestination(attacker, config);
                List<String> plannedRoute = pathfinder.findFullRoute(attacker, session, loc, targetDestination, config, turnsRemaining);
                String nextStepNode = !plannedRoute.isEmpty() ? plannedRoute.get(0) : loc;

                if (nextStepNode != null && !nextStepNode.equals(loc)) {
                    Node startNode = pathfinder.getNode(loc, config);
                    Node endNode = pathfinder.getNode(nextStepNode, config);
                    boolean isBorderCrossing = startNode != null && endNode != null && !startNode.getTerritory().equals(endNode.getTerritory());

                    // Destination safehouse gate:
                    // Before moving into ANY city (hostile or friendly territory), a HOSTILE safehouse
                    // must ALREADY exist at destination (built in a previous turn). If none exists,
                    // the AI Attacker pre-builds one at destination on this turn and stays at current location.
                    final String destLoc = nextStepNode;
                    boolean hasSafehouseAtDest = session.getSafehouses().stream()
                            .anyMatch(s -> s.getCityNode().equals(destLoc) && "HOSTILE".equals(s.getOwnerFaction()));

                    if (!hasSafehouseAtDest) {
                        if (isBorderCrossing) {
                            boolean hasClearance = "Clearance approved".equals(attacker.getState())
                                    || "Permission to cross border".equals(attacker.getState())
                                    || "Border crossed".equals(attacker.getState());
                            if (!hasClearance) {
                                // Cannot pre-build at destination without clearance — build staging safehouse at current location if needed and stay
                                final String currentLoc = loc;
                                long shsHere = session.getSafehouses().stream()
                                        .filter(s -> s.getCityNode().equals(currentLoc) && "HOSTILE".equals(s.getOwnerFaction()))
                                        .count();
                                int stagingCost = 50000;
                                if (shsHere < 4 && attacker.getBudget() >= stagingCost) {
                                    attacker.setBudget(attacker.getBudget() - stagingCost);
                                    String stageCode = String.valueOf(100 + random.nextInt(900));
                                    GameSession.Safehouse stageSh = new GameSession.Safehouse(currentLoc, "HOSTILE", "PURCHASED", false, stageCode);
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
                                continue; // Remain at current location this turn
                            }
                        }

                        // Check home territory safehouse cap if destination is in HOME_TERRITORY
                        if (endNode != null && "HOME_TERRITORY".equals(endNode.getTerritory())) {
                            long homeShs = session.getSafehouses().stream()
                                    .filter(s -> "HOSTILE".equals(s.getOwnerFaction()))
                                    .filter(s -> {
                                        Node n = pathfinder.getNode(s.getCityNode(), config);
                                        return n != null && "HOME_TERRITORY".equals(n.getTerritory());
                                    })
                                    .count();
                            if (homeShs >= 6) {
                                continue; // Cap reached
                            }
                        }

                        // Pre-build safehouse at destination city
                        int targetShCost = 50000;
                        if (endNode != null && "HOME_TERRITORY".equals(endNode.getTerritory())) {
                            if (destLoc.toLowerCase().contains("mumbai") || destLoc.toLowerCase().contains("delhi")) {
                                targetShCost = 150000;
                            }
                        }
                        boolean buildSecure = attacker.getBudget() >= targetShCost * 2 && random.nextBoolean();
                        int finalCost = buildSecure ? targetShCost * 2 : targetShCost;

                        if (attacker.getBudget() >= finalCost) {
                            attacker.setBudget(attacker.getBudget() - finalCost);
                            String shCode = String.valueOf(100 + random.nextInt(900));
                            GameSession.Safehouse newSh = new GameSession.Safehouse(destLoc, "HOSTILE", "PURCHASED", false, shCode);
                            newSh.setAttackerName(attacker.getName());
                            newSh.setSecure(buildSecure);
                            session.getSafehouses().add(newSh);

                            if (buildSecure) {
                                if (session.getSecureSafehouseTurns() == null) {
                                    session.setSecureSafehouseTurns(new java.util.HashMap<>());
                                }
                                session.getSecureSafehouseTurns().put(destLoc, 5);
                            }

                            String destTerrType = endNode != null && "HOSTILE_TERRITORY".equals(endNode.getTerritory()) ? "hostile" : "friendly";
                            session.getDiscoveredClues().add(new GameSession.Clue(
                                    currentTurn,
                                    "SAFEHOUSE_ESTABLISHED",
                                    "AI ATTACKER: " + (buildSecure ? "High-security secure safehouse" : "Safehouse") + " [REDACTED] established in " + destTerrType + " city [REDACTED]."
                            ));
                        }
                        // Safehouse created in this turn — attacker must stay at current location until next turn
                        continue;
                    }

                    // Route Lookahead: Look ahead along planned attack path to pre-build downstream safehouses early
                    if (plannedRoute.size() > 1 && attacker.getBudget() >= 100000) {
                        for (int i = 1; i < plannedRoute.size(); i++) {
                            String aheadCity = plannedRoute.get(i);
                            Node aheadNode = pathfinder.getNode(aheadCity, config);
                            boolean aheadIsCrossBorder = startNode != null && aheadNode != null && !startNode.getTerritory().equals(aheadNode.getTerritory());
                            if (aheadIsCrossBorder) {
                                boolean hasClearance = "Clearance approved".equals(attacker.getState())
                                        || "Permission to cross border".equals(attacker.getState())
                                        || "Border crossed".equals(attacker.getState());
                                if (!hasClearance) {
                                    break; // Cannot pre-build across border without clearance
                                }
                            }
                            boolean hasShAhead = session.getSafehouses().stream()
                                    .anyMatch(s -> s.getCityNode().equals(aheadCity) && "HOSTILE".equals(s.getOwnerFaction()));
                            if (!hasShAhead) {
                                int preBuildCost = 50000;
                                if (aheadNode != null && "HOME_TERRITORY".equals(aheadNode.getTerritory())) {
                                    if (aheadCity.toLowerCase().contains("mumbai") || aheadCity.toLowerCase().contains("delhi")) {
                                        preBuildCost = 150000;
                                    }
                                }
                                if (attacker.getBudget() >= preBuildCost) {
                                    attacker.setBudget(attacker.getBudget() - preBuildCost);
                                    String code = String.valueOf(100 + random.nextInt(900));
                                    GameSession.Safehouse preSh = new GameSession.Safehouse(aheadCity, "HOSTILE", "PURCHASED", false, code);
                                    preSh.setAttackerName(attacker.getName());
                                    session.getSafehouses().add(preSh);
                                    String terrType = aheadNode != null && "HOSTILE_TERRITORY".equals(aheadNode.getTerritory()) ? "hostile" : "friendly";
                                    session.getDiscoveredClues().add(new GameSession.Clue(
                                            currentTurn,
                                            "SAFEHOUSE_ESTABLISHED",
                                            "AI ATTACKER: Safehouse [REDACTED] established in " + terrType + " city [REDACTED] (advance route preparation)."
                                    ));
                                }
                                break;
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
                                    GameSession.applyDefenderVictoryStatus(session);
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
                            boolean hasSatelliteView = session.getEspionageResources() != null && session.getEspionageResources().stream()
                                    .anyMatch(r -> "SATELLITE".equalsIgnoreCase(r.getType()) && nextStepNode.equalsIgnoreCase(r.getCityNode()));
                            boolean isDroneInAir = session.getDrones() != null && session.getDrones().stream()
                                    .anyMatch(d -> "ACTIVE".equalsIgnoreCase(d.getStatus()) && nextStepNode.equalsIgnoreCase(d.getCurrentCity()));

                            double interdictionChance = 0.40;
                            String enhancementTag = "";
                            if (isDroneInAir) {
                                interdictionChance = 0.60;
                                enhancementTag = " (DRONE AIRBORNE ENHANCED - 60% INTERDICTION)";
                            } else if (hasSatelliteView) {
                                interdictionChance = 0.50;
                                enhancementTag = " (SATELLITE ENHANCED - 50% INTERDICTION)";
                            } else {
                                enhancementTag = " (40% BASE INTERDICTION)";
                            }

                            if (random.nextDouble() < interdictionChance) {
                                addLaggedClue(
                                        session,
                                        clueTurn,
                                        currentTurn,
                                        "BORDER_GUARD",
                                        "BORDER INTERDICTION" + enhancementTag + ": Infiltration foiled. Target " + attacker.getName() + " detected attempting border crossing into " + nextStepNode.toUpperCase() + ". Relocation blocked.",
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
                        // Set 'Border crossed' state only NOW — after physical territory crossing
                        attacker.setState("Border crossed");
                        session.getDiscoveredClues().add(new GameSession.Clue(
                                currentTurn,
                                "BORDER_CROSSING",
                                "🚨 BORDER BREACH: Hostile operative " + attacker.getName() + " has crossed the border into friendly territory at " + displayCityName + ".",
                                nextStepNode,
                                "Border Surveillance Radar"
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

    private void considerSafehouseAttack(GameSession.AIAttacker attacker, GameSession session, ScenarioConfig config) {
        String city = attacker.getCurrentLocation();
        if (city == null || city.isEmpty() || "NONE".equals(city)) {
            return;
        }

        // Rule 1: First 4 turns grace period — no AI safehouse attacks to give players breathing space
        if (session.getCurrentTurn() <= 4) {
            return;
        }

        // Rule 2: Sweep protection — if a security sweep/patrol is active or planned in city, AI attacker will not attack
        boolean isSweepActive = (session.getHostilePatrolCities() != null && session.getHostilePatrolCities().stream().anyMatch(c -> c.equalsIgnoreCase(city)))
                || (session.getSurprisePatrolCities() != null && session.getSurprisePatrolCities().stream().anyMatch(c -> c.equalsIgnoreCase(city)));
        if (isSweepActive) {
            return;
        }

        List<GameSession.Safehouse> defenderSHs = session.getSafehouses().stream()
                .filter(s -> s.getCityNode().equalsIgnoreCase(city) && "DEFENDER".equals(s.getOwnerFaction()))
                .collect(Collectors.toList());

        if (defenderSHs.isEmpty()) {
            return;
        }

        String state = attacker.getState();
        boolean hasPermission = attacker.isPermissionToCrossBorderApproved() || attacker.isPermissionToEngageApproved();
        boolean isLateStage = "Permission to cross border".equals(state)
                || "Clearance approved".equals(state)
                || "Border crossed".equals(state)
                || "Permission to engage".equals(state)
                || "Attack initiated".equals(state)
                || "Exfiltration".equals(state);

        if (hasPermission || isLateStage) {
            return;
        }

        // AI Attacker does NOT know if defender agents or combat teams are in the safehouse.
        // Because raiding carries high risk of running into a Combat Team ambush, attack chance is cautious (15% per turn).
        double attackChance = 0.15;

        if (random.nextDouble() > attackChance) {
            return;
        }

        int currentTurn = session.getCurrentTurn();

        // Rule 3: Drone Defense Cover (100% Defended, 10% chance of attacker getting neutralized)
        boolean droneDeployedInCity = false;
        if (session.getDrones() != null) {
            droneDeployedInCity = session.getDrones().stream()
                    .anyMatch(d -> "ACTIVE".equals(d.getStatus()) && city.equalsIgnoreCase(d.getCurrentCity()));
        }
        if (!droneDeployedInCity && session.getDiscoveredClues() != null) {
            droneDeployedInCity = session.getDiscoveredClues().stream()
                    .anyMatch(c -> c.getTurnDiscovered() == currentTurn
                            && ("DRONE_RECON".equalsIgnoreCase(c.getSource()) || "DRONE_ATTACK".equalsIgnoreCase(c.getSource()))
                            && city.equalsIgnoreCase(c.getCityName()));
        }

        if (droneDeployedInCity) {
            // Drone cover provides 100% defense against safehouse attacks
            boolean attackerNeutralized = random.nextDouble() < 0.10;
            String resultText;
            if (attackerNeutralized) {
                attacker.setEliminated(true);
                attacker.setState("Lost");
                resultText = "COMBAT ENGAGEMENT: Safehouse in " + city.toUpperCase() +
                        " was attacked by hostile operative " + attacker.getName() +
                        ". Active drone air support repelled the raid with 100% efficiency and NEUTRALIZED " + attacker.getName() + "! Safehouse remains secure.";
            } else {
                resultText = "COMBAT ENGAGEMENT: Safehouse in " + city.toUpperCase() +
                        " was attacked by hostile operative " + attacker.getName() +
                        ". Active drone air support repelled the raid with 100% efficiency. " + attacker.getName() + " escaped, but the safehouse remains secure.";
            }

            session.getDiscoveredClues().add(new GameSession.Clue(
                    currentTurn,
                    "SAFEHOUSE_ATTACK",
                    resultText,
                    city,
                    "Drone Air Support"
            ));
            return;
        }

        // Randomly pick a defender safehouse without inspecting unit presence
        GameSession.Safehouse targetSH = defenderSHs.get(random.nextInt(defenderSHs.size()));
        
        boolean combatTeamPresent = session.getTacticalTeams().stream()
                .anyMatch(t -> t.getCurrentCity().equalsIgnoreCase(city));
        
        boolean agentPresent = session.getAgents().stream()
                .anyMatch(a -> a.getCurrentCity().equalsIgnoreCase(city));

        if (combatTeamPresent) {
            // AMBUSH: Combat Team was guarding the safehouse!
            // Attack fails completely (safehouse secure). 50% chance hostile operative is neutralized & eliminated.
            boolean attackerEliminated = random.nextDouble() < 0.50;
            String resultText;
            if (attackerEliminated) {
                attacker.setEliminated(true);
                attacker.setState("Lost");
                resultText = "COMBAT ENGAGEMENT: Safehouse in " + city.toUpperCase() +
                        " was attacked by hostile operative " + attacker.getName() +
                        ". The Combat Team repelled the attack and NEUTRALIZED " + attacker.getName() + ". Safehouse remains secure.";
            } else {
                resultText = "COMBAT ENGAGEMENT: Safehouse in " + city.toUpperCase() +
                        " was attacked by hostile operative " + attacker.getName() +
                        ". The Combat Team repelled the attack. " + attacker.getName() + " escaped neutralization, but the raid failed and safehouse remains secure.";
            }

            session.getDiscoveredClues().add(new GameSession.Clue(
                    currentTurn,
                    "SAFEHOUSE_ATTACK",
                    resultText,
                    city,
                    "Combat Operations"
            ));

        } else if (agentPresent) {
            // Field Agent present: 50% chance defense holds, 50% safehouse destroyed
            boolean success = random.nextDouble() < 0.50;
            if (success) {
                session.getSafehouses().remove(targetSH);

                List<GameSession.Agent> agentsHere = session.getAgents().stream()
                        .filter(a -> a.getCurrentCity().equalsIgnoreCase(city))
                        .collect(Collectors.toList());
                session.getAgents().removeAll(agentsHere);

                String agentsNames = agentsHere.stream()
                        .map(GameSession.Agent::getCodename)
                        .collect(Collectors.joining(", "));

                String resultText = "COMBAT LOSS: Hostile operative " + attacker.getName() + " attacked and destroyed defender safehouse in " + city.toUpperCase() + ".";
                if (!agentsNames.isEmpty()) {
                    resultText += " Neutralized: Agents (" + agentsNames + ").";
                }

                session.getDiscoveredClues().add(new GameSession.Clue(
                        currentTurn,
                        "SAFEHOUSE_ATTACK",
                        resultText,
                        city,
                        "Combat Operations"
                ));
            } else {
                String resultText = "COMBAT ENGAGEMENT: Safehouse in " + city.toUpperCase() +
                        " was attacked by hostile operative " + attacker.getName() +
                        ". Field agent defense held and the attack was repelled.";

                session.getDiscoveredClues().add(new GameSession.Clue(
                        currentTurn,
                        "SAFEHOUSE_ATTACK",
                        resultText,
                        city,
                        "Combat Operations"
                ));
            }
        } else {
            // Undefended safehouse: attack succeeds
            session.getSafehouses().remove(targetSH);

            String resultText = "COMBAT LOSS: Hostile operative " + attacker.getName() + " attacked and destroyed undefended safehouse in " + city.toUpperCase() + ".";

            session.getDiscoveredClues().add(new GameSession.Clue(
                    currentTurn,
                    "SAFEHOUSE_ATTACK",
                    resultText,
                    city,
                    "Combat Operations"
            ));
        }
    }

    private void considerDroneBaseAttack(GameSession.AIAttacker attacker, GameSession session, ScenarioConfig config) {
        String city = attacker.getCurrentLocation();
        if (city == null || city.isEmpty() || "NONE".equals(city)) {
            return;
        }

        if (session.getDroneBases() == null || session.getDroneBases().stream().noneMatch(b -> b.equalsIgnoreCase(city))) {
            return;
        }

        if (session.getDroneBaseCooldowns() != null && session.getDroneBaseCooldowns().getOrDefault(city.toLowerCase(), 0) > 0) {
            return;
        }

        String state = attacker.getState();
        boolean hasPermission = attacker.isPermissionToCrossBorderApproved() || attacker.isPermissionToEngageApproved();
        boolean isLateStage = "Permission to cross border".equals(state)
                || "Clearance approved".equals(state)
                || "Border crossed".equals(state)
                || "Permission to engage".equals(state)
                || "Attack initiated".equals(state)
                || "Exfiltration".equals(state);

        if (hasPermission || isLateStage) {
            return;
        }

        double attackChance = 0.20;
        if (random.nextDouble() > attackChance) {
            return;
        }

        int currentTurn = session.getCurrentTurn();
        boolean combatTeamPresent = session.getTacticalTeams().stream()
                .anyMatch(t -> t.getCurrentCity().equalsIgnoreCase(city));

        if (combatTeamPresent) {
            boolean attackerEliminated = random.nextDouble() < 0.50;
            String resultText;
            if (attackerEliminated) {
                attacker.setEliminated(true);
                attacker.setState("Lost");
                resultText = "COMBAT ENGAGEMENT: Hostile operative " + attacker.getName() +
                        " attempted to attack the Drone Base in " + city.toUpperCase() +
                        ", but the Combat Team repelled the raid and NEUTRALIZED " + attacker.getName() + ". Drone Base remains fully operational.";
            } else {
                resultText = "COMBAT ENGAGEMENT: Hostile operative " + attacker.getName() +
                        " attempted to attack the Drone Base in " + city.toUpperCase() +
                        ", but the Combat Team repelled the raid. " + attacker.getName() + " escaped neutralization. Drone Base remains intact.";
            }

            session.getDiscoveredClues().add(new GameSession.Clue(
                    currentTurn,
                    "SAFEHOUSE_ATTACK",
                    resultText,
                    city,
                    "Combat Operations"
            ));
        } else {
            boolean defenseHeld = random.nextDouble() < 0.50;
            if (defenseHeld) {
                String resultText = "COMBAT ENGAGEMENT: Hostile operative " + attacker.getName() +
                        " raided the Drone Base in " + city.toUpperCase() +
                        ", but perimeter defenses held. No damage sustained.";

                session.getDiscoveredClues().add(new GameSession.Clue(
                        currentTurn,
                        "SAFEHOUSE_ATTACK",
                        resultText,
                        city,
                        "Combat Operations"
                ));
            } else {
                int damageTurns = random.nextInt(4) + 1; // 1, 2, 3, or 4 turns
                session.getDroneBaseCooldowns().put(city.toLowerCase(), damageTurns);

                String resultText = "COMBAT LOSS: Hostile operative " + attacker.getName() +
                        " attacked and DAMAGED the Drone Base in " + city.toUpperCase() +
                        "! Drone Base is OFFLINE and disabled for " + damageTurns + " turn(s).";

                session.getDiscoveredClues().add(new GameSession.Clue(
                        currentTurn,
                        "SAFEHOUSE_ATTACK",
                        resultText,
                        city,
                        "Combat Operations"
                ));
            }
        }
    }
}
