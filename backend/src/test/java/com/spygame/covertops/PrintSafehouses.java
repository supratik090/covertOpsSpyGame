package com.spygame.covertops;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

public class PrintSafehouses {
    @Test
    public void printSafehouses() throws Exception {
        String uri = "mongo_URL";
        try (MongoClient client = MongoClients.create(uri)) {
            MongoDatabase db = client.getDatabase("covert_ops");
            MongoCollection<Document> col = db.getCollection("game_sessions");
            List<Document> sessions = new ArrayList<>();
            col.find().into(sessions);
            Document latest = sessions.get(sessions.size() - 1);

            System.out.println("=== CURRENT SAFEHOUSES (Live Session) ===");
            List<Document> safehouses = (List<Document>) latest.get("safehouses");
            if (safehouses != null) {
                for (Document sh : safehouses) {
                    System.out.println("  [" + sh.get("cityNode") + "] id=" + sh.get("id")
                            + " faction=" + sh.get("ownerFaction")
                            + " type=" + sh.get("type")
                            + " destroyed=" + sh.get("destroyed")
                            + " securityLevel=" + sh.get("securityLevel"));
                }
            }

            System.out.println("\n=== SAFEHOUSE SNAPSHOT DURING CROSSING TURNS (18-22) ===");
            ObjectMapper mapper = new ObjectMapper();
            List<String> turnHistory = (List<String>) latest.get("turnHistory");
            if (turnHistory != null) {
                for (String json : turnHistory) {
                    Map<String, Object> state = mapper.readValue(json, Map.class);
                    int turn = (int) state.get("currentTurn");
                    if (turn < 18 || turn > 22) continue;

                    System.out.println("\n--- Turn " + turn + " ---");

                    // Print Kazi's position
                    List<Map<String, Object>> attackers = (List<Map<String, Object>>) state.get("aiAttackers");
                    if (attackers != null) {
                        for (Map<String, Object> att : attackers) {
                            if (att.get("name") != null && att.get("name").toString().contains("Kazi")) {
                                System.out.println("  Kazi Rahman @ " + att.get("currentLocation")
                                        + " | state=" + att.get("state")
                                        + " | handoverCity=" + att.get("handoverCity")
                                        + " | handoverTurns=" + att.get("handoverTurnsRemaining")
                                        + " | handoverCompleted=" + att.get("handoverCompleted"));
                            }
                        }
                    }

                    // Print ALL safehouses
                    List<Map<String, Object>> shs = (List<Map<String, Object>>) state.get("safehouses");
                    if (shs != null) {
                        System.out.println("  Safehouses (" + shs.size() + " total):");
                        for (Map<String, Object> sh : shs) {
                            System.out.println("    [" + sh.get("cityNode") + "] id=" + sh.get("id")
                                    + " faction=" + sh.get("ownerFaction")
                                    + " type=" + sh.get("type")
                                    + " destroyed=" + sh.get("destroyed"));
                        }

                        // Highlight kolkata specifically
                        boolean kolkataHostile = shs.stream().anyMatch(s ->
                                "kolkata".equals(s.get("cityNode"))
                                && "HOSTILE".equals(s.get("ownerFaction"))
                                && !Boolean.TRUE.equals(s.get("destroyed")));
                        System.out.println("  >>> Hostile safehouse in KOLKATA: " + kolkataHostile);
                    } else {
                        System.out.println("  Safehouses: none");
                    }
                }
            }
        }
    }
}
