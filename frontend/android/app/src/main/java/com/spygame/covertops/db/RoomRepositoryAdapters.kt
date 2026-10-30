package com.spygame.covertops.db

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.spygame.covertops.model.*
import com.spygame.covertops.repository.*
import java.util.Optional
import java.util.UUID

private val sharedMapper = ObjectMapper()
    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)

class RoomScenarioRepository(private val dao: ScenarioDao) : ScenarioConfigRepository {
    private val mapper = sharedMapper

    override fun <S : ScenarioConfig?> save(entity: S): S {
        if (entity == null) return entity
        val json = mapper.writeValueAsString(entity)
        val scenarioEntity = ScenarioEntity(
            scenarioId = entity.scenarioId,
            title = entity.title ?: entity.scenarioId,
            targetCity = entity.targetCity,
            lastModified = entity.lastModified ?: System.currentTimeMillis(),
            configJson = json
        )
        dao.insert(scenarioEntity)
        return entity
    }

    override fun findById(id: String?): Optional<ScenarioConfig> {
        if (id == null) return Optional.empty()
        val entity = dao.getById(id) ?: return Optional.empty()
        return try {
            val config = mapper.readValue(entity.configJson, ScenarioConfig::class.java)
            Optional.ofNullable(config)
        } catch (e: Exception) {
            Optional.empty()
        }
    }

    override fun findAll(): List<ScenarioConfig> {
        return dao.getAll().mapNotNull { entity ->
            try {
                mapper.readValue(entity.configJson, ScenarioConfig::class.java)
            } catch (e: Exception) {
                null
            }
        }
    }

    override fun findAllByOrderByLastModifiedDesc(): List<ScenarioConfig> {
        return findAll()
    }

    override fun deleteById(id: String?) {
        // Not used
    }

    override fun delete(entity: ScenarioConfig?) {
        // Not used
    }

    override fun existsById(id: String?): Boolean {
        if (id == null) return false
        return dao.getById(id) != null
    }
}

class RoomGameSessionRepository(private val dao: GameSessionDao) : GameSessionRepository {
    private val mapper = sharedMapper

    override fun <S : GameSession?> save(entity: S): S {
        if (entity == null) return entity
        val json = mapper.writeValueAsString(entity)
        val sessionEntity = GameSessionEntity(
            id = entity.id.toString(),
            scenarioId = entity.scenarioId ?: "",
            status = entity.status ?: "ACTIVE",
            currentTurn = entity.currentTurn,
            maxTurns = entity.maxTurns,
            ownerUsername = entity.ownerUsername,
            sessionJson = json
        )
        dao.save(sessionEntity)
        return entity
    }

    override fun findById(id: UUID?): Optional<GameSession> {
        if (id == null) return Optional.empty()
        val entity = dao.getById(id.toString()) ?: return Optional.empty()
        return try {
            val session = mapper.readValue(entity.sessionJson, GameSession::class.java)
            Optional.ofNullable(session)
        } catch (e: Exception) {
            Optional.empty()
        }
    }

    override fun findAll(): List<GameSession> {
        return dao.getAllActive().mapNotNull { entity ->
            try {
                mapper.readValue(entity.sessionJson, GameSession::class.java)
            } catch (e: Exception) {
                null
            }
        }
    }

    fun findAllByUsername(username: String): List<GameSession> {
        return dao.getAllByUsername(username).mapNotNull { entity ->
            try {
                mapper.readValue(entity.sessionJson, GameSession::class.java)
            } catch (e: Exception) {
                null
            }
        }
    }

    override fun deleteById(id: UUID?) {
        if (id != null) {
            dao.deleteById(id.toString())
        }
    }

    override fun delete(entity: GameSession?) {
        if (entity?.id != null) {
            dao.deleteById(entity.id.toString())
        }
    }

    override fun existsById(id: UUID?): Boolean {
        if (id == null) return false
        return dao.getById(id.toString()) != null
    }
}

class RoomPlayerScoreRepository(private val dao: PlayerScoreDao) : PlayerScoreRepository {
    private val mapper = sharedMapper

