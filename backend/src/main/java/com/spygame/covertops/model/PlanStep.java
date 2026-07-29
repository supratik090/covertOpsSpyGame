package com.spygame.covertops.model;

public class PlanStep {
    private int turn;
    private String phase; // TRAIL_BREAKING, FINANCE_SOURCING, LOGISTICS_SOURCING, HANDOVER, CROSSING, TRANSIT, ATTACK
    private String suspectLocation;
    private String financeCity;
    private String financeMethod;
    private String logisticsCity;
    private String logisticsMethod;
    private String covertTeamLocation;
    private String action; // IDLE, MOVE, TRANSACT, MEET, SMUGGLE, STAGE, STRIKE
    private boolean smuggling;
    private String smugglingMethod;
    private String escapeMethod;
    private String escapeNode;

    // Default Constructor
    public PlanStep() {}

    // Getters and Setters
    public int getTurn() { return turn; }
    public void setTurn(int turn) { this.turn = turn; }

    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }

    public String getSuspectLocation() { return suspectLocation; }
    public void setSuspectLocation(String suspectLocation) { this.suspectLocation = suspectLocation; }

    public String getFinanceCity() { return financeCity; }
    public void setFinanceCity(String financeCity) { this.financeCity = financeCity; }

    public String getFinanceMethod() { return financeMethod; }
    public void setFinanceMethod(String financeMethod) { this.financeMethod = financeMethod; }

    public String getLogisticsCity() { return logisticsCity; }
    public void setLogisticsCity(String logisticsCity) { this.logisticsCity = logisticsCity; }

    public String getLogisticsMethod() { return logisticsMethod; }
    public void setLogisticsMethod(String logisticsMethod) { this.logisticsMethod = logisticsMethod; }

    public String getCovertTeamLocation() { return covertTeamLocation; }
    public void setCovertTeamLocation(String covertTeamLocation) { this.covertTeamLocation = covertTeamLocation; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public boolean isSmuggling() { return smuggling; }
    public void setSmuggling(boolean smuggling) { this.smuggling = smuggling; }

    public String getSmugglingMethod() { return smugglingMethod; }
    public void setSmugglingMethod(String smugglingMethod) { this.smugglingMethod = smugglingMethod; }

    public String getEscapeMethod() { return escapeMethod; }
    public void setEscapeMethod(String escapeMethod) { this.escapeMethod = escapeMethod; }

    public String getEscapeNode() { return escapeNode; }
    public void setEscapeNode(String escapeNode) { this.escapeNode = escapeNode; }
}
