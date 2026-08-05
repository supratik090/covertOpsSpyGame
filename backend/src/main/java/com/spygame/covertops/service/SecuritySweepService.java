package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.model.ScenarioConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class SecuritySweepService {

    @Autowired
    private SourcingMilestoneService milestoneService;

    public GameSession resolveSecuritySweeps(GameSession session, PlanStep currentStep, ScenarioConfig config) {
        int currentTurn = session.getCurrentTurn();
        java.util.Random rollRand = new java.util.Random();

        // 1. Resolve Warned Sweeps (hostilePatrolCities): Complete loss if present
        if (session.getHostilePatrolCities() != null && !session.getHostilePatrolCities().isEmpty()) {
            List<String> swept = session.getHostilePatrolCities();
            
            // Apprehend agents in swept cities
            List<GameSession.Agent> survivingAgents = new ArrayList<>();
            for (GameSession.Agent agent : session.getAgents()) {
                if (swept.contains(agent.getCurrentCity())) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Agent " + agent.getCodename() + " was caught in a warned security sweep in " + agent.getCurrentCity().toUpperCase() + " and has been disavowed.",
                            agent.getCurrentCity(),
                            "HQ Communications"
                    ));
                } else {
                    survivingAgents.add(agent);
                }
            }
            session.setAgents(survivingAgents);

            // Wipe out tactical teams in swept cities
            List<GameSession.TacticalTeam> survivingTeams = new ArrayList<>();
            for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
                if (swept.contains(team.getCurrentCity())) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Tactical Team " + team.getName() + " was intercepted and neutralized during a warned security sweep in " + team.getCurrentCity().toUpperCase() + ".",
                            team.getCurrentCity(),
                            "HQ Communications"
                    ));
                } else {
                    survivingTeams.add(team);
                }
            }
            session.setTacticalTeams(survivingTeams);

            // Dismantle safehouses in swept cities
            List<GameSession.Safehouse> safehousesLeft = new ArrayList<>();
            for (GameSession.Safehouse sh : session.getSafehouses()) {
                if (swept.contains(sh.getCityNode()) && "DEFENDER".equals(sh.getOwnerFaction())) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Friendly Safehouse in " + sh.getCityNode().toUpperCase() + " was discovered and dismantled by local security forces during a warned sweep.",
                            sh.getCityNode(),
                            "HQ Communications"
                    ));
                } else {
                    safehousesLeft.add(sh);
                }
            }
            session.setSafehouses(safehousesLeft);

            // After warned sweep resolves, set cooldown on swept cities
            if (session.getSweepCooldownCities() == null) {
                session.setSweepCooldownCities(new java.util.HashMap<>());
            }
            for (String sweptCity : swept) {
                session.getSweepCooldownCities().put(sweptCity, 3);
            }
        }

        // 2. Resolve Surprise Sweeps (surprisePatrolCities): 33% chance of capture/destruction for each resource independently
        if (session.getSurprisePatrolCities() != null && !session.getSurprisePatrolCities().isEmpty()) {
            List<String> swept = session.getSurprisePatrolCities();

            // Resolve surprise sweeps for agents
            List<GameSession.Agent> survivingAgents = new ArrayList<>();
            for (GameSession.Agent agent : session.getAgents()) {
                if (swept.contains(agent.getCurrentCity()) && rollRand.nextDouble() < 0.33) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Agent " + agent.getCodename() + " was caught in a surprise security sweep in " + agent.getCurrentCity().toUpperCase() + " and has been disavowed.",
                            agent.getCurrentCity(),
                            "HQ Communications"
                    ));
                } else {
                    survivingAgents.add(agent);
                }
            }
            session.setAgents(survivingAgents);

            // Resolve surprise sweeps for tactical teams
            List<GameSession.TacticalTeam> survivingTeams = new ArrayList<>();
            for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
                if (swept.contains(team.getCurrentCity()) && rollRand.nextDouble() < 0.33) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Tactical Team " + team.getName() + " was intercepted and neutralized during a surprise security sweep in " + team.getCurrentCity().toUpperCase() + ".",
                            team.getCurrentCity(),
                            "HQ Communications"
                    ));
                } else {
                    survivingTeams.add(team);
                }
            }
            session.setTacticalTeams(survivingTeams);

            // Resolve surprise sweeps for safehouses
            List<GameSession.Safehouse> safehousesLeft = new ArrayList<>();
            for (GameSession.Safehouse sh : session.getSafehouses()) {
                if (swept.contains(sh.getCityNode()) && "DEFENDER".equals(sh.getOwnerFaction()) && rollRand.nextDouble() < 0.33) {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            currentTurn,
                            "SECURITY_SWEEP_LOSS",
                            "LOSS REPORT: Friendly Safehouse in " + sh.getCityNode().toUpperCase() + " was discovered and dismantled during a surprise security sweep.",
                            sh.getCityNode(),
                            "HQ Communications"
                    ));
                } else {
                    safehousesLeft.add(sh);
                }
            }
            session.setSafehouses(safehousesLeft);

            // After surprise sweep resolves, set cooldown on swept cities
            if (session.getSweepCooldownCities() == null) {
                session.setSweepCooldownCities(new java.util.HashMap<>());
            }
            for (String sweptCity : swept) {
                session.getSweepCooldownCities().put(sweptCity, 3);
            }
        }

        // 4. Tick down lockout/cooldown timers
        for (GameSession.Agent agent : session.getAgents()) {
            if (agent.getCooldownRemaining() > 0) {
                agent.setCooldownRemaining(agent.getCooldownRemaining() - 1);
                if (agent.getCooldownRemaining() == 0 && "TRAINING".equals(agent.getActiveTask())) {
                    agent.setActiveTask("FIND_SUSPECT");
                }
            }
        }
        for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
            if (team.getCooldownRemaining() > 0) {
                team.setCooldownRemaining(team.getCooldownRemaining() - 1);
            }
        }

        // Update Heat Percentage and COBRA Alert Level
        updateHeatLevel(session, currentStep, config);

        // Update Attacker sourcing and handover timers
        milestoneService.tickAttackerMilestones(session);

        // 5. Advance timeline
        session.setCurrentTurn(currentTurn + 1);

        // Check Defeat / Victory on Turn Limit: if currentTurn exceeds deadline limit
        if (session.getCurrentTurn() > session.getMaxTurns()) {
            if ("DEFENDER".equals(session.getPlayerRole())) {
                session.setStatus("SUCCESS");
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "TACTICAL_FORCE",
                        "DEFENDER VICTORY! Operation successfully defended. Threat cell failed to execute the strike and exfiltrate in time."
                ));
            } else {
                session.setStatus("COMPROMISED");
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "TACTICAL_FORCE",
                        "MISSION FAILURE! Turn limit exceeded before strike execution and exfiltration were completed."
                ));
            }
        }

        // 6. Roll next turn's hostile security sweep targets (Warned Sweeps & Surprise Sweeps)
        rollPatrols(session, config);

        return session;
    }

    public void rollPatrols(GameSession session, ScenarioConfig config) {
        boolean sweepHappened = (session.getHostilePatrolCities() != null && !session.getHostilePatrolCities().isEmpty())
                || (session.getSurprisePatrolCities() != null && !session.getSurprisePatrolCities().isEmpty());

        // Decrement sweep cooldowns and remove expired
        if (session.getSweepCooldownCities() != null) {
            java.util.Map<String, Integer> cooldowns = new java.util.HashMap<>();
            for (java.util.Map.Entry<String, Integer> entry : session.getSweepCooldownCities().entrySet()) {
                int remaining = entry.getValue() - 1;
                if (remaining > 0) {
                    cooldowns.put(entry.getKey(), remaining);
                }
            }
            session.setSweepCooldownCities(cooldowns);
        }

        List<String> nextWarnedPatrols = new ArrayList<>();
        List<String> nextSurprisePatrols = new ArrayList<>();

        if (sweepHappened) {
            session.setHostilePatrolCities(nextWarnedPatrols);
            session.setSurprisePatrolCities(nextSurprisePatrols);
            return;
        }

        java.util.Random sweepRand = new java.util.Random();
        int nextTurn = session.getCurrentTurn();

        List<String> allHostileIds = config.getNodes().stream()
                .filter(n -> "HOSTILE_TERRITORY".equals(n.getTerritory()))
                .map(Node::getId)
                .collect(java.util.stream.Collectors.toList());
        java.util.Set<String> onCooldown = session.getSweepCooldownCities() != null
                ? session.getSweepCooldownCities().keySet() : java.util.Collections.emptySet();
        List<String> eligibleHostileCities = allHostileIds.stream()
                .filter(id -> !onCooldown.contains(id))
                .collect(java.util.stream.Collectors.toList());

        if (!eligibleHostileCities.isEmpty()) {
            List<String> highHeatHostileCities = new ArrayList<>();
            if (session.getCityHeat() != null) {
                for (Map.Entry<String, Integer> entry : session.getCityHeat().entrySet()) {
                    if (entry.getValue() > 50 && eligibleHostileCities.contains(entry.getKey())) {
                        highHeatHostileCities.add(entry.getKey());
                    }
                }
            }

            if (!highHeatHostileCities.isEmpty()) {
                nextWarnedPatrols.addAll(highHeatHostileCities);
            } else {
                double warnedSweepChance = nextTurn <= 8 ? 0.20 : (nextTurn <= 16 ? 0.40 : 0.60);
                int maxWarned = 2;
                if (sweepRand.nextDouble() < warnedSweepChance) {
                    List<String> shuffleHostile = new ArrayList<>(eligibleHostileCities);
                    java.util.Collections.shuffle(shuffleHostile, sweepRand);
                    for (int i = 0; i < Math.min(maxWarned, shuffleHostile.size()); i++) {
                        nextWarnedPatrols.add(shuffleHostile.get(i));
                    }
                }
            }

            double surpriseSweepChance = nextTurn <= 8 ? 0.15 : (nextTurn <= 16 ? 0.30 : 0.45);
            int maxSurprise = nextTurn <= 16 ? 1 : 2;
            if (sweepRand.nextDouble() < surpriseSweepChance) {
                List<String> potentialSurpriseCities = eligibleHostileCities.stream()
                        .filter(id -> !nextWarnedPatrols.contains(id))
                        .collect(java.util.stream.Collectors.toList());
                if (!potentialSurpriseCities.isEmpty()) {
                    java.util.Collections.shuffle(potentialSurpriseCities, sweepRand);
                    for (int i = 0; i < Math.min(maxSurprise, potentialSurpriseCities.size()); i++) {
                        nextSurprisePatrols.add(potentialSurpriseCities.get(i));
                    }
                }
            }
        }

        session.setHostilePatrolCities(nextWarnedPatrols);
        session.setSurprisePatrolCities(nextSurprisePatrols);

        for (String patrolCityId : nextWarnedPatrols) {
            Node patrolNode = config.getNodes().stream()
                    .filter(n -> n.getId().equals(patrolCityId))
                    .findFirst()
                    .orElse(null);
            String patrolCityName = patrolNode != null ? patrolNode.getName() : patrolCityId.toUpperCase();
            session.getDiscoveredClues().add(new GameSession.Clue(
                    session.getCurrentTurn(),
                    "SECURITY_SWEEP_ALERT",
                    "⚠ SWEEP WARNING: Local security forces are planning a raid sweep in " + patrolCityName + " next turn. ASSETS MUST VACATE or face absolute capture/destruction.",
                    patrolCityId,
                    "Field Intercept"
            ));
        }
    }

    private void updateHeatLevel(GameSession session, PlanStep currentStep, ScenarioConfig config) {
        if (currentStep == null && !session.isMultiplayer()) return;

        if (session.getCityHeat() == null) {
            session.setCityHeat(new java.util.HashMap<>());
        }
        for (Node node : config.getNodes()) {
            if ("HOSTILE_TERRITORY".equals(node.getTerritory())) {
                int heat = session.getCityHeat().getOrDefault(node.getId(), 0);
                session.getCityHeat().put(node.getId(), Math.max(0, heat - 10));
            } else {
                session.getCityHeat().put(node.getId(), 0);
            }
        }

        for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
            String teamCity = team.getCurrentCity();
            Node node = config.getNodes().stream().filter(n -> n.getId().equals(teamCity)).findFirst().orElse(null);
            if (node != null && "HOSTILE_TERRITORY".equals(node.getTerritory())) {
                int heat = session.getCityHeat().getOrDefault(teamCity, 0);
                session.getCityHeat().put(teamCity, Math.min(100, heat + 10));
            }
        }

        java.util.Map<String, Integer> agentCounts = new java.util.HashMap<>();
        for (GameSession.Agent agent : session.getAgents()) {
            String agentCity = agent.getCurrentCity();
            Node node = config.getNodes().stream().filter(n -> n.getId().equals(agentCity)).findFirst().orElse(null);
            if (node != null && "HOSTILE_TERRITORY".equals(node.getTerritory())) {
                agentCounts.put(agentCity, agentCounts.getOrDefault(agentCity, 0) + 1);
            }
        }
        for (Map.Entry<String, Integer> entry : agentCounts.entrySet()) {
            int count = entry.getValue();
            if (count >= 2) {
                int extraHeat = 15 * (count - 1);
                int heat = session.getCityHeat().getOrDefault(entry.getKey(), 0);
                session.getCityHeat().put(entry.getKey(), Math.min(100, heat + extraHeat));
            }
        }

        for (GameSession.Agent agent : session.getAgents()) {
            String agentCity = agent.getCurrentCity();
            Node node = config.getNodes().stream().filter(n -> n.getId().equals(agentCity)).findFirst().orElse(null);
            if (node != null && "HOSTILE_TERRITORY".equals(node.getTerritory())) {
                boolean overlap = false;
                for (Map.Entry<String, List<PlanStep>> entry : session.getSuspectPlans().entrySet()) {
                    PlanStep suspectStep = entry.getValue().stream()
                            .filter(s -> s.getTurn() == session.getCurrentTurn())
                            .findFirst()
                            .orElse(null);
                    if (suspectStep != null && agentCity.equals(suspectStep.getSuspectLocation())) {
                        overlap = true;
                        break;
                    }
                }
                if (overlap) {
                    int heat = session.getCityHeat().getOrDefault(agentCity, 0);
                    session.getCityHeat().put(agentCity, Math.min(100, heat + 30));
                }
            }
        }

        int baseHeat = 10;
        String phase = currentStep != null ? currentStep.getPhase() : (session.getActiveAttackerPhase() != null ? session.getActiveAttackerPhase() : "TRAIL_BREAKING");
        String loc = currentStep != null ? currentStep.getSuspectLocation() : session.getSuspectLocation();

        if ("TRAIL_BREAKING".equals(phase) || "FINANCE_SOURCING".equals(phase)) {
            baseHeat = 15;
        } else if ("LOGISTICS_SOURCING".equals(phase) || "HANDOVER".equals(phase)) {
            baseHeat = 30;
        } else if ("BORDER_CROSSING".equals(phase) || (currentStep != null && currentStep.isSmuggling())) {
            baseHeat = 50;
        } else if ("ATTACK_PREP".equals(phase)) {
            if ("new_delhi".equals(loc)) {
                baseHeat = 90;
            } else if ("chandigarh".equals(loc)) {
                baseHeat = 80;
            } else {
                baseHeat = 65;
            }
        } else if ("STRIKE".equals(phase)) {
            baseHeat = 98;
        }

        boolean isPivoted = session.getAiMasterPlan().getFallbackPlan().isEmpty();
        if (isPivoted) {
            baseHeat += 10;
        }

        if (session.isSuspectEscapedBefore()) {
            baseHeat += 15;
        }

        int maxCityHeat = 0;
        for (int h : session.getCityHeat().values()) {
            if (h > maxCityHeat) {
                maxCityHeat = h;
            }
        }
        baseHeat += maxCityHeat / 2;

        int heat = Math.max(0, Math.min(100, baseHeat));
        session.setHeatPercentage(heat);

        if (heat <= 25) {
            session.setCobraAlertLevel("COBRA_5_LOW");
        } else if (heat <= 50) {
            session.setCobraAlertLevel("COBRA_4_GUARDED");
        } else if (heat <= 75) {
            session.setCobraAlertLevel("COBRA_3_ELEVATED");
        } else if (heat <= 90) {
            session.setCobraAlertLevel("COBRA_2_HIGH");
        } else {
            session.setCobraAlertLevel("COBRA_1_SEVERE");
        }
    }
}
