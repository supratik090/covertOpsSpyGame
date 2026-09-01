package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.GameSessionRepository;
import com.spygame.covertops.repository.ScenarioConfigRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DeploymentService {

    @Autowired
    private GameSessionRepository repository;

    @Autowired
    private ScenarioConfigRepository scenarioConfigRepository;

    /**
     * Commits the player's initial deployment choices.
     * - Rebuilds defender safehouses from the submitted city list
     * - Sets currentCity for each agent and tactical team
     * - Clears deploymentPending flag so gameplay can begin
     *
     * @param sessionId       ID of the session to deploy into
     * @param safehouses      List of cityIds to place defender safehouses
     * @param agentDeployments  Map of agentId (as String) -> cityId
     * @param teamDeployments   Map of teamId (as String) -> cityId
     * @return Updated and saved GameSession
     */
    public GameSession commitDeployment(UUID sessionId,
                                        List<String> safehouses,
                                        Map<String, String> agentDeployments,
                                        Map<String, String> teamDeployments,
                                        String droneBaseCity) {
        GameSession session = repository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        ScenarioConfig config = session.getScenarioId() != null
                ? scenarioConfigRepository.findById(session.getScenarioId()).orElse(null)
                : null;

        if (!"DEFENDER".equals(session.getPlayerRole())) {
            throw new IllegalStateException("Deployment phase is only available for DEFENDER players.");
        }

        // 1. Rebuild defender safehouses from submitted list
        //    Preserve any existing HOSTILE safehouses (uncovered during setup)
        List<GameSession.Safehouse> updatedSafehouses = new ArrayList<>();
        session.getSafehouses().stream()
                .filter(s -> !"DEFENDER".equals(s.getOwnerFaction()))
                .forEach(updatedSafehouses::add);

        if (safehouses != null) {
            for (String cityId : safehouses) {
                if (cityId != null && !cityId.isBlank()) {
                    updatedSafehouses.add(new GameSession.Safehouse(cityId, "DEFENDER", "DEPLOYED", true));
                }
            }
        }
        session.setSafehouses(updatedSafehouses);

        // 2. Apply agent deployments (with robust fallback so agents are never lost)
        List<GameSession.Agent> agents = session.getAgents();
        if (agents != null && !agents.isEmpty()) {
            for (int i = 0; i < agents.size(); i++) {
                GameSession.Agent agent = agents.get(i);
                String cityId = null;
                if (agentDeployments != null) {
                    cityId = agentDeployments.get(String.valueOf(agent.getId()));
                    if (cityId == null) {
                        cityId = agentDeployments.get(String.valueOf(i + 1));
                    }
                    if (cityId == null) {
                        cityId = agentDeployments.get(String.valueOf(i));
                    }
                }
                if (cityId == null || cityId.isBlank()) {
                    if (safehouses != null && !safehouses.isEmpty()) {
                        cityId = safehouses.get(i % safehouses.size());
                    } else {
                        cityId = "amritsar";
                    }
                }
                agent.setCurrentCity(cityId);
                if (agent.getActiveTask() == null || agent.getActiveTask().isBlank() || "NONE".equalsIgnoreCase(agent.getActiveTask())) {
                    agent.setActiveTask("UNCOVER_SAFEHOUSE");
                }
            }
        }

        // 3. Apply tactical team deployments (with robust fallback so teams are never lost)
        List<GameSession.TacticalTeam> teams = session.getTacticalTeams();
        if (teams != null && !teams.isEmpty()) {
            for (int i = 0; i < teams.size(); i++) {
                GameSession.TacticalTeam team = teams.get(i);
                String cityId = null;
                if (teamDeployments != null) {
                    cityId = teamDeployments.get(String.valueOf(team.getId()));
                    if (cityId == null) {
                        cityId = teamDeployments.get(String.valueOf(i + 1));
                    }
                    if (cityId == null) {
                        cityId = teamDeployments.get(String.valueOf(i));
                    }
                }
                if (cityId == null || cityId.isBlank()) {
                    if (safehouses != null && !safehouses.isEmpty()) {
                        cityId = safehouses.get(i % safehouses.size());
                    } else {
                        cityId = "amritsar";
                    }
                }
                team.setCurrentCity(cityId);
            }
        }

        // 3.5. Place drone base and drones (strictly in HOME_TERRITORY)
        String finalDroneBaseCity = droneBaseCity;
        String firstHomeCity = "amritsar";
        if (config != null && config.getNodes() != null) {
            firstHomeCity = config.getNodes().stream()
                    .filter(n -> "HOME_TERRITORY".equals(n.getTerritory()))
                    .map(com.spygame.covertops.model.Node::getId)
                    .findFirst()
                    .orElse("amritsar");
        }

        if (finalDroneBaseCity == null || finalDroneBaseCity.isBlank()) {
            finalDroneBaseCity = firstHomeCity;
        } else {
            // Verify chosen city is in HOME_TERRITORY
            final String targetCity = finalDroneBaseCity;
            boolean isHome = config != null && config.getNodes() != null && config.getNodes().stream()
                    .anyMatch(n -> n.getId().equalsIgnoreCase(targetCity) && "HOME_TERRITORY".equals(n.getTerritory()));
            if (!isHome) {
                finalDroneBaseCity = firstHomeCity;
            }
        }

        List<String> droneBases = new ArrayList<>();
        droneBases.add(finalDroneBaseCity);
        session.setDroneBases(droneBases);

        if (session.getDrones() != null) {
            for (GameSession.Drone drone : session.getDrones()) {
                drone.setCurrentCity(finalDroneBaseCity);
                drone.setStatus("ACTIVE");
            }
        }

        // 4. Clear deployment pending flag — game can now begin
        session.setDeploymentPending(false);

        return repository.save(session);
    }
}
