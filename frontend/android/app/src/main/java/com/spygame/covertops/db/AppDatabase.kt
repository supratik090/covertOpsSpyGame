package com.spygame.covertops.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [
        ScenarioEntity::class,
        GameSessionEntity::class,
        UserEntity::class,
        UserSessionEntity::class,
        PlayerScoreEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun scenarioDao(): ScenarioDao
    abstract fun gameSessionDao(): GameSessionDao
    abstract fun userDao(): UserDao
    abstract fun userSessionDao(): UserSessionDao
    abstract fun playerScoreDao(): PlayerScoreDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "covert_ops_database.db"
                )
                .fallbackToDestructiveMigration()
                .allowMainThreadQueries()
                .addCallback(object : Callback() {
                    override fun onCreate(db: SupportSQLiteDatabase) {
                        super.onCreate(db)
                        CoroutineScope(Dispatchers.IO).launch {
                            DatabaseSeeder.seedInitialData(context.applicationContext, getInstance(context))
                        }
                    }
                })
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
