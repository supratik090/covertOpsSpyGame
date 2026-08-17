package com.spygame.covertops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.service.DeploymentService;
import com.spygame.covertops.service.GameSessionService;
import com.spygame.covertops.service.HintGenerationService;
import com.spygame.covertops.service.PlayerDefenderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/game")
@CrossOrigin(origins = "*") // Allows calls from local Vite development servers
public class GameSessionController {

    @Autowired
    private GameSessionService sessionService;

    @Autowired
    private PlayerDefenderService defenderService;

    @Autowired
    private HintGenerationService hintService;

    @Autowired
    private DeploymentService deploymentService;

    private final ObjectMapper mapper = new ObjectMapper();

    // POST /api/game/create?scenarioId=operation_silent_edge&playerRole=DEFENDER
    @PostMapping("/create")
    public GameSession createGame(
            @RequestParam String scenarioId,
            @RequestParam(required = false, defaultValue = "DEFENDER") String playerRole,
            jakarta.servlet.http.HttpServletRequest request) {
        String username = (String) request.getAttribute("username");
        return sessionService.createSession(scenarioId, playerRole, username);
    }

    // POST /api/game/create-multiplayer?scenarioId=...&playerRole=...&timerMinutes=5
    @PostMapping("/create-multiplayer")
    public GameSession createMultiplayerGame(
            @RequestParam String scenarioId,
            @RequestParam(required = false, defaultValue = "DEFENDER") String playerRole,
            @RequestParam(required = false, defaultValue = "5") int timerMinutes,
            jakarta.servlet.http.HttpServletRequest request) {
        String username = (String) request.getAttribute("username");
        return sessionService.createMultiplayerSession(scenarioId, playerRole, username, timerMinutes);
    }

    // POST /api/game/join?gameToken=...
    @PostMapping("/join")
    public GameSession joinGame(
            @RequestParam String gameToken,
            jakarta.servlet.http.HttpServletRequest request) {
        String username = (String) request.getAttribute("username");
        UUID sessionId = UUID.fromString(gameToken);
        return sessionService.joinSession(sessionId, username);
    }

    // GET /api/game/scenarios
    @GetMapping("/scenarios")
    public List<ScenarioConfig> getScenarios() {
        return sessionService.getAvailableScenarios();
    }

    // GET /api/game/list
    @GetMapping("/list")
    public List<GameSession> listGames(jakarta.servlet.http.HttpServletRequest request) {
        String username = (String) request.getAttribute("username");
        return sessionService.listSessions(username);
    }

    // DELETE /api/game/{id}
    @DeleteMapping("/{id}")
    public void deleteGame(@PathVariable UUID id) {
        sessionService.deleteSession(id);
    }

    // GET /api/game/{id}
    @GetMapping("/{id}")
    public GameSession getGame(@PathVariable UUID id) {
        return sessionService.getSession(id);
    }

    // POST /api/game/{id}/agent/relocate
    @PostMapping("/{id}/agent/relocate")
    public GameSession relocateAgent(
            @PathVariable UUID id,
            @RequestParam int agentId,
            @RequestParam String targetCity) throws Exception {
        GameSession session = sessionService.getSession(id);
        ScenarioConfig config = loadConfig(session.getScenarioId());
        GameSession updated = defenderService.relocateAgent(session, agentId, targetCity, config);
        return sessionService.saveSession(updated);
    }

    // POST /api/game/{id}/team/relocate
    @PostMapping("/{id}/team/relocate")
    public GameSession relocateTacticalTeam(
            @PathVariable UUID id,
            @RequestParam int teamId,
            @RequestParam String targetCity) throws Exception {
        GameSession session = sessionService.getSession(id);
        ScenarioConfig config = loadConfig(session.getScenarioId());
        GameSession updated = defenderService.relocateTacticalTeam(session, teamId, targetCity, config);
        return sessionService.saveSession(updated);
    }

