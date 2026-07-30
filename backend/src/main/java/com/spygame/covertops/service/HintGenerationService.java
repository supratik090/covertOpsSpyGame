package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.ScenarioConfig;
import com.spygame.covertops.repository.GameSessionRepository;
import com.spygame.covertops.repository.ScenarioConfigRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class HintGenerationService {

    @Autowired
    private GameSessionRepository repository;

    @Autowired
    private ScenarioConfigRepository scenarioConfigRepository;

    public List<Hint> generateHints(UUID sessionId) {
        GameSession session = repository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found with ID: " + sessionId));

        ScenarioConfig config = scenarioConfigRepository.findById(session.getScenarioId())
                .orElse(null);

        List<Hint> hints = new ArrayList<>();
        int turn = session.getCurrentTurn();
        int maxTurns = session.getMaxTurns();

        // Early game (turns 1-5)
        if (turn <= 5) {
            hints.add(new Hint(
                    "EARLY GAME",
                    "SECURE A FOOTHOLD",
                    "Establish a safehouse in hostile territory as soon as possible. Without a local base, agents and teams operate without cover, increasing detection risk and border crossing peril. Build safehouses via the RESOURCES tab or deploy through the CIA panel on the MAP.",
                    turn
            ));

            long hostileSafehouses = session.getSafehouses().stream()
                    .filter(s -> "HOSTILE_TERRITORY".equals(getTerritory(s.getCityNode(), config)))
                    .count();
            if (hostileSafehouses == 0) {
                hints.add(new Hint(
                        "EARLY GAME",
                        "DEPLOY AGENTS STRATEGICALLY",
                        "Move at least one agent into hostile territory and assign them to GATHER INTELLIGENCE. This reveals suspect footprints and builds your clue deck. Idle agents produce no intel — use the CIA panel on the MAP to assign tasks.",
                        turn
                ));
            }

            hints.add(new Hint(
                    "EARLY GAME",
                    "WATCH YOUR BUDGET",
                    "Starting budget is limited. Prioritize one hostile safehouse ($100K) and one CCTV deployment ($30K) early. Avoid spending all funds on agent relocations.",
                        turn
            ));
        }

        // Mid game (turns 6-15)
        if (turn >= 6 && turn <= 15) {
            boolean hasBiometricScan = session.getEspionageResources().stream()
                    .anyMatch(r -> "BIOMETRIC_SCAN".equals(r.getType()));
            boolean hasCctv = session.getEspionageResources().stream()
                    .anyMatch(r -> "CCTV".equals(r.getType()));
            boolean hasFinanceMonitor = session.getEspionageResources().stream()
                    .anyMatch(r -> "FINANCE_MONITOR".equals(r.getType()));

            if (!hasBiometricScan) {
                hints.add(new Hint(
                        "MID GAME",
                        "DEPLOY BIOMETRIC SCAN",
                        "Biometric scanners in hostile cities double as detection triggers. When a suspect passes through a scanned city, heat spikes +25%, potentially triggering a warned sweep. Place them on high-traffic border cities.",
                        turn
                ));
            }

            if (!hasCctv) {
                hints.add(new Hint(
                        "MID GAME",
                        "CCTV FOR VISUAL CONFIRMATION",
                        "CCTV provides always-truthful visual confirmation of suspect locations. Deploy in cities where you suspect the cell is operating. Unlike human intel, CCTV clues cannot be false.",
                        turn
                ));
            }

            if (!hasFinanceMonitor) {
                hints.add(new Hint(
                        "MID GAME",
                        "TRACK THE MONEY",
                        "Finance Monitors reveal wire transactions in a city. Assign an agent to MONITOR FINANCE in the same city to get CONFIRMED FINANCE clues — always truthful and key to tracking the cell's funding phase.",
                        turn
                ));
            }

            // Check if agents are doing uncover tasks
            boolean uncoverTasks = session.getAgents().stream().anyMatch(a -> "UNCOVER_SAFEHOUSE".equals(a.getActiveTask()));
            if (!uncoverTasks) {
                hints.add(new Hint(
                        "MID GAME",
                        "UNCOVER ENEMY SAFEHOUSES",
                        "Assign at least one agent to UNCOVER SAFEHOUSE in a city where you suspect the enemy is operating. Exposed safehouses reveal a 3-digit raid code — essential for launching a successful RAID SAFEHOUSE operation.",
                        turn
                ));
            }

            // Check for idle agents
            long idleAgents = session.getAgents().stream()
                    .filter(a -> a.getActiveTask() == null || "NONE".equals(a.getActiveTask()) || "".equals(a.getActiveTask()))
                    .count();
            if (idleAgents > 0) {
                hints.add(new Hint(
                        "MID GAME",
                        "ASSIGN IDLE AGENTS",
                        idleAgents + " agent(s) currently have no task assigned. Idle agents waste valuable intel-gathering turns. Open the MAP, select a city, and assign each agent a directive through the CIA panel.",
                        turn
                ));
            }
        }

        // Late game (turns 16+)
        if (turn >= 16) {
            boolean hostileSafehouseUncovered = session.getSafehouses().stream()
                    .anyMatch(s -> "HOSTILE".equals(s.getOwnerFaction()) && s.isUncovered());
            boolean tacticalTeamInPosition = session.getTacticalTeams().stream()
                    .anyMatch(t -> {
                        String terr = getTerritory(t.getCurrentCity(), config);
                        return "HOSTILE_TERRITORY".equals(terr);
                    });

            if (!hostileSafehouseUncovered) {
                hints.add(new Hint(
                        "LATE GAME",
                        "EXPOSE BEFORE YOU RAID",
                        "It is late in the operation. You must uncover hostile safehouses using the UNCOVER SAFEHOUSE agent task before you can launch a RAID SAFEHOUSE. Check which cities have hidden hostile safehouses by assigning agents to uncover.",
                        turn
                ));
            } else {
                hints.add(new Hint(
                        "LATE GAME",
                        "RAID IS READY",
                        "Hostile safehouses have been exposed with raid codes. Move a Tactical Team into position and launch a RAID SAFEHOUSE operation from the CIA panel. Remember to enter the correct 3-digit code.",
                        turn
                ));
            }

            if (!tacticalTeamInPosition) {
                hints.add(new Hint(
                        "LATE GAME",
                        "MOVE TACTICAL TEAMS FORWARD",
                        "Tactical Teams should be positioned in hostile territory to execute raids. Relocate teams across the border — but beware: border crossings carry a 20% capture risk per team.",
                        turn
                ));
            }

            if (turn > maxTurns - 5) {
                hints.add(new Hint(
                        "LATE GAME",
                        "TIME IS RUNNING OUT",
                        "Only " + (maxTurns - turn) + " turns remain before the cell executes its attack. Focus all resources on uncovering and raiding the correct safehouse. Use airborne SIGINT and border intercepts to lock down escape routes.",
                        turn
                ));
            }
        }

        // General hints that apply regardless of turn
        boolean hasBorderGuard = session.getEspionageResources().stream()
                .anyMatch(r -> "BORDER_GUARD".equals(r.getType()));
        if (!hasBorderGuard && turn >= 4) {
            hints.add(new Hint(
                    "SURVEILLANCE",
                    "BORDER GUARD INTERDICTION",
                    "Deploying BORDER GUARD at a border city gives a 10% chance to capture the suspect during crossing. Even if capture fails, it forces a fallback plan pivot, delaying the cell by 3 turns.",
                    turn
            ));
        }

        boolean hasSignalJammer = session.getEspionageResources().stream()
                .anyMatch(r -> "SIGNAL_JAMMER".equals(r.getType()));
        if (!hasSignalJammer && turn >= 8) {
            hints.add(new Hint(
                    "SURVEILLANCE",
                    "SIGNAL JAMMER FOR COMMS INTERCEPT",
                    "Signal Jammers intercept suspect communications in any phase (finance, logistics, movement). Provides always-truthful intel and forces a fallback pivot on the actual attacker, buying extra turns.",
                    turn
            ));
        }

        boolean hasPhoneTap = session.getEspionageResources().stream()
                .anyMatch(r -> "PHONE_TAP".equals(r.getType()));
        if (!hasPhoneTap && turn >= 3) {
            hints.add(new Hint(
                    "SURVEILLANCE",
                    "PHONE TAP FOR VERIFIED LOCATIONS",
                    "Phone Taps provide always-truthful confirmation when a suspect is in the tapped city. Unlike agent-gathered intel, phone tap clues cannot be false. Deploy in suspected operating cities.",
                    turn
            ));
        }

        // Check if suspect plans exist and there's a border crossing phase
        if (session.getAiMasterPlan() != null && session.getAiMasterPlan().getPrimaryPlan() != null) {
            boolean crossingSoon = session.getAiMasterPlan().getPrimaryPlan().stream()
                    .anyMatch(s -> s.getTurn() >= turn && s.getTurn() <= turn + 3 && (s.isSmuggling() || "BORDER_CROSSING".equals(s.getPhase())));
            if (crossingSoon) {
                hints.add(new Hint(
                        "TACTICAL",
                        "EXPECT BORDER CROSSING",
                        "Intelligence suggests the suspect cell is planning a border crossing in the next few turns. Deploy BORDER GUARD at likely crossing points and position Tactical Teams to respond.",
                        turn
                ));
            }
        }

        // Heat advisory
        if (session.getCityHeat() != null) {
            session.getCityHeat().entrySet().stream()
                    .filter(e -> e.getValue() >= 50)
                    .findFirst()
                    .ifPresent(entry -> {
                        String cityName = entry.getKey();
                        if (config != null) {
                            Node node = config.getNodes().stream()
                                    .filter(n -> n.getId().equals(entry.getKey()))
                                    .findFirst().orElse(null);
                            if (node != null) cityName = node.getName();
                        }
                        hints.add(new Hint(
                                "WARNING",
                                "HIGH DETECTION HEAT IN " + cityName.toUpperCase(),
                                "Detection heat in " + cityName + " is at " + entry.getValue() + "%. If it exceeds 50%, a warned security sweep may be triggered next turn, destroying any assets in that city. Consider evacuating agents and teams.",
                                turn
                        ));
                    });
        }

        // Covert action reminders
        boolean hasCovertInCity = session.getTacticalTeams().stream().anyMatch(t -> {
            String terr = getTerritory(t.getCurrentCity(), config);
            return "HOSTILE_TERRITORY".equals(terr);
        });
        if (hasCovertInCity && turn >= 3) {
            hints.add(new Hint(
                    "TACTICAL",
                    "USE COVERT ACTIONS",
                    "Tactical Teams in hostile territory can execute covert actions: FREEZE FINANCE ($50K), RAID LOGISTICS ($50K), or RAID SAFEHOUSE ($100K). These disrupt the cell's plan and force fallback pivots. Access covert actions through the CIA panel on the MAP.",
                    turn
            ));
        }

        // Budget advisory
        if (session.getBudget() < 50000) {
            hints.add(new Hint(
                    "WARNING",
                    "BUDGET CRITICAL",
                    "Remaining budget is $" + session.getBudget() + ". Most operations cost $30K–$100K. Prioritize essential actions and avoid wasteful relocations.",
                    turn
            ));
        }

        // Trusted intelligence cycle hint
        if (turn % 6 == 0) {
            hints.add(new Hint(
                    "INTEL",
                    "TRUSTED INTELLIGENCE CYCLE",
                    "A TRUSTED INTELLIGENCE milestone has been generated this turn. Check the CLUES tab and ACCEPT it to build your dossier with high-confidence strategic intel about the cell's overall progress.",
                    turn
            ));
        }

        return hints;
    }

    private String getTerritory(String cityId, ScenarioConfig config) {
        if (config == null || config.getNodes() == null) return "";
        return config.getNodes().stream()
                .filter(n -> n.getId().equals(cityId))
                .findFirst()
                .map(Node::getTerritory)
                .orElse("");
    }

    public static class Hint {
        private String category;
        private String title;
        private String body;
        private int turnGenerated;

        public Hint() {}

        public Hint(String category, String title, String body, int turnGenerated) {
            this.category = category;
            this.title = title;
            this.body = body;
            this.turnGenerated = turnGenerated;
        }

        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getBody() { return body; }
        public void setBody(String body) { this.body = body; }

        public int getTurnGenerated() { return turnGenerated; }
        public void setTurnGenerated(int turnGenerated) { this.turnGenerated = turnGenerated; }
    }
}
