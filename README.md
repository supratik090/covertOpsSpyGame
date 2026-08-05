# Protocol Nightfall — Cyber-Espionage Tactical Simulator

Protocol Nightfall is an immersive, cyber-espionage tactical HUD simulator depicting an operative tracking scenario across a contested border region. You play as the **Defender**, coordinating intelligence sweeps, deploying surveillance resources, building friendly safehouses, and commanding tactical teams to intercept and neutralize AI threat agents before they execute a target strike in your capital city.

---

## 🛠️ Project Requirements
* **Java SDK 17+**
* **Maven 3.6+**
* **Node.js 18+ & npm**
* **MongoDB** (running locally or via docker-compose)

---

## 🚀 How to Start the Game

### 1. Launch MongoDB
You can run MongoDB locally on port `27017` or use the provided Docker Compose setup:
```bash
docker-compose up -d
```

### 2. Run the Spring Boot Backend
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Build and launch the server:
   ```bash
   mvn spring-boot:run
   ```
   *Note: At boot, the server scans the `/scenarios/` directory, parses scenario JSON files, and automatically seeds them into MongoDB.*
   *The server binds to port **`7900`**.*

### 3. Run the React + Vite Frontend
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open **`http://localhost:5173`** in your browser to launch the Tactical command HUD.

---

## 🎮 How to Play & Game Objectives

Your goal as the **Defender** is to locate, track, and eliminate all active threat agents (AI suspects) before they reach the target city (e.g. New Delhi) and execute their attack. If any operative successfully initiates and executes the target strike, the mission fails.

### 1. The Operatives' Sourcing Pipeline
Threat agents move through a multi-phase sourcing pipeline in hostile territory to secure clearance for border infiltration:
1. **Initial Decoy / Finance Sourcing**: Suspects choose a hostile city node and collect funding (takes 2 turns).
2. **Logistics Sourcing**: Suspects relocate to a logistics hub to source equipment (takes 3 turns).
3. **Handover Sourcing**: Suspects meet contact points at a designated handover node (takes 3 turns).
4. **Border Infiltration**: Once sourcing is complete, they request border crossing clearance to infiltrate friendly territory and navigate toward the target node.

---

## ⚔️ Combat & Tactical Raid Mechanics

If you uncover a hostile safehouse containing threat agents, you can command a Tactical Team to execute a **Raid**.

### 1. Safehouse Destruction
- **Every raid destroys the target safehouse**: Regardless of whether the raid succeeds or fails, the safehouse is destroyed and deleted from the active list.
- If any operatives survive, they are forced to flee.
- You must search for and uncover any new safehouses built by the AI in subsequent turns.

### 2. Secure vs. Normal Safehouses
- **Normal Safehouses**: Raid success is calculated based on your Tactical Team's **Combat Skill** roll.
- **Secure Safehouses (High-Security)**: Secure safehouses are heavily fortified. A raid on a secure safehouse has a **flat 50% success probability** (team combat skill is ignored). Even if the raid fails, the safehouse is dismantled and cannot be used.

### 3. Casualty & Escape Matrix
When a safehouse is successfully raided, the casualties and escapes are resolved based on the number of operatives present:
* **1 Attacker Present**:
  - **80% chance**: Neutralized (Lost).
  - **20% chance**: Escapes (Healing).
* **2 Attackers Present**:
  - **80% chance**: 1 neutralized, 1 escapes.
  - **10% chance**: Both escape.
  - **10% chance**: Both neutralized.
* **3 Attackers Present**:
  - **100% chance**: 2 neutralized, 1 escapes.

### 4. Healing State & Relocation
* **Lockout Penalty**: Any operative who escapes a raid enters a **Healing State** for **5 turns**.
* **Forbidden Actions**: While healing, operatives **CANNOT** request border crossing, perform handovers, or execute attacks.
* **Allowed Actions**: Healing operatives can still move to adjacent cities and construct new safehouses. Threat agents can build **up to 4 safehouses** per city to guard against full tactical detection.
* **Fleeing Routing**: When escaping, the survivor relocates using this logic:
  1. Flee to another hostile safehouse in the same city if one exists.
  2. If none exists, flee to a connected city node (preferring connected nodes containing existing hostile safehouses).

---

## 👁️ Intelligence, Scans, & Surveillance

To locate threat agent movements, you can deploy five different types of sensors in city nodes:
1. **CCTV Scan**: Tracks suspect movements by matching traffic logs (scans current turn $T$ and previous turn $T-1$).
2. **Satellite Scan**: Reconnaissance imagery tracking of physical suspect presence.
3. **Phone Tap**: Intercepts cell tower nodes matching cellular activity.
4. **Wire Tap**: Intercepts encrypted account wires in server nodes.
5. **Security Sweep**: Actively sweeps a city to identify safehouses, increase local heat, and search for suspects.

*Note: Sighting clues for previous turns ($T-1$) display the turn index in the text (e.g. `(Turn 9)`) and are correctly grouped under that turn in the suspect dossier timeline to maintain tracking realism.*
