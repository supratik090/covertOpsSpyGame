package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.PlanStep;
import com.spygame.covertops.model.ScenarioConfig;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
public class ClueGenerationEngine {

    private final Random random = new Random();

    private final List<String> suspectLocationTemplates = Arrays.asList(
            "Surveillance report: Suspect %s was spotted near a local safehouse in %s.",
            "Local informant: Suspect %s was seen moving through the %s transit hub.",
            "Field agent report: Suspect %s was observed meeting with a known handler in %s.",
            "Covert surveillance: Suspect %s's vehicle was tracked to a restricted zone in %s.",
            "Signal intercept: Suspect %s placed a call from a burner phone near %s.",
            "Human source: Suspect %s was seen entering a high-security compound in %s."
    );

    private final List<String> financeTemplates = Arrays.asList(
            "Financial audit: Wire transaction linked to suspect %s was cleared in %s.",
            "Bank monitor: Funding source for suspect %s was identified in %s."
    );

    private final List<String> logisticsTemplates = Arrays.asList(
            "Logistics manifest: Special cargo for suspect %s cleared customs in %s.",
            "Customs scan: Tactical equipment transport for suspect %s departed %s."
    );

    private final List<String> neutralTemplates = Arrays.asList(
            "Security Sweep: Municipal police database search in %s returned zero alerts for flagged foreign nationals.",
            "Local Intelligence: Informants in %s bazaar report stable prices, standard commercial traffic, and no high-value targets.",
            "SIGINT Scan: Cellular traffic logs in %s verify only localized SIM cards in active cell towers. No suspect signatures found.",
            "Financial Audit: Local bank clearinghouses in %s report standard electronic ledger balances with no anomalous cross-border wires.",
            "Public Order Report: CCTV logs in %s confirm routine transit and business operations with zero reports of suspicious groups.",
            "Port Authority Log: Cargo manifests at %s transit yard were checked and verified. Custom agents report normal operation.",
            "Routine Patrol: Border security patrol unit swept %s perimeter. Log reports no unauthorized movements.",
            "Signals Monitoring: Regional telemetry checks normal across all %s relay towers."
    );

