package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.GameSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CombatResolutionService {

    @Autowired
    private GameSessionRepository repository;

    @Autowired
    private SourcingMilestoneService milestoneService;

    public GameSession resolveCovertActions(GameSession session, List<Map<String, Object>> covertActions, PlanStep currentStep, ScenarioConfig config) {
        int currentTurn = session.getCurrentTurn();

        for (Map<String, Object> action : covertActions) {
            String type = (String) action.get("actionType");
            String city = (String) action.get("cityNode");

            Node actionNode = config.getNodes().stream().filter(n -> n.getId().equals(city)).findFirst().orElse(null);
            if (actionNode != null) {
                if (!"HOME_TERRITORY".equals(actionNode.getTerritory())) {
                    if ("TRANSIT_CHECKPOINT".equals(type) || "ROADBLOCK".equals(type) || "CITY_GRID_LOCKDOWN".equals(type) || "LOCKDOWN".equals(type)) {
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                                "Operation " + type + " in " + city + " aborted: City defense is only available in friendly cities."));
                        continue;
                    }
                }
                if ("TRANSIT_CHECKPOINT".equals(type)) {
                    if (!isFriendlyBorderCity(city, config)) {
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                                "Operation " + type + " in " + city + " aborted: Transit checkpoints can only be deployed in friendly cities connected to hostile territory."));
                        continue;
                    }
                }
                if ("STOP_INFILTRATION".equals(type) || "STOP_EXFILTRATION".equals(type)) {
                    if (!isFriendlyBorderCity(city, config)) {
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                                "Operation " + type + " in " + city + " aborted: Border defense is only available in friendly border cities."));
                        continue;
                    }
                }
            }

            int cost = 0;
            if ("FREEZE_FINANCE".equals(type)) cost = 50000;
            else if ("RAID_LOGISTICS".equals(type)) cost = 50000;
            else if ("RAID_SAFEHOUSE".equals(type)) {
                cost = (actionNode != null && "HOSTILE_TERRITORY".equals(actionNode.getTerritory())) ? 150000 : 80000;
            }
            else if ("TRANSIT_CHECKPOINT".equals(type) || "ROADBLOCK".equals(type)) cost = 80000;
            else if ("CITY_GRID_LOCKDOWN".equals(type) || "LOCKDOWN".equals(type)) cost = 100000;
            else if ("STOP_INFILTRATION".equals(type)) cost = 35000;
            else if ("STOP_EXFILTRATION".equals(type)) cost = 40000;

            if (actionNode != null && "HOSTILE_TERRITORY".equals(actionNode.getTerritory()) && !"RAID_SAFEHOUSE".equals(type)) {
                cost *= 2;
            }

            if (session.getBudget() < cost) {
                session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                        "Operation " + type + " in " + city + " cancelled: Insufficient budget."));
                continue;
            }
            session.setBudget(session.getBudget() - cost);

            List<GameSession.AIAttacker> activeAttackersInCity = new ArrayList<>();
            if (session.getAiAttackers() != null) {
                activeAttackersInCity = session.getAiAttackers().stream()
                        .filter(a -> !a.isEliminated() && city.equals(a.getCurrentLocation()))
                        .collect(Collectors.toList());
            }
            boolean isSuspectAtRaid = !activeAttackersInCity.isEmpty();

            if ("RAID_SAFEHOUSE".equals(type)) {
                String targetCode = action.containsKey("targetSafehouseCode") ? (String) action.get("targetSafehouseCode") : "";
                int teamId = action.containsKey("teamId") ? (Integer) action.get("teamId") : 1;
                GameSession.TacticalTeam team = session.getTacticalTeams().stream()
                        .filter(t -> t.getId() == teamId)
                        .findFirst()
                        .orElse(null);

                GameSession.Safehouse targetSH = null;
                boolean isCorrectCode = true;
                if (targetCode == null || targetCode.trim().isEmpty()) {
                    targetSH = session.getSafehouses().stream()
                            .filter(s -> s.getCityNode().equals(city) && "HOSTILE".equals(s.getOwnerFaction()))
                            .findFirst()
                            .orElse(null);
                } else {
                    targetSH = session.getSafehouses().stream()
                            .filter(s -> s.getCityNode().equals(city) && "HOSTILE".equals(s.getOwnerFaction()) && targetCode.equals(s.getSafehouseCode()))
                            .findFirst()
                            .orElse(null);
                    if (targetSH == null) {
                        isCorrectCode = false;
                    }
                }

                if (isCorrectCode && targetSH != null) {
                    session.getSafehouses().remove(targetSH);
                }

                if (isSuspectAtRaid && isCorrectCode) {
                    boolean isSecure = (targetSH != null) && targetSH.isSecure();
                    java.util.Random rand = new java.util.Random();
                    int roll = rand.nextInt(100);
                    int combatSkill = team != null ? team.getSkills().getOrDefault("combat", 50) : 50;

                    boolean raidSuccess = false;
                    if (isSecure) {
                        raidSuccess = rand.nextInt(100) < 50;
                    } else {
                        raidSuccess = (roll <= combatSkill || session.isSuspectEscapedBefore());
                    }

                    List<GameSession.AIAttacker> killedList = new ArrayList<>();
                    List<GameSession.AIAttacker> escapedList = new ArrayList<>();

                    List<GameSession.AIAttacker> shAttackers = new ArrayList<>(activeAttackersInCity);
                    Collections.shuffle(shAttackers, rand);

                    if (raidSuccess) {
                        int count = shAttackers.size();
                        int toKill = 0;
                        if (count == 1) {
                            toKill = (rand.nextInt(100) < 80) ? 1 : 0;
                        } else if (count == 2) {
                            int r = rand.nextInt(100);
                            if (r < 80) toKill = 1;
                            else if (r < 90) toKill = 0;
                            else toKill = 2;
                        } else if (count >= 3) {
                            toKill = 2;
                        }

                        for (int i = 0; i < count; i++) {
                            GameSession.AIAttacker att = shAttackers.get(i);
                            if (i < toKill) {
                                att.setEliminated(true);
                                att.setState("Lost");
                                killedList.add(att);
                            } else {
                                att.setHealingTurnsRemaining(5);
                                att.setState("Healing");
                                relocateSurvivingAttacker(session, att, config);
                                escapedList.add(att);
                            }
                        }
                    } else {
                        // All escape
                        for (GameSession.AIAttacker att : shAttackers) {
                            att.setHealingTurnsRemaining(5);
                            att.setState("Healing");
                            relocateSurvivingAttacker(session, att, config);
                            escapedList.add(att);
                        }
                    }

                    // Check game over
                    boolean allEliminated = session.getAiAttackers().stream().allMatch(GameSession.AIAttacker::isEliminated);
                    if (allEliminated) {
                        GameSession.applyDefenderVictoryStatus(session);
                    }

                    // Log outcomes
                    String typeStr = isSecure ? "High-Security Secure Safehouse" : "Hostile Safehouse";
                    if (killedList.size() > 0 && escapedList.isEmpty()) {
                        String names = killedList.stream().map(GameSession.AIAttacker::getName).collect(Collectors.joining(", "));
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                "COMBAT SUCCESS! " + typeStr + " [" + targetCode + "] was destroyed. Threat agents (" + names + ") were cornered and neutralized by " + (team != null ? team.getName() : "Vanguard Unit") + " in " + city.toUpperCase() + ". " + (allEliminated ? "All threats neutralized. Victory achieved!" : "Other threat agents are still in play!")));
                    } else if (killedList.size() > 0 && escapedList.size() > 0) {
                        String kNames = killedList.stream().map(GameSession.AIAttacker::getName).collect(Collectors.joining(", "));
                        String eNames = escapedList.stream().map(GameSession.AIAttacker::getName).collect(Collectors.joining(", "));
                        
                        // Escaped attackers lose all finance and logistics collected — must restart sourcing
                        for (GameSession.AIAttacker escaped : escapedList) {
                            escaped.setFinanceCollected(false);
                            escaped.setLogisticsCollected(false);
                            escaped.setRequestedFinanceCity(null);
                            escaped.setFinanceCollectionTurnsRemaining(-1);
                            escaped.setRequestedLogisticsCity(null);
                            escaped.setLogisticsCollectionTurnsRemaining(-1);
                            escaped.setHandoverCompleted(false);
                            escaped.setHandoverCity(null);
                            escaped.setHandoverTurnsRemaining(-1);
                            escaped.setPermissionToCrossBorderApproved(false);
                            escaped.setPermissionToEngageApproved(false);
                            escaped.setState("Initial decoy");
                        }
                        session.setSuspectEscapedBefore(true);
                        session.setCurrentTurn(Math.max(1, session.getCurrentTurn() - 10));

                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                "COMBAT ENGAGEMENT: " + typeStr + " [" + targetCode + "] in " + city.toUpperCase() + " was destroyed by " + (team != null ? team.getName() : "Vanguard Unit") + ". Threat agents (" + kNames + ") were neutralized, but (" + eNames + ") escaped the dragnet and entered a 5-turn lockout. Any finance or logistics collected has been lost and must be re-sourced."));
                    } else {
                        // All escaped
                        String eNames = escapedList.stream().map(GameSession.AIAttacker::getName).collect(Collectors.joining(", "));

                        // Escaped attackers lose all finance and logistics collected — must restart sourcing
                        for (GameSession.AIAttacker escaped : escapedList) {
                            escaped.setFinanceCollected(false);
                            escaped.setLogisticsCollected(false);
                            escaped.setRequestedFinanceCity(null);
                            escaped.setFinanceCollectionTurnsRemaining(-1);
                            escaped.setRequestedLogisticsCity(null);
                            escaped.setLogisticsCollectionTurnsRemaining(-1);
                            escaped.setHandoverCompleted(false);
                            escaped.setHandoverCity(null);
                            escaped.setHandoverTurnsRemaining(-1);
                            escaped.setPermissionToCrossBorderApproved(false);
                            escaped.setPermissionToEngageApproved(false);
                            escaped.setState("Initial decoy");
                        }
                        session.setSuspectEscapedBefore(true);
                        session.setCurrentTurn(Math.max(1, session.getCurrentTurn() - 10));

                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                "COMBAT ENGAGEMENT: " + (team != null ? team.getName() : "Delta Team") + " raided the " + typeStr + " [" + targetCode + "] in " + city.toUpperCase() + ". Safehouse was dismantled. All suspects (" + eNames + ") escaped and are now in a 5-turn lockout. Any finance or logistics collected has been forfeited and must be re-sourced."));
                    }

                    // Apply compromised raid detection if hostile territory
                    if (actionNode != null && "HOSTILE_TERRITORY".equals(actionNode.getTerritory())) {
                        int stealth = team != null ? team.getSkills().getOrDefault("stealth", 50) : 50;
                        if (rand.nextInt(100) > stealth) {
                            if (rand.nextBoolean()) {
                                session.getTacticalTeams().remove(team);
                                session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                        "COMPROMISED RAID: Tactical Team " + (team != null ? team.getName() : "Delta Team") + " was captured in " + city.toUpperCase() + " after the raid."));
                            } else {
                                int currentCityHeat = session.getCityHeat().getOrDefault(city, 0);
                                session.getCityHeat().put(city, Math.min(100, currentCityHeat + 20));
                                session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                        "COMPROMISED RAID: Tactical Team " + (team != null ? team.getName() : "Delta Team") + " was detected in " + city.toUpperCase() + " after the raid. City detection heat increased by +20%."));
                            }
                        }
                        int currentCityHeat = session.getCityHeat().getOrDefault(city, 0);
                        session.getCityHeat().put(city, Math.min(100, currentCityHeat + 40));
                    }
                    // FIX 4: Do NOT return early here — allow the loop to continue so a second
                    // RAID_SAFEHOUSE from a second combat team in the same turn is also processed.
                    continue;
                } else {
                    // Intel breach / empty safehouse or wrong code
                    if (isCorrectCode) {
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                "COMBAT ENGAGEMENT: Tactical Team " + (team != null ? team.getName() : "Delta Team") + " raided hostile safehouse [" + targetCode + "] in " + city.toUpperCase() + ". Safehouse was destroyed. Intel indicates no suspect presence at this location. Target was elsewhere."));
                    } else {
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                "COMBAT ENGAGEMENT: Tactical Team " + (team != null ? team.getName() : "Delta Team") + " raided hostile safehouse [" + targetCode + "] in " + city.toUpperCase() + ". Intel breach! The raided code was empty. Suspect was elsewhere."));
                    }

                    if (team != null) {
                        team.setCooldownRemaining(2);
                    }
                    int currentCityHeat = session.getCityHeat().getOrDefault(city, 0);
                    session.getCityHeat().put(city, Math.min(100, currentCityHeat + 20));
                    // FIX 4: Do NOT return early here — allow loop to continue for subsequent raids.
                    continue;
                }
            }

            boolean isFinanceLogisticsMatch = false;
            if ("FREEZE_FINANCE".equals(type)) {
                if (session.isMultiplayer()) {
                    isFinanceLogisticsMatch = city.equals(session.getRequestedFinanceCity());
                } else {
                    isFinanceLogisticsMatch = currentStep != null && city.equals(currentStep.getFinanceCity());
                }
            } else if ("RAID_LOGISTICS".equals(type)) {
                if (session.isMultiplayer()) {
                    isFinanceLogisticsMatch = city.equals(session.getRequestedLogisticsCity());
                } else {
                    isFinanceLogisticsMatch = currentStep != null && city.equals(currentStep.getLogisticsCity());
                }
            }

            if (isFinanceLogisticsMatch) {
                if (session.isMultiplayer()) {
                    if ("FREEZE_FINANCE".equals(type)) {
                        session.setRequestedFinanceCity(null);
                        session.setFinanceCollectionTurnsRemaining(0);
                        session.setFinanceCollected(false);
                        session.setActiveAttackerPhase("FINANCE_SOURCING");
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                                "FREEZE FINANCE: Defender has frozen the finance pipeline of suspect " + session.getActualAttacker() + " in " + city.toUpperCase() + "! Sourcing defeated. You must request finance in a different city."));
                    } else {
                        session.setRequestedLogisticsCity(null);
                        session.setLogisticsCollectionTurnsRemaining(0);
                        session.setLogisticsCollected(false);
                        session.setActiveAttackerPhase("LOGISTICS_SOURCING");
                        session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                                "RAID LOGISTICS: Defender has raided the logistics cache of suspect " + session.getActualAttacker() + " in " + city.toUpperCase() + "! Sourcing defeated. You must request logistics in a different city."));
                    }
                } else {
                    milestoneService.reallocateAiSourcing(session, city, "FREEZE_FINANCE".equals(type), config);
                    session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                            "OPERATION SUCCESS: Defender " + type + " in " + city.toUpperCase() + " disrupted the suspect " + session.getActualAttacker() + "'s sourcing. Attacker plan defeated, forcing resource re-allocation."));
                }
                continue;
            }

            if ("FREEZE_FINANCE".equals(type) || "RAID_LOGISTICS".equals(type)) {
                session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                        "OPERATION UPDATE: Defender " + type + " in " + city.toUpperCase() + " completed. No hostile sourcing activity was detected at this node."));
                continue;
            }

            boolean isMatch = false;
            if (("ROADBLOCK".equals(type) || "TRANSIT_CHECKPOINT".equals(type))) {
                if (session.isMultiplayer()) {
                    isMatch = city.equals(session.getSuspectLocation());
                } else {
                    isMatch = currentStep != null && city.equals(currentStep.getSuspectLocation());
                }
            } else if ("STOP_INFILTRATION".equals(type)) {
                if (session.isMultiplayer()) {
                    isMatch = city.equals(session.getSuspectLocation()) && "BORDER_CROSSING".equals(session.getActiveAttackerPhase());
                } else {
                    isMatch = currentStep != null && city.equals(currentStep.getSuspectLocation()) && currentStep.isSmuggling();
                }
            } else if ("STOP_EXFILTRATION".equals(type)) {
                if (session.isMultiplayer()) {
                    isMatch = city.equals(session.getSuspectLocation()) && "EXFILTRATION".equals(session.getActiveAttackerPhase());
                } else {
                    PlanStep strikeStep = session.getAiMasterPlan().getPrimaryPlan().get(session.getAiMasterPlan().getPrimaryPlan().size() - 1);
                    if (city.equals(strikeStep.getEscapeNode())) {
                        isMatch = true;
                    }
                }
            } else if (("LOCKDOWN".equals(type) || "CITY_GRID_LOCKDOWN".equals(type))) {
                if (session.isMultiplayer()) {
                    final String finalSuspectLoc = session.getSuspectLocation();
                    boolean suspectCurrentlyHere = city.equals(finalSuspectLoc);
                    boolean suspectMovingHere = false;
                    Node suspectNode = config.getNodes().stream().filter(n -> n.getId().equals(finalSuspectLoc)).findFirst().orElse(null);
                    if (suspectNode != null && suspectNode.getConnections() != null) {
                        suspectMovingHere = suspectNode.getConnections().contains(city);
                    }
                    if (suspectCurrentlyHere || suspectMovingHere) {
                        isMatch = true;
                    }
                } else {
                    boolean suspectCurrentlyHere = city.equals(session.getSuspectLocation());
                    if (suspectCurrentlyHere) {
                        isMatch = true;
                    }
                }
            }

            if (isMatch) {
                session.setSuspectEscapedBefore(true);
                session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "COMMAND_CENTER",
                        "Alert! Operative " + session.getActualAttacker() + " path disrupted in " + city.toUpperCase() + ". Sourcing delayed. Timeline extended by 3 turns."));

                List<Node> hostiles = config.getNodes().stream()
                        .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()) && !n.getId().equals(city))
                        .collect(Collectors.toList());
                if (!hostiles.isEmpty()) {
                    session.setSuspectLocation(hostiles.get(new java.util.Random().nextInt(hostiles.size())).getId());
                }
                break;
            } else {
                if (actionNode != null && "HOSTILE_TERRITORY".equals(actionNode.getTerritory())) {
                    int teamId = action.containsKey("teamId") ? (Integer) action.get("teamId") : 1;
                    GameSession.TacticalTeam team = session.getTacticalTeams().stream()
                            .filter(t -> t.getId() == teamId)
                            .findFirst()
                            .orElse(null);
                    int stealth = team != null ? team.getSkills().getOrDefault("stealth", 50) : 50;
                    java.util.Random rand = new java.util.Random();
                    if (rand.nextInt(100) > stealth) {
                        if (rand.nextBoolean()) {
                            session.getTacticalTeams().remove(team);
                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                    "COMPROMISED OPERATION: Tactical Team " + (team != null ? team.getName() : "Delta Team") + " was captured in " + city.toUpperCase() + " during the deployment sweep."));
                        } else {
                            int currentCityHeat = session.getCityHeat().getOrDefault(city, 0);
                            session.getCityHeat().put(city, Math.min(100, currentCityHeat + 20));
                            session.getDiscoveredClues().add(new GameSession.Clue(currentTurn, "TACTICAL_FORCE",
                                    "COMPROMISED OPERATION: Tactical Team " + (team != null ? team.getName() : "Delta Team") + " was detected in " + city.toUpperCase() + " during the deployment sweep. City detection heat increased by +20%."));
                        }
                    }
                    int currentCityHeat = session.getCityHeat().getOrDefault(city, 0);
                    session.getCityHeat().put(city, Math.min(100, currentCityHeat + 20));
                }
            }
        }
        return session;
    }

    private boolean isFriendlyBorderCity(String cityNodeId, ScenarioConfig config) {
        Node node = config.getNodes().stream().filter(n -> n.getId().equals(cityNodeId)).findFirst().orElse(null);
        if (node == null || !"HOME_TERRITORY".equals(node.getTerritory())) {
            return false;
        }
        if (node.getConnections() != null) {
            for (String connId : node.getConnections()) {
                Node connNode = config.getNodes().stream().filter(n -> n.getId().equals(connId)).findFirst().orElse(null);
                if (connNode != null && "HOSTILE_TERRITORY".equals(connNode.getTerritory())) {
                    return true;
                }
            }
        }
        return false;
    }

    private void relocateSurvivingAttacker(GameSession session, GameSession.AIAttacker attacker, ScenarioConfig config) {
        String currentCity = attacker.getCurrentLocation();
        
        // 1. Check if there is another hostile safehouse in the same city
        boolean hasOtherSafehouse = session.getSafehouses().stream()
                .anyMatch(s -> s.getCityNode().equals(currentCity) && "HOSTILE".equals(s.getOwnerFaction()));
        
        if (hasOtherSafehouse) {
            return;
        }
        
        // 2. Flee to connected city
        Node node = config.getNodes().stream()
                .filter(n -> n.getId().equals(currentCity))
                .findFirst()
                .orElse(null);
                
        if (node != null && node.getConnections() != null && !node.getConnections().isEmpty()) {
            List<String> connections = node.getConnections();
            
            // Prefer connection with a hostile safehouse
            String targetCity = connections.stream()
                    .filter(c -> session.getSafehouses().stream().anyMatch(s -> s.getCityNode().equals(c) && "HOSTILE".equals(s.getOwnerFaction())))
                    .findFirst()
                    .orElse(null);
                    
            if (targetCity == null) {
                java.util.Random rand = new java.util.Random();
                targetCity = connections.get(rand.nextInt(connections.size()));
            }
            
            attacker.setCurrentLocation(targetCity);
        }
    }
}
