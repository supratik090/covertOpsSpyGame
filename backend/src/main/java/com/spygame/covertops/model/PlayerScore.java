package com.spygame.covertops.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Document(collection = "player_scores")
public class PlayerScore {
    @Id
    private String username; // Username is the unique ID
    private int totalScore;
    private Map<String, ScenarioScore> scenarioScores = new HashMap<>();

    public PlayerScore() {}

    public PlayerScore(String username) {
        this.username = username;
        this.totalScore = 0;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public int getTotalScore() { return totalScore; }
    public void setTotalScore(int totalScore) { this.totalScore = totalScore; }

    public Map<String, ScenarioScore> getScenarioScores() { return scenarioScores; }
    public void setScenarioScores(Map<String, ScenarioScore> scenarioScores) { this.scenarioScores = scenarioScores; }

    public void recalculateTotalScore() {
        if (scenarioScores == null || scenarioScores.isEmpty()) {
            this.totalScore = 0;
            return;
        }
        this.totalScore = scenarioScores.values().stream()
                .mapToInt(ScenarioScore::getScore)
                .sum();
    }

    public static class ScenarioScore {
        private String scenarioId;
        private int score; // 0 - 100
        private String outcome; // SUCCESS, PARTIAL_DEFENDER_VICTORY
        private int turnsUsed;
        private int maxTurns;
        private int agentsLost;
        private int teamsLost;
        private int budgetRemaining;
        private int startingBudget;
        private LocalDateTime achievedAt;

        public ScenarioScore() {}

        public ScenarioScore(String scenarioId, int score, String outcome, int turnsUsed, int maxTurns,
                             int agentsLost, int teamsLost, int budgetRemaining, int startingBudget) {
            this.scenarioId = scenarioId;
            this.score = score;
            this.outcome = outcome;
            this.turnsUsed = turnsUsed;
            this.maxTurns = maxTurns;
            this.agentsLost = agentsLost;
            this.teamsLost = teamsLost;
            this.budgetRemaining = budgetRemaining;
            this.startingBudget = startingBudget;
            this.achievedAt = LocalDateTime.now();
        }

        public String getScenarioId() { return scenarioId; }
        public void setScenarioId(String scenarioId) { this.scenarioId = scenarioId; }

        public int getScore() { return score; }
        public void setScore(int score) { this.score = score; }

        public String getOutcome() { return outcome; }
        public void setOutcome(String outcome) { this.outcome = outcome; }

        public int getTurnsUsed() { return turnsUsed; }
        public void setTurnsUsed(int turnsUsed) { this.turnsUsed = turnsUsed; }

        public int getMaxTurns() { return maxTurns; }
        public void setMaxTurns(int maxTurns) { this.maxTurns = maxTurns; }

        public int getAgentsLost() { return agentsLost; }
        public void setAgentsLost(int agentsLost) { this.agentsLost = agentsLost; }

        public int getTeamsLost() { return teamsLost; }
        public void setTeamsLost(int teamsLost) { this.teamsLost = teamsLost; }

        public int getBudgetRemaining() { return budgetRemaining; }
        public void setBudgetRemaining(int budgetRemaining) { this.budgetRemaining = budgetRemaining; }

        public int getStartingBudget() { return startingBudget; }
        public void setStartingBudget(int startingBudget) { this.startingBudget = startingBudget; }

        public LocalDateTime getAchievedAt() { return achievedAt; }
        public void setAchievedAt(LocalDateTime achievedAt) { this.achievedAt = achievedAt; }
    }
}
