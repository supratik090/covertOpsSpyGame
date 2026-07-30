package com.spygame.covertops.interceptor;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.UserSession;
import com.spygame.covertops.repository.GameSessionRepository;
import com.spygame.covertops.repository.UserSessionRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
public class AuthenticationInterceptor implements HandlerInterceptor {

    @Autowired
    private UserSessionRepository userSessionRepository;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // Allow preflight CORS requests
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        // Get Authorization header
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing or invalid authorization header.");
            return false;
        }

        String token = authHeader.substring(7).trim();
        Optional<UserSession> sessionOpt = userSessionRepository.findByToken(token);

        if (sessionOpt.isEmpty()) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid session token.");
            return false;
        }

        UserSession userSession = sessionOpt.get();
        if (userSession.getExpiryTime().isBefore(LocalDateTime.now())) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Session token has expired.");
            return false;
        }

        // Place the username into the request scope for use in controllers
        request.setAttribute("username", userSession.getUsername());

        // Perform Session Ownership Check for path parameters
        Map<?, ?> pathVariables = (Map<?, ?>) request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (pathVariables != null && pathVariables.containsKey("id")) {
            String idStr = (String) pathVariables.get("id");
            if (idStr != null) {
                try {
                    UUID sessionId = UUID.fromString(idStr);
                    Optional<GameSession> gameOpt = gameSessionRepository.findById(sessionId);
                    if (gameOpt.isPresent()) {
                        GameSession gameSession = gameOpt.get();
                        String owner = gameSession.getOwnerUsername();
                        String invitee = gameSession.getPlayerB();
                        boolean isAuthorized = false;
                        if (owner != null && owner.equals(userSession.getUsername())) {
                            isAuthorized = true;
                        }
                        if (invitee != null && invitee.equals(userSession.getUsername())) {
                            isAuthorized = true;
                        }
                        // If both are null (legacy single-player or public), or not matches, deny
                        if (owner == null && invitee == null) {
                            isAuthorized = true;
                        }
                        if (!isAuthorized) {
                            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Access to game session denied.");
                            return false;
                        }
                    }
                } catch (IllegalArgumentException e) {
                    // Invalid UUID, return bad request or let it fall through
                    response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid session ID format.");
                    return false;
                }
            }
        }

        return true;
    }
}
