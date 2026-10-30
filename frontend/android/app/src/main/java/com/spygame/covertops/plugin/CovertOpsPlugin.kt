package com.spygame.covertops.plugin

import android.net.Uri
import android.util.Log
import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.spygame.covertops.GameEngine
import com.spygame.covertops.model.EndTurnRequest
import com.spygame.covertops.model.GameSession
import com.spygame.covertops.model.ScenarioConfig
import com.spygame.covertops.service.FirebaseTelemetryService
import java.util.UUID

@CapacitorPlugin(name = "CovertOps")
open class CovertOpsPlugin : Plugin() {

    private val TAG = "CovertOpsPlugin"

    private val mapper by lazy {
        ObjectMapper()
            .registerModule(JavaTimeModule())
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
    }

    override fun load() {
        super.load()
        GameEngine.init(context)
        FirebaseTelemetryService.init(context)
        FirebaseTelemetryService.logAppLaunch(context, GameEngine.database, "operator")
        Log.i(TAG, "CovertOpsPlugin loaded and GameEngine + Firebase Telemetry initialized.")
    }

    @PluginMethod
    fun executeRequest(call: PluginCall) {
        val urlStr = call.getString("url") ?: call.getString("path") ?: ""
        val method = (call.getString("method") ?: "GET").uppercase()
        val bodyStr = call.getString("body")
        val authHeader = call.getString("authHeader") ?: ""

        val token = if (authHeader.startsWith("Bearer ")) {
            authHeader.substring(7).trim()
        } else {
            ""
        }
        val currentUsername = GameEngine.authService.getUsernameForToken(token) ?: "operator"

        try {
            val uri = Uri.parse(urlStr)
            val path = uri.path ?: urlStr

            val responseJson = handleRoute(path, uri, method, bodyStr, currentUsername)
            val ret = JSObject()
            ret.put("status", 200)
            ret.put("json", responseJson)
            call.resolve(ret)
        } catch (e: RouteException) {
            val ret = JSObject()
            ret.put("status", e.statusCode)
            ret.put("json", mapper.writeValueAsString(mapOf("message" to e.message, "error" to e.message)))
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e(TAG, "Error executing request for $urlStr: ${e.message}", e)
            val ret = JSObject()
            ret.put("status", 500)
            ret.put("json", mapper.writeValueAsString(mapOf("message" to (e.message ?: "Internal Server Error"))))
            call.resolve(ret)
        }
    }

