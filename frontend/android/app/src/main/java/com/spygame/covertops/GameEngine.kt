package com.spygame.covertops

import android.content.Context
import android.util.Log
import com.spygame.covertops.db.*
import com.spygame.covertops.service.*
import org.springframework.beans.factory.annotation.Autowired

object GameEngine {

    private const val TAG = "GameEngine"

    lateinit var database: AppDatabase
        private set

    lateinit var scenarioRepository: RoomScenarioRepository
        private set

    lateinit var gameSessionRepository: RoomGameSessionRepository
        private set

    lateinit var playerScoreRepository: RoomPlayerScoreRepository
        private set

    lateinit var userRepository: RoomUserRepository
        private set

    // Game Simulation Services
    lateinit var pathfinder: AttackerPathfinder
        private set
    lateinit var aiAttackerService: AIAttackerService
        private set
    lateinit var clueEngine: ClueGenerationEngine
        private set
    lateinit var combatResolutionService: CombatResolutionService
        private set
    lateinit var securitySweepService: SecuritySweepService
        private set
    lateinit var sourcingMilestoneService: SourcingMilestoneService
        private set
    lateinit var playerDefenderService: PlayerDefenderService
        private set
    lateinit var playerAttackerService: PlayerAttackerService
        private set
    lateinit var aiDefenderService: AIDefenderService
        private set
    lateinit var defenderActionService: DefenderActionService
        private set
    lateinit var scoringService: ScoringService
        private set
    lateinit var hintService: HintGenerationService
        private set
    lateinit var deploymentService: DeploymentService
        private set
    lateinit var lobbyService: GameSessionLobbyService
        private set
    lateinit var sessionService: GameSessionService
        private set
    lateinit var authService: AuthService
        private set

    private var initialized = false

    fun init(context: Context) {
        if (initialized) return

        Log.i(TAG, "Initializing CovertOps Game Engine...")

        // 1. Initialize Database & Repositories
        database = AppDatabase.getInstance(context)
        scenarioRepository = RoomScenarioRepository(database.scenarioDao())
        gameSessionRepository = RoomGameSessionRepository(database.gameSessionDao())
        playerScoreRepository = RoomPlayerScoreRepository(database.playerScoreDao())
        userRepository = RoomUserRepository(database.userDao())

        // Ensure scenarios and default accounts are seeded
        if (database.scenarioDao().count() == 0) {
            DatabaseSeeder.seedScenarios(context, database.scenarioDao())
        }
        DatabaseSeeder.seedDefaultUser(database.userDao())

        // 2. Instantiate all Game Services
        pathfinder = AttackerPathfinder()
        aiAttackerService = AIAttackerService()
        clueEngine = ClueGenerationEngine()
        combatResolutionService = CombatResolutionService()
        securitySweepService = SecuritySweepService()
        sourcingMilestoneService = SourcingMilestoneService()
        playerDefenderService = PlayerDefenderService()
        playerAttackerService = PlayerAttackerService()
        aiDefenderService = AIDefenderService()
        defenderActionService = DefenderActionService()
        scoringService = ScoringService()
        hintService = HintGenerationService()
        deploymentService = DeploymentService()
        lobbyService = GameSessionLobbyService()
        sessionService = GameSessionService()
        authService = AuthService(database)

        // 3. Inject all dependencies into services
        val allBeans = listOf(
            scenarioRepository,
            gameSessionRepository,
            playerScoreRepository,
            userRepository,
            pathfinder,
            aiAttackerService,
            clueEngine,
            combatResolutionService,
            securitySweepService,
            sourcingMilestoneService,
            playerDefenderService,
            playerAttackerService,
            aiDefenderService,
            defenderActionService,
            scoringService,
            hintService,
            deploymentService,
            lobbyService,
            sessionService
        )

        for (bean in allBeans) {
            injectAutowiredFields(bean, allBeans)
        }

        initialized = true
        Log.i(TAG, "CovertOps Game Engine fully initialized with Room DB!")
    }

    private fun injectAutowiredFields(target: Any, candidateBeans: List<Any>) {
        var clazz: Class<*>? = target.javaClass
        while (clazz != null && clazz != Any::class.java) {
            for (field in clazz.declaredFields) {
                if (field.isAnnotationPresent(Autowired::class.java)) {
                    field.isAccessible = true
                    val fieldType = field.type
                    val match = candidateBeans.firstOrNull { fieldType.isAssignableFrom(it.javaClass) }
                    if (match != null) {
                        field.set(target, match)
                    } else {
                        Log.w(TAG, "No candidate bean found for ${clazz.simpleName}.${field.name} (${fieldType.simpleName})")
                    }
                }
            }
            clazz = clazz.superclass
        }
    }
}
