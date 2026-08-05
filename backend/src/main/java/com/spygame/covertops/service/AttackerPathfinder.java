package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.ScenarioConfig;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class AttackerPathfinder {

    public String findOptimalPathNode(GameSession.AIAttacker attacker, GameSession session, String currentLoc, String targetDest, ScenarioConfig config, int turnsRemaining) {
        boolean isCurrentLocked = session.getHostilePatrolCities().contains(currentLoc) || session.getSurprisePatrolCities().contains(currentLoc);
        if (isCurrentLocked) {
            return currentLoc;
        }

        Node currentNode = getNode(currentLoc, config);
        if (currentNode == null || currentNode.getConnections() == null || currentNode.getConnections().isEmpty()) {
            return currentLoc;
        }

        List<String> options = currentNode.getConnections();
        String bestOption = null;
        double lowestThreat = Double.MAX_VALUE;

        for (String nextCity : options) {
            boolean isTargetLocked = session.getHostilePatrolCities().contains(nextCity) || session.getSurprisePatrolCities().contains(nextCity);
            if (isTargetLocked) {
                continue;
            }

            Node startNode = getNode(currentLoc, config);
            Node endNode = getNode(nextCity, config);
            if (startNode != null && endNode != null && !startNode.getTerritory().equals(endNode.getTerritory())) {
                if (!attacker.isPermissionToCrossBorderApproved()) {
                    continue;
                }
            }

            double threat = getThreatScore(attacker, session, nextCity, targetDest, config, turnsRemaining);
            if (threat < lowestThreat) {
                lowestThreat = threat;
                bestOption = nextCity;
            }
        }
        return bestOption != null ? bestOption : currentLoc;
    }

    public double getThreatScore(GameSession.AIAttacker attacker, GameSession session, String city, String destination, ScenarioConfig config, int turnsRemaining) {
        double score = 0.0;

        int dist = getShortestDistance(city, destination, config);
        score += dist * 50.0;

        if (turnsRemaining <= dist + 2) {
            score += dist * 1000.0;
        }

        boolean isLockedDown = session.getHostilePatrolCities().contains(city) || session.getSurprisePatrolCities().contains(city);
        if (isLockedDown) {
            score += 1500.0;
        }

        int heat = session.getCityHeat().getOrDefault(city, 0);
        score += heat * 2.0;

        boolean hasScanners = false;
        if (session.getEspionageResources() != null) {
            hasScanners = session.getEspionageResources().stream()
                    .anyMatch(r -> r.getCityNode().equals(city));
        }
        if (hasScanners) {
            score += 150.0;
        }

        boolean hasSH = session.getSafehouses().stream()
                .anyMatch(s -> s.getCityNode().equals(city) && "HOSTILE".equals(s.getOwnerFaction()));
        if (hasSH) {
            score -= 60.0;
        }

        // Spreading penalty: check if another active attacker is in this city
        boolean otherAttackerPresent = session.getAiAttackers().stream()
                .anyMatch(a -> !a.getName().equals(attacker.getName()) && !a.isEliminated() && city.equals(a.getCurrentLocation()));
        if (otherAttackerPresent) {
            score += 500.0;
        }

        return score;
    }

    public int getShortestDistance(String start, String end, ScenarioConfig config) {
        if (start.equals(end)) return 0;
        Queue<String> queue = new LinkedList<>();
        Map<String, Integer> distMap = new HashMap<>();
        queue.add(start);
        distMap.put(start, 0);

        while (!queue.isEmpty()) {
            String curr = queue.poll();
            int currDist = distMap.get(curr);
            if (curr.equals(end)) return currDist;

            Node node = getNode(curr, config);
            if (node != null && node.getConnections() != null) {
                for (String conn : node.getConnections()) {
                    if (!distMap.containsKey(conn)) {
                        distMap.put(conn, currDist + 1);
                        queue.add(conn);
                    }
                }
            }
        }
        return 99;
    }

    public Node getNode(String id, ScenarioConfig config) {
        return config.getNodes().stream()
                .filter(n -> n.getId().equals(id))
                .findFirst()
                .orElse(null);
    }
}
