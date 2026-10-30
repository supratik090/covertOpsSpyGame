package com.spygame.covertops.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Document(collection = "password_reset_otps")
public class PasswordResetOTP {
    @Id
    private String id;
    private String userId;
    private String email;
    private String otpCode;
    private LocalDateTime expiryTime;
    private boolean used;

    public PasswordResetOTP() {}

    public PasswordResetOTP(String userId, String email, String otpCode, LocalDateTime expiryTime) {
        this.userId = userId;
        this.email = email;
        this.otpCode = otpCode;
        this.expiryTime = expiryTime;
        this.used = false;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getOtpCode() { return otpCode; }
    public void setOtpCode(String otpCode) { this.otpCode = otpCode; }

    public LocalDateTime getExpiryTime() { return expiryTime; }
    public void setExpiryTime(LocalDateTime expiryTime) { this.expiryTime = expiryTime; }

    public boolean isUsed() { return used; }
    public void setUsed(boolean used) { this.used = used; }
}