    private fun handleRoute(
        path: String,
        uri: Uri,
        method: String,
        bodyStr: String?,
        currentUsername: String
    ): String {
        // 1. Health
        if (path.endsWith("/api/health") || path.endsWith("/health")) {
            return mapper.writeValueAsString(
                mapOf(
                    "status" to "UP",
                    "timestamp" to System.currentTimeMillis(),
                    "message" to "CovertOps Native Android Engine is fully operational"
                )
            )
        }

        // 2. Auth Routes
        if (path.contains("/api/auth/register")) {
            val body = parseBodyMap(bodyStr)
            val res = GameEngine.authService.register(
                body["username"],
                body["email"],
                body["password"],
                body["securityQuestion"],
                body["securityAnswer"]
            )
            if (!res.success) throw RouteException(400, res.message)
            return mapper.writeValueAsString(mapOf("message" to res.message))
        }

        if (path.contains("/api/auth/login")) {
            val body = parseBodyMap(bodyStr)
            val identifier = body["username"] ?: body["identifier"]
            val res = GameEngine.authService.login(identifier, body["password"])
            if (!res.success) throw RouteException(401, res.message)
            FirebaseTelemetryService.logAppLaunch(context, GameEngine.database, res.username ?: "operator")
            return mapper.writeValueAsString(
                mapOf(
                    "message" to res.message,
                    "username" to res.username,
                    "token" to res.token
                )
            )
        }

        if (path.contains("/api/auth/forgot-password/request-otp")) {
            val body = parseBodyMap(bodyStr)
            val identifier = body["identifier"] ?: body["username"]
            val res = GameEngine.authService.getSecurityQuestion(identifier)
            if (!res.success) throw RouteException(404, res.message)
            return mapper.writeValueAsString(
                mapOf(
                    "message" to (res.securityQuestion ?: "Security question retrieved."),
                    "securityQuestion" to (res.securityQuestion ?: "What is your primary agency safehouse station?"),
                    "email" to (res.maskedEmail ?: "***@***")
                )
            )
        }

        if (path.contains("/api/auth/forgot-password/reset")) {
            val body = parseBodyMap(bodyStr)
            val identifier = body["identifier"] ?: body["username"]
            val answer = body["securityAnswer"] ?: body["answer"] ?: body["otp"]
            val newPassword = body["newPassword"]
            val res = GameEngine.authService.resetPassword(identifier, answer, newPassword)
            if (!res.success) throw RouteException(400, res.message)
            return mapper.writeValueAsString(mapOf("message" to res.message))
        }

        // 3. Scenario List
        if (path.endsWith("/api/game/scenarios")) {
            val scenarios = GameEngine.sessionService.availableScenarios
            return mapper.writeValueAsString(scenarios)
        }

        // 4. Game Creation
        if (path.endsWith("/api/game/create")) {
            val scenarioId = uri.getQueryParameter("scenarioId")
                ?: throw RouteException(400, "Missing scenarioId")
            val playerRole = uri.getQueryParameter("playerRole") ?: "DEFENDER"
            val isFirstTime = uri.getQueryParameter("isFirstTimeUser")?.toBoolean() ?: false
            val session = GameEngine.sessionService.createSession(scenarioId, playerRole, currentUsername, isFirstTime)
            
            val config = try { GameEngine.scenarioRepository.findById(scenarioId).orElse(null) } catch (e: Exception) { null }
            val scenarioTitle = config?.title ?: scenarioId
            FirebaseTelemetryService.logGameStart(session.id.toString(), scenarioId, scenarioTitle, currentUsername)

            return mapper.writeValueAsString(session)
        }

        // 5. Game List
        if (path.endsWith("/api/game/list")) {
            val sessions = GameEngine.sessionService.listSessions(currentUsername)
            return mapper.writeValueAsString(sessions)
        }

        // 6. Scores Leaderboard & Me
        if (path.endsWith("/leaderboard")) {
            val leaderboard = GameEngine.scoringService.top5Leaderboard
            return mapper.writeValueAsString(leaderboard)
        }

        if (path.endsWith("/api/scores/me") || path.endsWith("/api/game/scores/me")) {
            val myScores = GameEngine.scoringService.getPlayerRankAndScores(currentUsername)
            return mapper.writeValueAsString(myScores)
        }

        if (path.contains("/api/scores/session/") || path.contains("/api/game/scores/session/")) {
            val sessionIdStr = path.substringAfterLast("/")
            val sessionId = UUID.fromString(sessionIdStr)
            val session = GameEngine.sessionService.getSession(sessionId)
                ?: throw RouteException(404, "Session not found")
            val breakdown = GameEngine.scoringService.calculateScore(session)
            return mapper.writeValueAsString(breakdown)
        }

        // 7. Operations on Game Session: /api/game/{id}/...
        val gamePrefix = "/api/game/"
        if (path.contains(gamePrefix)) {
            val rest = path.substringAfter(gamePrefix)
            val segments = rest.split("/")
            val sessionIdStr = segments[0]
            val sessionId = try {
                UUID.fromString(sessionIdStr)
            } catch (e: Exception) {
                null
            }

            if (sessionId != null) {
                // DELETE /api/game/{id}
                if (segments.size == 1 && method == "DELETE") {
                    GameEngine.sessionService.deleteSession(sessionId)
                    return mapper.writeValueAsString(mapOf("success" to true))
                }

                // GET /api/game/{id}
                if (segments.size == 1 && method == "GET") {
                    val session = GameEngine.sessionService.getSession(sessionId)
                        ?: throw RouteException(404, "Session not found")
                    return mapper.writeValueAsString(session)
                }

                val action = if (segments.size > 1) segments[1] else ""

                if (action == "end-turn") {
                    val request = if (!bodyStr.isNullOrBlank()) {
                        mapper.readValue(bodyStr, EndTurnRequest::class.java)
                    } else {
                        EndTurnRequest()
                    }
                    val updated = GameEngine.sessionService.processEndTurn(sessionId, request, currentUsername)

                    FirebaseTelemetryService.logRoundPlayed(
                        sessionId.toString(),
                        updated.currentTurn,
                        updated.budget.toLong(),
                        updated.discoveredClues?.size ?: 0
                    )

                    val statusStr = updated.status ?: "ACTIVE"
                    if (statusStr == "SUCCESS" || statusStr == "PARTIAL_DEFENDER_VICTORY" || statusStr == "COMPROMISED") {
                        val score = try {
                            GameEngine.scoringService.calculateScore(updated)?.totalScore?.toLong() ?: 0L
                        } catch (e: Exception) { 0L }

                        FirebaseTelemetryService.logGameCompleted(
                            sessionId.toString(),
                            statusStr,
                            score,
                            updated.currentTurn
                        )
                    }

                    return mapper.writeValueAsString(updated)
                }

                if (action == "heartbeat") {
                    val seconds = uri.getQueryParameter("seconds")?.toLongOrNull() ?: 30L
                    FirebaseTelemetryService.logHeartbeat(sessionId.toString(), seconds)
                    return mapper.writeValueAsString(mapOf("success" to true))
                }

                if (action == "deploy") {
                    val body = parseBodyObjectMap(bodyStr)
                    @Suppress("UNCHECKED_CAST")
                    val safehouses = (body["safehouses"] as? List<String>) ?: emptyList()
                    @Suppress("UNCHECKED_CAST")
                    val agentDeployments = (body["agentDeployments"] as? Map<String, String>) ?: emptyMap()
                    @Suppress("UNCHECKED_CAST")
                    val teamDeployments = (body["teamDeployments"] as? Map<String, String>) ?: emptyMap()
                    val droneBaseCity = body["droneBaseCity"] as? String
                    val updated = GameEngine.deploymentService.commitDeployment(
                        sessionId, safehouses, agentDeployments, teamDeployments, droneBaseCity
                    )
                    return mapper.writeValueAsString(updated)
                }

                if (action == "hints") {
                    val hints = GameEngine.hintService.generateHints(sessionId)
                    return mapper.writeValueAsString(hints)
                }

                if (action == "replay") {
                    val session = GameEngine.sessionService.getSession(sessionId)
                        ?: throw RouteException(404, "Session not found")
                    val replay = mapOf(
                        "primaryPlan" to (session.aiMasterPlan?.primaryPlan ?: emptyList()),
                        "fallbackPlan" to (session.aiMasterPlan?.fallbackPlan ?: emptyList())
                    )
                    return mapper.writeValueAsString(replay)
                }

                if (action == "revert-turn") {
                    val updated = GameEngine.sessionService.revertTurn(sessionId)
                    return mapper.writeValueAsString(updated)
                }

                if (action == "extend") {
                    val updated = GameEngine.sessionService.extendSession(sessionId)
                    return mapper.writeValueAsString(updated)
                }

                if (action == "agent" && segments.size > 2) {
                    val subAction = segments[2]
                    val session = GameEngine.sessionService.getSession(sessionId)
                        ?: throw RouteException(404, "Session not found")
                    val config = loadConfig(session.scenarioId)

                    if (subAction == "relocate") {
                        val agentId = uri.getQueryParameter("agentId")?.toIntOrNull() ?: 1
                        val targetCity = uri.getQueryParameter("targetCity") ?: ""
                        val updated = GameEngine.playerDefenderService.relocateAgent(session, agentId, targetCity, config)
                        GameEngine.sessionService.saveSession(updated)
                        return mapper.writeValueAsString(updated)
                    }

                    if (subAction == "task") {
                        val agentId = uri.getQueryParameter("agentId")?.toIntOrNull() ?: 1
                        val task = uri.getQueryParameter("task") ?: ""
                        val updated = GameEngine.playerDefenderService.assignAgentTask(session, agentId, task)
                        GameEngine.sessionService.saveSession(updated)
                        return mapper.writeValueAsString(updated)
                    }
                }

                if (action == "team" && segments.size > 2) {
                    val subAction = segments[2]
                    val session = GameEngine.sessionService.getSession(sessionId)
                        ?: throw RouteException(404, "Session not found")
                    val config = loadConfig(session.scenarioId)

                    if (subAction == "relocate") {
                        val teamId = uri.getQueryParameter("teamId")?.toIntOrNull() ?: 1
                        val targetCity = uri.getQueryParameter("targetCity") ?: ""
                        val updated = GameEngine.playerDefenderService.relocateTacticalTeam(session, teamId, targetCity, config)
                        GameEngine.sessionService.saveSession(updated)
                        return mapper.writeValueAsString(updated)
                    }
                }

                if (action == "safehouse" && segments.size > 2 && segments[2] == "build") {
                    val session = GameEngine.sessionService.getSession(sessionId)
                        ?: throw RouteException(404, "Session not found")
                    val config = loadConfig(session.scenarioId)
                    val cityNode = uri.getQueryParameter("cityNode") ?: ""
                    val updated = GameEngine.playerDefenderService.buildSafehouse(session, cityNode, config)
                    GameEngine.sessionService.saveSession(updated)
                    return mapper.writeValueAsString(updated)
                }

                if (action == "tech" && segments.size > 2 && segments[2] == "deploy") {
                    val session = GameEngine.sessionService.getSession(sessionId)
                        ?: throw RouteException(404, "Session not found")
                    val config = loadConfig(session.scenarioId)
                    val type = uri.getQueryParameter("type") ?: ""
                    val cityNode = uri.getQueryParameter("cityNode") ?: ""
                    val updated = GameEngine.playerDefenderService.deployEspionageResource(session, type, cityNode, config)
                    GameEngine.sessionService.saveSession(updated)
                    return mapper.writeValueAsString(updated)
                }

                if (action == "defender" && segments.size > 2 && segments[2] == "buy-drone") {
                    val session = GameEngine.sessionService.getSession(sessionId)
                        ?: throw RouteException(404, "Session not found")
                    val config = loadConfig(session.scenarioId)
                    val cityNode = uri.getQueryParameter("cityNode") ?: ""
                    val type = uri.getQueryParameter("type") ?: "1-HOP"
                    val updated = GameEngine.playerDefenderService.buyDrone(session, cityNode, type, config)
                    GameEngine.sessionService.saveSession(updated)
                    return mapper.writeValueAsString(updated)
                }
            }
        }

        throw RouteException(404, "Endpoint not found: $method $path")
    }

    private fun loadConfig(scenarioId: String): ScenarioConfig {
        return GameEngine.scenarioRepository.findById(scenarioId).orElse(null)
            ?: throw RouteException(404, "Scenario not found: $scenarioId")
    }

    private fun parseBodyMap(bodyStr: String?): Map<String, String> {
        if (bodyStr.isNullOrBlank()) return emptyMap()
        return try {
            val typeRef = object : TypeReference<Map<String, String>>() {}
            mapper.readValue(bodyStr, typeRef)
        } catch (e: Exception) {
            emptyMap()
        }
    }

    private fun parseBodyObjectMap(bodyStr: String?): Map<String, Any> {
        if (bodyStr.isNullOrBlank()) return emptyMap()
        return try {
            val typeRef = object : TypeReference<Map<String, Any>>() {}
            mapper.readValue(bodyStr, typeRef)
        } catch (e: Exception) {
            emptyMap()
        }
    }

    private class RouteException(val statusCode: Int, override val message: String) : Exception(message)
}
