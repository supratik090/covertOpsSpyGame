# Protocol Nightfall

An immersive, cyber-espionage tactical HUD simulator depicting an operative tracking scenario across a contested border region. The defender coordinates intelligence sweeps, constructs safehouses, and performs tactical raids to stop an AI suspect from executing an attack on a VIP minister.

---

## 🛠️ Project Requirements
*   **Java SDK 17+**
*   **Maven 3.6+**
*   **Node.js 18+** & **npm**
*   **MongoDB** (running locally or remotely)

---

## ⚙️ Configuration Setup (.env)
A `.env` template file is configured at the root of the project:
```env
MONGO_URI=mongodb://localhost:27017/covert_ops
```
Ensure your MongoDB instance is running before launching the backend. The Spring Boot backend port is hardcoded to **`7900`**.

---

## 🚀 How to Start the Game

### 1. Seed & Run the Spring Boot Backend
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Build and run the server:
   ```bash
   mvn spring-boot:run
   ```
   *Note: At boot, the server will scan the `/scenarios/` directory, parse the configuration files, and automatically seed them into the MongoDB `scenarios` collection if they are not already present.*
   *The server binds to port **`7900`**.*

### 2. Run the React + Vite Frontend
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies (if not done):
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
4. Click the URL printed in the terminal (usually `http://localhost:5173`) to launch the Protocol Nightfall terminal in your browser.

---

## 🧪 Running Automated Tests
To run unit and integration tests (which utilize mocked persistence repositories, bypassing MongoDB connection requirements during compile time):
```bash
cd backend
mvn test
```
All 9 test cases covering pathfinding mechanics, territorial safehouse pricing, tactical raids, and controller endpoints should compile and pass successfully.
