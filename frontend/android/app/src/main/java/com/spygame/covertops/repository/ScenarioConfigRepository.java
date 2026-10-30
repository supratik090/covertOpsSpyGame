package com.spygame.covertops.repository;

import com.spygame.covertops.model.ScenarioConfig;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ScenarioConfigRepository extends MongoRepository<ScenarioConfig, String> {
    List<ScenarioConfig> findAllByOrderByLastModifiedDesc();
}
