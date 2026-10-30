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
    private String status; // ACTIVE, SUCCESS, PARTIAL_DEFENDER_VICTORY, COMPROMISED, INACTIVE

    public static void applyDefenderVictoryStatus(GameSession session) {
        boolean strikeExecuted = session.getDiscoveredClues() != null && session.getDiscoveredClues().stream()
                .anyMatch(c -> "STRIKE_EXECUTED".equals(c.getSource()) || (c.getClueText() != null && c.getClueText().contains("TARGET STRIKE EXECUTED")));
        if (strikeExecuted) {
            session.setStatus("PARTIAL_DEFENDER_VICTORY");
        } else {
            session.setStatus("SUCCESS");
        }
    }
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
    private List<String> droneBases = new ArrayList<>();
    private List<Drone> drones = new ArrayList<>();
    private List<String> hostilePatrolCities = new ArrayList<>();
    private List<String> surprisePatrolCities = new ArrayList<>();
    private String activeDroneDefenseCity; // Hostile city with active SAM air defense battery for 1 turn
    private java.util.Map<String, List<PlanStep>> suspectPlans = new java.util.HashMap<>();
    private java.util.Map<String, Integer> cityHeat = new java.util.HashMap<>();
    private java.util.Map<String, Integer> sweepCooldownCities = new java.util.HashMap<>();
    private java.util.Map<String, Integer> droneBaseCooldowns = new java.util.HashMap<>();

    private String playerRole = "DEFENDER";
    private int attackerBudget;
    private String suspectLocation;
    private String activeAttackerPhase = "TRAIL_BREAKING";
    private List<ActiveDecoy> activeDecoys = new ArrayList<>();
    private List<AIAttacker> aiAttackers = new ArrayList<>();
    private java.util.Map<String, Integer> secureSafehouseTurns = new java.util.HashMap<>();
    private boolean infiltrationGoAheadApproved;
    private boolean strikeGoAheadApproved;
    private String ownerUsername;

    // Logistics and Finance tracking
    private String requestedFinanceCity;
    private int financeCollectionTurnsRemaining = -1;
    private boolean financeCollected = false;
    private String requestedLogisticsCity;
    private int logisticsCollectionTurnsRemaining = -1;
    private boolean logisticsCollected = false;
    private String handoverCity;
    private int handoverTurnsRemaining = -1;
    private boolean handoverCompleted = false;
    private String suspectSafehouseCode;

    // Deployment phase — true until DEFENDER player has placed all safehouses, agents, and teams
    private boolean deploymentPending = false;

    // Drone Base Maintenance Event fields
    private String maintenanceDroneBase; // Active drone base under 24h technical maintenance this turn
    private String nextTurnMaintenanceDroneBase; // Advance warning city for scheduled maintenance next turn

    private java.util.List<String> turnHistory = new java.util.ArrayList<>();

    public java.util.List<String> getTurnHistory() { return turnHistory; }
    public void setTurnHistory(java.util.List<String> turnHistory) { this.turnHistory = turnHistory; }


    public GameSession() {}

    public String getPlayerRole() { return playerRole; }
    public void setPlayerRole(String playerRole) { this.playerRole = playerRole; }

    public int getAttackerBudget() { return attackerBudget; }
    public void setAttackerBudget(int attackerBudget) { this.attackerBudget = attackerBudget; }

    public String getSuspectLocation() { return suspectLocation; }
    public void setSuspectLocation(String suspectLocation) { this.suspectLocation = suspectLocation; }

    public String getActiveAttackerPhase() { return activeAttackerPhase; }
    public void setActiveAttackerPhase(String activeAttackerPhase) { this.activeAttackerPhase = activeAttackerPhase; }

    public String getRequestedFinanceCity() { return requestedFinanceCity; }
    public void setRequestedFinanceCity(String requestedFinanceCity) { this.requestedFinanceCity = requestedFinanceCity; }

    public int getFinanceCollectionTurnsRemaining() { return financeCollectionTurnsRemaining; }
    public void setFinanceCollectionTurnsRemaining(int financeCollectionTurnsRemaining) { this.financeCollectionTurnsRemaining = financeCollectionTurnsRemaining; }

    public boolean isFinanceCollected() { return financeCollected; }
    public void setFinanceCollected(boolean financeCollected) { this.financeCollected = financeCollected; }

    public String getRequestedLogisticsCity() { return requestedLogisticsCity; }
    public void setRequestedLogisticsCity(String requestedLogisticsCity) { this.requestedLogisticsCity = requestedLogisticsCity; }

    public int getLogisticsCollectionTurnsRemaining() { return logisticsCollectionTurnsRemaining; }
    public void setLogisticsCollectionTurnsRemaining(int logisticsCollectionTurnsRemaining) { this.logisticsCollectionTurnsRemaining = logisticsCollectionTurnsRemaining; }

    public boolean isLogisticsCollected() { return logisticsCollected; }
    public void setLogisticsCollected(boolean logisticsCollected) { this.logisticsCollected = logisticsCollected; }

    public String getHandoverCity() { return handoverCity; }
    public void setHandoverCity(String handoverCity) { this.handoverCity = handoverCity; }

    public int getHandoverTurnsRemaining() { return handoverTurnsRemaining; }
    public void setHandoverTurnsRemaining(int handoverTurnsRemaining) { this.handoverTurnsRemaining = handoverTurnsRemaining; }

    public boolean isHandoverCompleted() { return handoverCompleted; }
    public void setHandoverCompleted(boolean handoverCompleted) { this.handoverCompleted = handoverCompleted; }

    public String getSuspectSafehouseCode() { return suspectSafehouseCode; }
    public void setSuspectSafehouseCode(String suspectSafehouseCode) { this.suspectSafehouseCode = suspectSafehouseCode; }

    public boolean isDeploymentPending() { return deploymentPending; }
    public void setDeploymentPending(boolean deploymentPending) { this.deploymentPending = deploymentPending; }

    public List<ActiveDecoy> getActiveDecoys() { return activeDecoys; }
    public void setActiveDecoys(List<ActiveDecoy> activeDecoys) { this.activeDecoys = activeDecoys; }

    public List<AIAttacker> getAiAttackers() { return aiAttackers; }
    public void setAiAttackers(List<AIAttacker> aiAttackers) { this.aiAttackers = aiAttackers; }

    public java.util.Map<String, Integer> getSecureSafehouseTurns() { return secureSafehouseTurns; }
    public void setSecureSafehouseTurns(java.util.Map<String, Integer> secureSafehouseTurns) { this.secureSafehouseTurns = secureSafehouseTurns; }

    public boolean isInfiltrationGoAheadApproved() { return infiltrationGoAheadApproved; }
    public void setInfiltrationGoAheadApproved(boolean infiltrationGoAheadApproved) { this.infiltrationGoAheadApproved = infiltrationGoAheadApproved; }

    public boolean isStrikeGoAheadApproved() { return strikeGoAheadApproved; }
    public void setStrikeGoAheadApproved(boolean strikeGoAheadApproved) { this.strikeGoAheadApproved = strikeGoAheadApproved; }

    public String getOwnerUsername() { return ownerUsername; }
    public void setOwnerUsername(String ownerUsername) { this.ownerUsername = ownerUsername; }

    public java.util.Map<String, List<PlanStep>> getSuspectPlans() { return suspectPlans; }
    public void setSuspectPlans(java.util.Map<String, List<PlanStep>> suspectPlans) { this.suspectPlans = suspectPlans; }

    public java.util.Map<String, Integer> getCityHeat() { return cityHeat; }
    public void setCityHeat(java.util.Map<String, Integer> cityHeat) { this.cityHeat = cityHeat; }

    public java.util.Map<String, Integer> getSweepCooldownCities() { return sweepCooldownCities; }
    public void setSweepCooldownCities(java.util.Map<String, Integer> sweepCooldownCities) { this.sweepCooldownCities = sweepCooldownCities; }

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

    public String getMaintenanceDroneBase() { return maintenanceDroneBase; }
    public void setMaintenanceDroneBase(String maintenanceDroneBase) { this.maintenanceDroneBase = maintenanceDroneBase; }

    public String getNextTurnMaintenanceDroneBase() { return nextTurnMaintenanceDroneBase; }
    public void setNextTurnMaintenanceDroneBase(String nextTurnMaintenanceDroneBase) { this.nextTurnMaintenanceDroneBase = nextTurnMaintenanceDroneBase; }

    public String getActiveDroneDefenseCity() { return activeDroneDefenseCity; }
    public void setActiveDroneDefenseCity(String activeDroneDefenseCity) { this.activeDroneDefenseCity = activeDroneDefenseCity; }

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
        private String subLocality; // neighborhood/place name, e.g. "Colaba"
        private String attackerName;
        private boolean secure;

        public Safehouse() {}

        public Safehouse(String cityNode, String ownerFaction, String origin, boolean uncovered) {
            this.cityNode = cityNode;
            this.ownerFaction = ownerFaction;
            this.origin = origin;
            this.uncovered = uncovered;
            this.secure = false;
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
            this.secure = false;
        }

        public Safehouse(String cityNode, String ownerFaction, String origin, boolean uncovered, String safehouseCode, String subLocality) {
            this.cityNode = cityNode;
            this.ownerFaction = ownerFaction;
            this.origin = origin;
            this.uncovered = uncovered;
            this.safehouseCode = safehouseCode;
            this.subLocality = subLocality;
            this.secure = false;
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

        public String getSubLocality() { return subLocality; }
        public void setSubLocality(String subLocality) { this.subLocality = subLocality; }

        public String getAttackerName() { return attackerName; }
        public void setAttackerName(String attackerName) { this.attackerName = attackerName; }

        public boolean isSecure() { return secure; }
        public void setSecure(boolean secure) { this.secure = secure; }
    }

    public static class ActiveResource {
        private String type; // SATELLITE, CCTV, WIRE_TAP, FINANCE_MONITOR, PHONE_TAP
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
        private Integer turnOccurred;
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

        public Integer getTurnOccurred() { return turnOccurred; }
        public void setTurnOccurred(Integer turnOccurred) { this.turnOccurred = turnOccurred; }

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

    public static class ActiveDecoy {
        private String type; // CCTV, SATELLITE
        private String cityNode;
        private int turnsRemaining = 10;

        public ActiveDecoy() {}

        public ActiveDecoy(String type, String cityNode) {
            this.type = type;
            this.cityNode = cityNode;
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public String getCityNode() { return cityNode; }
        public void setCityNode(String cityNode) { this.cityNode = cityNode; }

        public int getTurnsRemaining() { return turnsRemaining; }
        public void setTurnsRemaining(int turnsRemaining) { this.turnsRemaining = turnsRemaining; }
    }

    public static class AIAttacker {
        private String name;
        private String state;
        private String currentLocation;
        private boolean eliminated;
        private int budget;

        private String requestedFinanceCity;
        private int financeCollectionTurnsRemaining = -1;
        private boolean financeCollected = false;

        private String requestedLogisticsCity;
        private int logisticsCollectionTurnsRemaining = -1;
        private boolean logisticsCollected = false;

        private String handoverCity;
        private int handoverTurnsRemaining = -1;
        private boolean handoverCompleted = false;

        private boolean permissionToCrossBorderRequested = false;
        private boolean permissionToCrossBorderApproved = false;

        private boolean permissionToEngageRequested = false;
        private boolean permissionToEngageApproved = false;
        private int healingTurnsRemaining = 0;

        public AIAttacker() {}

        public AIAttacker(String name, String currentLocation, String state) {
            this.name = name;
            this.currentLocation = currentLocation;
            this.state = state;
            this.eliminated = false;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getState() { return state; }
        public void setState(String state) { this.state = state; }

        public String getCurrentLocation() { return currentLocation; }
        public void setCurrentLocation(String currentLocation) { this.currentLocation = currentLocation; }

        public boolean isEliminated() { return eliminated; }
        public void setEliminated(boolean eliminated) { this.eliminated = eliminated; }

        public int getBudget() { return budget; }
        public void setBudget(int budget) { this.budget = budget; }

        public String getRequestedFinanceCity() { return requestedFinanceCity; }
        public void setRequestedFinanceCity(String requestedFinanceCity) { this.requestedFinanceCity = requestedFinanceCity; }

        public int getFinanceCollectionTurnsRemaining() { return financeCollectionTurnsRemaining; }
        public void setFinanceCollectionTurnsRemaining(int financeCollectionTurnsRemaining) { this.financeCollectionTurnsRemaining = financeCollectionTurnsRemaining; }

        public boolean isFinanceCollected() { return financeCollected; }
        public void setFinanceCollected(boolean financeCollected) { this.financeCollected = financeCollected; }

        public String getRequestedLogisticsCity() { return requestedLogisticsCity; }
        public void setRequestedLogisticsCity(String requestedLogisticsCity) { this.requestedLogisticsCity = requestedLogisticsCity; }

        public int getLogisticsCollectionTurnsRemaining() { return logisticsCollectionTurnsRemaining; }
        public void setLogisticsCollectionTurnsRemaining(int logisticsCollectionTurnsRemaining) { this.logisticsCollectionTurnsRemaining = logisticsCollectionTurnsRemaining; }

        public boolean isLogisticsCollected() { return logisticsCollected; }
        public void setLogisticsCollected(boolean logisticsCollected) { this.logisticsCollected = logisticsCollected; }

        public String getHandoverCity() { return handoverCity; }
        public void setHandoverCity(String handoverCity) { this.handoverCity = handoverCity; }

        public int getHandoverTurnsRemaining() { return handoverTurnsRemaining; }
        public void setHandoverTurnsRemaining(int handoverTurnsRemaining) { this.handoverTurnsRemaining = handoverTurnsRemaining; }

        public boolean isHandoverCompleted() { return handoverCompleted; }
        public void setHandoverCompleted(boolean handoverCompleted) { this.handoverCompleted = handoverCompleted; }

        public boolean isPermissionToCrossBorderRequested() { return permissionToCrossBorderRequested; }
        public void setPermissionToCrossBorderRequested(boolean permissionToCrossBorderRequested) { this.permissionToCrossBorderRequested = permissionToCrossBorderRequested; }

        public boolean isPermissionToCrossBorderApproved() { return permissionToCrossBorderApproved; }
        public void setPermissionToCrossBorderApproved(boolean permissionToCrossBorderApproved) { this.permissionToCrossBorderApproved = permissionToCrossBorderApproved; }

        public boolean isPermissionToEngageRequested() { return permissionToEngageRequested; }
        public void setPermissionToEngageRequested(boolean permissionToEngageRequested) { this.permissionToEngageRequested = permissionToEngageRequested; }

        public boolean isPermissionToEngageApproved() { return permissionToEngageApproved; }
        public void setPermissionToEngageApproved(boolean permissionToEngageApproved) { this.permissionToEngageApproved = permissionToEngageApproved; }

        public int getHealingTurnsRemaining() { return healingTurnsRemaining; }
        public void setHealingTurnsRemaining(int healingTurnsRemaining) { this.healingTurnsRemaining = healingTurnsRemaining; }
    }

    public List<String> getDroneBases() { return droneBases; }
    public void setDroneBases(List<String> droneBases) { this.droneBases = droneBases; }

    public java.util.Map<String, Integer> getDroneBaseCooldowns() {
        if (droneBaseCooldowns == null) {
            droneBaseCooldowns = new java.util.HashMap<>();
        }
        return droneBaseCooldowns;
    }
    public void setDroneBaseCooldowns(java.util.Map<String, Integer> droneBaseCooldowns) {
        this.droneBaseCooldowns = droneBaseCooldowns;
    }

    public List<Drone> getDrones() { return drones; }
    public void setDrones(List<Drone> drones) { this.drones = drones; }

    public static class Drone {
        private int id;
        private String currentCity; // base city, or null/empty if in reserve
        private String status; // ACTIVE, SHOT_DOWN, RESERVE
        private int cooldown;
        private String type = "1-HOP"; // "1-HOP" or "2-HOP"
        private int maxHops = 1; // 1 or 2
        private String assignedActionType; // RECON, ATTACK, or null
        private String assignedTargetCity; // target city node or null
        private int serviceCooldown = 0; // Turns remaining for technical servicing (2 turns)

        public Drone() {}

        public Drone(int id, String currentCity, String status) {
            this.id = id;
            this.currentCity = currentCity;
            this.status = status;
            this.cooldown = 0;
            this.serviceCooldown = 0;
            this.type = (id == 2) ? "2-HOP" : "1-HOP";
            this.maxHops = (id == 2) ? 2 : 1;
        }

        public Drone(int id, String currentCity, String status, String type, int maxHops) {
            this.id = id;
            this.currentCity = currentCity;
            this.status = status;
            this.type = type != null ? type : "1-HOP";
            this.maxHops = maxHops > 0 ? maxHops : 1;
            this.cooldown = 0;
            this.serviceCooldown = 0;
        }

        public int getId() { return id; }
        public void setId(int id) { this.id = id; }

        public String getCurrentCity() { return currentCity; }
        public void setCurrentCity(String currentCity) { this.currentCity = currentCity; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public int getCooldown() { return cooldown; }
        public void setCooldown(int cooldown) { this.cooldown = cooldown; }

        public int getServiceCooldown() { return serviceCooldown; }
        public void setServiceCooldown(int serviceCooldown) { this.serviceCooldown = serviceCooldown; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public int getMaxHops() { return maxHops; }
        public void setMaxHops(int maxHops) { this.maxHops = maxHops; }

        public String getAssignedActionType() { return assignedActionType; }
        public void setAssignedActionType(String assignedActionType) { this.assignedActionType = assignedActionType; }

        public String getAssignedTargetCity() { return assignedTargetCity; }
        public void setAssignedTargetCity(String assignedTargetCity) { this.assignedTargetCity = assignedTargetCity; }
    }
}
