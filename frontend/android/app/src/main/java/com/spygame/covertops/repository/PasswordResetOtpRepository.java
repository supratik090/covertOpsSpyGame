package com.spygame.covertops.repository;

import com.spygame.covertops.model.PasswordResetOTP;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PasswordResetOtpRepository extends MongoRepository<PasswordResetOTP, String> {
    Optional<PasswordResetOTP> findTopByEmailAndUsedFalseOrderByExpiryTimeDesc(String email);
    Optional<PasswordResetOTP> findTopByUserIdAndUsedFalseOrderByExpiryTimeDesc(String userId);
}
