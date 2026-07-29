package com.spygame.covertops;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import java.io.File;
import java.nio.file.Files;

@SpringBootApplication
public class CovertOpsApplication {
    public static void main(String[] args) {
        // Load environment variables from .env file if available
        try {
            File envFile = new File("../.env");
            if (!envFile.exists()) {
                envFile = new File(".env");
            }
            if (envFile.exists()) {
                System.out.println("Bootstrap Info: Loading environment configuration from " + envFile.getAbsolutePath());
                Files.readAllLines(envFile.toPath()).forEach(line -> {
                    line = line.trim();
                    if (!line.isEmpty() && !line.startsWith("#") && line.contains("=")) {
                        int index = line.indexOf("=");
                        String key = line.substring(0, index).trim();
                        String value = line.substring(index + 1).trim();
                        // Strip surrounding quotes if present
                        if (value.startsWith("\"") && value.endsWith("\"")) {
                            value = value.substring(1, value.length() - 1);
                        } else if (value.startsWith("'") && value.endsWith("'")) {
                            value = value.substring(1, value.length() - 1);
                        }
                        System.setProperty(key, value);
                    }
                });
            } else {
                System.out.println("Bootstrap Warning: No .env configuration file found at root.");
            }
        } catch (Exception e) {
            System.err.println("Bootstrap Error: Failed to parse .env file: " + e.getMessage());
        }

        SpringApplication.run(CovertOpsApplication.class, args);
    }
}
