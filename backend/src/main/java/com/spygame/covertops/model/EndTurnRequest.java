package com.spygame.covertops.model;

import java.util.List;
import java.util.Map;

public class EndTurnRequest {
    private List<Map<String, Object>> covertActions;
    private Map<Integer, String> clueAssessments; // Maps clueIndex -> assessment (ACCEPT, REJECT, DOUBT)
    private Map<Integer, String> agentRelocations; // Maps agentId -> targetCity
    private Map<Integer, String> teamRelocations; // Maps teamId -> targetCity
    private Map<Integer, String> agentTasks; // Maps agentId -> task (GATHER_INTELLIGENCE, etc.)
    private List<String> safehouseBuilds; // List of cityNodes to construct safehouses in
    private List<Map<String, String>> techDeployments; // List of { "type": type, "cityNode": cityNode }

    public EndTurnRequest() {}

    public List<Map<String, Object>> getCovertActions() { return covertActions; }
    public void setCovertActions(List<Map<String, Object>> covertActions) { this.covertActions = covertActions; }

    public Map<Integer, String> getClueAssessments() { return clueAssessments; }
    public void setClueAssessments(Map<Integer, String> clueAssessments) { this.clueAssessments = clueAssessments; }

    public Map<Integer, String> getAgentRelocations() { return agentRelocations; }
    public void setAgentRelocations(Map<Integer, String> agentRelocations) { this.agentRelocations = agentRelocations; }

    public Map<Integer, String> getTeamRelocations() { return teamRelocations; }
    public void setTeamRelocations(Map<Integer, String> teamRelocations) { this.teamRelocations = teamRelocations; }

    public Map<Integer, String> getAgentTasks() { return agentTasks; }
    public void setAgentTasks(Map<Integer, String> agentTasks) { this.agentTasks = agentTasks; }

    public List<String> getSafehouseBuilds() { return safehouseBuilds; }
    public void setSafehouseBuilds(List<String> safehouseBuilds) { this.safehouseBuilds = safehouseBuilds; }

    public List<Map<String, String>> getTechDeployments() { return techDeployments; }
    public void setTechDeployments(List<Map<String, String>> techDeployments) { this.techDeployments = techDeployments; }
}
