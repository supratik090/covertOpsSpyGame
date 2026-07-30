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

@Service
public class ClueGenerationEngine {

    private final Random random = new Random();

    // Standardized templates used for both True and False clues to prevent formatting-based distinction
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
            "Signal check: Communications and border lines in %s appear secure.",
            "Area status: Standard administrative flow observed in %s server logs.",
            "Routine patrol: No unusual activity detected in %s this cycle.",
            "Communications monitoring: Traffic patterns normal across %s relay stations.",
            "Satellite sweep: Thermal imaging shows standard civilian movement in %s.",
            "Local asset report: Nothing of interest to report from %s.",
            "Infrastructure check: Power and network grids stable in %s.",
            "Unattended sensor array: No signature matches recorded in %s sector."
    );

    public List<GameSession.Clue> generateTurnClues(GameSession session, ScenarioConfig config) {
        List<GameSession.Clue> turnClues = new ArrayList<>();
        int currentTurn = session.getCurrentTurn();
        int lastTurn = currentTurn - 1;

        String actualAttacker = session.getActualAttacker() != null ? session.getActualAttacker() : "Suspect";
        List<String> allSuspects = session.getAttackerNames() != null && !session.getAttackerNames().isEmpty()
                ? session.getAttackerNames()
                : Arrays.asList(actualAttacker);

        List<PlanStep> plan = session.getAiMasterPlan().getPrimaryPlan();

        // 1. T-7 Historical Footprint Disclosure (T >= 8)
        if (currentTurn >= 8) {
            int tMinus7 = currentTurn - 7;
            PlanStep historicStep = plan.stream()
                    .filter(s -> s.getTurn() == tMinus7)
                    .findFirst()
                    .orElse(null);

            if (historicStep != null && historicStep.getSuspectLocation() != null) {
                Node node = config.getNodes().stream()
                        .filter(n -> n.getId().equals(historicStep.getSuspectLocation()))
                        .findFirst()
                        .orElse(null);
                String cityName = node != null ? node.getName() : historicStep.getSuspectLocation();
                turnClues.add(new GameSession.Clue(
                        currentTurn,
                        "HISTORICAL_INTEL",
                        "CONFIRMED FOOTPRINT: Intel confirms the actual threat agent (" + actualAttacker + ") occupied a safehouse in " + cityName + " 7 turns ago (Turn " + tMinus7 + ").",
                        historicStep.getSuspectLocation(),
                        "HQ Archival Intelligence"
                ));
            }
        }

        PlanStep lastStep = plan.stream()
                .filter(s -> s.getTurn() == lastTurn)
                .findFirst()
                .orElse(null);

        // 1.1 Automatic Border Crossing Footprints (no agent required)
        if (session.getSuspectPlans() != null) {
            for (String suspectName : allSuspects) {
                List<PlanStep> suspectPlan = session.getSuspectPlans().get(suspectName);
                if (suspectPlan == null) continue;
                PlanStep suspectLastStep = suspectPlan.stream().filter(s -> s.getTurn() == lastTurn).findFirst().orElse(null);
                if (suspectLastStep != null && (suspectLastStep.isSmuggling() || "BORDER_CROSSING".equals(suspectLastStep.getPhase()))) {
                    Node node = config.getNodes().stream().filter(n -> n.getId().equals(suspectLastStep.getSuspectLocation())).findFirst().orElse(null);
                    String cityName = node != null ? node.getName() : suspectLastStep.getSuspectLocation();
                    turnClues.add(new GameSession.Clue(
                            currentTurn,
                            "BORDER_CROSSING_FOOTPRINT",
                            "INTELLIGENCE REPORT: Local border patrol reported unauthorized crossing activity near " + cityName + " border line. Forensic analysis indicates suspect " + suspectName + " was present.",
                            suspectLastStep.getSuspectLocation(),
                            "Border Control"
                    ));
                }
            }
        }

        // 2. Generate 3 Clues per City ONLY if there is an agent present in that city and gathering intelligence
        for (Node node : config.getNodes()) {
            String cityId = node.getId();
            String cityName = node.getName();

            // Find agent stationed in this city using GATHER INTELLIGENCE (FIND_SUSPECT)
            GameSession.Agent agentInCity = session.getAgents().stream()
                    .filter(a -> a.getCurrentCity().equals(cityId) && "FIND_SUSPECT".equals(a.getActiveTask()) && a.getCooldownRemaining() <= 0)
                    .findFirst()
                    .orElse(null);

            // ONLY generate city clues if an agent is present in the city and active on FIND_SUSPECT task
            if (agentInCity == null) {
                continue;
            }

            // Evaluate if actual events occurred in this city last turn (T-1)
            boolean wasSuspectPresent = lastStep != null && cityId.equals(lastStep.getSuspectLocation());
            boolean wasFinanceActive = lastStep != null && cityId.equals(lastStep.getFinanceCity());
            boolean wasLogisticsActive = lastStep != null && cityId.equals(lastStep.getLogisticsCity());

            List<String> trueClues = new ArrayList<>();
            if (wasSuspectPresent) {
                trueClues.add(String.format(suspectLocationTemplates.get(0), actualAttacker, cityName));
                trueClues.add(String.format(suspectLocationTemplates.get(1), actualAttacker, cityName));
            } else if (wasFinanceActive) {
                trueClues.add(String.format(financeTemplates.get(0), actualAttacker, cityName));
                trueClues.add(String.format(financeTemplates.get(1), actualAttacker, cityName));
            } else if (wasLogisticsActive) {
                trueClues.add(String.format(logisticsTemplates.get(0), actualAttacker, cityName));
                trueClues.add(String.format(logisticsTemplates.get(1), actualAttacker, cityName));
            } else {
                trueClues.add(String.format(neutralTemplates.get(0), cityName));
                trueClues.add(String.format(neutralTemplates.get(1), cityName));
            }

            // Select 2 True Clues
            String true1 = trueClues.get(0);
            String true2 = trueClues.get(1 % trueClues.size());

            // Select 1 False Clue (noise or decoy) formatted in the exact same way
            String falseClue = null;
            
            // Check if any decoy suspect was active in this city last turn
            List<String> potentialDecoyClues = new ArrayList<>();
            for (String suspectName : allSuspects) {
                if (!suspectName.equals(actualAttacker) && session.getSuspectPlans() != null && session.getSuspectPlans().containsKey(suspectName)) {
                    List<PlanStep> decoyPlan = session.getSuspectPlans().get(suspectName);
                    PlanStep decoyLastStep = decoyPlan.stream().filter(s -> s.getTurn() == lastTurn).findFirst().orElse(null);
                    if (decoyLastStep != null) {
                        if (cityId.equals(decoyLastStep.getSuspectLocation())) {
                            potentialDecoyClues.add(String.format(suspectLocationTemplates.get(random.nextInt(suspectLocationTemplates.size())), suspectName, cityName));
                        }
                        if (cityId.equals(decoyLastStep.getFinanceCity())) {
                            potentialDecoyClues.add(String.format(financeTemplates.get(random.nextInt(financeTemplates.size())), suspectName, cityName));
                        }
                        if (cityId.equals(decoyLastStep.getLogisticsCity())) {
                            potentialDecoyClues.add(String.format(logisticsTemplates.get(random.nextInt(logisticsTemplates.size())), suspectName, cityName));
                        }
                    }
                }
            }

            if (!potentialDecoyClues.isEmpty()) {
                // Pick one of the actual decoy events that occurred in this city
                falseClue = potentialDecoyClues.get(random.nextInt(potentialDecoyClues.size()));
            } else {
                // Fallback to random false clue if no decoy suspect was active here last turn
                String randomSuspect = allSuspects.get(random.nextInt(allSuspects.size()));
                int roll = random.nextInt(4);
                if (roll == 0) {
                    falseClue = String.format(suspectLocationTemplates.get(random.nextInt(suspectLocationTemplates.size())), randomSuspect, cityName);
                } else if (roll == 1) {
                    falseClue = String.format(financeTemplates.get(random.nextInt(financeTemplates.size())), randomSuspect, cityName);
                } else if (roll == 2) {
                    falseClue = String.format(logisticsTemplates.get(random.nextInt(logisticsTemplates.size())), randomSuspect, cityName);
                } else {
                    falseClue = String.format(neutralTemplates.get(random.nextInt(neutralTemplates.size())), cityName);
                }
            }

            // Add the 3 clues to this city's deck
            turnClues.add(new GameSession.Clue(currentTurn, "CITY_" + cityId, true1, cityId, agentInCity.getCodename()));
            turnClues.add(new GameSession.Clue(currentTurn, "CITY_" + cityId, true2, cityId, agentInCity.getCodename()));
            turnClues.add(new GameSession.Clue(currentTurn, "CITY_" + cityId, falseClue, cityId, agentInCity.getCodename()));
        }

        // 3. Inspect Finance and Inspect Logistics Confirmed Clues
        for (Node node : config.getNodes()) {
            String cityId = node.getId();
            String cityName = node.getName();

            // Check if any agent is inspecting finance in this city
            GameSession.Agent financeAgent = session.getAgents().stream()
                    .filter(a -> a.getCurrentCity().equals(cityId) && "MONITOR_FINANCE".equals(a.getActiveTask()) && a.getCooldownRemaining() <= 0)
                    .findFirst()
                    .orElse(null);

            if (financeAgent != null && lastStep != null && cityId.equals(lastStep.getFinanceCity())) {
                GameSession.Clue financeClue = new GameSession.Clue(
                        currentTurn,
                        "CONFIRMED_FINANCE",
                        "CONFIRMED FINANCE: Wire transactions for suspect " + actualAttacker + " confirmed at finance hub in " + cityName + ".",
                        cityId,
                        financeAgent.getCodename()
                );
                financeClue.setAssessment("ACCEPT");
                turnClues.add(financeClue);
            }

            // Check if any agent is inspecting logistics in this city
            GameSession.Agent logisticsAgent = session.getAgents().stream()
                    .filter(a -> a.getCurrentCity().equals(cityId) && "MONITOR_LOGISTICS".equals(a.getActiveTask()) && a.getCooldownRemaining() <= 0)
                    .findFirst()
                    .orElse(null);

            if (logisticsAgent != null && lastStep != null && cityId.equals(lastStep.getLogisticsCity())) {
                GameSession.Clue logisticsClue = new GameSession.Clue(
                        currentTurn,
                        "CONFIRMED_LOGISTICS",
                        "CONFIRMED LOGISTICS: Specialist gear shipments for suspect " + actualAttacker + " confirmed departed/customs in " + cityName + ".",
                        cityId,
                        logisticsAgent.getCodename()
                );
                logisticsClue.setAssessment("ACCEPT");
                turnClues.add(logisticsClue);
            }
        }

        // 4. Tech Scan Clues (Finance, Phone, and CCTV footage data) - explicitly naming suspect (decoys included)
        if (session.getEspionageResources() != null && session.getSuspectPlans() != null) {
            for (GameSession.ActiveResource resource : session.getEspionageResources()) {
                String resCity = resource.getCityNode();

                for (String suspectName : allSuspects) {
                    List<PlanStep> suspectPlan = session.getSuspectPlans().get(suspectName);
                    if (suspectPlan == null) continue;
                    PlanStep suspectLastStep = suspectPlan.stream().filter(s -> s.getTurn() == lastTurn).findFirst().orElse(null);
                    if (suspectLastStep == null) continue;

                    if ("CCTV".equals(resource.getType()) && resCity.equals(suspectLastStep.getSuspectLocation())) {
                        GameSession.Clue cctvClue = new GameSession.Clue(
                                currentTurn,
                                "CCTV_SCAN",
                                "CCTV Scan: Visual match confirmed for target " + suspectName + " in " + resCity + " traffic logs.",
                                resCity,
                                "Surveillance Tech"
                        );
                        cctvClue.setAssessment("ACCEPT");
                        turnClues.add(cctvClue);
                    }

                    if ("WIRE_TAP".equals(resource.getType()) && resCity.equals(suspectLastStep.getFinanceCity())) {
                        GameSession.Clue wireClue = new GameSession.Clue(
                                currentTurn,
                                "WIRE_TAP",
                                "Wiretap Intercept: Encrypted account wires registered to " + suspectName + " in " + resCity + " servers.",
                                resCity,
                                "Surveillance Tech"
                        );
                        wireClue.setAssessment("ACCEPT");
                        turnClues.add(wireClue);
                    }

                    if ("PHONE_TAP".equals(resource.getType()) && resCity.equals(suspectLastStep.getSuspectLocation())) {
                        GameSession.Clue phoneClue = new GameSession.Clue(
                                currentTurn,
                                "PHONE_TAP",
                                "Phone Tap: Cellular intercept confirms " + suspectName + " registered to cell tower node in " + resCity + ".",
                                resCity,
                                "Surveillance Tech"
                        );
                        phoneClue.setAssessment("ACCEPT");
                        turnClues.add(phoneClue);
                    }

                    // 6. Satellite Scan: detect suspect presence and movement in/out of covered city
                    if ("SATELLITE".equals(resource.getType()) && resCity.equals(suspectLastStep.getSuspectLocation())) {
                        Node node = config.getNodes().stream().filter(n -> n.getId().equals(resCity)).findFirst().orElse(null);
                        String cityName = node != null ? node.getName() : resCity;
                        PlanStep suspectTwoTurnsAgo = suspectPlan.stream().filter(s -> s.getTurn() == lastTurn - 1).findFirst().orElse(null);
                        String movementDetail;
                        if (suspectTwoTurnsAgo != null && !resCity.equals(suspectTwoTurnsAgo.getSuspectLocation())) {
                            Node prevNode = config.getNodes().stream().filter(n -> n.getId().equals(suspectTwoTurnsAgo.getSuspectLocation())).findFirst().orElse(null);
                            String prevCityName = prevNode != null ? prevNode.getName() : suspectTwoTurnsAgo.getSuspectLocation();
                            movementDetail = suspectName + " moved into " + cityName + " from " + prevCityName + ".";
                        } else {
                            movementDetail = suspectName + " was tracked to " + cityName + " via satellite reconnaissance.";
                        }
                        GameSession.Clue satClue = new GameSession.Clue(
                                currentTurn,
                                "SATELLITE_SCAN",
                                "Satellite Imagery Analysis: " + movementDetail,
                                resCity,
                                "Satellite Recon"
                        );
                        satClue.setAssessment("ACCEPT");
                        turnClues.add(satClue);
                    }
                }
            }
        }

        // 4.1 Generate Decoy Clues matching standard scans if any decoys are active (Attacker mode)
        if (session.getActiveDecoys() != null) {
            for (GameSession.ActiveDecoy decoy : session.getActiveDecoys()) {
                if ("CCTV".equals(decoy.getType())) {
                    GameSession.Clue decoyClue = new GameSession.Clue(
                            currentTurn,
                            "CCTV_SCAN",
                            "CCTV Scan: Visual match confirmed for target " + actualAttacker + " in " + decoy.getCityNode() + " traffic logs.",
                            decoy.getCityNode(),
                            "Surveillance Tech"
                    );
                    decoyClue.setAssessment("ACCEPT");
                    turnClues.add(decoyClue);
                } else if ("SATELLITE".equals(decoy.getType())) {
                    Node node = config.getNodes().stream().filter(n -> n.getId().equals(decoy.getCityNode())).findFirst().orElse(null);
                    String cityName = node != null ? node.getName() : decoy.getCityNode();
                    GameSession.Clue decoyClue = new GameSession.Clue(
                            currentTurn,
                            "SATELLITE_SCAN",
                            "Satellite Imagery Analysis: " + actualAttacker + " was tracked to " + cityName + " via satellite reconnaissance.",
                            decoy.getCityNode(),
                            "Satellite Recon"
                    );
                    decoyClue.setAssessment("ACCEPT");
                    turnClues.add(decoyClue);
                }
            }
        }

        // 5. Trusted Intelligence Milestone Every 6 Turns (turn 6, 12, 18...)
        if (currentTurn % 6 == 0) {
            List<PlanStep> fullPlan = session.getAiMasterPlan().getPrimaryPlan();
            if (fullPlan != null) {
                boolean financePhaseDone = fullPlan.stream().anyMatch(s -> s.getTurn() <= currentTurn && s.getFinanceCity() != null && !s.getFinanceCity().isEmpty());
                boolean logisticsPhaseDone = fullPlan.stream().anyMatch(s -> s.getTurn() <= currentTurn && s.getLogisticsCity() != null && !s.getLogisticsCity().isEmpty());
                boolean crossingPhaseDone = fullPlan.stream().anyMatch(s -> s.getTurn() <= currentTurn && (s.isSmuggling() || "BORDER_CROSSING".equals(s.getPhase())));
                boolean attackPhaseReached = fullPlan.stream().anyMatch(s -> s.getTurn() <= currentTurn && "ATTACK".equals(s.getPhase()));

                StringBuilder milestoneBuilder = new StringBuilder();
                milestoneBuilder.append("TRUSTED INTELLIGENCE BRIEF (Cycle ").append(currentTurn / 6).append("): Threat cell activity summary — ");
                if (financePhaseDone) milestoneBuilder.append("Financing confirmed. ");
                else milestoneBuilder.append("No financial trail detected yet. ");
                if (logisticsPhaseDone) milestoneBuilder.append("Logistics network active. ");
                else milestoneBuilder.append("Logistics sourcing not yet observed. ");
                if (crossingPhaseDone) milestoneBuilder.append("Border crossing operations in progress. ");
                if (attackPhaseReached) milestoneBuilder.append("ATTENTION — Attack phase reached, imminent threat. ");
                if (!financePhaseDone && !logisticsPhaseDone && !crossingPhaseDone && !attackPhaseReached) {
                    milestoneBuilder.append("Cell appears to be in early planning stages.");
                }

                GameSession.Clue milestoneClue = new GameSession.Clue(
                        currentTurn,
                        "TRUSTED_INTEL",
                        milestoneBuilder.toString(),
                        "HQ",
                        "Strategic Analysis Unit"
                );
                milestoneClue.setAssessment("ACCEPT");
                turnClues.add(milestoneClue);
            }
        }

        // 6. Generate clues about combat team movements
        if (session.getTacticalTeams() != null) {
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
}
