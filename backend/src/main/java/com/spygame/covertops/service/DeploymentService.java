package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.repository.GameSessionRepository;
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
                                        Map<String, String> teamDeployments) {
        GameSession session = repository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (!session.isDeploymentPending()) {
            throw new IllegalStateException("Deployment phase is not active for this session.");
        }
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

        // 2. Apply agent deployments
        if (agentDeployments != null && !agentDeployments.isEmpty()) {
            for (GameSession.Agent agent : session.getAgents()) {
                String cityId = agentDeployments.get(String.valueOf(agent.getId()));
                if (cityId != null && !cityId.isBlank()) {
                    agent.setCurrentCity(cityId);
                }
            }
        }

        // 3. Apply tactical team deployments
        if (teamDeployments != null && !teamDeployments.isEmpty()) {
            for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
                String cityId = teamDeployments.get(String.valueOf(team.getId()));
                if (cityId != null && !cityId.isBlank()) {
                    team.setCurrentCity(cityId);
                }
            }
        }

        // 4. Clear deployment pending flag — game can now begin
        session.setDeploymentPending(false);

        return repository.save(session);
    }
}
