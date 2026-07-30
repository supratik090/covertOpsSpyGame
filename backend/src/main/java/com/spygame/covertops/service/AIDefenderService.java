package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.GameSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AIDefenderService {

    @Autowired
    private GameSessionRepository repository;

    private final Random random = new Random();

    public GameSession executeTurn(GameSession session, ScenarioConfig config) {
        if (!"ACTIVE".equals(session.getStatus())) {
            return session;
        }

        // 1. Calculate Heuristic Probability Map
        Map<String, Double> probabilityMap = calculateProbabilityMap(session, config);

        // 2. Find maximum probability city node
        String maxNode = null;
        double maxProb = 0.0;
        for (Map.Entry<String, Double> entry : probabilityMap.entrySet()) {
            if (entry.getValue() > maxProb) {
                maxProb = entry.getValue();
                maxNode = entry.getKey();
            }
        }

        // 3. AI Budget & State Machine Resolution
        int budget = session.getBudget();

        if (maxProb >= 0.8 && maxNode != null) {
            // ASSAULT State: lockdown city and raid
            executeAssault(session, maxNode, config);
        } else if (maxProb >= 0.4 && maxNode != null) {
            // CHASE State: deploy scanners & route combat teams
            executeChase(session, maxNode, config);
        } else {
            // SEARCH State: randomly scatter search resources
            executeSearch(session, config);
        }

        // 4. Tick down secure safehouses and active decoys
        tickDownDurations(session);

        return repository.save(session);
    }

    private Map<String, Double> calculateProbabilityMap(GameSession session, ScenarioConfig config) {
        Map<String, Double> probMap = new HashMap<>();
        for (Node n : config.getNodes()) {
            probMap.put(n.getId(), 0.0);
        }

        // Suspect true location (represented as 1.0)
        String suspectLoc = session.getSuspectLocation();
        if (suspectLoc != null && !suspectLoc.isEmpty() && !suspectLoc.equals("NONE")) {
            probMap.put(suspectLoc, 1.0);
        }

        // Scan alerts set node prob to 1.0
        for (GameSession.Clue clue : session.getDiscoveredClues()) {
            if (clue.getTurnDiscovered() == session.getCurrentTurn() && clue.getCityName() != null) {
                String city = clue.getCityName();
                if (probMap.containsKey(city)) {
                    probMap.put(city, 1.0);
                }
            }
        }

        // Discount probability on active decoys
        for (GameSession.ActiveDecoy decoy : session.getActiveDecoys()) {
            String city = decoy.getCityNode();
            if (probMap.containsKey(city)) {
                // Discount score by 70%
                double current = probMap.get(city);
                probMap.put(city, current * 0.3);
            }
        }

        return probMap;
    }

    private void executeAssault(GameSession session, String targetCity, ScenarioConfig config) {
        // AI locks down city
        if (session.getBudget() >= 100000) {
            session.setBudget(session.getBudget() - 100000);
            session.getSurprisePatrolCities().add(targetCity);
            session.getDiscoveredClues().add(new GameSession.Clue(
                    session.getCurrentTurn(),
                    "GRID_LOCKDOWN",
                    "AI DEFENDER: City Grid LOCKDOWN executed in " + targetCity.toUpperCase() + ". Infiltration lines cut."
            ));
        }

        // Route a tactical team to target city
        GameSession.TacticalTeam team = session.getTacticalTeams().stream()
                .filter(t -> t.getCooldownRemaining() <= 0)
                .findFirst()
                .orElse(null);

        if (team != null && session.getBudget() >= 40000) {
            session.setBudget(session.getBudget() - 40000);
            team.setCurrentCity(targetCity);
            team.setCooldownRemaining(1);
        }

        // Raid safehouses
        List<GameSession.Safehouse> safehouses = session.getSafehouses().stream()
                .filter(s -> s.getCityNode().equals(targetCity) && "HOSTILE".equals(s.getOwnerFaction()))
                .collect(Collectors.toList());

        if (!safehouses.isEmpty() && team != null && session.getBudget() >= 100000) {
            session.setBudget(session.getBudget() - 100000);
            GameSession.Safehouse targetSH = safehouses.get(random.nextInt(safehouses.size()));

            boolean isSuspectPresent = targetCity.equals(session.getSuspectLocation());
            
            // Check if secure safehouse is currently active (prevents discovery/raids)
            boolean isSecure = session.getSecureSafehouseTurns().getOrDefault(targetCity, 0) > 0;

            if (isSuspectPresent && !isSecure) {
                // Suspect captured: Defender Wins
                session.setStatus("COMPROMISED"); // Attacker cell is compromised (Defender wins)
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "TACTICAL_RAID",
                        "DEFENDER COMBAT VICTORY: AI Tactical team successfully raided safehouse [" + targetSH.getSafehouseCode() + "] in " + targetCity.toUpperCase() + ". Attacker operative captured."
                ));
            } else {
                // Setback / empty raid
                session.getDiscoveredClues().add(new GameSession.Clue(
                        session.getCurrentTurn(),
                        "TACTICAL_RAID",
                        "AI Raid on safehouse in " + targetCity.toUpperCase() + " came up empty. Suspect was not inside or safehouse was highly secure."
                ));
            }
        }
    }

    private void executeChase(GameSession session, String suspectedCity, ScenarioConfig config) {
        // Deploy checkpoints / scanners along connected nodes
        if (session.getBudget() >= 30000) {
            session.setBudget(session.getBudget() - 30000);
            session.getEspionageResources().add(new GameSession.ActiveResource("CCTV", suspectedCity, 10));
        }

        // Reposition tactical team to nearby node
        GameSession.TacticalTeam team = session.getTacticalTeams().stream()
                .filter(t -> t.getCooldownRemaining() <= 0)
                .findFirst()
                .orElse(null);

        if (team != null && session.getBudget() >= 40000) {
            session.setBudget(session.getBudget() - 40000);
            // Move adjacent to target node
            Node current = config.getNodes().stream().filter(n -> n.getId().equals(suspectedCity)).findFirst().orElse(null);
            if (current != null && current.getConnections() != null && !current.getConnections().isEmpty()) {
                String nextCity = current.getConnections().get(random.nextInt(current.getConnections().size()));
                team.setCurrentCity(nextCity);
                team.setCooldownRemaining(1);
            }
        }
    }

    private void executeSearch(GameSession session, ScenarioConfig config) {
        // Deploy scanning dragnet
        if (session.getBudget() >= 35000) {
            List<Node> homeNodes = config.getNodes().stream()
                    .filter(n -> "HOME_TERRITORY".equals(n.getTerritory()))
                    .collect(Collectors.toList());
            if (!homeNodes.isEmpty()) {
                session.setBudget(session.getBudget() - 35000);
                String randomHome = homeNodes.get(random.nextInt(homeNodes.size())).getId();
                session.getEspionageResources().add(new GameSession.ActiveResource("BIOMETRIC_SCAN", randomHome, 10));
            }
        }

        // Randomly reposition agents to gather clues
        for (GameSession.Agent agent : session.getAgents()) {
            if (agent.getCooldownRemaining() <= 0 && random.nextDouble() < 0.5) {
                Node randNode = config.getNodes().get(random.nextInt(config.getNodes().size()));
                agent.setCurrentCity(randNode.getId());
                agent.setCooldownRemaining(1);
            }
        }
    }

    private void tickDownDurations(GameSession session) {
        // Ticks down decoy turns remaining
        List<GameSession.ActiveDecoy> decoys = new ArrayList<>();
        for (GameSession.ActiveDecoy d : session.getActiveDecoys()) {
            int left = d.getTurnsRemaining() - 1;
            if (left > 0) {
                d.setTurnsRemaining(left);
                decoys.add(d);
            }
        }
        session.setActiveDecoys(decoys);

        // Ticks down secure safehouse turns
        Map<String, Integer> secureSH = new HashMap<>();
        for (Map.Entry<String, Integer> entry : session.getSecureSafehouseTurns().entrySet()) {
            int left = entry.getValue() - 1;
            if (left > 0) {
                secureSH.put(entry.getKey(), left);
            }
        }
        session.setSecureSafehouseTurns(secureSH);
    }
}
