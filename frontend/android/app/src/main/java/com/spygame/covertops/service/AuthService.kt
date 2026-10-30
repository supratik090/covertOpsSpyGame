package com.spygame.covertops.service

import com.spygame.covertops.db.AppDatabase
import com.spygame.covertops.db.UserEntity
import com.spygame.covertops.db.UserSessionEntity
import org.mindrot.jbcrypt.BCrypt
import java.util.UUID

class AuthService(private val database: AppDatabase) {

    private val userDao = database.userDao()
    private val sessionDao = database.userSessionDao()

    data class AuthResult(
        val success: Boolean,
        val message: String,
        val username: String? = null,
        val token: String? = null,
        val securityQuestion: String? = null,
        val maskedEmail: String? = null
    )

    fun register(
        username: String?,
        email: String?,
        password: String?,
        securityQuestion: String? = "What is your primary agency safehouse station?",
        securityAnswer: String? = "berlin"
    ): AuthResult {
        if (username.isNullOrBlank() || email.isNullOrBlank() || password.isNullOrBlank()) {
            return AuthResult(false, "Operator ID, email, and passphrase are required.")
        }

        val trimmedUsername = username.trim()
        val trimmedEmail = email.trim().lowercase()

        if (userDao.countByUsername(trimmedUsername) > 0) {
            return AuthResult(false, "Operator ID already classified.")
        }
        if (userDao.countByEmail(trimmedEmail) > 0) {
            return AuthResult(false, "Email address is already registered.")
        }

        val passwordHash = BCrypt.hashpw(password, BCrypt.gensalt())
        val answerClean = securityAnswer?.trim()?.lowercase() ?: "berlin"
        val answerHash = BCrypt.hashpw(answerClean, BCrypt.gensalt())

        val user = UserEntity(
            username = trimmedUsername,
            email = trimmedEmail,
            passwordHash = passwordHash,
            securityQuestion = securityQuestion ?: "What is your primary agency safehouse station?",
            securityAnswerHash = answerHash,
            createdAt = System.currentTimeMillis()
        )
        userDao.insert(user)
        return AuthResult(true, "Operator successfully registered.", username = trimmedUsername)
    }

    fun login(identifier: String?, password: String?): AuthResult {
        if (identifier.isNullOrBlank() || password.isNullOrBlank()) {
            return AuthResult(false, "Operator ID/Email and passphrase are required.")
        }

        val cleanId = identifier.trim()
        val user = userDao.findByIdentifier(cleanId)
            ?: return AuthResult(false, "Invalid credentials.")

        if (!BCrypt.checkpw(password, user.passwordHash)) {
            return AuthResult(false, "Invalid credentials.")
        }

        val token = UUID.randomUUID().toString()
        val expiryTime = System.currentTimeMillis() + 86400000L // 24 hours
        sessionDao.save(UserSessionEntity(token = token, username = user.username, expiryTime = expiryTime))

        return AuthResult(
            success = true,
            message = "Authentication successful.",
            username = user.username,
            token = token
        )
    }

    fun getSecurityQuestion(identifier: String?): AuthResult {
        if (identifier.isNullOrBlank()) {
            return AuthResult(false, "Operator ID or email address is required.")
        }
        val cleanId = identifier.trim()
        val user = userDao.findByIdentifier(cleanId)
            ?: return AuthResult(false, "No classified operator found with provided credentials.")

        val question = user.securityQuestion ?: "What is your primary agency safehouse station?"
        val masked = maskEmail(user.email)

        return AuthResult(
            success = true,
            message = "Security verification retrieved.",
            username = user.username,
            securityQuestion = question,
            maskedEmail = masked
        )
    }

    fun resetPassword(identifier: String?, securityAnswer: String?, newPassword: String?): AuthResult {
        if (identifier.isNullOrBlank() || securityAnswer.isNullOrBlank() || newPassword.isNullOrBlank()) {
            return AuthResult(false, "Operator ID, security answer, and new passphrase are required.")
        }

        val cleanId = identifier.trim()
        val user = userDao.findByIdentifier(cleanId)
            ?: return AuthResult(false, "Operator record not found.")

        val storedHash = user.securityAnswerHash
        val cleanAnswer = securityAnswer.trim().lowercase()

        val answerMatches = if (storedHash != null) {
            try {
                BCrypt.checkpw(cleanAnswer, storedHash)
            } catch (e: Exception) {
                false
            }
        } else {
            // Default fallback if no answer was set
            cleanAnswer == "berlin"
        }

        if (!answerMatches) {
            return AuthResult(false, "Incorrect security answer provided.")
        }

        val newPasswordHash = BCrypt.hashpw(newPassword, BCrypt.gensalt())
        val updatedUser = user.copy(passwordHash = newPasswordHash)
        userDao.update(updatedUser)

        return AuthResult(true, "Passphrase reset successful. You may now authenticate.")
    }

    fun getUsernameForToken(token: String?): String? {
        if (token.isNullOrBlank()) return null
        val session = sessionDao.findByToken(token) ?: return null
        if (session.expiryTime < System.currentTimeMillis()) {
            sessionDao.deleteByToken(token)
            return null
        }
        return session.username
    }

    private fun maskEmail(email: String?): String {
        if (email == null || !email.contains("@")) return "***@***"
        val parts = email.split("@")
        val name = parts[0]
        val domain = parts[1]
        return if (name.length <= 2) {
            name[0] + "***@" + domain
        } else {
            name[0] + "***" + name[name.length - 1] + "@" + domain
        }
    }
}
