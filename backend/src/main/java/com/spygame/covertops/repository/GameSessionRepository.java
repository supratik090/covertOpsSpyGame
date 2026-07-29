package com.spygame.covertops.repository;

import com.spygame.covertops.model.GameSession;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface GameSessionRepository extends MongoRepository<GameSession, UUID> {
}
