package com.spygame.covertops.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Document(collection = "game_sessions")
public class GameSession {
    @Id
    private UUID id;
    private String scenarioId;
    private int currentTurn;
    private int maxTurns;
    private int budget;
    private String status; // ACTIVE, SUCCESS, COMPROMISED
    private List<String> attackerNames = new ArrayList<>();
    private String actualAttacker;
    private boolean suspectEscapedBefore;
    private int heatPercentage;
    private String cobraAlertLevel = "COBRA_5_LOW"; // COBRA_5_LOW, COBRA_4_GUARDED, COBRA_3_ELEVATED, COBRA_2_HIGH, COBRA_1_SEVERE
    private AIMasterPlan aiMasterPlan; // Embedded primary and backup plan
    private List<Agent> agents = new ArrayList<>();
    private List<TacticalTeam> tacticalTeams = new ArrayList<>();
    private List<Safehouse> safehouses = new ArrayList<>();
    private List<ActiveResource> espionageResources = new ArrayList<>();
    private List<Clue> discoveredClues = new ArrayList<>();
    private List<String> uncoveredFinanceCities = new ArrayList<>();
    private List<String> uncoveredLogisticsCities = new ArrayList<>();
    private List<String> hostilePatrolCities = new ArrayList<>();
    private List<String> surprisePatrolCities = new ArrayList<>();
    private java.util.Map<String, List<PlanStep>> suspectPlans = new java.util.HashMap<>();
    private java.util.Map<String, Integer> cityHeat = new java.util.HashMap<>();

    public GameSession() {}

    public java.util.Map<String, List<PlanStep>> getSuspectPlans() { return suspectPlans; }
    public void setSuspectPlans(java.util.Map<String, List<PlanStep>> suspectPlans) { this.suspectPlans = suspectPlans; }

    public java.util.Map<String, Integer> getCityHeat() { return cityHeat; }
    public void setCityHeat(java.util.Map<String, Integer> cityHeat) { this.cityHeat = cityHeat; }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getScenarioId() { return scenarioId; }
    public void setScenarioId(String scenarioId) { this.scenarioId = scenarioId; }

    public int getCurrentTurn() { return currentTurn; }
    public void setCurrentTurn(int currentTurn) { this.currentTurn = currentTurn; }

    public int getMaxTurns() { return maxTurns; }
    public void setMaxTurns(int maxTurns) { this.maxTurns = maxTurns; }

