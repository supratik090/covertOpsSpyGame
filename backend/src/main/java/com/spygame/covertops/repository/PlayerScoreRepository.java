package com.spygame.covertops.repository;

import com.spygame.covertops.model.PlayerScore;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlayerScoreRepository extends MongoRepository<PlayerScore, String> {
    List<PlayerScore> findTop5ByOrderByTotalScoreDesc();
    List<PlayerScore> findAllByOrderByTotalScoreDesc();
}
