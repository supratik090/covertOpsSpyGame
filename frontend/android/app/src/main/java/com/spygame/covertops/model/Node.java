package com.spygame.covertops.model;

import java.util.List;
import java.util.Map;

public class Node {
    private String id;
    private String name;
    private String territory; // HOSTILE_TERRITORY or HOME_TERRITORY
    private Map<String, Double> coordinates;
    private List<String> connections;
    private List<String> availableFinance;
    private List<String> availableLogistics;
    private String defenses;
    private String counterEspionage;
    private List<String> places;

    public Node() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getTerritory() { return territory; }
    public void setTerritory(String territory) { this.territory = territory; }

    public Map<String, Double> getCoordinates() { return coordinates; }
    public void setCoordinates(Map<String, Double> coordinates) { this.coordinates = coordinates; }

    public List<String> getConnections() { return connections; }
    public void setConnections(List<String> connections) { this.connections = connections; }

    public List<String> getAvailableFinance() { return availableFinance; }
    public void setAvailableFinance(List<String> availableFinance) { this.availableFinance = availableFinance; }

    public List<String> getAvailableLogistics() { return availableLogistics; }
    public void setAvailableLogistics(List<String> availableLogistics) { this.availableLogistics = availableLogistics; }

    public String getDefenses() { return defenses; }
    public void setDefenses(String defenses) { this.defenses = defenses; }

    public String getCounterEspionage() { return counterEspionage; }
    public void setCounterEspionage(String counterEspionage) { this.counterEspionage = counterEspionage; }

    public List<String> getPlaces() { return places; }
    public void setPlaces(List<String> places) { this.places = places; }
}
