package com.spygame.covertops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.service.GameSessionService;
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

    private final ObjectMapper mapper = new ObjectMapper();

    // POST /api/game/create?scenarioId=operation_silent_edge
    @PostMapping("/create")
    public GameSession createGame(@RequestParam String scenarioId) {
        return sessionService.createSession(scenarioId);
    }

    // GET /api/game/scenarios
    @GetMapping("/scenarios")
    public List<ScenarioConfig> getScenarios() {
        return sessionService.getAvailableScenarios();
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
            @RequestParam String targetCity) {
        GameSession session = sessionService.getSession(id);
        return defenderService.relocateTacticalTeam(session, teamId, targetCity);
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

    // POST /api/game/{id}/agent/train
    @PostMapping("/{id}/agent/train")
    public GameSession trainAgent(
            @PathVariable UUID id,
            @RequestParam int agentId,
            @RequestParam String skillName) {
        GameSession session = sessionService.getSession(id);
        return defenderService.trainAgent(session, agentId, skillName);
    }

    // POST /api/game/{id}/team/train
    @PostMapping("/{id}/team/train")
    public GameSession trainTacticalTeam(
            @PathVariable UUID id,
            @RequestParam int teamId,
            @RequestParam String skillName) {
        GameSession session = sessionService.getSession(id);
        return defenderService.trainTacticalTeam(session, teamId, skillName);
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
            @RequestBody com.spygame.covertops.model.EndTurnRequest request) {
        return sessionService.processEndTurn(id, request);
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