    public int getBudget() { return budget; }
    public void setBudget(int budget) { this.budget = budget; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getAttackerNames() { return attackerNames; }
    public void setAttackerNames(List<String> attackerNames) { this.attackerNames = attackerNames; }

    public String getActualAttacker() { return actualAttacker; }
    public void setActualAttacker(String actualAttacker) { this.actualAttacker = actualAttacker; }

    public boolean isSuspectEscapedBefore() { return suspectEscapedBefore; }
    public void setSuspectEscapedBefore(boolean suspectEscapedBefore) { this.suspectEscapedBefore = suspectEscapedBefore; }

    public int getHeatPercentage() { return heatPercentage; }
    public void setHeatPercentage(int heatPercentage) { this.heatPercentage = heatPercentage; }

    public String getCobraAlertLevel() { return cobraAlertLevel; }
    public void setCobraAlertLevel(String cobraAlertLevel) { this.cobraAlertLevel = cobraAlertLevel; }

    public AIMasterPlan getAiMasterPlan() { return aiMasterPlan; }
    public void setAiMasterPlan(AIMasterPlan aiMasterPlan) { this.aiMasterPlan = aiMasterPlan; }

    public List<Agent> getAgents() { return agents; }
    public void setAgents(List<Agent> agents) { this.agents = agents; }

    public List<TacticalTeam> getTacticalTeams() { return tacticalTeams; }
    public void setTacticalTeams(List<TacticalTeam> tacticalTeams) { this.tacticalTeams = tacticalTeams; }

    public List<Safehouse> getSafehouses() { return safehouses; }
    public void setSafehouses(List<Safehouse> safehouses) { this.safehouses = safehouses; }

    public List<ActiveResource> getEspionageResources() { return espionageResources; }
    public void setEspionageResources(List<ActiveResource> espionageResources) { this.espionageResources = espionageResources; }

    public List<Clue> getDiscoveredClues() { return discoveredClues; }
    public void setDiscoveredClues(List<Clue> discoveredClues) { this.discoveredClues = discoveredClues; }

    public List<String> getUncoveredFinanceCities() { return uncoveredFinanceCities; }
    public void setUncoveredFinanceCities(List<String> uncoveredFinanceCities) { this.uncoveredFinanceCities = uncoveredFinanceCities; }

    public List<String> getUncoveredLogisticsCities() { return uncoveredLogisticsCities; }
    public void setUncoveredLogisticsCities(List<String> uncoveredLogisticsCities) { this.uncoveredLogisticsCities = uncoveredLogisticsCities; }

    public List<String> getHostilePatrolCities() { return hostilePatrolCities; }
    public void setHostilePatrolCities(List<String> hostilePatrolCities) { this.hostilePatrolCities = hostilePatrolCities; }

    public List<String> getSurprisePatrolCities() { return surprisePatrolCities; }
    public void setSurprisePatrolCities(List<String> surprisePatrolCities) { this.surprisePatrolCities = surprisePatrolCities; }

    // Nested Helper Classes
    public static class Agent {
        private int id;
        private String name;
        private String codename;
        private String currentCity;
        private String activeTask; // FIND_SUSPECT, MONITOR_FINANCE, MONITOR_LOGISTICS, UNCOVER_SAFEHOUSE, TRAINING
        private Map<String, Integer> skills;
        private int cooldownRemaining;

        public Agent() {}

        public int getId() { return id; }
        public void setId(int id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getCodename() { return codename; }
        public void setCodename(String codename) { this.codename = codename; }

        public String getCurrentCity() { return currentCity; }
        public void setCurrentCity(String currentCity) { this.currentCity = currentCity; }

        public String getActiveTask() { return activeTask; }
        public void setActiveTask(String activeTask) { this.activeTask = activeTask; }

        public Map<String, Integer> getSkills() { return skills; }
        public void setSkills(Map<String, Integer> skills) { this.skills = skills; }

        public int getCooldownRemaining() { return cooldownRemaining; }
        public void setCooldownRemaining(int cooldownRemaining) { this.cooldownRemaining = cooldownRemaining; }
    }

    public static class TacticalTeam {
        private int id;
        private String name;
        private String operatingCountry; // HOSTILE_TERRITORY, HOME_TERRITORY
        private String currentCity;
        private Map<String, Integer> skills;
        private int cooldownRemaining;

        public TacticalTeam() {}

        public int getId() { return id; }
        public void setId(int id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getOperatingCountry() { return operatingCountry; }
        public void setOperatingCountry(String operatingCountry) { this.operatingCountry = operatingCountry; }

        public String getCurrentCity() { return currentCity; }
        public void setCurrentCity(String currentCity) { this.currentCity = currentCity; }

        public Map<String, Integer> getSkills() { return skills; }
        public void setSkills(Map<String, Integer> skills) { this.skills = skills; }

        public int getCooldownRemaining() { return cooldownRemaining; }
        public void setCooldownRemaining(int cooldownRemaining) { this.cooldownRemaining = cooldownRemaining; }
    }

    public static class Safehouse {
        private String cityNode;
        private String ownerFaction; // DEFENDER, HOSTILE
        private String origin; // DEFAULT, PURCHASED
        private boolean uncovered;
        private String safehouseCode; // unique 3 digit code, e.g. "432"

        public Safehouse() {}

        public Safehouse(String cityNode, String ownerFaction, String origin, boolean uncovered) {
            this.cityNode = cityNode;
            this.ownerFaction = ownerFaction;
            this.origin = origin;
            this.uncovered = uncovered;
            // Generate a random 3-digit code
            java.util.Random rand = new java.util.Random();
            this.safehouseCode = String.valueOf(100 + rand.nextInt(900));
        }

        public Safehouse(String cityNode, String ownerFaction, String origin, boolean uncovered, String safehouseCode) {
            this.cityNode = cityNode;
            this.ownerFaction = ownerFaction;
            this.origin = origin;
            this.uncovered = uncovered;
            this.safehouseCode = safehouseCode;
        }

        public String getCityNode() { return cityNode; }
        public void setCityNode(String cityNode) { this.cityNode = cityNode; }

        public String getOwnerFaction() { return ownerFaction; }
        public void setOwnerFaction(String ownerFaction) { this.ownerFaction = ownerFaction; }

        public String getOrigin() { return origin; }
        public void setOrigin(String origin) { this.origin = origin; }

        public boolean isUncovered() { return uncovered; }
        public void setUncovered(boolean uncovered) { this.uncovered = uncovered; }

        public String getSafehouseCode() { return safehouseCode; }
        public void setSafehouseCode(String safehouseCode) { this.safehouseCode = safehouseCode; }
    }

    public static class ActiveResource {
        private String type; // SATELLITE_VIEW, CCTV_MONITOR, WIRE_TAP, FINANCE_MONITORING, PHONE_TAP
        private String cityNode;
        private int cooldownRemaining; // Representing turns remaining active

        public ActiveResource() {}

        public ActiveResource(String type, String cityNode, int cooldownRemaining) {
            this.type = type;
            this.cityNode = cityNode;
            this.cooldownRemaining = cooldownRemaining > 0 ? cooldownRemaining : 10; // Defaults to 10 turns active
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public String getCityNode() { return cityNode; }
        public void setCityNode(String cityNode) { this.cityNode = cityNode; }

        public int getCooldownRemaining() { return cooldownRemaining; }
        public void setCooldownRemaining(int cooldownRemaining) { this.cooldownRemaining = cooldownRemaining; }
    }

    public static class Clue {
        private int turnDiscovered;
        private String source;
        private String clueText;
        private String assessment = "UNASSESSED"; // UNASSESSED, ACCEPT, REJECT, DOUBT
        private String cityName;
        private String discoveredByAgent;

        public Clue() {}

        public Clue(int turnDiscovered, String source, String clueText) {
            this.turnDiscovered = turnDiscovered;
            this.source = source;
            this.clueText = clueText;
            this.assessment = "UNASSESSED";
        }

        public Clue(int turnDiscovered, String source, String clueText, String cityName, String discoveredByAgent) {
            this.turnDiscovered = turnDiscovered;
            this.source = source;
            this.clueText = clueText;
            this.cityName = cityName;
            this.discoveredByAgent = discoveredByAgent;
            this.assessment = "UNASSESSED";
        }

        public int getTurnDiscovered() { return turnDiscovered; }
        public void setTurnDiscovered(int turnDiscovered) { this.turnDiscovered = turnDiscovered; }

        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }

        public String getClueText() { return clueText; }
        public void setClueText(String clueText) { this.clueText = clueText; }

        public String getAssessment() { return assessment; }
        public void setAssessment(String assessment) { this.assessment = assessment; }

        public String getCityName() { return cityName; }
        public void setCityName(String cityName) { this.cityName = cityName; }

        public String getDiscoveredByAgent() { return discoveredByAgent; }
        public void setDiscoveredByAgent(String discoveredByAgent) { this.discoveredByAgent = discoveredByAgent; }
    }
}
