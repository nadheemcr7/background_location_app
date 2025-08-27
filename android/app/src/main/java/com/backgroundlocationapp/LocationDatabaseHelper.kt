package com.backgroundlocationapp

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class LocationDatabaseHelper(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "locations.db"
        private const val DATABASE_VERSION = 2 // ⬅️ bump version (important for upgrades)
        private const val TABLE_NAME = "locations"
        private const val COLUMN_ID = "id"
        private const val COLUMN_LATITUDE = "latitude"
        private const val COLUMN_LONGITUDE = "longitude"
        private const val COLUMN_TIMESTAMP = "timestamp"
    }

    override fun onCreate(db: SQLiteDatabase) {
        val createTable = """
            CREATE TABLE IF NOT EXISTS $TABLE_NAME (
                $COLUMN_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COLUMN_LATITUDE REAL,
                $COLUMN_LONGITUDE REAL,
                $COLUMN_TIMESTAMP DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """
        db.execSQL(createTable)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // 🔧 If schema changes in future, drop and recreate
        db.execSQL("DROP TABLE IF EXISTS $TABLE_NAME")
        onCreate(db)
    }

    fun insertLocation(latitude: Double, longitude: Double) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COLUMN_LATITUDE, latitude)
            put(COLUMN_LONGITUDE, longitude)
        }
        db.insert(TABLE_NAME, null, values)
        db.close()
    }

    fun getAllLocations(): List<Map<String, Any>> {
        val locations = mutableListOf<Map<String, Any>>()
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT * FROM $TABLE_NAME ORDER BY $COLUMN_TIMESTAMP DESC", null)

        if (cursor.moveToFirst()) {
            do {
                val id = cursor.getInt(cursor.getColumnIndexOrThrow(COLUMN_ID))
                val lat = cursor.getDouble(cursor.getColumnIndexOrThrow(COLUMN_LATITUDE))
                val lng = cursor.getDouble(cursor.getColumnIndexOrThrow(COLUMN_LONGITUDE))
                val ts = cursor.getString(cursor.getColumnIndexOrThrow(COLUMN_TIMESTAMP))

                locations.add(
                    mapOf(
                        "id" to id,
                        "latitude" to lat,
                        "longitude" to lng,
                        "timestamp" to ts
                    )
                )
            } while (cursor.moveToNext())
        }

        cursor.close()
        db.close()
        return locations
    }
}