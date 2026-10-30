package com.spygame.covertops.db

import android.content.Context
import android.util.Log
import org.json.JSONObject
import org.mindrot.jbcrypt.BCrypt
import java.io.BufferedReader
import java.io.InputStreamReader

object DatabaseSeeder {

    private const val TAG = "DatabaseSeeder"

    fun seedInitialData(context: Context, database: AppDatabase) {
        seedScenarios(context, database.scenarioDao())
        seedDefaultUser(database.userDao())
    }

    fun seedScenarios(context: Context, scenarioDao: ScenarioDao) {
        try {
            val scenarioFiles = context.assets.list("scenarios") ?: return
            Log.i(TAG, "Found ${scenarioFiles.size} scenario assets to seed.")

            val scenarioEntities = mutableListOf<ScenarioEntity>()

            for (fileName in scenarioFiles) {
                if (!fileName.endsWith(".json")) continue
                try {
                    val inputStream = context.assets.open("scenarios/$fileName")
                    val jsonContent = BufferedReader(InputStreamReader(inputStream)).use { it.readText() }
                    val jsonObject = JSONObject(jsonContent)

                    val scenarioId = jsonObject.optString("scenarioId", fileName.removeSuffix(".json"))
                    val title = jsonObject.optString("title", scenarioId)
                    val targetCity = if (jsonObject.has("targetCity")) jsonObject.getString("targetCity") else null
                    val lastModified = System.currentTimeMillis()

                    scenarioEntities.add(
                        ScenarioEntity(
                            scenarioId = scenarioId,
                            title = title,
                            targetCity = targetCity,
                            lastModified = lastModified,
                            configJson = jsonContent
                        )
                    )
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing scenario file $fileName: ${e.message}", e)
                }
            }

            if (scenarioEntities.isNotEmpty()) {
                scenarioDao.insertAll(scenarioEntities)
                Log.i(TAG, "Successfully seeded ${scenarioEntities.size} scenarios into Room DB.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed reading scenario assets: ${e.message}", e)
        }
    }

    fun seedDefaultUser(userDao: UserDao) {
        try {
            if (userDao.countByUsername("operator") == 0) {
                val defaultPasswordHash = BCrypt.hashpw("covertops", BCrypt.gensalt())
                val defaultAnswerHash = BCrypt.hashpw("berlin", BCrypt.gensalt())

                val defaultUser = UserEntity(
                    username = "operator",
                    email = "operator@agency.gov",
                    passwordHash = defaultPasswordHash,
                    securityQuestion = "What is your primary agency safehouse station?",
                    securityAnswerHash = defaultAnswerHash,
                    createdAt = System.currentTimeMillis()
                )
                userDao.insert(defaultUser)
                Log.i(TAG, "Seeded default offline operator account: 'operator' / 'covertops'.")
            }

            if (userDao.countByUsername("testuser123") == 0) {
                val testPasswordHash = BCrypt.hashpw("test123", BCrypt.gensalt())
                val testAnswerHash = BCrypt.hashpw("berlin", BCrypt.gensalt())

                val testUser = UserEntity(
                    username = "testuser123",
                    email = "testuser123@covertops.net",
                    passwordHash = testPasswordHash,
                    securityQuestion = "What is your primary agency safehouse station?",
                    securityAnswerHash = testAnswerHash,
                    createdAt = System.currentTimeMillis()
                )
                userDao.insert(testUser)
                Log.i(TAG, "Seeded Google review test account: 'testuser123' / 'test123'.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to seed default operator: ${e.message}", e)
        }
    }
}
