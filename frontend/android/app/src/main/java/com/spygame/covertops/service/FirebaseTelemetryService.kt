package com.spygame.covertops.service

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.spygame.covertops.db.AppDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

object FirebaseTelemetryService {

    private const val TAG = "FirebaseTelemetry"

    private var analytics: FirebaseAnalytics? = null
    private var firestore: FirebaseFirestore? = null
    private var isInitialized = false

    data class ActiveSessionRecord(
        val sessionId: String,
        val scenarioId: String,
        val scenarioTitle: String,
        val username: String,
        val startTimeMs: Long = System.currentTimeMillis(),
        var lastActiveTimeMs: Long = System.currentTimeMillis(),
        var roundsPlayed: Int = 1,
        var accumulatedSeconds: Long = 0L
    ) {
        val totalMinutesSpent: Double
            get() {
                val currentSpan = (System.currentTimeMillis() - lastActiveTimeMs) / 1000L
                val totalSec = accumulatedSeconds + currentSpan.coerceAtLeast(0L)
                return Math.round((totalSec / 60.0) * 100.0) / 100.0
            }
    }

    private val activeSessions = ConcurrentHashMap<String, ActiveSessionRecord>()

    fun init(context: Context) {
        if (isInitialized) return
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(context)
            }
            analytics = FirebaseAnalytics.getInstance(context)
            firestore = FirebaseFirestore.getInstance()
            isInitialized = true
            Log.i(TAG, "Firebase Analytics & Firestore Telemetry initialized successfully.")
        } catch (e: Exception) {
            Log.e(TAG, "Failed initializing Firebase: ${e.message}", e)
        }
    }

    /**
     * Log whenever app is launched
     */
    fun logAppLaunch(context: Context, database: AppDatabase, username: String = "operator") {
        if (!isInitialized) init(context)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val totalSessionsInDb = try { database.gameSessionDao().count() } catch (e: Exception) { 0 }
                val totalScoresInDb = try { database.playerScoreDao().getAllOrderByScoreDesc().size } catch (e: Exception) { 0 }

                // 1. Firebase Analytics Event
                analytics?.let { fb ->
                    val bundle = Bundle().apply {
                        putString("user_id", username)
                        putLong("total_db_sessions", totalSessionsInDb.toLong())
                        putLong("total_db_scores", totalScoresInDb.toLong())
                        putString("app_version", "1.1.6")
                        putString("device_model", Build.MODEL)
                        putLong("launch_timestamp", System.currentTimeMillis())
                    }
                    fb.logEvent("app_launch", bundle)
                    fb.setUserId(username)
                    fb.setUserProperty("operator_id", username)
                }

                // 2. Firestore Document: users/{username}
                firestore?.let { db ->
                    val userDoc = mapOf(
                        "username" to username,
                        "lastAppLaunch" to FieldValue.serverTimestamp(),
                        "deviceModel" to Build.MODEL,
                        "osVersion" to Build.VERSION.RELEASE,
                        "appVersion" to "1.1.6",
                        "totalSessionsCount" to totalSessionsInDb,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                    db.collection("users").document(username)
                        .set(userDoc, SetOptions.merge())

                    // Log audit entry in app_launches collection
                    val launchRecord = mapOf(
                        "username" to username,
                        "timestamp" to FieldValue.serverTimestamp(),
                        "deviceModel" to Build.MODEL,
                        "appVersion" to "1.1.6"
                    )
                    db.collection("app_launches").add(launchRecord)
                }
                Log.i(TAG, "Logged app launch telemetry for operator: $username")
            } catch (e: Exception) {
                Log.w(TAG, "Error recording app launch telemetry: ${e.message}")
            }
        }
    }

    /**
     * Log when a game mission is started
     */
    fun logGameStart(
        sessionId: String,
        scenarioId: String,
        scenarioTitle: String,
        username: String
    ) {
        val record = ActiveSessionRecord(
            sessionId = sessionId,
            scenarioId = scenarioId,
            scenarioTitle = scenarioTitle,
            username = username
        )
        activeSessions[sessionId] = record

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // 1. Firebase Analytics
                analytics?.let { fb ->
                    val bundle = Bundle().apply {
                        putString("session_id", sessionId)
                        putString("scenario_id", scenarioId)
                        putString("scenario_title", scenarioTitle)
                        putString("user_id", username)
                        putInt("round", 1)
                        putLong("start_time", record.startTimeMs)
                    }
                    fb.logEvent("game_session_start", bundle)
                }

                // 2. Firestore Document: telemetry_games/{sessionId}
                firestore?.let { db ->
                    val gameDoc = mapOf(
                        "sessionId" to sessionId,
                        "scenarioId" to scenarioId,
                        "scenarioTitle" to scenarioTitle,
                        "username" to username,
                        "roundsPlayed" to 1,
                        "minutesSpent" to 0.0,
                        "status" to "IN_PROGRESS",
                        "startedAt" to FieldValue.serverTimestamp(),
                        "lastActiveAt" to FieldValue.serverTimestamp()
                    )
                    db.collection("telemetry_games").document(sessionId)
                        .set(gameDoc, SetOptions.merge())

                    // Increment user's game count
                    db.collection("users").document(username)
                        .set(mapOf("totalGamesStarted" to FieldValue.increment(1)), SetOptions.merge())
                }
                Log.i(TAG, "Logged game start: $scenarioTitle (Session $sessionId)")
            } catch (e: Exception) {
                Log.w(TAG, "Error logging game start: ${e.message}")
            }
        }
    }

    /**
     * Log whenever a round/turn is completed
     */
    fun logRoundPlayed(
        sessionId: String,
        roundNumber: Int,
        budgetRemaining: Long,
        cluesCount: Int
    ) {
        val record = activeSessions[sessionId]
        val now = System.currentTimeMillis()
        if (record != null) {
            val delta = (now - record.lastActiveTimeMs) / 1000L
            record.accumulatedSeconds += delta.coerceAtLeast(0L)
            record.lastActiveTimeMs = now
            record.roundsPlayed = roundNumber
        }

        val minutesSpent = record?.totalMinutesSpent ?: 0.0
        val scenarioId = record?.scenarioId ?: "unknown"
        val scenarioTitle = record?.scenarioTitle ?: "Covert Operation"
        val username = record?.username ?: "operator"

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // 1. Firebase Analytics
                analytics?.let { fb ->
                    val bundle = Bundle().apply {
                        putString("session_id", sessionId)
                        putString("scenario_id", scenarioId)
                        putString("scenario_title", scenarioTitle)
                        putString("user_id", username)
                        putInt("round_number", roundNumber)
                        putDouble("minutes_spent", minutesSpent)
                        putLong("budget_remaining", budgetRemaining)
                        putInt("clues_count", cluesCount)
                    }
                    fb.logEvent("game_round_played", bundle)
                }

                // 2. Firestore Document: telemetry_games/{sessionId}
                firestore?.let { db ->
                    val updates = mapOf(
                        "roundsPlayed" to roundNumber,
                        "minutesSpent" to minutesSpent,
                        "budgetRemaining" to budgetRemaining,
                        "cluesCount" to cluesCount,
                        "lastActiveAt" to FieldValue.serverTimestamp()
                    )
                    db.collection("telemetry_games").document(sessionId)
                        .set(updates, SetOptions.merge())

                    // Increment user's total rounds played
                    db.collection("users").document(username)
                        .set(
                            mapOf(
                                "totalRoundsPlayed" to FieldValue.increment(1),
                                "totalMinutesPlayed" to FieldValue.increment(0.5)
                            ),
                            SetOptions.merge()
                        )
                }
                Log.i(TAG, "Logged round $roundNumber for $scenarioId. Minutes spent: $minutesSpent")
            } catch (e: Exception) {
                Log.w(TAG, "Error logging round played: ${e.message}")
            }
        }
    }

    /**
     * Log continuous heartbeat/time spent while user interacts with map/clues
     */
    fun logHeartbeat(sessionId: String, additionalSeconds: Long = 30L) {
        val record = activeSessions[sessionId]
        if (record != null) {
            record.accumulatedSeconds += additionalSeconds
            record.lastActiveTimeMs = System.currentTimeMillis()
            val minutes = record.totalMinutesSpent

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    firestore?.collection("telemetry_games")?.document(sessionId)?.set(
                        mapOf(
                            "minutesSpent" to minutes,
                            "lastActiveAt" to FieldValue.serverTimestamp()
                        ),
                        SetOptions.merge()
                    )
                } catch (e: Exception) {
                    // non-critical
                }
            }
        }
    }

    /**
     * Log game outcome / session completion
     */
    fun logGameCompleted(
        sessionId: String,
        outcome: String,
        finalScore: Long,
        totalRounds: Int
    ) {
        val record = activeSessions[sessionId]
        val minutesSpent = record?.totalMinutesSpent ?: 0.0
        val scenarioId = record?.scenarioId ?: "unknown"
        val scenarioTitle = record?.scenarioTitle ?: "Covert Operation"
        val username = record?.username ?: "operator"

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // 1. Firebase Analytics
                analytics?.let { fb ->
                    val bundle = Bundle().apply {
                        putString("session_id", sessionId)
                        putString("scenario_id", scenarioId)
                        putString("scenario_title", scenarioTitle)
                        putString("user_id", username)
                        putString("outcome", outcome)
                        putLong("final_score", finalScore)
                        putInt("total_rounds", totalRounds)
                        putDouble("minutes_spent", minutesSpent)
                    }
                    fb.logEvent("game_completed", bundle)
                }

                // 2. Firestore Document: telemetry_games/{sessionId}
                firestore?.let { db ->
                    val completion = mapOf(
                        "status" to outcome,
                        "finalScore" to finalScore,
                        "roundsPlayed" to totalRounds,
                        "minutesSpent" to minutesSpent,
                        "completedAt" to FieldValue.serverTimestamp()
                    )
                    db.collection("telemetry_games").document(sessionId)
                        .set(completion, SetOptions.merge())

                    // Update user aggregate stats
                    db.collection("users").document(username).set(
                        mapOf(
                            "totalGamesFinished" to FieldValue.increment(1),
                            "totalMinutesPlayed" to FieldValue.increment(minutesSpent)
                        ),
                        SetOptions.merge()
                    )
                }
                Log.i(TAG, "Logged game completion ($outcome) for $scenarioId. Score: $finalScore, Rounds: $totalRounds, Minutes: $minutesSpent")
            } catch (e: Exception) {
                Log.w(TAG, "Error logging game completion: ${e.message}")
            } finally {
                activeSessions.remove(sessionId)
            }
        }
    }
}
