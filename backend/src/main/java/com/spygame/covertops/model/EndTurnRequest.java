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

    // Attacker-specific request fields
    private String suspectMoveTarget;
    private String targetSafehouseCode;
    private List<String> builtSafehouses;
    private List<String> builtSecureSafehouses;
    private List<Map<String, String>> decoyDeployments;
    private String activeJammerTarget;
    private String seekPermissionType;
    private boolean triggerStrike;
    private boolean triggerExfiltration;

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

    public String getSuspectMoveTarget() { return suspectMoveTarget; }
    public void setSuspectMoveTarget(String suspectMoveTarget) { this.suspectMoveTarget = suspectMoveTarget; }

    public String getTargetSafehouseCode() { return targetSafehouseCode; }
    public void setTargetSafehouseCode(String targetSafehouseCode) { this.targetSafehouseCode = targetSafehouseCode; }

    public List<String> getBuiltSafehouses() { return builtSafehouses; }
    public void setBuiltSafehouses(List<String> builtSafehouses) { this.builtSafehouses = builtSafehouses; }

    public List<String> getBuiltSecureSafehouses() { return builtSecureSafehouses; }
    public void setBuiltSecureSafehouses(List<String> builtSecureSafehouses) { this.builtSecureSafehouses = builtSecureSafehouses; }

    public List<Map<String, String>> getDecoyDeployments() { return decoyDeployments; }
    public void setDecoyDeployments(List<Map<String, String>> decoyDeployments) { this.decoyDeployments = decoyDeployments; }

    public String getActiveJammerTarget() { return activeJammerTarget; }
    public void setActiveJammerTarget(String activeJammerTarget) { this.activeJammerTarget = activeJammerTarget; }

    public String getSeekPermissionType() { return seekPermissionType; }
    public void setSeekPermissionType(String seekPermissionType) { this.seekPermissionType = seekPermissionType; }

    public boolean isTriggerStrike() { return triggerStrike; }
    public void setTriggerStrike(boolean triggerStrike) { this.triggerStrike = triggerStrike; }

    public boolean isTriggerExfiltration() { return triggerExfiltration; }
    public void setTriggerExfiltration(boolean triggerExfiltration) { this.triggerExfiltration = triggerExfiltration; }
}
