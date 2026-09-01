package com.spygame.covertops.controller;

import com.spygame.covertops.model.PasswordResetOTP;
import com.spygame.covertops.model.User;
import com.spygame.covertops.model.UserSession;
import com.spygame.covertops.repository.PasswordResetOtpRepository;
import com.spygame.covertops.repository.UserRepository;
import com.spygame.covertops.repository.UserSessionRepository;
import com.spygame.covertops.service.EmailService;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.POST, RequestMethod.OPTIONS})
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserSessionRepository userSessionRepository;

    @Autowired
    private PasswordResetOtpRepository passwordResetOtpRepository;

    @Autowired
    private EmailService emailService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String email = request.get("email");
        String password = request.get("password");

        if (username == null || username.trim().isEmpty() || 
            email == null || email.trim().isEmpty() || 
            password == null || password.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Operator ID, email, and passphrase are required."));
        }

        String trimmedUsername = username.trim();
        String trimmedEmail = email.trim().toLowerCase();

        if (userRepository.existsByUsername(trimmedUsername)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Operator ID already classified."));
        }

        if (userRepository.existsByEmail(trimmedEmail)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Email address is already registered."));
        }

        String hash = passwordEncoder.encode(password);
        User user = new User(trimmedUsername, trimmedEmail, hash);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Operator successfully registered."));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String identifier = request.get("username");
        if (identifier == null || identifier.trim().isEmpty()) {
            identifier = request.get("identifier");
        }
        String password = request.get("password");

        if (identifier == null || identifier.trim().isEmpty() || password == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Operator ID/Email and passphrase are required."));
        }

        String cleanIdentifier = identifier.trim();
        Optional<User> userOpt = userRepository.findByUsernameOrEmail(cleanIdentifier, cleanIdentifier.toLowerCase());

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid credentials."));
        }

        User user = userOpt.get();
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid credentials."));
        }

        String token = UUID.randomUUID().toString();
        LocalDateTime expiry = LocalDateTime.now().plusHours(24);
        UserSession session = new UserSession(token, user.getUsername(), expiry);
        userSessionRepository.save(session);

        return ResponseEntity.ok(Map.of(
            "message", "Authentication successful.",
            "username", user.getUsername(),
            "token", token
        ));
    }

    @PostMapping("/forgot-password/request-otp")
    public ResponseEntity<?> requestOtp(@RequestBody Map<String, String> request) {
        String identifier = request.get("identifier");
        if (identifier == null || identifier.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Operator ID or email address is required."));
        }

        String cleanIdentifier = identifier.trim();
        Optional<User> userOpt = userRepository.findByUsernameOrEmail(cleanIdentifier, cleanIdentifier.toLowerCase());

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "No classified operator found with provided credentials."));
        }

        User user = userOpt.get();
        if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No registered email on file for this operator."));
        }

        String otpCode = String.format("%06d", random.nextInt(1000000));
        LocalDateTime expiryTime = LocalDateTime.now().plusMinutes(10);

        PasswordResetOTP otpEntity = new PasswordResetOTP(user.getUsername(), user.getEmail(), otpCode, expiryTime);
        passwordResetOtpRepository.save(otpEntity);

        emailService.sendOtpEmail(user.getEmail(), otpCode);

        // Mask email for user response display (e.g. j***@domain.com)
        String maskedEmail = maskEmail(user.getEmail());

        return ResponseEntity.ok(Map.of(
            "message", "Passcode dispatched to classified email address.",
            "email", maskedEmail
        ));
    }

    @PostMapping("/forgot-password/reset")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> request) {
        String identifier = request.get("identifier");
        String otpCode = request.get("otp");
        String newPassword = request.get("newPassword");

        if (identifier == null || identifier.trim().isEmpty() ||
            otpCode == null || otpCode.trim().isEmpty() ||
            newPassword == null || newPassword.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Operator ID/Email, OTP, and new passphrase are required."));
        }

        String cleanIdentifier = identifier.trim();
        Optional<User> userOpt = userRepository.findByUsernameOrEmail(cleanIdentifier, cleanIdentifier.toLowerCase());

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Operator record not found."));
        }

        User user = userOpt.get();

        Optional<PasswordResetOTP> otpOpt = passwordResetOtpRepository
                .findTopByEmailAndUsedFalseOrderByExpiryTimeDesc(user.getEmail());

        if (otpOpt.isEmpty()) {
            otpOpt = passwordResetOtpRepository
                    .findTopByUserIdAndUsedFalseOrderByExpiryTimeDesc(user.getUsername());
        }

        if (otpOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No active OTP request found. Please request a new code."));
        }

        PasswordResetOTP otpEntity = otpOpt.get();

        if (otpEntity.getExpiryTime().isBefore(LocalDateTime.now())) {
            return ResponseEntity.badRequest().body(Map.of("message", "OTP has expired. Please request a new code."));
        }

        if (!otpEntity.getOtpCode().equals(otpCode.trim())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid OTP code provided."));
        }

        // Update password and invalidate OTP
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        otpEntity.setUsed(true);
        passwordResetOtpRepository.save(otpEntity);

        return ResponseEntity.ok(Map.of("message", "Passphrase reset successful. You may now authenticate."));
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "***@***";
        String[] parts = email.split("@");
        String name = parts[0];
        String domain = parts[1];
        if (name.length() <= 2) {
            return name.charAt(0) + "***@" + domain;
        }
        return name.charAt(0) + "***" + name.charAt(name.length() - 1) + "@" + domain;
    }
}
