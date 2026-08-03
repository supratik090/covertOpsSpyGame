package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.GameSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.Map;

@Service
public class PlayerDefenderService {

    @Autowired
    private GameSessionRepository repository;

    // Relocates an agent to a target city node.
    // Enforces the safehouse deployment rule: agent can only be sent to cities with active friendly safehouses.
    // Enforces lay-low cooldowns: if agent moves between Home and Hostile territories, cooldown = 2.
    public GameSession relocateAgent(GameSession session, int agentId, String targetCity, ScenarioConfig config) {
        GameSession.Agent agent = session.getAgents().stream()
                .filter(a -> a.getId() == agentId)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Agent not found: " + agentId));

        if (agent.getCooldownRemaining() > 0) {
            throw new IllegalStateException("Agent " + agent.getCodename() + " is currently in cooldown or training lockout.");
        }

        // 1. Enforce friendly safehouse constraint
        boolean safehouseExists = session.getSafehouses().stream()
                .anyMatch(s -> s.getCityNode().equals(targetCity) && "DEFENDER".equals(s.getOwnerFaction()));
        if (!safehouseExists) {
            throw new IllegalArgumentException("Cannot send agent to " + targetCity + ": No active friendly safehouse established.");
        }

        // 2. Check if crossing border to evaluate cooldowns
        Node startNode = config.getNodes().stream().filter(n -> n.getId().equals(agent.getCurrentCity())).findFirst().orElse(null);
        Node endNode = config.getNodes().stream().filter(n -> n.getId().equals(targetCity)).findFirst().orElse(null);

        if (startNode != null && endNode != null && !startNode.getTerritory().equals(endNode.getTerritory())) {
            agent.setCooldownRemaining(2); // Lay low for 2 turns when changing country

            // Border crossing into hostile territory: heat increase + capture risk
            if ("HOSTILE_TERRITORY".equals(endNode.getTerritory())) {
                java.util.Random borderRand = new java.util.Random();
                int currentHeat = session.getCityHeat().getOrDefault(targetCity, 0);
                session.getCityHeat().put(targetCity, Math.min(100, currentHeat + 20));

                if (borderRand.nextDouble() < 0.20) {
                    String agentCity = agent.getCurrentCity();
                    session.getAgents().remove(agent);
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            session.getCurrentTurn(),
                            "BORDER_INCIDENT",
                            "BORDER INCIDENT: Agent " + agent.getCodename() + " was captured during border crossing into " + targetCity.toUpperCase() + ". Operator has been disavowed.",
                            targetCity,
                            "Border Security"
                    ));
                    return repository.save(session);
                }
            }
        } else {
            agent.setCooldownRemaining(1); // Standard same-territory relocation sets 1-turn cooldown
        }

        agent.setCurrentCity(targetCity);
        return repository.save(session);
    }

    // Sets an active task for an agent
    public GameSession assignAgentTask(GameSession session, int agentId, String task) {
        GameSession.Agent agent = session.getAgents().stream()
                .filter(a -> a.getId() == agentId)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Agent not found: " + agentId));

        if (agent.getCooldownRemaining() > 0) {
            throw new IllegalStateException("Agent " + agent.getCodename() + " is locked out due to cooldown/training.");
        }

        agent.setActiveTask(task);
        return repository.save(session);
    }

    // Purchases and builds a new friendly safehouse in a city.
    // Charges $50,000 for friendly territory, and $150,000 for enemy territory.
    public GameSession buildSafehouse(GameSession session, String cityNode, ScenarioConfig config) {

        Node node = config.getNodes().stream()
                .filter(n -> n.getId().equals(cityNode))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Node not found: " + cityNode));

        // Deduct territory cost
        int cost = "HOME_TERRITORY".equals(node.getTerritory()) ? 40000 : 100000;
        if (session.getBudget() < cost) {
            throw new IllegalStateException("Insufficient budget to build safehouse in " + cityNode);
        }

        session.setBudget(session.getBudget() - cost);
        session.getSafehouses().add(new GameSession.Safehouse(cityNode, "DEFENDER", "PURCHASED", true));
        return repository.save(session);
    }

    // Spends budget dynamically based on config to purchase and deploy a tech asset to a node.
    public GameSession deployEspionageResource(GameSession session, String type, String cityNode, ScenarioConfig config) {
        if ("BORDER_GUARD".equals(type) && !isFriendlyBorderCity(cityNode, config)) {
            throw new IllegalArgumentException("Border Guard can only be deployed in friendly border cities.");
        }
        if ("BIOMETRIC_SCAN".equals(type) || "FINANCE_MONITOR".equals(type) || "SIGNAL_JAMMER".equals(type)) {
            Node node = config.getNodes().stream().filter(n -> n.getId().equals(cityNode)).findFirst().orElse(null);
            if (node == null || !"HOME_TERRITORY".equals(node.getTerritory())) {
                throw new IllegalArgumentException(type.replace("_", " ") + " can only be deployed in friendly cities.");
            }
        }

        int cost = 0;
        if (config.getDefensiveAssetCosts() != null && config.getDefensiveAssetCosts().containsKey(type)) {
            cost = config.getDefensiveAssetCosts().get(type);
        } else {
            if ("CCTV".equals(type)) cost = 30000;
            else if ("WIRE_TAP".equals(type)) cost = 20000;
            else if ("PHONE_TAP".equals(type)) cost = 40000;
            else if ("SATELLITE".equals(type)) cost = 80000;
            else if ("FINANCE_MONITOR".equals(type)) cost = 50000;
            else if ("BIOMETRIC_SCAN".equals(type)) cost = 35000;
            else if ("BORDER_GUARD".equals(type)) cost = 40000;
            else if ("SIGNAL_JAMMER".equals(type)) cost = 25000;
            else throw new IllegalArgumentException("Unknown defensive asset type: " + type);
        }

        if (session.getBudget() < cost) {
            throw new IllegalStateException("Insufficient budget to deploy " + type);
        }

        session.setBudget(session.getBudget() - cost);
        int duration = "BORDER_GUARD".equals(type) ? 5 : 0;
        session.getEspionageResources().add(new GameSession.ActiveResource(type, cityNode, duration));
        return repository.save(session);
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

    // Relocates a tactical team to a target city node.
    // Team must not be on cooldown and target city must have a friendly safehouse. Sets 1 turn cooldown.
    // Border crossing into hostile territory incurs +20 heat and a 20% capture risk.
    public GameSession relocateTacticalTeam(GameSession session, int teamId, String targetCity, ScenarioConfig config) {
        GameSession.TacticalTeam team = null;
        for (GameSession.TacticalTeam t : session.getTacticalTeams()) {
            if (t.getId() == teamId) {
                team = t;
                break;
            }
        }
        if (team == null) {
            throw new IllegalArgumentException("Tactical team not found: " + teamId);
        }

        if (team.getCooldownRemaining() > 0) {
            throw new IllegalStateException("Tactical team " + team.getName() + " is currently in cooldown lockout.");
        }

        boolean safehouseExists = false;
        for (GameSession.Safehouse s : session.getSafehouses()) {
            if (s.getCityNode().equals(targetCity) && "DEFENDER".equals(s.getOwnerFaction())) {
                safehouseExists = true;
                break;
            }
        }
        if (!safehouseExists) {
            throw new IllegalArgumentException("Cannot send tactical team to " + targetCity + ": No active friendly safehouse established.");
        }

        // Border crossing detection and capture risk
        String teamCity = team.getCurrentCity();
        Node startNode = config.getNodes().stream().filter(n -> n.getId().equals(teamCity)).findFirst().orElse(null);
        Node endNode = config.getNodes().stream().filter(n -> n.getId().equals(targetCity)).findFirst().orElse(null);

        if (startNode != null && endNode != null && !startNode.getTerritory().equals(endNode.getTerritory())) {
            if ("HOSTILE_TERRITORY".equals(endNode.getTerritory())) {
                java.util.Random borderRand = new java.util.Random();
                int currentHeat = session.getCityHeat().getOrDefault(targetCity, 0);
                session.getCityHeat().put(targetCity, Math.min(100, currentHeat + 20));

                if (borderRand.nextDouble() < 0.20) {
                    session.getTacticalTeams().remove(team);
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            session.getCurrentTurn(),
                            "BORDER_INCIDENT",
                            "BORDER INCIDENT: Tactical Team " + team.getName() + " was captured during border crossing into " + targetCity.toUpperCase() + ". Unit has been disavowed.",
                            targetCity,
                            "Border Security"
                    ));
                    return repository.save(session);
                }
            }
        }

        int cost = "HOSTILE_TERRITORY".equals(endNode != null ? endNode.getTerritory() : "HOME_TERRITORY") ? 80000 : 40000;
        if (session.getBudget() < cost) {
            throw new IllegalStateException("Insufficient budget to relocate tactical team.");
        }

        session.setBudget(session.getBudget() - cost);
        team.setCurrentCity(targetCity);
        team.setCooldownRemaining(1);
        return repository.save(session);
    }
}
