package com.spygame.covertops.seeder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.ScenarioConfigRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.io.File;

@Component
public class ScenarioDatabaseSeeder implements CommandLineRunner {

    @Autowired
    private ScenarioConfigRepository scenarioRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void run(String... args) throws Exception {
        File scenariosDir = new File("../scenarios");
        
        if (scenariosDir.exists() && scenariosDir.isDirectory()) {
            File[] jsonFiles = scenariosDir.listFiles((dir, name) -> name.endsWith(".json"));
            
            if (jsonFiles != null) {
                for (File file : jsonFiles) {
                    try {
                        ScenarioConfig config = mapper.readValue(file, ScenarioConfig.class);
                        String sId = config.getScenarioId();
                        
                        scenarioRepository.save(config);
                        System.out.println("Seeder Success: Imported/Updated scenario config '" + sId + "' in MongoDB.");
                    } catch (Exception e) {
                        System.err.println("Seeder Error: Failed to parse scenario config from file: " + file.getName() + " - " + e.getMessage());
                    }
                }
            }
        } else {
            System.err.println("Seeder Warning: Scenarios root folder scenarios/ not found at path: " + scenariosDir.getAbsolutePath());
        }
    }
}
