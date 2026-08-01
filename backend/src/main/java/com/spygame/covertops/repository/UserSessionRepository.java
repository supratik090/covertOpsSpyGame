package com.spygame.covertops.repository;

import com.spygame.covertops.model.UserSession;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface UserSessionRepository extends MongoRepository<UserSession, String> {
    Optional<UserSession> findByToken(String token);
}
