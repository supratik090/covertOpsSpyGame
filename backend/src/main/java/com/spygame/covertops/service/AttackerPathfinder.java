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
        boolean isHailMary = turnsRemaining <= 5;
        if ((!isHailMary && isCurrentLocked) || currentLoc.equalsIgnoreCase(targetDest)) {
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
            Node startNode = getNode(currentLoc, config);
            Node endNode = getNode(nextCity, config);
            if (startNode != null && endNode != null && !startNode.getTerritory().equals(endNode.getTerritory())) {
                if (!attacker.isPermissionToCrossBorderApproved()) {
                    continue;
                }
            }

            double threat;
            if (isHailMary) {
                // Hail Mary mode: ignore threats, strictly follow shortest path
                threat = getShortestDistance(nextCity, targetDest, config);
            } else {
                double survival = calculateSurvivalChance(attacker, session, nextCity, config, turnsRemaining);
                double threshold = 0.50;
                if (survival < threshold) {
                    continue;
                }
                threat = getThreatScore(attacker, session, nextCity, targetDest, config, turnsRemaining);
                threat += (1.0 - survival) * 1000.0;
            }

            if (threat < lowestThreat) {
                lowestThreat = threat;
                bestOption = nextCity;
            }
        }
        return bestOption != null ? bestOption : currentLoc;
    }

    public double calculateSurvivalChance(GameSession.AIAttacker attacker, GameSession session, String city, ScenarioConfig config, int turnsRemaining) {
        double survivalChance = 1.0;

        // 1. Detect border patrols (Hostile/Surprise patrols)
        if (session.getHostilePatrolCities() != null && session.getHostilePatrolCities().contains(city)) {
            survivalChance *= 0.60; // 40% risk from warned patrol
        }
        if (session.getSurprisePatrolCities() != null && session.getSurprisePatrolCities().contains(city)) {
            survivalChance *= 0.70; // 30% risk from surprise patrol
        }

        // 2. Detect Border Guards
        boolean hasBorderGuard = false;
        boolean hasOtherScanners = false;
        if (session.getEspionageResources() != null) {
            for (GameSession.ActiveResource res : session.getEspionageResources()) {
                if (res.getCityNode().equals(city)) {
                    if ("BORDER_GUARD".equals(res.getType())) {
                        hasBorderGuard = true;
                    } else {
                        hasOtherScanners = true;
                    }
                }
            }
        }
        if (hasBorderGuard) {
            survivalChance *= 0.75; // 25% risk from border guards
        }

        // 3. Estimated risk of combat teams (positions are NOT visible, but estimated via Heat & Scanners)
        int heat = session.getCityHeat().getOrDefault(city, 0);
        double heatRiskFactor = (heat / 100.0) * 0.30; // Max 30% risk factor at 100% heat
        survivalChance *= (1.0 - heatRiskFactor);

        if (hasOtherScanners) {
            survivalChance *= 0.85; // 15% risk factor if defender has active scanners in city
        }

        return survivalChance;
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
