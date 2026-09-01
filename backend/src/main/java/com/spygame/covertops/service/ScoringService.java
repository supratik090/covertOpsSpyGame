package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.PlayerScore;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.PlayerScoreRepository;
import com.spygame.covertops.repository.ScenarioConfigRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ScoringService {

    @Autowired
    private PlayerScoreRepository playerScoreRepository;

    @Autowired
    private ScenarioConfigRepository scenarioConfigRepository;

    public static class ScoreBreakdown {
        private int totalScore;
        private int turnScore;
        private int personnelScore;
        private int budgetScore;
        private int victoryQualityScore;
        private int turnsUsed;
        private int maxTurns;
        private int agentsLost;
        private int initialAgents;
        private int teamsLost;
        private int initialTeams;
        private int budgetRemaining;
        private int startingBudget;
        private String outcome;
        private boolean newPersonalBest;

        public ScoreBreakdown() {}

        public int getTotalScore() { return totalScore; }
        public void setTotalScore(int totalScore) { this.totalScore = totalScore; }

        public int getTurnScore() { return turnScore; }
        public void setTurnScore(int turnScore) { this.turnScore = turnScore; }

        public int getPersonnelScore() { return personnelScore; }
        public void setPersonnelScore(int personnelScore) { this.personnelScore = personnelScore; }

        public int getBudgetScore() { return budgetScore; }
        public void setBudgetScore(int budgetScore) { this.budgetScore = budgetScore; }

        public int getVictoryQualityScore() { return victoryQualityScore; }
        public void setVictoryQualityScore(int victoryQualityScore) { this.victoryQualityScore = victoryQualityScore; }

        public int getTurnsUsed() { return turnsUsed; }
        public void setTurnsUsed(int turnsUsed) { this.turnsUsed = turnsUsed; }

        public int getMaxTurns() { return maxTurns; }
        public void setMaxTurns(int maxTurns) { this.maxTurns = maxTurns; }

        public int getAgentsLost() { return agentsLost; }
        public void setAgentsLost(int agentsLost) { this.agentsLost = agentsLost; }

        public int getInitialAgents() { return initialAgents; }
        public void setInitialAgents(int initialAgents) { this.initialAgents = initialAgents; }

        public int getTeamsLost() { return teamsLost; }
        public void setTeamsLost(int teamsLost) { this.teamsLost = teamsLost; }

        public int getInitialTeams() { return initialTeams; }
        public void setInitialTeams(int initialTeams) { this.initialTeams = initialTeams; }

        public int getBudgetRemaining() { return budgetRemaining; }
        public void setBudgetRemaining(int budgetRemaining) { this.budgetRemaining = budgetRemaining; }

        public int getStartingBudget() { return startingBudget; }
        public void setStartingBudget(int startingBudget) { this.startingBudget = startingBudget; }

        public String getOutcome() { return outcome; }
        public void setOutcome(String outcome) { this.outcome = outcome; }

        public boolean isNewPersonalBest() { return newPersonalBest; }
        public void setNewPersonalBest(boolean newPersonalBest) { this.newPersonalBest = newPersonalBest; }
    }

    public ScoreBreakdown calculateScore(GameSession session) {
        ScenarioConfig config = scenarioConfigRepository.findById(session.getScenarioId()).orElse(null);
        return calculateScore(session, config);
    }

    public ScoreBreakdown calculateScore(GameSession session, ScenarioConfig config) {
        ScoreBreakdown bd = new ScoreBreakdown();
        if (session == null) return bd;

        String status = session.getStatus();
        bd.setOutcome(status);

        // Only DEFENDER wins are scored
        if (!"SUCCESS".equals(status) && !"PARTIAL_DEFENDER_VICTORY".equals(status)) {
            bd.setTotalScore(0);
            return bd;
        }

        int turnsUsed = session.getCurrentTurn();
        int maxTurns = session.getMaxTurns() > 0 ? session.getMaxTurns() : 25;
        bd.setTurnsUsed(turnsUsed);
        bd.setMaxTurns(maxTurns);

        int startingBudget = config != null ? config.getStartingBudget() : 4000000;
        int budgetRemaining = session.getBudget();
        bd.setStartingBudget(startingBudget);
        bd.setBudgetRemaining(budgetRemaining);

        int initialAgents = config != null && config.getAgents() != null ? config.getAgents().size() : 6;
        int survivingAgents = session.getAgents() != null ? session.getAgents().size() : 0;
        int agentsLost = Math.max(0, initialAgents - survivingAgents);
        bd.setInitialAgents(initialAgents);
        bd.setAgentsLost(agentsLost);

        int initialTeams = config != null && config.getTacticalTeams() != null ? config.getTacticalTeams().size() : 4;
        int survivingTeams = session.getTacticalTeams() != null ? session.getTacticalTeams().size() : 0;
        int teamsLost = Math.max(0, initialTeams - survivingTeams);
        bd.setInitialTeams(initialTeams);
        bd.setTeamsLost(teamsLost);

        // 1. Turn Score (30 pts max)
        double turnRatio = (double) Math.max(0, maxTurns - turnsUsed) / (double) maxTurns;
        int turnScore = (int) Math.round(30.0 * turnRatio);
        bd.setTurnScore(turnScore);

        // 2. Personnel Score (35 pts max) — Agents weight 2, Teams weight 1
        double totalPersonnelWeight = (initialAgents * 2.0) + (initialTeams * 1.0);
        double survivingPersonnelWeight = (survivingAgents * 2.0) + (survivingTeams * 1.0);
        double personnelRatio = totalPersonnelWeight > 0 ? (survivingPersonnelWeight / totalPersonnelWeight) : 1.0;
        int personnelScore = (int) Math.round(35.0 * Math.min(1.0, personnelRatio));
        bd.setPersonnelScore(personnelScore);

        // 3. Budget Score (25 pts max)
        double budgetRatio = startingBudget > 0 ? ((double) Math.max(0, budgetRemaining) / (double) startingBudget) : 0;
        int budgetScore = (int) Math.round(25.0 * Math.min(1.0, budgetRatio));
        bd.setBudgetScore(budgetScore);

        // 4. Victory Quality (10 pts max)
        int victoryQualityScore = "SUCCESS".equals(status) ? 10 : 5;
        bd.setVictoryQualityScore(victoryQualityScore);

        int totalScore = Math.min(100, turnScore + personnelScore + budgetScore + victoryQualityScore);
        bd.setTotalScore(totalScore);

        return bd;
    }

    public ScoreBreakdown submitScoreIfWin(GameSession session) {
        ScoreBreakdown breakdown = calculateScore(session);
        if (breakdown.getTotalScore() <= 0) return breakdown;

        String username = session.getOwnerUsername();
        if (username == null || username.trim().isEmpty()) {
            username = "Anonymous Agent";
        }

        PlayerScore playerScore = playerScoreRepository.findById(username)
                .orElse(new PlayerScore(username));

        Map<String, PlayerScore.ScenarioScore> scenarioMap = playerScore.getScenarioScores();
        if (scenarioMap == null) {
            scenarioMap = new HashMap<>();
            playerScore.setScenarioScores(scenarioMap);
        }

        String scenarioId = session.getScenarioId();
        PlayerScore.ScenarioScore existingScore = scenarioMap.get(scenarioId);

        boolean isNewBest = false;
        if (existingScore == null || breakdown.getTotalScore() > existingScore.getScore()) {
            isNewBest = true;
            PlayerScore.ScenarioScore newScore = new PlayerScore.ScenarioScore(
                    scenarioId,
                    breakdown.getTotalScore(),
                    breakdown.getOutcome(),
                    breakdown.getTurnsUsed(),
                    breakdown.getMaxTurns(),
                    breakdown.getAgentsLost(),
                    breakdown.getTeamsLost(),
                    breakdown.getBudgetRemaining(),
                    breakdown.getStartingBudget()
            );
            scenarioMap.put(scenarioId, newScore);
            playerScore.recalculateTotalScore();
            playerScoreRepository.save(playerScore);
        }

        breakdown.setNewPersonalBest(isNewBest);
        return breakdown;
    }

    public List<PlayerScore> getTop5Leaderboard() {
        return playerScoreRepository.findTop5ByOrderByTotalScoreDesc();
    }

    public Map<String, Object> getPlayerRankAndScores(String username) {
        Map<String, Object> response = new HashMap<>();
        if (username == null || username.trim().isEmpty()) {
            username = "Anonymous Agent";
        }

        List<PlayerScore> allScores = playerScoreRepository.findAllByOrderByTotalScoreDesc();
        int rank = 0;
        PlayerScore userScoreDoc = null;

        for (int i = 0; i < allScores.size(); i++) {
            if (allScores.get(i).getUsername().equalsIgnoreCase(username)) {
                rank = i + 1;
                userScoreDoc = allScores.get(i);
                break;
            }
        }

        if (userScoreDoc == null) {
            userScoreDoc = new PlayerScore(username);
        }

        response.put("username", username);
        response.put("globalRank", rank > 0 ? rank : allScores.size() + 1);
        response.put("totalScore", userScoreDoc.getTotalScore());
        response.put("scenarioScores", userScoreDoc.getScenarioScores());
        return response;
    }
}
