package com.spygame.covertops.seeder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.ScenarioConfigRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.concurrent.CompletableFuture;

@Component
public class ScenarioDatabaseSeeder {

    @Autowired
    private ScenarioConfigRepository scenarioRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        System.out.println("HTTP Server is live and serving requests. Initiating background scenario database seeding...");
        CompletableFuture.runAsync(this::seedScenarios);
    }

    public void seedScenarios() {
        String[] candidateDirs = {
            "../scenarios",
            "scenarios",
            "./scenarios",
            System.getProperty("user.dir") + "/scenarios",
            System.getProperty("user.dir") + "/../scenarios"
        };

        boolean foundAny = false;
        java.util.Set<String> processedFiles = new java.util.HashSet<>();

        for (String dirPath : candidateDirs) {
            File scenariosDir = new File(dirPath);
            if (scenariosDir.exists() && scenariosDir.isDirectory()) {
                File[] jsonFiles = scenariosDir.listFiles((dir, name) -> name.endsWith(".json"));
                if (jsonFiles != null && jsonFiles.length > 0) {
                    for (File file : jsonFiles) {
                        if (processedFiles.contains(file.getName())) continue;
                        try {
                            ScenarioConfig config = mapper.readValue(file, ScenarioConfig.class);
                            String sId = config.getScenarioId();
                            scenarioRepository.save(config);
                            processedFiles.add(file.getName());
                            foundAny = true;
                            System.out.println("Seeder Success (Async): Imported scenario '" + sId + "' (" + file.getName() + ") into DB.");
                        } catch (Exception e) {
                            System.err.println("Seeder Error: Failed parsing " + file.getName() + " - " + e.getMessage());
                        }
                    }
                }
            }
        }

        if (!foundAny) {
            System.err.println("Seeder Warning: Could not locate scenarios directory in candidate paths.");
        }
    }
}
