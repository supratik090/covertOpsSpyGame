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

        return repository.save(session);
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
            if ("HANDOVER".equals(session.getActiveAttackerPhase())) {
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

        // Handle moving between safehouses in the same city
        if (current.equals(targetCity)) {
            // Verify if safehouseCode exists
            boolean safehouseExists = session.getSafehouses().stream()
                    .anyMatch(s -> s.getCityNode().equals(targetCity) && "HOSTILE".equals(s.getOwnerFaction()));
            if (!safehouseExists) {
                throw new IllegalArgumentException("Cannot relocate to safehouse: No hostile safehouses found in " + targetCity);
            }
            // Just move safehouse
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

        // Validate lockdown
        boolean isLockedDown = session.getHostilePatrolCities().contains(targetCity) || session.getSurprisePatrolCities().contains(targetCity);
        if (isLockedDown) {
            throw new IllegalStateException("Node " + targetCity + " is currently in lockdown. Suspect cannot move.");
        }

        // If crossing border, must have infiltration approved
        boolean isStartHome = "HOSTILE_TERRITORY".equals(startNode.getTerritory());
        boolean isEndHome = "HOSTILE_TERRITORY".equals(endNode.getTerritory());

        if (isStartHome && !isEndHome && !session.isInfiltrationGoAheadApproved()) {
            throw new IllegalStateException("Cannot cross border: Infiltration Go-Ahead not approved.");
        }

        session.setSuspectLocation(targetCity);

        // Track sourcing visits
        if (config.getFinanceMapping() != null && config.getFinanceMapping().containsKey(targetCity)) {
            if (!session.getUncoveredFinanceCities().contains(targetCity)) {
                session.getUncoveredFinanceCities().add(targetCity);
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "FINANCE_SOURCED",
                        "Capital acquired. Finance sourcing completed in " + targetCity.toUpperCase() + ".",
                        targetCity,
                        "Cell Logistics"
                ));
            }
        }

        if (config.getLogisticsMapping() != null && config.getLogisticsMapping().containsKey(targetCity)) {
            if (!session.getUncoveredLogisticsCities().contains(targetCity)) {
                session.getUncoveredLogisticsCities().add(targetCity);
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "LOGISTICS_SOURCED",
                        "Logistical blueprints acquired. Logistics sourcing completed in " + targetCity.toUpperCase() + ".",
                        targetCity,
                        "Cell Logistics"
                ));
            }
        }

        // Update activeAttackerPhase status
        boolean financeComplete = config.getFinanceMapping() == null || config.getFinanceMapping().isEmpty() ||
                session.getUncoveredFinanceCities().containsAll(config.getFinanceMapping().keySet());
        boolean logisticsComplete = config.getLogisticsMapping() == null || config.getLogisticsMapping().isEmpty() ||
                session.getUncoveredLogisticsCities().containsAll(config.getLogisticsMapping().keySet());

        if (financeComplete && logisticsComplete && isHandoverCity(targetCity, config)) {
            session.setActiveAttackerPhase("HANDOVER");
            session.getDiscoveredClues().add(new GameSession.Clue(
                    session.getCurrentTurn(),
                    "HANDOVER_ACHIEVED",
                    "Handover achieved in " + targetCity.toUpperCase() + ". Operative is ready to request border infiltration clearance.",
                    targetCity,
                    "Command Dispatch"
            ));
        } else if (!financeComplete && config.getFinanceMapping().containsKey(targetCity)) {
            session.setActiveAttackerPhase("FINANCE_SOURCING");
        } else if (!logisticsComplete && config.getLogisticsMapping().containsKey(targetCity)) {
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
