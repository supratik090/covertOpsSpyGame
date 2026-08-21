package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.EndTurnRequest;
import com.spygame.covertops.model.ScenarioConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.HashSet;

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

        // 1.5. Apply drone base builds
        if (request.getDroneBasesToBuild() != null) {
            for (String cityNode : request.getDroneBasesToBuild()) {
                try {
                    session = defenderService.buildDroneBase(session, cityNode, config);
                } catch (Exception e) {
                    System.err.println("Failed drone base build: " + e.getMessage());
                }
            }
        }

        // 1.55. Apply drone purchases
        if (request.getDronesToBuy() != null) {
            for (Map<String, Object> buyReq : request.getDronesToBuy()) {
                try {
                    String cityNode = (String) buyReq.get("cityNode");
                    String type = (String) buyReq.get("type");
                    if (cityNode != null) {
                        session = defenderService.buyDrone(session, cityNode, type, config);
                    }
                } catch (Exception e) {
                    System.err.println("Failed drone purchase: " + e.getMessage());
                }
            }
        }

        // 1.6. Apply drone deployments
        if (request.getDroneDeployments() != null) {
            for (Map.Entry<Integer, String> entry : request.getDroneDeployments().entrySet()) {
                try {
                    int droneId = entry.getKey();
                    String targetBase = entry.getValue();
                    GameSession.Drone drone = session.getDrones().stream()
                            .filter(d -> d.getId() == droneId)
                            .findFirst()
                            .orElse(null);
                    if (drone != null) {
                        if (session.getDroneBases() != null && session.getDroneBases().contains(targetBase)) {
                            // Check capacity limit of 2 drones per base
                            long dronesAtTarget = session.getDrones().stream()
                                    .filter(d -> d.getId() != droneId && targetBase.equalsIgnoreCase(d.getCurrentCity()) && !"SHOT_DOWN".equalsIgnoreCase(d.getStatus()))
                                    .count();
                            if (dronesAtTarget < 2) {
                                drone.setCurrentCity(targetBase);
                                if ("RESERVE".equals(drone.getStatus())) {
                                    drone.setStatus("ACTIVE");
                                }
                                drone.setAssignedActionType(null);
                                drone.setAssignedTargetCity(null);
                            } else {
                                System.err.println("Cannot deploy drone " + droneId + " to " + targetBase + ": Maximum capacity of 2 drones reached.");
                            }
                        } else {
                            System.err.println("Cannot deploy drone " + droneId + " to " + targetBase + ": No drone base exists.");
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Failed drone deployment: " + e.getMessage());
                }
            }
        }

        // 1.7. Apply persistent drone operations
        if (request.getDroneOperations() != null) {
            Set<Integer> specifiedDroneIds = new HashSet<>();
            for (Map<String, Object> op : request.getDroneOperations()) {
                try {
                    Integer droneIdObj = (Integer) op.get("droneId");
                    if (droneIdObj != null) {
                        specifiedDroneIds.add(droneIdObj);
                        String actionType = (String) op.get("actionType");
                        String targetCity = (String) op.get("targetCity");
                        GameSession.Drone drone = session.getDrones().stream()
                                .filter(d -> d.getId() == droneIdObj)
                                .findFirst()
                                .orElse(null);
                        if (drone != null && "ACTIVE".equals(drone.getStatus())) {
                            drone.setAssignedActionType(actionType);
                            drone.setAssignedTargetCity(targetCity);
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Failed drone operation setting: " + e.getMessage());
                }
            }
            // Clear assigned ops for active drones explicitly omitted by player in UI
            if (session.getDrones() != null) {
                for (GameSession.Drone drone : session.getDrones()) {
                    if ("ACTIVE".equals(drone.getStatus()) && !specifiedDroneIds.contains(drone.getId())) {
                        drone.setAssignedActionType(null);
                        drone.setAssignedTargetCity(null);
                    }
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
