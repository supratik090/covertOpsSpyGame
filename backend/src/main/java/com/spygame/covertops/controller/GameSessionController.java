package com.spygame.covertops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.ScenarioConfig;
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
        return defenderService.relocateAgent(session, agentId, targetCity, config);
    }

    // POST /api/game/{id}/team/relocate
    @PostMapping("/{id}/team/relocate")
    public GameSession relocateTacticalTeam(
            @PathVariable UUID id,
            @RequestParam int teamId,
            @RequestParam String targetCity) throws Exception {
        GameSession session = sessionService.getSession(id);
        ScenarioConfig config = loadConfig(session.getScenarioId());
        return defenderService.relocateTacticalTeam(session, teamId, targetCity, config);
    }

    // POST /api/game/{id}/agent/task
    @PostMapping("/{id}/agent/task")
    public GameSession assignAgentTask(
            @PathVariable UUID id,
            @RequestParam int agentId,
            @RequestParam String task) {
        GameSession session = sessionService.getSession(id);
        return defenderService.assignAgentTask(session, agentId, task);
    }

    // POST /api/game/{id}/safehouse/build
    @PostMapping("/{id}/safehouse/build")
    public GameSession buildSafehouse(
            @PathVariable UUID id,
            @RequestParam String cityNode) throws Exception {
        GameSession session = sessionService.getSession(id);
        ScenarioConfig config = loadConfig(session.getScenarioId());
        return defenderService.buildSafehouse(session, cityNode, config);
    }

    // POST /api/game/{id}/tech/deploy
    @PostMapping("/{id}/tech/deploy")
    public GameSession deployEspionageResource(
            @PathVariable UUID id,
            @RequestParam String type,
            @RequestParam String cityNode) throws Exception {
        GameSession session = sessionService.getSession(id);
        ScenarioConfig config = loadConfig(session.getScenarioId());
        return defenderService.deployEspionageResource(session, type, cityNode, config);
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
        return session.getAiMasterPlan();
    }

    private ScenarioConfig loadConfig(String scenarioId) throws Exception {
        File configFile = new File("../scenarios/" + scenarioId + ".json");
        return mapper.readValue(configFile, ScenarioConfig.class);
    }
}
