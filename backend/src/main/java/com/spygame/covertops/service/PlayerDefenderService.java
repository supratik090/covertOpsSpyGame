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
        int cost = "HOME_TERRITORY".equals(node.getTerritory()) ? 50000 : 150000;
        if (session.getBudget() < cost) {
            throw new IllegalStateException("Insufficient budget to build safehouse in " + cityNode);
        }

        session.setBudget(session.getBudget() - cost);
        session.getSafehouses().add(new GameSession.Safehouse(cityNode, "DEFENDER", "PURCHASED", true));
        return repository.save(session);
    }

    // Spends $50,000 to increase an agent skill by +10 points. Sets a 1-turn training lockout.
    public GameSession trainAgent(GameSession session, int agentId, String skillName) {
        GameSession.Agent agent = session.getAgents().stream()
                .filter(a -> a.getId() == agentId)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Agent not found: " + agentId));

        if (agent.getCooldownRemaining() > 0) {
            throw new IllegalStateException("Agent is already in a lockout state.");
        }

        int cost = 50000;
        if (session.getBudget() < cost) {
            throw new IllegalStateException("Insufficient budget to train agent.");
        }

        Map<String, Integer> skills = agent.getSkills();
        if (skills == null || !skills.containsKey(skillName)) {
            throw new IllegalArgumentException("Invalid skill type: " + skillName);
        }

        int currentVal = skills.get(skillName);
        skills.put(skillName, Math.min(100, currentVal + 10)); // Caps skill at 100

        session.setBudget(session.getBudget() - cost);
        agent.setCooldownRemaining(1);
        agent.setActiveTask("TRAINING");

        return repository.save(session);
    }

    // Spends $100,000 to increase a tactical team skill by +10 points. Sets a 1-turn lockout.
    public GameSession trainTacticalTeam(GameSession session, int teamId, String skillName) {
        GameSession.TacticalTeam team = session.getTacticalTeams().stream()
                .filter(t -> t.getId() == teamId)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Tactical team not found: " + teamId));

        if (team.getCooldownRemaining() > 0) {
            throw new IllegalStateException("Tactical team is already in a lockout state.");
        }

        int cost = 100000;
        if (session.getBudget() < cost) {
            throw new IllegalStateException("Insufficient budget to train tactical team.");
        }

        Map<String, Integer> skills = team.getSkills();
        if (skills == null || !skills.containsKey(skillName)) {
            throw new IllegalArgumentException("Invalid skill type: " + skillName);
        }

        int currentVal = skills.get(skillName);
        skills.put(skillName, Math.min(100, currentVal + 10)); // Caps skill at 100

        session.setBudget(session.getBudget() - cost);
        team.setCooldownRemaining(1);

        return repository.save(session);
    }

    // Spends budget dynamically based on config to purchase and deploy a tech asset to a node.
    public GameSession deployEspionageResource(GameSession session, String type, String cityNode, ScenarioConfig config) {
        if ("BORDER_GUARD".equals(type) && !isFriendlyBorderCity(cityNode, config)) {
            throw new IllegalArgumentException("Border Guard can only be deployed in friendly border cities.");
        }
        if ("BIOMETRIC_SCAN".equals(type)) {
            Node node = config.getNodes().stream().filter(n -> n.getId().equals(cityNode)).findFirst().orElse(null);
            if (node == null || !"HOME_TERRITORY".equals(node.getTerritory())) {
                throw new IllegalArgumentException("Biometric Scan Grid can only be deployed in friendly cities.");
            }
        }

        int cost = 0;
        if (config.getDefensiveAssetCosts() != null && config.getDefensiveAssetCosts().containsKey(type)) {
            cost = config.getDefensiveAssetCosts().get(type);
        } else {
            if ("BIOMETRIC_SCAN".equals(type)) cost = 45000;
            else if ("BORDER_GUARD".equals(type)) cost = 55000;
            else if ("SIGNAL_JAMMER".equals(type)) cost = 30000;
            else throw new IllegalArgumentException("Unknown defensive asset type: " + type);
        }

        if (session.getBudget() < cost) {
            throw new IllegalStateException("Insufficient budget to deploy " + type);
        }

        session.setBudget(session.getBudget() - cost);
        session.getEspionageResources().add(new GameSession.ActiveResource(type, cityNode, 0));
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
    public GameSession relocateTacticalTeam(GameSession session, int teamId, String targetCity) {
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

        team.setCurrentCity(targetCity);
        team.setCooldownRemaining(1); // Limit movement to once per turn
        return repository.save(session);
    }
}
