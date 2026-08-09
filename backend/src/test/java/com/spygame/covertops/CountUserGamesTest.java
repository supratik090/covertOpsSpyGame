package com.spygame.covertops;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;

public class CountUserGamesTest {
    @Test
    public void testCount() throws Exception {
        String uri = "mongo_URL";
        try (MongoClient client = MongoClients.create(uri)) {
            MongoDatabase db = client.getDatabase("covert_ops");
            MongoCollection<Document> col = db.getCollection("game_sessions");
            List<Document> allActive = new ArrayList<>();
            
            Document query = new Document();
            query.put("status", "ACTIVE");
            
            List<Document> orList = new ArrayList<>();
            orList.add(new Document("ownerUsername", "testuser"));
            orList.add(new Document("playerB", "testuser"));
            query.put("$or", orList);
            
            col.find(query).into(allActive);
            
            System.out.println("USER_GAMES_COUNT_RESULT: " + allActive.size());
            for (Document d : allActive) {
                System.out.println("Active Game Session ID: " + d.get("_id") 
                    + " | Scenario: " + d.get("scenarioId")
                    + " | Role: " + d.get("playerRole")
                    + " | Turn: " + d.get("currentTurn"));
            }
        }
    }
}
