package com.spygame.covertops.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    public void sendOtpEmail(String toEmail, String otpCode) {
        logger.info("[OTP DISPATCH] Generated OTP [{}] for recipient [{}]", otpCode, toEmail);

        if (mailSender == null || fromEmail == null || fromEmail.trim().isEmpty()) {
            logger.warn("[SMTP UNCONFIGURED] Skipping actual SMTP send. Dev mode fallback: OTP for {} is {}", toEmail, otpCode);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("SHADOW PROTOCOL - Passphrase Reset OTP");
            message.setText(
                "AGENT CLEARANCE NOTICE:\n\n" +
                "Your one-time passcode (OTP) for resetting your clearance passphrase is:\n\n" +
                "   " + otpCode + "\n\n" +
                "This passcode is valid for 10 minutes. If you did not request this, secure your account immediately.\n\n" +
                "COVERT OPS SECURITY HEADQUARTERS"
            );
            mailSender.send(message);
            logger.info("[SMTP SUCCESS] OTP email dispatched successfully to {}", toEmail);
        } catch (Exception e) {
            logger.error("[SMTP ERROR] Failed to send email via SMTP to {}: {}", toEmail, e.getMessage());
            logger.info("[FALLBACK] OTP for recipient [{}] is: {}", toEmail, otpCode);
        }
    }
}
