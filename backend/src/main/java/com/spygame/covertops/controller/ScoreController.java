package com.spygame.covertops.controller;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.PlayerScore;
import com.spygame.covertops.service.GameSessionService;
import com.spygame.covertops.service.ScoringService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping({"/api/scores", "/api/game/scores"})
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class ScoreController {

    @Autowired
    private ScoringService scoringService;

    @Autowired
    private GameSessionService gameSessionService;

    @GetMapping("/leaderboard")
    public List<PlayerScore> getLeaderboard() {
        return scoringService.getTop5Leaderboard();
    }

    @GetMapping("/me")
    public Map<String, Object> getMyScore(HttpServletRequest request) {
        String username = (String) request.getAttribute("username");
        if (username == null || username.isEmpty()) {
            username = "Anonymous Agent";
        }
        return scoringService.getPlayerRankAndScores(username);
    }

    @GetMapping("/session/{sessionId}")
    public ScoringService.ScoreBreakdown getSessionScore(@PathVariable UUID sessionId) {
        GameSession session = gameSessionService.getSession(sessionId);
        return scoringService.calculateScore(session);
    }
}
