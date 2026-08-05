package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.EndTurnRequest;
import com.spygame.covertops.model.ScenarioConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class DefenderActionService {

    @Autowired
    private PlayerDefenderService defenderService;

    public GameSession applyDefenderActions(GameSession session, EndTurnRequest request, ScenarioConfig config) {
        // 1. Apply safehouse builds first so relocations/deployments can target them
        if (request.getSafehouseBuilds() != null) {
            for (String cityNode : request.getSafehouseBuilds()) {
                try {
                    session = defenderService.buildSafehouse(session, cityNode, config);
                } catch (Exception e) {
                    System.err.println("Failed safehouse build: " + e.getMessage());
                }
            }
        }

        // 2. Apply tech deployments next
        if (request.getTechDeployments() != null) {
            for (Map<String, String> deploy : request.getTechDeployments()) {
                try {
                    String type = deploy.get("type");
                    String cityNode = deploy.get("cityNode");
                    session = defenderService.deployEspionageResource(session, type, cityNode, config);
                } catch (Exception e) {
                    System.err.println("Failed tech deployment: " + e.getMessage());
                }
            }
        }

        // 3. Apply agent relocations now that target safehouses are established
        if (request.getAgentRelocations() != null) {
            for (Map.Entry<Integer, String> entry : request.getAgentRelocations().entrySet()) {
                try {
                    session = defenderService.relocateAgent(session, entry.getKey(), entry.getValue(), config);
                } catch (Exception e) {
                    System.err.println("Failed agent relocation: " + e.getMessage());
                }
            }
        }

        // 4. Apply tactical team relocations
        if (request.getTeamRelocations() != null) {
            for (Map.Entry<Integer, String> entry : request.getTeamRelocations().entrySet()) {
                try {
                    session = defenderService.relocateTacticalTeam(session, entry.getKey(), entry.getValue(), config);
                } catch (Exception e) {
                    System.err.println("Failed team relocation: " + e.getMessage());
                }
            }
        }

        // 5. Apply task assignments
        if (request.getAgentTasks() != null) {
            for (Map.Entry<Integer, String> entry : request.getAgentTasks().entrySet()) {
                try {
                    session = defenderService.assignAgentTask(session, entry.getKey(), entry.getValue());
                } catch (Exception e) {
                    System.err.println("Failed agent task assignment: " + e.getMessage());
                }
            }
        }

        // 6. Apply clue assessments submitted in this turn transaction
        if (request.getClueAssessments() != null) {
            for (Map.Entry<Integer, String> entry : request.getClueAssessments().entrySet()) {
                int index = entry.getKey();
                String status = entry.getValue();
                if (index >= 0 && index < session.getDiscoveredClues().size()) {
                    session.getDiscoveredClues().get(index).setAssessment(status);
                }
            }
        }

        return session;
    }
}