    // POST /api/game/{id}/agent/task
    @PostMapping("/{id}/agent/task")
    public GameSession assignAgentTask(
            @PathVariable UUID id,
            @RequestParam int agentId,
            @RequestParam String task) {
        GameSession session = sessionService.getSession(id);
        GameSession updated = defenderService.assignAgentTask(session, agentId, task);
        return sessionService.saveSession(updated);
    }

    // POST /api/game/{id}/safehouse/build
    @PostMapping("/{id}/safehouse/build")
    public GameSession buildSafehouse(
            @PathVariable UUID id,
            @RequestParam String cityNode) throws Exception {
        GameSession session = sessionService.getSession(id);
        ScenarioConfig config = loadConfig(session.getScenarioId());
        GameSession updated = defenderService.buildSafehouse(session, cityNode, config);
        return sessionService.saveSession(updated);
    }

    // POST /api/game/{id}/tech/deploy
    @PostMapping("/{id}/tech/deploy")
    public GameSession deployEspionageResource(
            @PathVariable UUID id,
            @RequestParam String type,
            @RequestParam String cityNode) throws Exception {
        GameSession session = sessionService.getSession(id);
        ScenarioConfig config = loadConfig(session.getScenarioId());
        GameSession updated = defenderService.deployEspionageResource(session, type, cityNode, config);
        return sessionService.saveSession(updated);
    }

    // POST /api/game/{id}/end-turn
    // Accepts a JSON payload containing the player's covert team commands and clue assessments for the turn
    @PostMapping("/{id}/end-turn")
    public GameSession endTurn(
            @PathVariable UUID id,
            @RequestBody com.spygame.covertops.model.EndTurnRequest request,
            jakarta.servlet.http.HttpServletRequest servletRequest) {
        String username = (String) servletRequest.getAttribute("username");
        return sessionService.processEndTurn(id, request, username);
    }

    // GET /api/game/{id}/hints
    @GetMapping("/{id}/hints")
    public List<HintGenerationService.Hint> getHints(@PathVariable UUID id) {
        return hintService.generateHints(id);
    }

    // GET /api/game/{id}/replay
    // Exposed only if status is SUCCESS or COMPROMISED (God Mode details)
    @GetMapping("/{id}/replay")
    public Object getReplay(@PathVariable UUID id) {
        GameSession session = sessionService.getSession(id);
        return java.util.Map.of(
            "primaryPlan", (session.getAiMasterPlan() != null && session.getAiMasterPlan().getPrimaryPlan() != null)
                ? session.getAiMasterPlan().getPrimaryPlan() : java.util.List.of(),
            "fallbackPlan", (session.getAiMasterPlan() != null && session.getAiMasterPlan().getFallbackPlan() != null)
                ? session.getAiMasterPlan().getFallbackPlan() : java.util.List.of()
        );
    }

    @PostMapping("/{id}/revert-turn")
    public GameSession revertTurn(@PathVariable UUID id) {
        return sessionService.revertTurn(id);
    }

    // POST /api/game/{id}/deploy
    // Accepts the initial DEFENDER deployment: safehouse cities, agent cities, team cities
    @PostMapping("/{id}/deploy")
    public GameSession commitDeployment(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        java.util.List<String> safehouses = (java.util.List<String>) body.get("safehouses");
        @SuppressWarnings("unchecked")
        Map<String, String> agentDeployments = (Map<String, String>) body.get("agentDeployments");
        @SuppressWarnings("unchecked")
        Map<String, String> teamDeployments = (Map<String, String>) body.get("teamDeployments");
        String droneBaseCity = (String) body.get("droneBaseCity");
        return deploymentService.commitDeployment(id, safehouses, agentDeployments, teamDeployments, droneBaseCity);
    }

    private ScenarioConfig loadConfig(String scenarioId) throws Exception {
        File configFile = new File("../scenarios/" + scenarioId + ".json");
        return mapper.readValue(configFile, ScenarioConfig.class);
    }
}
