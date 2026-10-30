package com.spygame.covertops.service;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.ScenarioConfig;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class SourcingMilestoneService {

    public void tickAttackerMilestones(GameSession session) {
        int currentTurn = session.getCurrentTurn();
        int clueTurn = "DEFENDER".equals(session.getPlayerRole()) ? currentTurn + 5 : currentTurn;

        if (session.getAiAttackers() != null) {
            for (GameSession.AIAttacker attacker : session.getAiAttackers()) {
                if (attacker.isEliminated()) {
                    continue;
                }

                if (attacker.getFinanceCollectionTurnsRemaining() > 0) {
                    attacker.setFinanceCollectionTurnsRemaining(attacker.getFinanceCollectionTurnsRemaining() - 1);
                    if (attacker.getFinanceCollectionTurnsRemaining() == 0) {
                        GameSession.Clue clue = new GameSession.Clue(
                                clueTurn,
                                "FINANCE_COLLECTIBLE",
                                "Finance collection channels are ready for " + attacker.getName() + ". Return to " + attacker.getRequestedFinanceCity().toUpperCase() + " to collect."
                        );
                        clue.setTurnOccurred(currentTurn);
                        session.getDiscoveredClues().add(clue);
                    }
                }

                if (attacker.getLogisticsCollectionTurnsRemaining() > 0) {
                    attacker.setLogisticsCollectionTurnsRemaining(attacker.getLogisticsCollectionTurnsRemaining() - 1);
                    if (attacker.getLogisticsCollectionTurnsRemaining() == 0) {
                        GameSession.Clue clue = new GameSession.Clue(
                                clueTurn,
                                "LOGISTICS_COLLECTIBLE",
                                "Logistics collection channels are ready for " + attacker.getName() + ". Return to " + attacker.getRequestedLogisticsCity().toUpperCase() + " to collect."
                        );
                        clue.setTurnOccurred(currentTurn);
                        session.getDiscoveredClues().add(clue);
                    }
                }

                if (attacker.getHandoverCity() != null && !attacker.isHandoverCompleted()) {
                    if (attacker.getHandoverCity().equals(attacker.getCurrentLocation())) {
                        if (attacker.getHandoverTurnsRemaining() == 2) {
                            GameSession.Clue startClue = new GameSession.Clue(
                                    clueTurn,
                                    "HANDOVER_STARTED",
                                    "Handover has started for agent " + attacker.getName() + " in redacted city."
                            );
                            startClue.setTurnOccurred(currentTurn);
                            session.getDiscoveredClues().add(startClue);
                        }
                        attacker.setHandoverTurnsRemaining(attacker.getHandoverTurnsRemaining() - 1);
                        if (attacker.getHandoverTurnsRemaining() == 0) {
                            attacker.setHandoverCompleted(true);
                            GameSession.Clue clue = new GameSession.Clue(
                                    clueTurn,
                                    "HANDOVER_COMPLETE",
                                    "Handover complete for " + attacker.getName() + ". Operational clearance to cross border can now be requested."
                            );
                            clue.setTurnOccurred(currentTurn);
                            session.getDiscoveredClues().add(clue);
                            attacker.setState("Permission to cross border");

                            GameSession.Clue soughtClue = new GameSession.Clue(
                                    currentTurn + 1,
                                    "BORDER_CROSSING_REQUESTED",
                                    "STATE INTELLIGENCE: Signals intercept suggests suspect (" + attacker.getName() + ") has requested clearance to cross the border.",
                                    attacker.getCurrentLocation(),
                                    "Signals Intelligence"
                            );
                            soughtClue.setTurnOccurred(currentTurn);
                            session.getDiscoveredClues().add(soughtClue);
                        }
                    } else if (attacker.getHandoverTurnsRemaining() < 2) {
                        // Reset handover if suspect left the city
                        attacker.setHandoverCity(null);
                        attacker.setHandoverTurnsRemaining(-1);
                        GameSession.Clue clue = new GameSession.Clue(
                                clueTurn,
                                "HANDOVER_INTERRUPTED",
                                "WARNING: Handover interrupted. Operative " + attacker.getName() + " left the handover city before completion."
                        );
                        clue.setTurnOccurred(currentTurn);
                        session.getDiscoveredClues().add(clue);
                        attacker.setState(attacker.isFinanceCollected() && attacker.isLogisticsCollected() ? "Handover pending" : "Initial decoy");
                    }
                }

                if (attacker.getHealingTurnsRemaining() > 0) {
                    attacker.setHealingTurnsRemaining(attacker.getHealingTurnsRemaining() - 1);
                    if (attacker.getHealingTurnsRemaining() == 0) {
                        if ("Healing".equals(attacker.getState())) {
                            if (attacker.isHandoverCompleted()) {
                                attacker.setState("Permission to cross border");

                                GameSession.Clue soughtClue = new GameSession.Clue(
                                        currentTurn + 1,
                                        "BORDER_CROSSING_REQUESTED",
                                        "STATE INTELLIGENCE: Signals intercept suggests suspect (" + attacker.getName() + ") has requested clearance to cross the border.",
                                        attacker.getCurrentLocation(),
                                        "Signals Intelligence"
                                );
                                soughtClue.setTurnOccurred(currentTurn);
                                session.getDiscoveredClues().add(soughtClue);
                            } else if (attacker.isFinanceCollected() && attacker.isLogisticsCollected()) {
                                attacker.setHandoverCity(attacker.getCurrentLocation());
                                attacker.setHandoverTurnsRemaining(1);
                                attacker.setState("Handover pending");
                            } else if (attacker.isFinanceCollected()) {
                                attacker.setRequestedLogisticsCity(attacker.getCurrentLocation());
                                attacker.setLogisticsCollectionTurnsRemaining(1);
                                attacker.setState("Request Logistic");
                            } else {
                                attacker.setRequestedFinanceCity(attacker.getCurrentLocation());
                                attacker.setFinanceCollectionTurnsRemaining(1);
                                attacker.setState("Healing_Recovered");
                            }
                        }
                    }
                }
            }
        }

        // Ticking down player attacker's handover progress
        if (session.getHandoverCity() != null && !session.isHandoverCompleted()) {
            if (session.getHandoverCity().equals(session.getSuspectLocation())) {
                if (session.getHandoverTurnsRemaining() == 2) {
                    GameSession.Clue startClue = new GameSession.Clue(
                            clueTurn,
                            "HANDOVER_STARTED",
                            "Handover has started for agent " + (session.getActualAttacker() != null ? session.getActualAttacker() : "Suspect") + " in redacted city."
                    );
                    startClue.setTurnOccurred(currentTurn);
                    session.getDiscoveredClues().add(startClue);
                }
                session.setHandoverTurnsRemaining(session.getHandoverTurnsRemaining() - 1);
                if (session.getHandoverTurnsRemaining() == 0) {
                    session.setHandoverCompleted(true);
                    GameSession.Clue clue = new GameSession.Clue(
                            clueTurn,
                            "HANDOVER_COMPLETE",
                            "Handover complete for " + (session.getActualAttacker() != null ? session.getActualAttacker() : "Suspect") + ". Operational clearance to cross border can now be requested."
                    );
                    clue.setTurnOccurred(currentTurn);
                    session.getDiscoveredClues().add(clue);
                    session.setActiveAttackerPhase("CROSSING");
                }
            } else if (session.getHandoverTurnsRemaining() < 2) {
                // Reset handover if suspect left the city
                session.setHandoverCity(null);
                session.setHandoverTurnsRemaining(-1);
                GameSession.Clue clue = new GameSession.Clue(
                        clueTurn,
                        "HANDOVER_INTERRUPTED",
                        "WARNING: Handover interrupted. Operative left the handover city before completion."
                );
                clue.setTurnOccurred(currentTurn);
                session.getDiscoveredClues().add(clue);
                session.setActiveAttackerPhase("HANDOVER");
            }
        }

        // Tick down active decoys (10 turns standard duration)
        if (session.getActiveDecoys() != null) {
            List<GameSession.ActiveDecoy> nextDecoys = new ArrayList<>();
            for (GameSession.ActiveDecoy d : session.getActiveDecoys()) {
                int rem = d.getTurnsRemaining() - 1;
                if (rem > 0) {
                    d.setTurnsRemaining(rem);
                    nextDecoys.add(d);
                } else {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            session.getCurrentTurn(),
                            "DECOY_EXPIRED",
                            "Decoy decoy " + d.getType() + " at " + d.getCityNode().toUpperCase() + " has expired."
                    ));
                }
            }
            session.setActiveDecoys(nextDecoys);
        }

        // Tick down secure safehouse turns (5 turns standard duration)
        if (session.getSecureSafehouseTurns() != null) {
            java.util.Map<String, Integer> nextSecureSafehouses = new java.util.HashMap<>();
            for (java.util.Map.Entry<String, Integer> entry : session.getSecureSafehouseTurns().entrySet()) {
                int left = entry.getValue() - 1;
                if (left > 0) {
                    nextSecureSafehouses.put(entry.getKey(), left);
                } else {
                    session.getDiscoveredClues().add(new GameSession.Clue(
                            session.getCurrentTurn(),
                            "SAFEHOUSE_EXPOSED",
                            "Secure safehouse cover at " + entry.getKey().toUpperCase() + " has expired. It is now vulnerable to Defender scans."
                    ));
                }
            }
            session.setSecureSafehouseTurns(nextSecureSafehouses);
        }

        // Tick down player attacker's finance collection
        if (session.getRequestedFinanceCity() != null && !session.isFinanceCollected() && session.getFinanceCollectionTurnsRemaining() > 0) {
            session.setFinanceCollectionTurnsRemaining(session.getFinanceCollectionTurnsRemaining() - 1);
            if (session.getFinanceCollectionTurnsRemaining() == 0) {
                GameSession.Clue clue = new GameSession.Clue(
                        clueTurn,
                        "FINANCE_COLLECTIBLE",
                        "Finance collection channels are ready in " + session.getRequestedFinanceCity().toUpperCase() + ". Return here to claim your capital."
                );
                clue.setTurnOccurred(currentTurn);
                session.getDiscoveredClues().add(clue);
            }
        }

        // Tick down player attacker's logistics collection
        if (session.getRequestedLogisticsCity() != null && !session.isLogisticsCollected() && session.getLogisticsCollectionTurnsRemaining() > 0) {
            session.setLogisticsCollectionTurnsRemaining(session.getLogisticsCollectionTurnsRemaining() - 1);
            if (session.getLogisticsCollectionTurnsRemaining() == 0) {
                GameSession.Clue clue = new GameSession.Clue(
                        clueTurn,
                        "LOGISTICS_COLLECTIBLE",
                        "Logistics collection channels are ready in " + session.getRequestedLogisticsCity().toUpperCase() + ". Return here to claim your gear."
                );
                clue.setTurnOccurred(currentTurn);
                session.getDiscoveredClues().add(clue);
            }
        }
    }

    public void reallocateAiSourcing(GameSession session, String frozenCity, boolean isFinance, ScenarioConfig config) {
        if (isFinance) {
            session.setRequestedFinanceCity(null);
            session.setFinanceCollectionTurnsRemaining(0);
            session.setFinanceCollected(false);
            session.setActiveAttackerPhase("FINANCE_SOURCING");
        } else {
            session.setRequestedLogisticsCity(null);
            session.setLogisticsCollectionTurnsRemaining(0);
            session.setLogisticsCollected(false);
            session.setActiveAttackerPhase("LOGISTICS_SOURCING");
        }
        if (session.getAiMasterPlan() != null && session.getAiMasterPlan().getFallbackPlan() != null && !session.getAiMasterPlan().getFallbackPlan().isEmpty()) {
            session.getAiMasterPlan().setPrimaryPlan(new ArrayList<>(session.getAiMasterPlan().getFallbackPlan()));
            session.getAiMasterPlan().getFallbackPlan().clear();
        }
    }
}
