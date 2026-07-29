package com.spygame.covertops.repository;

import com.spygame.covertops.model.ScenarioConfig;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ScenarioConfigRepository extends MongoRepository<ScenarioConfig, String> {
}
