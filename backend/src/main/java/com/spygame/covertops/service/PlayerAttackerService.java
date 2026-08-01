package com.spygame.covertops.service;

import com.spygame.covertops.model.EndTurnRequest;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.GameSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class PlayerAttackerService {

    @Autowired
    private GameSessionRepository repository;

    public GameSession applyAttackerActions(GameSession session, EndTurnRequest request, ScenarioConfig config) {
        // 1. Process standard/secure safehouse builds
        if (request.getBuiltSafehouses() != null) {
            for (String cityNode : request.getBuiltSafehouses()) {
                buildSafehouse(session, cityNode, false, config);
            }
        }
        if (request.getBuiltSecureSafehouses() != null) {
            for (String cityNode : request.getBuiltSecureSafehouses()) {
                buildSafehouse(session, cityNode, true, config);
            }
        }

        // 2. Process decoy deployments
        if (request.getDecoyDeployments() != null) {
            for (Map<String, String> decoy : request.getDecoyDeployments()) {
                deployDecoy(session, decoy.get("type"), decoy.get("cityNode"));
            }
        }

        // 3. Process active jammer
        if (request.getActiveJammerTarget() != null && !request.getActiveJammerTarget().isEmpty()) {
            deployJammer(session, request.getActiveJammerTarget());
        }

        // 4. Process Seek Permissions
        if (request.getSeekPermissionType() != null && !request.getSeekPermissionType().isEmpty()) {
            evaluatePermissionRequest(session, request.getSeekPermissionType(), config);
        }

        // 5. Process Suspect Relocations
        if (request.getSuspectMoveTarget() != null && !request.getSuspectMoveTarget().isEmpty()) {
            relocateSuspect(session, request.getSuspectMoveTarget(), request.getTargetSafehouseCode(), config);
        }

        // 6. Process Strike Execution
        if (request.isTriggerStrike()) {
            executeStrike(session, config);
        }

        // 7. Process Exfiltration Activation
        if (request.isTriggerExfiltration()) {
            activateExfiltration(session);
        }

        // 8. Process Finance / Logistics Request/Collection Actions
        if (request.isRequestFinance()) {
            requestFinance(session);
        }
        if (request.isCollectFinance()) {
            collectFinance(session, config);
        }
        if (request.isRequestLogistics()) {
            requestLogistics(session);
        }
        if (request.isCollectLogistics()) {
            collectLogistics(session, config);
        }
        if (request.isBeginHandover()) {
            beginHandover(session, config);
        }

        return repository.save(session);
    }

    private void requestFinance(GameSession session) {
        if (session.getRequestedFinanceCity() != null) {
            throw new IllegalStateException("Finance has already been requested.");
        }
        session.setRequestedFinanceCity(session.getSuspectLocation());
        session.setFinanceCollectionTurnsRemaining(5);
        session.setActiveAttackerPhase("FINANCE_SOURCING");
        session.getDiscoveredClues().add(new GameSession.Clue(
                session.getCurrentTurn(),
                "FINANCE_REQUESTED",
                "Finance channel opened in " + session.getSuspectLocation().toUpperCase() + ". Return here in 5 turns to collect."
        ));
    }

    private void collectFinance(GameSession session, ScenarioConfig config) {
        if (session.isFinanceCollected()) {
            throw new IllegalStateException("Finance has already been collected.");
        }
        if (session.getFinanceCollectionTurnsRemaining() > 0) {
            throw new IllegalStateException("Finance collection channels not yet ready.");
        }
        if (session.getRequestedFinanceCity() == null || !session.getRequestedFinanceCity().equals(session.getSuspectLocation())) {
            throw new IllegalStateException("Operative must be at the requested finance city to collect.");
        }
        session.setFinanceCollected(true);
        session.getUncoveredFinanceCities().add(session.getSuspectLocation());
        session.getDiscoveredClues().add(new GameSession.Clue(
                session.getCurrentTurn(),
                "FINANCE_SOURCED",
                "Capital acquired. Finance sourcing completed."
        ));
        checkUnlockedPhase(session, config);
    }

    private void requestLogistics(GameSession session) {
        if (session.getRequestedLogisticsCity() != null) {
            throw new IllegalStateException("Logistics has already been requested.");
        }
        session.setRequestedLogisticsCity(session.getSuspectLocation());
        session.setLogisticsCollectionTurnsRemaining(5);
        session.setActiveAttackerPhase("LOGISTICS_SOURCING");
        session.getDiscoveredClues().add(new GameSession.Clue(
                session.getCurrentTurn(),
                "LOGISTICS_REQUESTED",
                "Logistical supply lines mapped in " + session.getSuspectLocation().toUpperCase() + ". Return here in 5 turns to collect."
        ));
    }

    private void collectLogistics(GameSession session, ScenarioConfig config) {
        if (session.isLogisticsCollected()) {
            throw new IllegalStateException("Logistics has already been collected.");
        }
        if (session.getLogisticsCollectionTurnsRemaining() > 0) {
            throw new IllegalStateException("Logistics collection channels not yet ready.");
        }
        if (session.getRequestedLogisticsCity() == null || !session.getRequestedLogisticsCity().equals(session.getSuspectLocation())) {
            throw new IllegalStateException("Operative must be at the requested logistics city to collect.");
        }
        session.setLogisticsCollected(true);
        session.getUncoveredLogisticsCities().add(session.getSuspectLocation());
        session.getDiscoveredClues().add(new GameSession.Clue(
                session.getCurrentTurn(),
                "LOGISTICS_SOURCED",
                "Logistical blueprints acquired. Logistics sourcing completed."
        ));
        checkUnlockedPhase(session, config);
    }

    private void beginHandover(GameSession session, ScenarioConfig config) {
        if (!session.isFinanceCollected() || !session.isLogisticsCollected()) {
            throw new IllegalStateException("Cannot initiate handover before both finance and logistics are collected.");
        }
        if (session.getHandoverCity() == null) {
            throw new IllegalStateException("No handover city has been allocated yet.");
        }
        if (!session.getSuspectLocation().equals(session.getHandoverCity())) {
            throw new IllegalStateException("Operative must be at the allocated handover city: " + session.getHandoverCity().replace("_", " ").toUpperCase() + " to initiate handover.");
        }
        session.setHandoverTurnsRemaining(3);
        session.setActiveAttackerPhase("HANDOVER");
        session.getDiscoveredClues().add(new GameSession.Clue(
                session.getCurrentTurn(),
                "HANDOVER_INITIATED",
                "Handover protocol initiated at " + session.getSuspectLocation().toUpperCase() + ". Remain here for 3 turns to complete handover."
        ));
    }

    private void checkUnlockedPhase(GameSession session, ScenarioConfig config) {
        if (session.isFinanceCollected() && session.isLogisticsCollected()) {
            session.setActiveAttackerPhase("HANDOVER");
            
            // Choose a random friendly city (HOSTILE_TERRITORY represents Attacker home soil)
            List<String> friendlyCities = config.getNodes().stream()
                    .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                    .map(Node::getId)
                    .collect(Collectors.toList());
            if (friendlyCities.isEmpty()) {
                friendlyCities = config.getNodes().stream().map(Node::getId).collect(Collectors.toList());
            }
            Random rand = new Random();
            String chosenHandoverCity = friendlyCities.get(rand.nextInt(friendlyCities.size()));
            session.setHandoverCity(chosenHandoverCity);

            session.getDiscoveredClues().add(new GameSession.Clue(
                    session.getCurrentTurn(),
                    "HANDOVER_UNLOCKED",
                    "Sourcing completed. Handover site confirmed: " + chosenHandoverCity.replace("_", " ").toUpperCase() + ". Navigate there to initiate handover protocol."
            ));
        }
    }

    private void buildSafehouse(GameSession session, String cityNode, boolean isSecure, ScenarioConfig config) {
        Node node = config.getNodes().stream()
                .filter(n -> n.getId().equals(cityNode))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Node not found: " + cityNode));

        boolean isHome = "HOSTILE_TERRITORY".equals(node.getTerritory()); // For Attacker, hostile territory is home
        int baseCost = isHome ? 50000 : 150000;
        int finalCost = isSecure ? baseCost * 2 : baseCost;

        if (session.getAttackerBudget() < finalCost) {
            throw new IllegalStateException("Insufficient budget to build safehouse in " + cityNode);
        }

        session.setAttackerBudget(session.getAttackerBudget() - finalCost);

        // Attacker creates a hostile safehouse for the Defender. Add with random code or generated.
        Random rand = new Random();
        String code = String.valueOf(100 + rand.nextInt(900));
        
        // Save safehouse in list (owner is HOSTILE as seen by the Defender, i.e. the Attacker)
        session.getSafehouses().add(new GameSession.Safehouse(cityNode, "HOSTILE", "PURCHASED", !isSecure, code));

        if (isSecure) {
            session.getSecureSafehouseTurns().put(cityNode, 5);
            session.getDiscoveredClues().add(new GameSession.Clue(
                    session.getCurrentTurn(),
                    "SAFEHOUSE_EXPOSED",
                    "Alert: Signals intelligence indicates the enemy has created a secure safehouse.",
                    cityNode,
                    "Signals Intelligence"
            ));
        } else {
            session.getDiscoveredClues().add(new GameSession.Clue(
                    session.getCurrentTurn(),
                    "SAFEHOUSE_EXPOSED",
                    "Surveillance report: Operative established a standard safehouse.",
                    cityNode,
                    "Signals Intelligence"
            ));
        }
    }

    private void deployDecoy(GameSession session, String type, String cityNode) {
        int cost = "CCTV".equalsIgnoreCase(type) ? 20000 : 40000;
        if (session.getAttackerBudget() < cost) {
            throw new IllegalStateException("Insufficient budget to deploy decoy " + type);
        }
        session.setAttackerBudget(session.getAttackerBudget() - cost);

        GameSession.ActiveDecoy decoy = new GameSession.ActiveDecoy(type.toUpperCase(), cityNode);
        session.getActiveDecoys().add(decoy);
    }

    private void deployJammer(GameSession session, String cityNode) {
        int cost = 30000;
        if (session.getAttackerBudget() < cost) {
            throw new IllegalStateException("Insufficient budget to deploy Active Jammer");
        }
        session.setAttackerBudget(session.getAttackerBudget() - cost);

        // We can add a specialized active espionage resource representing the jammer
        session.getEspionageResources().add(new GameSession.ActiveResource("ATTACKER_JAMMER", cityNode, 3));
    }

    private void evaluatePermissionRequest(GameSession session, String type, ScenarioConfig config) {
        if ("INFILTRATION".equalsIgnoreCase(type)) {
            // Stage 1 Validation Checklist:
            // Check if Finance & Logistics are cleared and Handover complete
            if (session.isHandoverCompleted()) {
                session.setInfiltrationGoAheadApproved(true);
                session.setActiveAttackerPhase("BORDER_CROSSING");
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "GO_AHEAD_APPROVED",
                        "HQ COMMAND: Infiltration clearance APPROVED. Infiltration routes unlocked. Active patrols and combat team positions updated."
                ));
            } else {
                throw new IllegalStateException("Infiltration request rejected: Sourcing or Handover phases incomplete.");
            }
        } else if ("STRIKE".equalsIgnoreCase(type)) {
            // Stage 2 Validation Checklist:
            // Must have reached target city
            String target = config.getTargetCity();
            if (target.equals(session.getSuspectLocation()) && session.isInfiltrationGoAheadApproved()) {
                session.setStrikeGoAheadApproved(true);
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "GO_AHEAD_APPROVED",
                        "HQ COMMAND: Strike authorization APPROVED. Target locked. Execute strike when ready."
                ));
            } else {
                throw new IllegalStateException("Strike authorization rejected: operative not at target city or infiltration not authorized.");
            }
        }
    }

    private void relocateSuspect(GameSession session, String targetCity, String safehouseCode, ScenarioConfig config) {
        String current = session.getSuspectLocation();
        if (current == null) {
            session.setSuspectLocation(targetCity);
            return;
        }

        // Handle moving between safehouses in the same city (Loopholes lockdowns)
        if (current.equals(targetCity)) {
            boolean safehouseExists = session.getSafehouses().stream()
                    .anyMatch(s -> s.getCityNode().equals(targetCity) && "HOSTILE".equals(s.getOwnerFaction()) && s.getSafehouseCode().equals(safehouseCode));
            if (!safehouseExists) {
                throw new IllegalArgumentException("Cannot relocate to safehouse: Safehouse code " + safehouseCode + " not found in " + targetCity);
            }
            session.setSuspectSafehouseCode(safehouseCode);
            session.getDiscoveredClues().add(new GameSession.Clue(
                    session.getCurrentTurn(),
                    "SAFEHOUSE_ROTATION",
                    "Operative rotated safehouses inside " + targetCity + " to shake surveillance."
            ));
            return;
        }

        // Standard relocation: target must be connected
        Node startNode = config.getNodes().stream().filter(n -> n.getId().equals(current)).findFirst().orElse(null);
        Node endNode = config.getNodes().stream().filter(n -> n.getId().equals(targetCity)).findFirst().orElse(null);

        if (startNode == null || endNode == null) {
            throw new IllegalArgumentException("Invalid node connection.");
        }

        // Validate lockdown (moving into or out of a locked-down city is forbidden)
        boolean isStartLocked = session.getHostilePatrolCities().contains(current) || session.getSurprisePatrolCities().contains(current);
        boolean isEndLocked = session.getHostilePatrolCities().contains(targetCity) || session.getSurprisePatrolCities().contains(targetCity);
        if (isStartLocked || isEndLocked) {
            throw new IllegalStateException("Node connection is blocked: City grid lockdown is active.");
        }

        // If crossing border, must have infiltration approved
        boolean isStartHome = "HOSTILE_TERRITORY".equals(startNode.getTerritory());
        boolean isEndHome = "HOSTILE_TERRITORY".equals(endNode.getTerritory());

        if (isStartHome && !isEndHome && !session.isInfiltrationGoAheadApproved()) {
            throw new IllegalStateException("Cannot cross border: Infiltration Go-Ahead not approved.");
        }

        session.setSuspectLocation(targetCity);

        session.getDiscoveredClues().add(new GameSession.Clue(
                session.getCurrentTurn(),
                "SUSPECT_RELOCATION",
                "Operative relocated to " + targetCity.replace("_", " ").toUpperCase()
        ));

        // Track occupied safehouse code
        if (safehouseCode != null && !safehouseCode.isEmpty()) {
            boolean safehouseExists = session.getSafehouses().stream()
                    .anyMatch(s -> s.getCityNode().equals(targetCity) && "HOSTILE".equals(s.getOwnerFaction()) && s.getSafehouseCode().equals(safehouseCode));
            if (safehouseExists) {
                session.setSuspectSafehouseCode(safehouseCode);
            }
        } else {
            String firstSH = session.getSafehouses().stream()
                    .filter(s -> s.getCityNode().equals(targetCity) && "HOSTILE".equals(s.getOwnerFaction()))
                    .map(GameSession.Safehouse::getSafehouseCode)
                    .findFirst()
                    .orElse(null);
            session.setSuspectSafehouseCode(firstSH);
        }

        // Update activeAttackerPhase status based on new milestones
        if (session.isHandoverCompleted()) {
            if (!session.isInfiltrationGoAheadApproved()) {
                session.setActiveAttackerPhase("HANDOVER");
            }
        } else if (session.isFinanceCollected() && session.isLogisticsCollected()) {
            session.setActiveAttackerPhase("HANDOVER");
        } else if (session.getRequestedFinanceCity() != null && !session.isFinanceCollected()) {
            session.setActiveAttackerPhase("FINANCE_SOURCING");
        } else if (session.getRequestedLogisticsCity() != null && !session.isLogisticsCollected()) {
            session.setActiveAttackerPhase("LOGISTICS_SOURCING");
        } else if (!"BORDER_CROSSING".equals(session.getActiveAttackerPhase()) &&
                   !"EXFILTRATION".equals(session.getActiveAttackerPhase())) {
            session.setActiveAttackerPhase("TRAIL_BREAKING");
        }

        // Heat accumulation: standard relocations add local heat
        int heatIncrease = (isStartHome != isEndHome) ? 30 : 10;
        int currentHeat = session.getCityHeat().getOrDefault(targetCity, 0);
        session.getCityHeat().put(targetCity, Math.min(100, currentHeat + heatIncrease));
    }

    private boolean isHandoverCity(String city, ScenarioConfig config) {
        boolean isHostile = false;
        Node node = config.getNodes().stream().filter(n -> n.getId().equals(city)).findFirst().orElse(null);
        if (node != null) {
            isHostile = "HOSTILE_TERRITORY".equals(node.getTerritory());
        }
        boolean isFinance = config.getFinanceMapping() != null && config.getFinanceMapping().containsKey(city);
        boolean isLogistics = config.getLogisticsMapping() != null && config.getLogisticsMapping().containsKey(city);
        return isHostile && !isFinance && !isLogistics;
    }

    private void executeStrike(GameSession session, ScenarioConfig config) {
        if (!session.isStrikeGoAheadApproved()) {
            throw new IllegalStateException("Strike cannot be executed without Go-Ahead approval.");
        }

        // Primary Target Strike
        if (config.getTargetCity().equals(session.getSuspectLocation())) {
            session.setActiveAttackerPhase("EXFILTRATION");
            session.getDiscoveredClues().add(new GameSession.Clue(
                    session.getCurrentTurn(),
                    "STRIKE_EXECUTED",
                    "💥 CRITICAL IMPACT: Strike successfully executed on Primary Target " + config.getTargetCity().toUpperCase() + "! Exfiltration protocol activated. Get back to home soil undetected."
            ));
        } else {
            // Secondary target strike triggers a partial win immediately
            session.setStatus("SUCCESS");
            session.getDiscoveredClues().add(new GameSession.Clue(
                    session.getCurrentTurn(),
                    "STRIKE_EXECUTED",
                    "💥 IMPACT: Strike executed on Secondary Target. Partial victory achieved. Mission complete."
            ));
        }
    }

    private void activateExfiltration(GameSession session) {
        if (!"EXFILTRATION".equals(session.getActiveAttackerPhase())) {
            session.setActiveAttackerPhase("EXFILTRATION");
        }
    }
}
