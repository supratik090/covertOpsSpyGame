package com.spygame.covertops.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.List;
import java.util.Map;

@Document(collection = "scenarios")
public class ScenarioConfig {
    @Id
    private String scenarioId;
    private String title;
    private String briefing;
    private String targetCity;
    private String targetVip;
    private String attackForm;
    private int maxTurns;
    private int startingBudget;
    private String mapBackground;
    private List<Node> nodes;
    private List<String> attackerNames;
    private List<Map<String, String>> startingDefenderSafehouses;
    private List<Map<String, Object>> agents;
    private List<Map<String, Object>> tacticalTeams;
    private Map<String, Integer> defensiveAssetCosts;
    private Map<String, Integer> trainingCosts;
    private Map<String, Integer> safehouseBuildCosts;
    private List<Map<String, String>> startingEspionageResources;
    private Map<String, Map<String, Object>> logisticsMapping;
    private Map<String, Map<String, Object>> financeMapping;

    public ScenarioConfig() {}

    // Getters and Setters
    public String getScenarioId() { return scenarioId; }
    public void setScenarioId(String scenarioId) { this.scenarioId = scenarioId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getBriefing() { return briefing; }
    public void setBriefing(String briefing) { this.briefing = briefing; }

    public String getTargetCity() { return targetCity; }
    public void setTargetCity(String targetCity) { this.targetCity = targetCity; }

    public String getTargetVip() { return targetVip; }
    public void setTargetVip(String targetVip) { this.targetVip = targetVip; }

    public String getAttackForm() { return attackForm; }
    public void setAttackForm(String attackForm) { this.attackForm = attackForm; }

    public int getMaxTurns() { return maxTurns; }
    public void setMaxTurns(int maxTurns) { this.maxTurns = maxTurns; }

    public int getStartingBudget() { return startingBudget; }
    public void setStartingBudget(int startingBudget) { this.startingBudget = startingBudget; }

    public String getMapBackground() { return mapBackground; }
    public void setMapBackground(String mapBackground) { this.mapBackground = mapBackground; }

    public List<Node> getNodes() { return nodes; }
    public void setNodes(List<Node> nodes) { this.nodes = nodes; }

    public List<String> getAttackerNames() { return attackerNames; }
    public void setAttackerNames(List<String> attackerNames) { this.attackerNames = attackerNames; }

    public List<Map<String, String>> getStartingDefenderSafehouses() { return startingDefenderSafehouses; }
    public void setStartingDefenderSafehouses(List<Map<String, String>> startingDefenderSafehouses) { this.startingDefenderSafehouses = startingDefenderSafehouses; }

    public List<Map<String, Object>> getAgents() { return agents; }
    public void setAgents(List<Map<String, Object>> agents) { this.agents = agents; }

    public List<Map<String, Object>> getTacticalTeams() { return tacticalTeams; }
    public void setTacticalTeams(List<Map<String, Object>> tacticalTeams) { this.tacticalTeams = tacticalTeams; }

    public Map<String, Integer> getDefensiveAssetCosts() { return defensiveAssetCosts; }
    public void setDefensiveAssetCosts(Map<String, Integer> defensiveAssetCosts) { this.defensiveAssetCosts = defensiveAssetCosts; }

    public Map<String, Integer> getTrainingCosts() { return trainingCosts; }
    public void setTrainingCosts(Map<String, Integer> trainingCosts) { this.trainingCosts = trainingCosts; }

    public Map<String, Integer> getSafehouseBuildCosts() { return safehouseBuildCosts; }
    public void setSafehouseBuildCosts(Map<String, Integer> safehouseBuildCosts) { this.safehouseBuildCosts = safehouseBuildCosts; }

    public List<Map<String, String>> getStartingEspionageResources() { return startingEspionageResources; }
    public void setStartingEspionageResources(List<Map<String, String>> startingEspionageResources) { this.startingEspionageResources = startingEspionageResources; }

    public Map<String, Map<String, Object>> getLogisticsMapping() { return logisticsMapping; }
    public void setLogisticsMapping(Map<String, Map<String, Object>> logisticsMapping) { this.logisticsMapping = logisticsMapping; }

    public Map<String, Map<String, Object>> getFinanceMapping() { return financeMapping; }
    public void setFinanceMapping(Map<String, Map<String, Object>> financeMapping) { this.financeMapping = financeMapping; }
}
