package com.spygame.covertops.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Document(collection = "user_sessions")
public class UserSession {
    @Id
    private String token;
    private String username;
    private LocalDateTime expiryTime;

    public UserSession() {}

    public UserSession(String token, String username, LocalDateTime expiryTime) {
        this.token = token;
        this.username = username;
        this.expiryTime = expiryTime;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public LocalDateTime getExpiryTime() { return expiryTime; }
    public void setExpiryTime(LocalDateTime expiryTime) { this.expiryTime = expiryTime; }
}
