package com.spygame.covertops.seeder;

import com.spygame.covertops.model.PlayerScore;
import com.spygame.covertops.model.User;
import com.spygame.covertops.repository.PlayerScoreRepository;
import com.spygame.covertops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.io.File;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

@SpringBootTest
public class LeaderboardSeederRunner {

    static {
        try {
            File envFile = new File(".env");
            if (!envFile.exists()) {
                envFile = new File("../.env");
            }
            if (envFile.exists()) {
                System.out.println("Seeder Info: Loading environment configuration from " + envFile.getAbsolutePath());
                Files.readAllLines(envFile.toPath()).forEach(line -> {
                    line = line.trim();
                    if (!line.isEmpty() && !line.startsWith("#") && line.contains("=")) {
                        int index = line.indexOf("=");
                        String key = line.substring(0, index).trim();
                        String value = line.substring(index + 1).trim();
                        if (value.startsWith("\"") && value.endsWith("\"")) {
                            value = value.substring(1, value.length() - 1);
                        } else if (value.startsWith("'") && value.endsWith("'")) {
                            value = value.substring(1, value.length() - 1);
                        }
                        System.setProperty(key, value);
                    }
                });
            }
        } catch (Exception e) {
            System.err.println("Seeder Error: Failed to parse .env file: " + e.getMessage());
        }
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PlayerScoreRepository playerScoreRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Test
    public void seedLeaderboardAndUsers() {
        System.out.println("=== Starting Leaderboard & User Standalone Seeder ===");

        String defaultPasswordHash = passwordEncoder.encode("test123");

        // 1. marcus_vance (472 PTS)
        seedUserAndScore(
                "marcus_vance",
                "marcus_vance@covertops.io",
                defaultPasswordHash,
                createScenarioScores(
                        entry("operation_silent_edge", 96, "SUCCESS", 4, 25, 0, 0, 3200000, 4000000),
                        entry("assassinate_iran_general", 95, "SUCCESS", 5, 25, 0, 0, 2900000, 4000000),
                        entry("operation_semiconductor_sabotage", 94, "SUCCESS", 6, 25, 0, 0, 2800000, 4000000),
                        entry("operation_cartel_border_strike", 95, "SUCCESS", 5, 25, 0, 0, 3100000, 4000000),
                        entry("asean_defense_operation", 92, "SUCCESS", 7, 25, 0, 0, 2600000, 4000000)
                )
        );

        // 2. Phantom7x (435 PTS)
        seedUserAndScore(
                "Phantom7x",
                "phantom7x@covertops.io",
                defaultPasswordHash,
                createScenarioScores(
                        entry("operation_silent_edge", 90, "SUCCESS", 7, 25, 0, 0, 2800000, 4000000),
                        entry("kidnap_ex_bangladeshi_pm", 88, "SUCCESS", 8, 25, 0, 0, 2500000, 4000000),
                        entry("operation_coastal_thunder", 89, "SUCCESS", 7, 25, 0, 0, 2700000, 4000000),
                        entry("operation_ukraine_oil_strike", 85, "PARTIAL_DEFENDER_VICTORY", 9, 25, 1, 0, 2200000, 4000000),
                        entry("operation_english_channel_strike", 83, "SUCCESS", 10, 25, 0, 1, 2100000, 4000000)
                )
        );

        // 3. Dmitri_B (398 PTS)
        seedUserAndScore(
                "Dmitri_B",
                "dmitri_b@covertops.io",
                defaultPasswordHash,
                createScenarioScores(
                        entry("operation_silent_edge", 84, "SUCCESS", 9, 25, 0, 0, 2400000, 4000000),
                        entry("assassinate_iran_general", 82, "SUCCESS", 10, 25, 0, 0, 2200000, 4000000),
                        entry("operation_semiconductor_sabotage", 79, "PARTIAL_DEFENDER_VICTORY", 11, 25, 1, 0, 1900000, 4000000),
                        entry("asean_defense_operation", 78, "SUCCESS", 11, 25, 0, 1, 1800000, 4000000),
                        entry("operation_cartel_border_strike", 75, "SUCCESS", 12, 25, 1, 0, 1700000, 4000000)
                )
        );

        // 4. tactical_sam (356 PTS)
        seedUserAndScore(
                "tactical_sam",
                "tactical_sam@covertops.io",
                defaultPasswordHash,
                createScenarioScores(
                        entry("operation_silent_edge", 75, "SUCCESS", 12, 25, 1, 0, 1800000, 4000000),
                        entry("operation_coastal_thunder", 74, "SUCCESS", 12, 25, 0, 1, 1700000, 4000000),
                        entry("kidnap_ex_bangladeshi_pm", 71, "PARTIAL_DEFENDER_VICTORY", 13, 25, 1, 1, 1500000, 4000000),
                        entry("operation_ukraine_oil_strike", 68, "SUCCESS", 14, 25, 1, 0, 1400000, 4000000),
                        entry("operation_thunder", 68, "SUCCESS", 14, 25, 1, 0, 1400000, 4000000)
                )
        );

        // 5. Kestrel99 (312 PTS)
        seedUserAndScore(
                "Kestrel99",
                "kestrel99@covertops.io",
                defaultPasswordHash,
                createScenarioScores(
                        entry("operation_silent_edge", 68, "SUCCESS", 14, 25, 1, 0, 1400000, 4000000),
                        entry("assassinate_iran_general", 65, "SUCCESS", 15, 25, 1, 1, 1300000, 4000000),
                        entry("operation_cartel_border_strike", 62, "PARTIAL_DEFENDER_VICTORY", 16, 25, 2, 0, 1100000, 4000000),
                        entry("asean_defense_operation", 60, "SUCCESS", 17, 25, 1, 1, 1000000, 4000000),
                        entry("operation_semiconductor_sabotage", 57, "SUCCESS", 18, 25, 2, 1, 900000, 4000000)
                )
        );

        System.out.println("=== Standalone Leaderboard & User Seeder Completed Successfully ===");
    }

    private void seedUserAndScore(String username, String email, String passwordHash, Map<String, PlayerScore.ScenarioScore> scenarioScores) {
        // Seed or update User
        User user = userRepository.findByUsernameOrEmail(username, email)
                .orElse(new User(username, email, passwordHash));
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(passwordHash);
        userRepository.save(user);
        System.out.println("Seeded User: " + username + " (" + email + ")");

        // Seed or update PlayerScore
        PlayerScore playerScore = playerScoreRepository.findById(username)
                .orElse(new PlayerScore(username));
        playerScore.setScenarioScores(scenarioScores);
        playerScore.recalculateTotalScore();
        playerScoreRepository.save(playerScore);
        System.out.println("Seeded Leaderboard Score for " + username + ": " + playerScore.getTotalScore() + " PTS");
    }

    @SafeVarargs
    private final Map<String, PlayerScore.ScenarioScore> createScenarioScores(Map.Entry<String, PlayerScore.ScenarioScore>... entries) {
        Map<String, PlayerScore.ScenarioScore> map = new HashMap<>();
        for (Map.Entry<String, PlayerScore.ScenarioScore> entry : entries) {
            map.put(entry.getKey(), entry.getValue());
        }
        return map;
    }

    private Map.Entry<String, PlayerScore.ScenarioScore> entry(String scenarioId, int score, String outcome, int turnsUsed, int maxTurns, int agentsLost, int teamsLost, int budgetRemaining, int startingBudget) {
        PlayerScore.ScenarioScore scenarioScore = new PlayerScore.ScenarioScore(
                scenarioId, score, outcome, turnsUsed, maxTurns, agentsLost, teamsLost, budgetRemaining, startingBudget
        );
        return Map.entry(scenarioId, scenarioScore);
    }
}
