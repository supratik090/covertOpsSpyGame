package com.spygame.covertops.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "scenarios")
data class ScenarioEntity(
    @PrimaryKey val scenarioId: String,
    val title: String,
    val targetCity: String?,
    val lastModified: Long,
    val configJson: String
)

@Entity(tableName = "game_sessions")
data class GameSessionEntity(
    @PrimaryKey val id: String, // UUID string
    val scenarioId: String,
    val status: String,
    val currentTurn: Int,
    val maxTurns: Int,
    val ownerUsername: String?,
    val sessionJson: String
)

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val username: String,
    val email: String,
    val passwordHash: String,
    val securityQuestion: String? = null,
    val securityAnswerHash: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "user_sessions")
data class UserSessionEntity(
    @PrimaryKey val token: String,
    val username: String,
    val expiryTime: Long
)

@Entity(tableName = "player_scores")
data class PlayerScoreEntity(
    @PrimaryKey val username: String,
    val totalScore: Int,
    val scenarioScoresJson: String
)
