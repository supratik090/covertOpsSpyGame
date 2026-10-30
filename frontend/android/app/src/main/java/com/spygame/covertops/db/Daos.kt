package com.spygame.covertops.db

import androidx.room.*

@Dao
interface ScenarioDao {
    @Query("SELECT * FROM scenarios ORDER BY lastModified DESC")
    fun getAll(): List<ScenarioEntity>

    @Query("SELECT * FROM scenarios WHERE scenarioId = :id LIMIT 1")
    fun getById(id: String): ScenarioEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(scenario: ScenarioEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertAll(scenarios: List<ScenarioEntity>)

    @Query("SELECT COUNT(*) FROM scenarios")
    fun count(): Int
}

@Dao
interface GameSessionDao {
    @Query("SELECT * FROM game_sessions WHERE id = :id LIMIT 1")
    fun getById(id: String): GameSessionEntity?

    @Query("SELECT * FROM game_sessions WHERE status != 'INACTIVE' ORDER BY currentTurn DESC")
    fun getAllActive(): List<GameSessionEntity>

    @Query("SELECT * FROM game_sessions WHERE (ownerUsername = :username OR ownerUsername IS NULL) AND status != 'INACTIVE'")
    fun getAllByUsername(username: String): List<GameSessionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun save(session: GameSessionEntity)

    @Query("DELETE FROM game_sessions WHERE id = :id")
    fun deleteById(id: String)

    @Query("SELECT COUNT(*) FROM game_sessions")
    fun count(): Int
}

@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE LOWER(username) = LOWER(:username) LIMIT 1")
    fun findByUsername(username: String): UserEntity?

    @Query("SELECT * FROM users WHERE LOWER(email) = LOWER(:email) LIMIT 1")
    fun findByEmail(email: String): UserEntity?

    @Query("SELECT * FROM users WHERE LOWER(username) = LOWER(:identifier) OR LOWER(email) = LOWER(:identifier) LIMIT 1")
    fun findByIdentifier(identifier: String): UserEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    fun insert(user: UserEntity)

    @Update
    fun update(user: UserEntity)

    @Query("SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER(:username)")
    fun countByUsername(username: String): Int

    @Query("SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(:email)")
    fun countByEmail(email: String): Int

    @Query("SELECT COUNT(*) FROM users")
    fun count(): Int
}

@Dao
interface UserSessionDao {
    @Query("SELECT * FROM user_sessions WHERE token = :token LIMIT 1")
    fun findByToken(token: String): UserSessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun save(session: UserSessionEntity)

    @Query("DELETE FROM user_sessions WHERE token = :token")
    fun deleteByToken(token: String)
}

@Dao
interface PlayerScoreDao {
    @Query("SELECT * FROM player_scores WHERE username = :username LIMIT 1")
    fun findByUsername(username: String): PlayerScoreEntity?

    @Query("SELECT * FROM player_scores ORDER BY totalScore DESC LIMIT 5")
    fun getTop5(): List<PlayerScoreEntity>

    @Query("SELECT * FROM player_scores ORDER BY totalScore DESC")
    fun getAllOrderByScoreDesc(): List<PlayerScoreEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun save(score: PlayerScoreEntity)
}
