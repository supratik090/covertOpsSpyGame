package com.spygame.covertops.model;

import java.util.List;

public class AIMasterPlan {
    private List<PlanStep> primaryPlan;
    private List<PlanStep> fallbackPlan;
    private String briefing;

    public AIMasterPlan() {}

    public AIMasterPlan(List<PlanStep> primaryPlan, List<PlanStep> fallbackPlan) {
        this.primaryPlan = primaryPlan;
        this.fallbackPlan = fallbackPlan;
    }

    public List<PlanStep> getPrimaryPlan() { return primaryPlan; }
    public void setPrimaryPlan(List<PlanStep> primaryPlan) { this.primaryPlan = primaryPlan; }

    public List<PlanStep> getFallbackPlan() { return fallbackPlan; }
    public void setFallbackPlan(List<PlanStep> fallbackPlan) { this.fallbackPlan = fallbackPlan; }

    public String getBriefing() { return briefing; }
    public void setBriefing(String briefing) { this.briefing = briefing; }
}