    override fun <S : PlayerScore?> save(entity: S): S {
        if (entity == null) return entity
        val scoresJson = mapper.writeValueAsString(entity.scenarioScores ?: emptyMap<String, Any>())
        val scoreEntity = PlayerScoreEntity(
            username = entity.username,
            totalScore = entity.totalScore,
            scenarioScoresJson = scoresJson
        )
        dao.save(scoreEntity)
        return entity
    }

    override fun findById(username: String?): Optional<PlayerScore> {
        if (username == null) return Optional.empty()
        val entity = dao.findByUsername(username) ?: return Optional.empty()
        return try {
            val score = PlayerScore(entity.username)
            score.totalScore = entity.totalScore
            val mapType = object : TypeReference<Map<String, PlayerScore.ScenarioScore>>() {}
            val scenarioScores = mapper.readValue(entity.scenarioScoresJson, mapType)
            score.scenarioScores = scenarioScores
            Optional.of(score)
        } catch (e: Exception) {
            Optional.empty()
        }
    }

    override fun findTop5ByOrderByTotalScoreDesc(): List<PlayerScore> {
        return dao.getTop5().mapNotNull { toPlayerScore(it) }
    }

    override fun findAllByOrderByTotalScoreDesc(): List<PlayerScore> {
        return dao.getAllOrderByScoreDesc().mapNotNull { toPlayerScore(it) }
    }

    private fun toPlayerScore(entity: PlayerScoreEntity): PlayerScore? {
        return try {
            val score = PlayerScore(entity.username)
            score.totalScore = entity.totalScore
            val mapType = object : TypeReference<Map<String, PlayerScore.ScenarioScore>>() {}
            score.scenarioScores = mapper.readValue(entity.scenarioScoresJson, mapType)
            score
        } catch (e: Exception) {
            null
        }
    }

    override fun findAll(): List<PlayerScore> {
        return findAllByOrderByTotalScoreDesc()
    }

    override fun deleteById(id: String?) {}
    override fun delete(entity: PlayerScore?) {}
    override fun existsById(id: String?): Boolean {
        if (id == null) return false
        return dao.findByUsername(id) != null
    }
}

class RoomUserRepository(private val dao: UserDao) : UserRepository {

    override fun <S : User?> save(entity: S): S {
        if (entity == null) return entity
        val existing = dao.findByUsername(entity.username)
        val userEntity = UserEntity(
            username = entity.username,
            email = entity.email ?: "",
            passwordHash = entity.passwordHash ?: "",
            securityQuestion = existing?.securityQuestion,
            securityAnswerHash = existing?.securityAnswerHash
        )
        if (existing != null) {
            dao.update(userEntity)
        } else {
            dao.insert(userEntity)
        }
        return entity
    }

    override fun findByUsername(username: String?): Optional<User> {
        if (username == null) return Optional.empty()
        val entity = dao.findByUsername(username) ?: return Optional.empty()
        return Optional.of(User(entity.username, entity.email, entity.passwordHash))
    }

    override fun findByEmail(email: String?): Optional<User> {
        if (email == null) return Optional.empty()
        val entity = dao.findByEmail(email) ?: return Optional.empty()
        return Optional.of(User(entity.username, entity.email, entity.passwordHash))
    }

    override fun findByUsernameOrEmail(username: String?, email: String?): Optional<User> {
        val identifier = username ?: email ?: return Optional.empty()
        val entity = dao.findByIdentifier(identifier) ?: return Optional.empty()
        return Optional.of(User(entity.username, entity.email, entity.passwordHash))
    }

    override fun existsByUsername(username: String?): Boolean {
        if (username == null) return false
        return dao.countByUsername(username) > 0
    }

    override fun existsByEmail(email: String?): Boolean {
        if (email == null) return false
        return dao.countByEmail(email) > 0
    }

    override fun findById(id: String?): Optional<User> = findByUsername(id)
    override fun findAll(): List<User> = emptyList()
    override fun deleteById(id: String?) {}
    override fun delete(entity: User?) {}
    override fun existsById(id: String?): Boolean = existsByUsername(id)
}
