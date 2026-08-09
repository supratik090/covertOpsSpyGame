package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.GameSessionRepository;
import com.spygame.covertops.repository.ScenarioConfigRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class HintGenerationService {

    @Autowired
    private GameSessionRepository repository;

    @Autowired
    private ScenarioConfigRepository scenarioConfigRepository;

    private static final int P_CRITICAL = 0;
    private static final int P_HIGH     = 1;
    private static final int P_MEDIUM   = 2;
    private static final int P_LOW      = 3;

    public List<Hint> generateHints(UUID sessionId) {
        GameSession session = repository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));
        ScenarioConfig config = scenarioConfigRepository.findById(session.getScenarioId()).orElse(null);
        List<Hint> hints = new ArrayList<>();
        boolean isAttacker = "ATTACKER".equals(session.getPlayerRole());
        if (isAttacker) {
            hints.addAll(generateAttackerHints(session, config));
        } else {
            hints.addAll(generateDefenderHints(session, config));
        }
        hints.sort(Comparator.comparingInt(Hint::getPriority));
        return hints;
    }

    // ATTACKER HINTS
    private List<Hint> generateAttackerHints(GameSession session, ScenarioConfig config) {
        List<Hint> hints = new ArrayList<>();
        int turn = session.getCurrentTurn();
        if (turn <= 5) {
            hints.add(new Hint("EARLY GAME", "REQUEST SOURCING EARLY",
                "Request Finance and Logistics early. Sourcing takes 5 turns of transit before you can collect them.",
                turn, P_HIGH));
            hints.add(new Hint("EARLY GAME", "ESTABLISH HIDE-OUTS",
                "Build safehouses to manage cell heat. Standard USD50K (Home) / USD150K (Hostile). Secure safehouses (USD100K / USD300K) are invisible to sweeps for 5 turns.",
                turn, P_MEDIUM));
        }
        if (turn >= 6 && turn <= 15) {
            hints.add(new Hint("MID GAME", "DEPLOY DEFLECTION TECH",
                "Deploy Decoy CCTV (USD20K) or Decoy Satellite (USD40K) to lure Defender agents. Active Jammers (USD30K) block scans for 3 turns.",
                turn, P_MEDIUM));
            if (session.isFinanceCollected() && session.isLogisticsCollected()) {
                hints.add(new Hint("MID GAME", "EXECUTE HANDOVER MEETING",
                    "All sourcing acquired. Navigate to a hostile target city and Initiate Handover. Stay 3 turns to complete.",
                    turn, P_HIGH));
            } else {
                hints.add(new Hint("MID GAME", "COLLECT ACTIVE SOURCING",
                    "Return to your requested Finance/Logistics cities once the 5-turn transit counter expires.",
                    turn, P_MEDIUM));
            }
        }
        if (turn >= 16) {
            if (session.isHandoverCompleted()) {
                hints.add(new Hint("LATE GAME", "OBTAIN BORDER CLEARANCE",
                    "Handover complete. Request Stage 1 (Infiltration) clearance from HQ to cross the border.",
                    turn, P_HIGH));
            }
            if (session.isInfiltrationGoAheadApproved()) {
                hints.add(new Hint("LATE GAME", "REQUEST STRIKE AUTHORIZATION",
                    "Reach the primary target city and request Stage 2 (Strike) authorisation.",
                    turn, P_HIGH));
            }
        }
        int heat = session.getCityHeat().getOrDefault(session.getSuspectLocation(), 0);
        if (heat >= 50) {
            hints.add(new Hint("WARNING", "HIGH DETECTION HEAT",
                "Detection heat is at " + heat + "% at current position. Relocate immediately.",
                turn, P_CRITICAL));
        }
        return hints;
    }

    // DEFENDER HINTS
    private List<Hint> generateDefenderHints(GameSession session, ScenarioConfig config) {
        List<Hint> hints = new ArrayList<>();
        int turn     = session.getCurrentTurn();
        int maxTurns = session.getMaxTurns();
        int budget   = session.getBudget();
        int turnsLeft = maxTurns - turn;

        List<Node> allNodes     = config != null && config.getNodes() != null ? config.getNodes() : Collections.emptyList();
        List<Node> hostileNodes = allNodes.stream().filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory())).collect(Collectors.toList());
        List<Node> homeNodes    = allNodes.stream().filter(n -> "HOME_TERRITORY".equals(n.getTerritory())).collect(Collectors.toList());
        Set<String> hostileIds  = hostileNodes.stream().map(Node::getId).collect(Collectors.toSet());
        List<Node> borderCities = homeNodes.stream()
                .filter(n -> n.getConnections() != null && n.getConnections().stream().anyMatch(hostileIds::contains))
                .collect(Collectors.toList());

        String suspectLoc    = session.getSuspectLocation();
        String attackerPhase = session.getActiveAttackerPhase() != null ? session.getActiveAttackerPhase() : "";

        List<GameSession.AIAttacker> activeAttackers = session.getAiAttackers() != null
                ? session.getAiAttackers().stream().filter(a -> !a.isEliminated()).collect(Collectors.toList())
                : Collections.emptyList();

        Set<String> attackerLocations = activeAttackers.stream()
                .map(GameSession.AIAttacker::getCurrentLocation).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> attackerStates = activeAttackers.stream()
                .map(GameSession.AIAttacker::getState).filter(Objects::nonNull).collect(Collectors.toSet());

        boolean crossingApproved = activeAttackers.stream().anyMatch(GameSession.AIAttacker::isPermissionToCrossBorderApproved);
        boolean attackerInHome   = activeAttackers.stream().anyMatch(a -> "HOME_TERRITORY".equals(getTerritory(a.getCurrentLocation(), config)));
        boolean exfiltrating     = attackerStates.contains("Exfiltration") || "EXFILTRATION".equals(attackerPhase);
        boolean borderCrossing   = crossingApproved || "BORDER_CROSSING".equals(attackerPhase)
                || attackerStates.contains("Border crossed") || attackerStates.contains("Clearance approved");
        boolean financePhase     = "FINANCE_SOURCING".equals(attackerPhase)
                || attackerStates.stream().anyMatch(s -> s.contains("Finance") || s.contains("finance"));
        boolean logisticsPhase   = "LOGISTICS_SOURCING".equals(attackerPhase)
                || attackerStates.stream().anyMatch(s -> s.contains("Logistic") || s.contains("logistic"));
        boolean handoverPhase    = "HANDOVER".equals(attackerPhase)
                || attackerStates.stream().anyMatch(s -> s.contains("Handover") || s.contains("handover"));

        Set<String> deployedTypes = session.getEspionageResources().stream()
                .map(GameSession.ActiveResource::getType).collect(Collectors.toSet());

        List<GameSession.TacticalTeam> readyTeams = session.getTacticalTeams().stream()
                .filter(t -> t.getCooldownRemaining() <= 0).collect(Collectors.toList());
        List<GameSession.TacticalTeam> teamsInHostile = readyTeams.stream()
                .filter(t -> "HOSTILE_TERRITORY".equals(getTerritory(t.getCurrentCity(), config))).collect(Collectors.toList());
        List<GameSession.TacticalTeam> teamsInHome = readyTeams.stream()
                .filter(t -> "HOME_TERRITORY".equals(getTerritory(t.getCurrentCity(), config))).collect(Collectors.toList());
        List<GameSession.TacticalTeam> cooldownTeams = session.getTacticalTeams().stream()
                .filter(t -> t.getCooldownRemaining() > 0).collect(Collectors.toList());

        List<GameSession.Safehouse> uncoveredHostileSH = session.getSafehouses().stream()
                .filter(s -> "HOSTILE".equals(s.getOwnerFaction()) && s.isUncovered()).collect(Collectors.toList());
        List<GameSession.Safehouse> coveredHostileSH = session.getSafehouses().stream()
                .filter(s -> "HOSTILE".equals(s.getOwnerFaction()) && !s.isUncovered()).collect(Collectors.toList());
        boolean hasFriendlyHostileSH = session.getSafehouses().stream()
                .anyMatch(s -> "DEFENDER".equals(s.getOwnerFaction()) && "HOSTILE_TERRITORY".equals(getTerritory(s.getCityNode(), config)));

        long idleAgents = session.getAgents().stream()
                .filter(a -> a.getCooldownRemaining() == 0
                        && (a.getActiveTask() == null || "NONE".equals(a.getActiveTask()) || a.getActiveTask().isEmpty()))
                .count();
        boolean agentUncovering = session.getAgents().stream().anyMatch(a -> "UNCOVER_SAFEHOUSE".equals(a.getActiveTask()));

        List<String> warnedCities   = session.getHostilePatrolCities() != null ? session.getHostilePatrolCities() : Collections.emptyList();
        List<String> surpriseCities = session.getSurprisePatrolCities() != null ? session.getSurprisePatrolCities() : Collections.emptyList();

        List<Map.Entry<String, Integer>> highHeatEntries = session.getCityHeat() != null
                ? session.getCityHeat().entrySet().stream()
                    .filter(e -> e.getValue() >= 50)
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .collect(Collectors.toList())
                : Collections.emptyList();

        // 1. Budget
        if (budget < 50000) {
            hints.add(new Hint("WARNING", "BUDGET CRITICAL - ACT SELECTIVELY",
                "Remaining budget: USD" + String.format("%,d", budget) + ". Cheapest high-value actions: STOP_INFILTRATION (USD35K), SIGNAL_JAMMER (USD25K), WIRE_TAP (USD20K).",
                turn, P_CRITICAL));
        }

        // 2. Time
        if (turnsLeft <= 3) {
            hints.add(new Hint("WARNING", "FINAL TURNS - ALL HANDS ON DECK",
                turnsLeft + " turn(s) remaining. If suspect in HOME_TERRITORY: CITY_GRID_LOCKDOWN (USD100K) NOW. If crossing: TRANSIT_CHECKPOINT (USD80K) at border. If exfiltrating: STOP_EXFILTRATION (USD40K) at all border cities.",
                turn, P_CRITICAL));
        } else if (turnsLeft <= 5) {
            hints.add(new Hint("WARNING", "TIME RUNNING OUT - " + turnsLeft + " TURNS",
                "Priority: (1) Raid known safehouses. (2) STOP_EXFILTRATION if attacker acted. (3) CITY_GRID_LOCKDOWN on target corridor.",
                turn, P_HIGH));
        }

        // 3. Warned sweep
        if (!warnedCities.isEmpty()) {
            String cities = warnedCities.stream().map(String::toUpperCase).collect(Collectors.joining(", "));
            hints.add(new Hint("CRITICAL", "WARNED SWEEP - EVACUATE ASSETS NOW",
                "Active sweep in: " + cities + ". ALL your agents, teams, and safehouses there will be destroyed this turn. EVACUATE before End Turn.",
                turn, P_CRITICAL));
        }

        // 4. Surprise sweep
        if (!surpriseCities.isEmpty()) {
            String cities = surpriseCities.stream().map(String::toUpperCase).collect(Collectors.joining(", "));
            hints.add(new Hint("WARNING", "SURPRISE SWEEP RISK",
                "33% capture chance for each asset in: " + cities + ". Consider relocating valuable agents and teams.",
                turn, P_HIGH));
        }

        // 5. High heat
        for (Map.Entry<String, Integer> entry : highHeatEntries) {
            String cityId   = entry.getKey();
            int heatVal     = entry.getValue();
            String cityName = getNodeName(cityId, config);
            String terr     = getTerritory(cityId, config);
            boolean isBorderCity = borderCities.stream().anyMatch(n -> n.getId().equals(cityId));
            if ("HOME_TERRITORY".equals(terr) && heatVal >= 70) {
                hints.add(new Hint("TACTICAL", "CITY GRID LOCKDOWN - " + cityName.toUpperCase(),
                    cityName + " heat: " + heatVal + "%. Deploy CITY_GRID_LOCKDOWN (USD100K) to lock all movement in/out. Adds 3 defender turns if suspect present.",
                    turn, P_HIGH));
                if (isBorderCity) {
                    hints.add(new Hint("TACTICAL", "LOCKDOWN + TRANSIT_CHECKPOINT COMBO - " + cityName.toUpperCase(),
                        cityName + " is a border city at " + heatVal + "% heat. Stack CITY_GRID_LOCKDOWN (USD100K) + TRANSIT_CHECKPOINT (USD80K) for maximum disruption.",
                        turn, P_HIGH));
                }
            }
            if ("HOSTILE_TERRITORY".equals(terr) && heatVal >= 60) {
                hints.add(new Hint("SURVEILLANCE", "SWEEP IMMINENT - " + cityName.toUpperCase(),
                    cityName + " heat: " + heatVal + "%. Security sweep likely next turn. Evacuate agents and teams from " + cityName + " before submitting.",
                    turn, P_HIGH));
            }
        }

        // 6a. Finance phase
        if (financePhase) {
            String finCity = session.getRequestedFinanceCity();
            if (finCity != null && !finCity.isEmpty()) {
                String finCityName = getNodeName(finCity, config);
                hints.add(new Hint("COMBAT ACTION", "FREEZE FINANCE - " + finCityName.toUpperCase(),
                    "Suspect staging finance in " + finCityName + ". Execute FREEZE_FINANCE (USD50K) this turn. Destroys funding pipeline - forces re-source from different city (3+ turns lost).",
                    turn, P_CRITICAL));
                if (!teamsInHostile.isEmpty()) {
                    String teamNames = teamsInHostile.stream().map(GameSession.TacticalTeam::getName).collect(Collectors.joining(", "));
                    hints.add(new Hint("COMBAT ACTION", "MOVE TEAM TO FREEZE FINANCE CITY",
                        "Teams available: " + teamNames + ". Move closest team to " + finCityName + " and assign FREEZE_FINANCE.",
                        turn, P_HIGH));
                }
            }
        }

        // 6b. Logistics phase
        if (logisticsPhase) {
            String logCity = session.getRequestedLogisticsCity();
            if (logCity != null && !logCity.isEmpty()) {
                String logCityName = getNodeName(logCity, config);
                hints.add(new Hint("COMBAT ACTION", "RAID LOGISTICS - " + logCityName.toUpperCase(),
                    "Suspect logistics active in " + logCityName + ". Execute RAID_LOGISTICS (USD50K) to destroy supply chain. Forces re-sourcing from new city.",
                    turn, P_CRITICAL));
            }
        }

        // 6c. Handover phase
        if (handoverPhase && suspectLoc != null && !suspectLoc.isEmpty()) {
            String handoverCityName = getNodeName(suspectLoc, config);
            hints.add(new Hint("COMBAT ACTION", "ROADBLOCK AT HANDOVER SITE - " + handoverCityName.toUpperCase(),
                "Suspect executing handover in " + handoverCityName + ". Deploy ROADBLOCK (USD80K) or LOCKDOWN (USD100K) to disrupt transfer and delay operation by 3 turns.",
                turn, P_CRITICAL));
            if (!deployedTypes.contains("CCTV")) {
                hints.add(new Hint("SURVEILLANCE", "CCTV AT HANDOVER CITY - " + handoverCityName.toUpperCase(),
                    "Place CCTV (USD30K) in " + handoverCityName + " to confirm suspect presence with always-truthful visual clues.",
                    turn, P_HIGH));
            }
        }

        // 6d. Border crossing phase
        if (borderCrossing && !borderCities.isEmpty()) {
            List<Node> likelyCrossing = new ArrayList<>();
            if (suspectLoc != null) {
                Node suspectNode = getNode(suspectLoc, config);
                if (suspectNode != null && suspectNode.getConnections() != null) {
                    for (Node bc : borderCities) {
                        if (suspectNode.getConnections().contains(bc.getId())) likelyCrossing.add(bc);
                    }
                }
            }
            if (likelyCrossing.isEmpty()) likelyCrossing = borderCities;
            for (Node bc : likelyCrossing) {
                boolean hasTC = session.getEspionageResources().stream()
                        .anyMatch(r -> "TRANSIT_CHECKPOINT".equals(r.getType()) && r.getCityNode().equals(bc.getId()));
                boolean hasBG = session.getEspionageResources().stream()
                        .anyMatch(r -> "BORDER_GUARD".equals(r.getType()) && r.getCityNode().equals(bc.getId()));
                if (!hasTC) {
                    hints.add(new Hint("COMBAT ACTION", "TRANSIT CHECKPOINT - " + bc.getName().toUpperCase(),
                        "Border crossing clearance issued! Deploy TRANSIT_CHECKPOINT (USD80K) at " + bc.getName() + " NOW. 80% capture chance if suspect crosses here. Highest-impact action available.",
                        turn, P_CRITICAL));
                }
                if (!hasBG) {
                    hints.add(new Hint("COMBAT ACTION", "BORDER GUARD - " + bc.getName().toUpperCase(),
                        "Reinforce " + bc.getName() + " with BORDER_GUARD (USD70K). 50% chance to block crossing and force fallback pivot.",
                        turn, P_HIGH));
                }
                hints.add(new Hint("COMBAT ACTION", "STOP_INFILTRATION - " + bc.getName().toUpperCase(),
                    "Execute STOP_INFILTRATION (USD35K) at " + bc.getName() + " as covert action. Cheapest border interception - adds 3 turns if suspect is crossing here.",
                    turn, P_HIGH));
            }
        }

        // 6e. Attacker in HOME territory
        if (attackerInHome) {
            for (String loc : attackerLocations) {
                if ("HOME_TERRITORY".equals(getTerritory(loc, config))) {
                    String locName = getNodeName(loc, config);
                    boolean hasLockdown = session.getEspionageResources().stream()
                            .anyMatch(r -> ("LOCKDOWN".equals(r.getType()) || "CITY_GRID_LOCKDOWN".equals(r.getType())) && r.getCityNode().equals(loc));
                    if (!hasLockdown) {
                        hints.add(new Hint("COMBAT ACTION", "CITY GRID LOCKDOWN - " + locName.toUpperCase(),
                            "SUSPECT IS IN FRIENDLY TERRITORY at " + locName + "! Deploy CITY_GRID_LOCKDOWN (USD100K) immediately. Scramble a Tactical Team for follow-up RAID.",
                            turn, P_CRITICAL));
                    }
                    hints.add(new Hint("COMBAT ACTION", "ROADBLOCK - " + locName.toUpperCase(),
                        "Deploy ROADBLOCK (USD80K) at " + locName + " to delay suspect movement within HOME_TERRITORY.",
                        turn, P_HIGH));
                }
            }
            List<GameSession.Safehouse> hostileSHInHome = uncoveredHostileSH.stream()
                    .filter(s -> "HOME_TERRITORY".equals(getTerritory(s.getCityNode(), config))).collect(Collectors.toList());
            if (!hostileSHInHome.isEmpty() && !teamsInHome.isEmpty()) {
                GameSession.Safehouse target = hostileSHInHome.get(0);
                String shCity = getNodeName(target.getCityNode(), config);
                String teamNames = teamsInHome.stream().map(GameSession.TacticalTeam::getName).collect(Collectors.joining(", "));
                hints.add(new Hint("COMBAT ACTION", "RAID SAFEHOUSE - " + shCity.toUpperCase(),
                    "Teams ready: " + teamNames + ". Exposed hostile safehouse in " + shCity
                        + " [code: " + (target.getSafehouseCode() != null ? target.getSafehouseCode() : "unknown") + "]. Execute RAID_SAFEHOUSE. Suspect present = 80%+ elimination chance.",
                    turn, P_CRITICAL));
            } else if (!teamsInHome.isEmpty()) {
                for (String loc : attackerLocations) {
                    if ("HOME_TERRITORY".equals(getTerritory(loc, config))) {
                        String teamNames = teamsInHome.stream().map(GameSession.TacticalTeam::getName).collect(Collectors.joining(", "));
                        hints.add(new Hint("COMBAT ACTION", "MOVE TEAM TO SUSPECT LOCATION - " + getNodeName(loc, config).toUpperCase(),
                            "Suspect at " + getNodeName(loc, config) + ". Relocate " + teamNames + " there. Assign UNCOVER_SAFEHOUSE agents, then RAID_SAFEHOUSE next turn.",
                            turn, P_CRITICAL));
                    }
                }
            }
        }

        // 6f. Exfiltration
        if (exfiltrating) {
            for (Node bc : borderCities) {
                boolean hasStopExfil = session.getEspionageResources().stream()
                        .anyMatch(r -> "STOP_EXFILTRATION".equals(r.getType()) && r.getCityNode().equals(bc.getId()));
                if (!hasStopExfil) {
                    hints.add(new Hint("COMBAT ACTION", "STOP_EXFILTRATION - " + bc.getName().toUpperCase(),
                        "SUSPECT ATTEMPTING EXFILTRATION! Execute STOP_EXFILTRATION (USD40K) at " + bc.getName() + " to intercept escape. Deploy at ALL border cities simultaneously if budget allows.",
                        turn, P_CRITICAL));
                }
            }
        }

        // 7. Raid safehouse
        if (!uncoveredHostileSH.isEmpty()) {
            Map<String, List<GameSession.Safehouse>> shByCity = uncoveredHostileSH.stream()
                    .collect(Collectors.groupingBy(GameSession.Safehouse::getCityNode));
            for (Map.Entry<String, List<GameSession.Safehouse>> entry : shByCity.entrySet()) {
                String cityId   = entry.getKey();
                String cityName = getNodeName(cityId, config);
                List<GameSession.Safehouse> shList = entry.getValue();
                boolean suspectHere = attackerLocations.contains(cityId);
                long teamsHere = readyTeams.stream().filter(t -> t.getCurrentCity().equals(cityId)).count();
                if (shList.size() >= 2 && teamsHere >= 2) {
                    StringBuilder codeList = new StringBuilder();
                    for (GameSession.Safehouse sh : shList) {
                        codeList.append("[").append(sh.getSafehouseCode() != null ? sh.getSafehouseCode() : "?").append("] ");
                    }
                    hints.add(new Hint("COMBAT ACTION", "DUAL RAID - " + cityName.toUpperCase(),
                        cityName + " has " + shList.size() + " exposed safehouses " + codeList.toString().trim()
                            + " and " + teamsHere + " ready teams. Assign each team a different code and submit BOTH RAID_SAFEHOUSE actions - both now fire independently.",
                        turn, suspectHere ? P_CRITICAL : P_HIGH));
                } else {
                    GameSession.Safehouse sh = shList.get(0);
                    String code = sh.getSafehouseCode() != null ? sh.getSafehouseCode() : "unknown";
                    hints.add(new Hint("COMBAT ACTION", "RAID SAFEHOUSE - " + cityName.toUpperCase(),
                        (suspectHere ? "SUSPECT CONFIRMED HERE. " : "")
                            + "Hostile safehouse [" + code + "] exposed in " + cityName + ". "
                            + (sh.isSecure() ? "HIGH-SECURITY - 50% capture chance regardless of skill. " : "Capture chance scales with team combat skill. ")
                            + "Move a Tactical Team to " + cityName + " and execute RAID_SAFEHOUSE with code [" + code + "].",
                        turn, suspectHere ? P_CRITICAL : P_HIGH));
                }
            }
        } else if (!coveredHostileSH.isEmpty() && !agentUncovering) {
            List<String> covCities = coveredHostileSH.stream()
                    .map(s -> getNodeName(s.getCityNode(), config)).distinct().collect(Collectors.toList());
            hints.add(new Hint("INTEL", "UNCOVER HOSTILE SAFEHOUSES - " + String.join(", ", covCities).toUpperCase(),
                "Hostile safehouses in: " + String.join(", ", covCities) + " but raid codes not yet exposed. Assign agents to UNCOVER_SAFEHOUSE immediately. 2 agents together crack a secure safehouse.",
                turn, P_HIGH));
        }

        // 8. Team management
        if (teamsInHostile.isEmpty() && turn >= 4) {
            hints.add(new Hint("TACTICAL", "MOVE TACTICAL TEAMS INTO HOSTILE TERRITORY",
                "No teams in hostile territory. Teams must be there for FREEZE_FINANCE, RAID_LOGISTICS, RAID_SAFEHOUSE. Relocate now - 20% border capture risk. Ensure a friendly safehouse exists at destination.",
                turn, P_HIGH));
        }
        if (!cooldownTeams.isEmpty()) {
            String ctNames = cooldownTeams.stream()
                    .map(t -> t.getName() + " (" + t.getCooldownRemaining() + " turn(s))").collect(Collectors.joining(", "));
            hints.add(new Hint("TACTICAL", "TEAMS ON COOLDOWN",
                "Teams on cooldown: " + ctNames + ". Use this turn to reposition ready teams or assign uncovering agents.",
                turn, P_MEDIUM));
        }

        // 9. Surveillance gaps
        if (!deployedTypes.contains("BORDER_GUARD") && !attackerInHome && turn >= 3) {
            String borderList = borderCities.stream().map(Node::getName).collect(Collectors.joining(", "));
            hints.add(new Hint("SURVEILLANCE", "DEPLOY BORDER GUARD",
                "No BORDER_GUARD deployed. Border cities unprotected: " + borderList + ". A BORDER_GUARD (USD70K) gives 50% interdiction on suspect crossing. Deploy before clearance is issued.",
                turn, P_HIGH));
        }
        if (!deployedTypes.contains("SATELLITE") && turn >= 5) {
            hints.add(new Hint("SURVEILLANCE", "DEPLOY SATELLITE COVERAGE",
                "Satellite (USD80K) provides wide-area detection of suspect movement. Always-truthful position clues.",
                turn, P_MEDIUM));
        }
        if (!deployedTypes.contains("WIRE_TAP") && turn >= 4) {
            hints.add(new Hint("SURVEILLANCE", "WIRE TAP FOR COMMUNICATIONS",
                "WIRE_TAP (USD20K) intercepts suspect communications. Deploy in suspected finance or logistics city for low-cost always-truthful intel.",
                turn, P_LOW));
        }
        if (!deployedTypes.contains("BIOMETRIC_SCAN") && turn >= 6) {
            hints.add(new Hint("SURVEILLANCE", "BIOMETRIC SCAN - HIGH-TRAFFIC NODES",
                "BIOMETRIC_SCAN (USD35K) spikes city heat +25% when suspect passes through, potentially triggering a warned sweep. Deploy on high-traffic border or finance cities.",
                turn, P_MEDIUM));
        }
        if (!deployedTypes.contains("FINANCE_MONITOR") && (financePhase || turn >= 8)) {
            String finCity = session.getRequestedFinanceCity();
            String cityHint = (finCity != null && !finCity.isEmpty()) ? getNodeName(finCity, config) : "suspected finance city";
            hints.add(new Hint("SURVEILLANCE", "FINANCE MONITOR - " + cityHint.toUpperCase(),
                "FINANCE_MONITOR (USD50K) in " + cityHint + " reveals wire transactions. Pair with agent on MONITOR_FINANCE for CONFIRMED FINANCE clues.",
                turn, P_MEDIUM));
        }
        if (!deployedTypes.contains("PHONE_TAP") && turn >= 3 && suspectLoc != null) {
            hints.add(new Hint("SURVEILLANCE", "PHONE TAP - " + getNodeName(suspectLoc, config).toUpperCase(),
                "PHONE_TAP (USD40K) provides always-truthful confirmation when suspect is in a city. Cannot be fabricated. Deploy in suspected operating city.",
                turn, P_LOW));
        }
        if (!deployedTypes.contains("SIGNAL_JAMMER") && turn >= 8) {
            hints.add(new Hint("SURVEILLANCE", "SIGNAL JAMMER - COMMS BLACKOUT",
                "SIGNAL_JAMMER (USD25K) intercepts suspect comms in any phase. Always-truthful intel, forces fallback pivot. Cheapest always-truthful asset.",
                turn, P_LOW));
        }
        if (!deployedTypes.contains("CCTV") && turn >= 2) {
            hints.add(new Hint("SURVEILLANCE", "CCTV - VISUAL CONFIRMATION",
                "CCTV (USD30K) provides always-truthful visual confirmation of suspect location. Deploy in suspected operating cities.",
                turn, P_LOW));
        }

        // 10. Early game
        if (!hasFriendlyHostileSH && turn <= 8) {
            hints.add(new Hint("EARLY GAME", "BUILD HOSTILE-TERRITORY SAFEHOUSE",
                "No friendly safehouse in hostile territory. Agents and teams cannot legally operate there without one. Build now (USD100K) via RESOURCES tab.",
                turn, P_HIGH));
        }
        if (turn <= 5) {
            hints.add(new Hint("EARLY GAME", "WATCH YOUR BUDGET",
                "Prioritise one hostile safehouse (USD100K) and one CCTV (USD30K) early. Avoid wasteful relocations.",
                turn, P_MEDIUM));
        }

        // 11. Idle agents
        if (idleAgents > 0) {
            String bestTask = attackerInHome ? "UNCOVER_SAFEHOUSE in suspect city"
                    : financePhase ? ("MONITOR_FINANCE in " + getNodeName(session.getRequestedFinanceCity(), config))
                    : logisticsPhase ? ("MONITOR_LOGISTICS in " + getNodeName(session.getRequestedLogisticsCity(), config))
                    : "GATHER_INTELLIGENCE in suspected attacker corridor";
            hints.add(new Hint("INTEL", idleAgents + " IDLE AGENT(S) - ASSIGN TASKS",
                idleAgents + " agent(s) have no task. Best assignment now: " + bestTask + ". Open MAP and assign via CIA panel.",
                turn, P_MEDIUM));
        }

        // 12. Intel cycle
        if (turn % 6 == 0) {
            hints.add(new Hint("INTEL", "TRUSTED INTELLIGENCE MILESTONE",
                "A TRUSTED INTELLIGENCE milestone generated this turn. Check CLUES tab and ACCEPT it.",
                turn, P_LOW));
        }

        // 13. Crossing expected from master plan
        if (session.getAiMasterPlan() != null && session.getAiMasterPlan().getPrimaryPlan() != null) {
            boolean crossingSoon = session.getAiMasterPlan().getPrimaryPlan().stream()
                    .anyMatch(s -> s.getTurn() >= turn && s.getTurn() <= turn + 3
                            && (s.isSmuggling() || "BORDER_CROSSING".equals(s.getPhase())));
            if (crossingSoon && !borderCrossing) {
                String borderList = borderCities.stream().map(Node::getName).collect(Collectors.joining(", "));
                hints.add(new Hint("TACTICAL", "BORDER CROSSING IMMINENT - 1-3 TURNS",
                    "Crossing predicted within 3 turns. Checklist: (1) TRANSIT_CHECKPOINT (USD80K). (2) BORDER_GUARD (USD70K). (3) STOP_INFILTRATION (USD35K) covert action. (4) Position team at border city.",
                    turn, P_HIGH));
            }
        }

        // 14. Multi-attacker co-location
        if (activeAttackers.size() > 1) {
            Map<String, Long> locCount = activeAttackers.stream()
                    .filter(a -> a.getCurrentLocation() != null)
                    .collect(Collectors.groupingBy(GameSession.AIAttacker::getCurrentLocation, Collectors.counting()));
            for (Map.Entry<String, Long> e : locCount.entrySet()) {
                if (e.getValue() > 1) {
                    String cityName = getNodeName(e.getKey(), config);
                    hints.add(new Hint("TACTICAL", "MULTIPLE SUSPECTS IN " + cityName.toUpperCase(),
                        e.getValue() + " operatives co-located in " + cityName + ". Prime multi-target raid opportunity. Move a tactical team and execute RAID_SAFEHOUSE.",
                        turn, P_HIGH));
                }
            }
        }

        return hints;
    }

    private String getTerritory(String cityId, ScenarioConfig config) {
        if (config == null || config.getNodes() == null || cityId == null) return "";
        return config.getNodes().stream().filter(n -> n.getId().equals(cityId)).findFirst()
                .map(Node::getTerritory).orElse("");
    }

    private String getNodeName(String cityId, ScenarioConfig config) {
        if (config == null || config.getNodes() == null || cityId == null || cityId.isEmpty()) return cityId != null ? cityId : "";
        return config.getNodes().stream().filter(n -> n.getId().equals(cityId)).findFirst()
                .map(Node::getName).orElse(cityId);
    }

    private Node getNode(String cityId, ScenarioConfig config) {
        if (config == null || config.getNodes() == null || cityId == null) return null;
        return config.getNodes().stream().filter(n -> n.getId().equals(cityId)).findFirst().orElse(null);
    }

    public static class Hint {
        private String category;
        private String title;
        private String body;
        private int turnGenerated;
        private int priority;

        public Hint() {}

        public Hint(String category, String title, String body, int turnGenerated, int priority) {
            this.category      = category;
            this.title         = title;
            this.body          = body;
            this.turnGenerated = turnGenerated;
            this.priority      = priority;
        }

        public String getCategory()         { return category; }
        public void setCategory(String c)   { this.category = c; }
        public String getTitle()            { return title; }
        public void setTitle(String t)      { this.title = t; }
        public String getBody()             { return body; }
        public void setBody(String b)       { this.body = b; }
        public int getTurnGenerated()       { return turnGenerated; }
        public void setTurnGenerated(int t) { this.turnGenerated = t; }
        public int getPriority()            { return priority; }
        public void setPriority(int p)      { this.priority = p; }
    }
}
