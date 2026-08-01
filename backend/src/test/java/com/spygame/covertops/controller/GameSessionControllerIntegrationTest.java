package com.spygame.covertops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spygame.covertops.model.EndTurnRequest;
import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.repository.GameSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class GameSessionControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private GameSessionRepository repository;

    @MockBean
    private com.spygame.covertops.repository.ScenarioConfigRepository scenarioConfigRepository;

    @MockBean
    private com.spygame.covertops.repository.UserSessionRepository userSessionRepository;

    private GameSession mockedSession;

    @BeforeEach
    public void setupMocks() throws Exception {
        // Load scenario configuration mock data
        java.io.File configFile = new java.io.File("../scenarios/operation_silent_edge.json");
        com.spygame.covertops.model.ScenarioConfig scenarioConfig = objectMapper.readValue(configFile, com.spygame.covertops.model.ScenarioConfig.class);
        
        when(scenarioConfigRepository.findById("operation_silent_edge")).thenReturn(Optional.of(scenarioConfig));

        // Mock Authentication Interceptor Session lookup
        when(userSessionRepository.findByToken(any(String.class))).thenReturn(Optional.of(
            new com.spygame.covertops.model.UserSession("test_token", "test_user", java.time.LocalDateTime.now().plusDays(1))
        ));

        // Prepare a mock save answer to return the exact session passed to it
        when(repository.save(any(GameSession.class))).thenAnswer(invocation -> {
            GameSession s = invocation.getArgument(0);
            if (s.getId() == null) {
                s.setId(UUID.randomUUID());
            }
            mockedSession = s;
            return s;
        });

        // Mock findById to return the active mock session
        when(repository.findById(any(UUID.class))).thenAnswer(invocation -> {
            if (mockedSession != null && mockedSession.getId().equals(invocation.getArgument(0))) {
                return Optional.of(mockedSession);
            }
            return Optional.empty();
        });
    }

    @Test
    public void testFullGameSessionLifecycleApi() throws Exception {
        // 1. Create a Game Session via POST /api/game/create
        MvcResult createResult = mockMvc.perform(post("/api/game/create")
                        .param("scenarioId", "operation_silent_edge")
                        .header("Authorization", "Bearer test_token")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        String createJson = createResult.getResponse().getContentAsString();
        GameSession session = objectMapper.readValue(createJson, GameSession.class);

        assertNotNull(session);
        assertNotNull(session.getId());
        assertEquals("operation_silent_edge", session.getScenarioId());
        assertEquals(1, session.getCurrentTurn());
        assertEquals("ACTIVE", session.getStatus());

        // 2. Fetch the created session via GET /api/game/{id}
        MvcResult getResult = mockMvc.perform(get("/api/game/" + session.getId())
                        .header("Authorization", "Bearer test_token")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        String getJson = getResult.getResponse().getContentAsString();
        GameSession fetchedSession = objectMapper.readValue(getJson, GameSession.class);
        assertEquals(session.getId(), fetchedSession.getId());

        // 3. Post End-Turn payload via POST /api/game/{id}/end-turn
        EndTurnRequest request = new EndTurnRequest();
        request.setCovertActions(new ArrayList<>());
        request.setClueAssessments(new HashMap<>());

        MvcResult endTurnResult = mockMvc.perform(post("/api/game/" + session.getId() + "/end-turn")
                        .content(objectMapper.writeValueAsString(request))
                        .header("Authorization", "Bearer test_token")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        String endTurnJson = endTurnResult.getResponse().getContentAsString();
        GameSession nextTurnSession = objectMapper.readValue(endTurnJson, GameSession.class);

        // Turn should have ticked forward to 2
        assertEquals(2, nextTurnSession.getCurrentTurn());
        assertFalse(nextTurnSession.getDiscoveredClues().isEmpty(), "Clues should have been generated on turn tick");
    }
}