    public List<GameSession.Clue> generateTurnClues(GameSession session, ScenarioConfig config) {
        List<GameSession.Clue> turnClues = new ArrayList<>();
        int currentTurn = session.getCurrentTurn();
        int tMinus6 = currentTurn - 6;

        List<PlanStep> plan = session.getAiMasterPlan().getPrimaryPlan();

        // 1. T-6 Historical Footprint Disclosure (T >= 7)
        if (currentTurn >= 7 && plan != null) {
            PlanStep historicStep = plan.stream()
                    .filter(s -> s.getTurn() == tMinus6)
                    .findFirst()
                    .orElse(null);

            if (historicStep != null && historicStep.getAttackerHistories() != null) {
                for (PlanStep.AttackerHistory hist : historicStep.getAttackerHistories()) {
                    boolean currentlyEliminated = session.getAiAttackers() != null && session.getAiAttackers().stream()
                            .anyMatch(a -> a.getName().equals(hist.getName()) && a.isEliminated());
                    if (!hist.isEliminated() && !currentlyEliminated) {
                        Node node = config.getNodes().stream()
                                .filter(n -> n.getId().equals(hist.getLocation()))
                                .findFirst()
                                .orElse(null);
                        String cityName = node != null ? node.getName() : hist.getLocation();
                        GameSession.Clue footprintClue = new GameSession.Clue(
                                currentTurn,
                                "HISTORICAL_INTEL",
                                "CONFIRMED FOOTPRINT: Intel confirms the threat agent (" + hist.getName() + ") occupied a safehouse in " + cityName + " 6 turns ago (Turn " + tMinus6 + ").",
                                hist.getLocation(),
                                "HQ Archival Intelligence"
                        );
                        footprintClue.setTurnOccurred(tMinus6);
                        turnClues.add(footprintClue);
                    }
                }
            }
        }

        // 2. Generate 3 Clues per City ONLY if there is an agent present in that city and gathering intelligence
        for (Node node : config.getNodes()) {
            String cityId = node.getId();
            String cityName = node.getName();

            GameSession.Agent agentInCity = session.getAgents().stream()
                    .filter(a -> a.getCurrentCity() != null && a.getCurrentCity().equals(cityId) 
                            && ("FIND_SUSPECT".equals(a.getActiveTask()) || "UNCOVER_SAFEHOUSE".equals(a.getActiveTask())) 
                            && a.getCooldownRemaining() <= 0)
                    .findFirst()
                    .orElse(null);

            if (agentInCity == null) {
                continue;
            }

            // Check if any active attacker is/was present at turn T or T-1
            GameSession.AIAttacker presentAttacker = getAttackerInCityAtTOrTMinus1(session, cityId);

            if (presentAttacker != null) {
                // Generate 3 true clues
                List<String> cluesPool = new ArrayList<>();
                cluesPool.add(String.format(suspectLocationTemplates.get(0), presentAttacker.getName(), cityName));
                cluesPool.add(String.format(suspectLocationTemplates.get(1), presentAttacker.getName(), cityName));
                cluesPool.add(String.format(suspectLocationTemplates.get(2 % suspectLocationTemplates.size()), presentAttacker.getName(), cityName));
                cluesPool.add(String.format(suspectLocationTemplates.get(3 % suspectLocationTemplates.size()), presentAttacker.getName(), cityName));
                
                if (!presentAttacker.isFinanceCollected() && cityId.equals(presentAttacker.getRequestedFinanceCity())) {
                    cluesPool.add(String.format(financeTemplates.get(0), presentAttacker.getName(), cityName));
                    cluesPool.add(String.format(financeTemplates.get(1 % financeTemplates.size()), presentAttacker.getName(), cityName));
                }
                if (!presentAttacker.isLogisticsCollected() && cityId.equals(presentAttacker.getRequestedLogisticsCity())) {
                    cluesPool.add(String.format(logisticsTemplates.get(0), presentAttacker.getName(), cityName));
                    cluesPool.add(String.format(logisticsTemplates.get(1 % logisticsTemplates.size()), presentAttacker.getName(), cityName));
                }

                List<String> chosenClues = new ArrayList<>();
                while (chosenClues.size() < 3 && !cluesPool.isEmpty()) {
                    int idx = random.nextInt(cluesPool.size());
                    chosenClues.add(cluesPool.remove(idx));
                }
                while (chosenClues.size() < 3) {
                    chosenClues.add(String.format(suspectLocationTemplates.get(random.nextInt(suspectLocationTemplates.size())), presentAttacker.getName(), cityName));
                }

                for (String text : chosenClues) {
                    turnClues.add(new GameSession.Clue(currentTurn, "CITY_" + cityId, text, cityId, agentInCity.getCodename()));
                }
            } else {
                // Generate 3 realistic neutral clues
                List<String> neutralPool = new ArrayList<>(neutralTemplates);
                for (int i = 0; i < 3; i++) {
                    int idx = random.nextInt(neutralPool.size());
                    String text = String.format(neutralPool.remove(idx), cityName);
                    turnClues.add(new GameSession.Clue(currentTurn, "CITY_" + cityId, text, cityId, agentInCity.getCodename()));
                }
            }
        }

        // 3. Inspect Finance and Inspect Logistics Confirmed Clues
        for (Node node : config.getNodes()) {
            String cityId = node.getId();
            String cityName = node.getName();

            GameSession.Agent financeAgent = session.getAgents().stream()
                    .filter(a -> a.getCurrentCity() != null && a.getCurrentCity().equals(cityId) && "MONITOR_FINANCE".equals(a.getActiveTask()) && a.getCooldownRemaining() <= 0)
                    .findFirst()
                    .orElse(null);

            if (financeAgent != null) {
                GameSession.AIAttacker financeAtt = null;
                if (session.getAiAttackers() != null) {
                    financeAtt = session.getAiAttackers().stream()
                            .filter(a -> !a.isEliminated() && cityId.equals(a.getRequestedFinanceCity()))
                            .findFirst()
                            .orElse(null);
                }
                if (financeAtt != null) {
                    GameSession.Clue financeClue = new GameSession.Clue(
                            currentTurn,
                            "CONFIRMED_FINANCE",
                            "CONFIRMED FINANCE: Wire transactions for suspect " + financeAtt.getName() + " confirmed at finance hub in " + cityName + ".",
                            cityId,
                            financeAgent.getCodename()
                    );
                    financeClue.setAssessment("ACCEPT");
                    turnClues.add(financeClue);
                }
            }

            GameSession.Agent logisticsAgent = session.getAgents().stream()
                    .filter(a -> a.getCurrentCity() != null && a.getCurrentCity().equals(cityId) && "MONITOR_LOGISTICS".equals(a.getActiveTask()) && a.getCooldownRemaining() <= 0)
                    .findFirst()
                    .orElse(null);

            if (logisticsAgent != null) {
                GameSession.AIAttacker logisticsAtt = null;
                if (session.getAiAttackers() != null) {
                    logisticsAtt = session.getAiAttackers().stream()
                            .filter(a -> !a.isEliminated() && cityId.equals(a.getRequestedLogisticsCity()))
                            .findFirst()
                            .orElse(null);
                }
                if (logisticsAtt != null) {
                    GameSession.Clue logisticsClue = new GameSession.Clue(
                            currentTurn,
                            "CONFIRMED_LOGISTICS",
                            "CONFIRMED LOGISTICS: Specialist gear shipments for suspect " + logisticsAtt.getName() + " confirmed departed/customs in " + cityName + ".",
                            cityId,
                            logisticsAgent.getCodename()
                    );
                    logisticsClue.setAssessment("ACCEPT");
                    turnClues.add(logisticsClue);
                }
            }
        }

        // 4. Tech Scan Clues (Finance, Phone, and CCTV footage data)
        if (session.getEspionageResources() != null && session.getAiAttackers() != null) {
            for (GameSession.ActiveResource resource : session.getEspionageResources()) {
                String resCity = resource.getCityNode();
                
                GameSession.AIAttacker scannedAtt = null;
                int occurredTurn = currentTurn;

                // Check current turn T
                if (session.getAiAttackers() != null) {
                    for (GameSession.AIAttacker attacker : session.getAiAttackers()) {
                        if (!attacker.isEliminated() && resCity.equals(attacker.getCurrentLocation())) {
                            scannedAtt = attacker;
                            occurredTurn = currentTurn;
                            break;
                        }
                    }
                }

                // If not found at T, check previous turn T-1
                if (scannedAtt == null) {
                    int prevTurn = currentTurn - 1;
                    if (prevTurn >= 1 && session.getAiMasterPlan() != null && session.getAiMasterPlan().getPrimaryPlan() != null) {
                        PlanStep prevStep = session.getAiMasterPlan().getPrimaryPlan().stream()
                                .filter(s -> s.getTurn() == prevTurn)
                                .findFirst()
                                .orElse(null);
                        if (prevStep != null && prevStep.getAttackerHistories() != null) {
                            for (PlanStep.AttackerHistory hist : prevStep.getAttackerHistories()) {
                                if (!hist.isEliminated() && resCity.equals(hist.getLocation())) {
                                     scannedAtt = session.getAiAttackers().stream()
                                             .filter(a -> a.getName().equals(hist.getName()) && !a.isEliminated())
                                             .findFirst()
                                             .orElse(null);
                                     if (scannedAtt != null) {
                                        occurredTurn = prevTurn;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                if (scannedAtt != null) {
                    String suffix = occurredTurn < currentTurn ? " (Turn " + occurredTurn + ")" : "";
                    if ("CCTV".equals(resource.getType())) {
                        GameSession.Clue cctvClue = new GameSession.Clue(
                                currentTurn,
                                "CCTV_SCAN",
                                "CCTV Scan: Visual match confirmed for target " + scannedAtt.getName() + " in " + resCity.toUpperCase() + " traffic logs" + suffix + ".",
                                resCity,
                                "Surveillance Tech"
                        );
                        cctvClue.setTurnOccurred(occurredTurn);
                        cctvClue.setAssessment("ACCEPT");
                        turnClues.add(cctvClue);
                    }

                    if ("PHONE_TAP".equals(resource.getType())) {
                        GameSession.Clue phoneClue = new GameSession.Clue(
                                currentTurn,
                                "PHONE_TAP",
                                "Phone Tap: Cellular intercept confirms " + scannedAtt.getName() + " registered to cell tower node in " + resCity.toUpperCase() + suffix + ".",
                                resCity,
                                "Surveillance Tech"
                        );
                        phoneClue.setTurnOccurred(occurredTurn);
                        phoneClue.setAssessment("ACCEPT");
                        turnClues.add(phoneClue);
                    }

                    if ("SATELLITE".equals(resource.getType())) {
                        Node node = config.getNodes().stream().filter(n -> n.getId().equals(resCity)).findFirst().orElse(null);
                        String cityName = node != null ? node.getName() : resCity;
                        
                        GameSession.Clue satClue = new GameSession.Clue(
                                currentTurn,
                                "SATELLITE_SCAN",
                                "Satellite Imagery Analysis: " + scannedAtt.getName() + " was tracked to " + cityName + " via satellite reconnaissance" + suffix + ".",
                                resCity,
                                "Satellite Recon"
                        );
                        satClue.setTurnOccurred(occurredTurn);
                        satClue.setAssessment("ACCEPT");
                        turnClues.add(satClue);
                    }
                }
                
                if ("WIRE_TAP".equals(resource.getType())) {
                    for (GameSession.AIAttacker att : session.getAiAttackers()) {
                        if (!att.isEliminated() && !att.isFinanceCollected() && resCity.equals(att.getRequestedFinanceCity())) {
                            GameSession.Clue wireClue = new GameSession.Clue(
                                    currentTurn,
                                    "WIRE_TAP",
                                    "Wiretap Intercept: Encrypted account wires registered to " + att.getName() + " in " + resCity.toUpperCase() + " servers.",
                                    resCity,
                                    "Surveillance Tech"
                            );
                            wireClue.setAssessment("ACCEPT");
                            turnClues.add(wireClue);
                        }
                    }
                }
            }
        }

        // 5. Generate clues about combat team movements (Attacker only)
        if (session.getTacticalTeams() != null && "ATTACKER".equals(session.getPlayerRole())) {
            for (GameSession.TacticalTeam team : session.getTacticalTeams()) {
                if (team.getCooldownRemaining() > 0) {
                    turnClues.add(new GameSession.Clue(
                            currentTurn,
                            "COMBAT_TEAM_MOVEMENT",
                            "TACTICAL ALARM: Combat team " + team.getName() + " has relocated to " + team.getCurrentCity().toUpperCase() + ".",
                            team.getCurrentCity(),
                            "Red Cell Intelligence"
                    ));
                }
            }
        }

        return turnClues;
    }

    private GameSession.AIAttacker getAttackerInCityAtTOrTMinus1(GameSession session, String cityId) {
        if (session.getAiAttackers() == null) {
            return null;
        }
        
        // Check current turn T
        for (GameSession.AIAttacker attacker : session.getAiAttackers()) {
            if (!attacker.isEliminated() && cityId.equals(attacker.getCurrentLocation())) {
                return attacker;
            }
        }
        
        // Check previous turn T-1
        int prevTurn = session.getCurrentTurn() - 1;
        if (prevTurn >= 1 && session.getAiMasterPlan() != null && session.getAiMasterPlan().getPrimaryPlan() != null) {
            PlanStep prevStep = session.getAiMasterPlan().getPrimaryPlan().stream()
                    .filter(s -> s.getTurn() == prevTurn)
                    .findFirst()
                    .orElse(null);
            if (prevStep != null && prevStep.getAttackerHistories() != null) {
                for (PlanStep.AttackerHistory hist : prevStep.getAttackerHistories()) {
                    if (!hist.isEliminated() && cityId.equals(hist.getLocation())) {
                        return session.getAiAttackers().stream()
                                .filter(a -> a.getName().equals(hist.getName()) && !a.isEliminated())
                                .findFirst()
                                .orElse(null);
                    }
                }
            }
        }
        
        return null;
    }
}
