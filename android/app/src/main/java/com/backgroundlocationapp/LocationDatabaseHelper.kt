package com.backgroundlocationapp

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.content.ContentValues

class LocationDatabaseHelper(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "locations.db"
        private const val DATABASE_VERSION = 1
        private const val TABLE_NAME = "locations"
        private const val COLUMN_ID = "id"
        private const val COLUMN_LAT = "latitude"
        private const val COLUMN_LNG = "longitude"
        private const val COLUMN_TIME = "timestamp"
    }

    override fun onCreate(db: SQLiteDatabase) {
        val createTable = """
            CREATE TABLE $TABLE_NAME (
                $COLUMN_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COLUMN_LAT REAL,
                $COLUMN_LNG REAL,
                $COLUMN_TIME TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """.trimIndent()
        db.execSQL(createTable)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_NAME")
        onCreate(db)
    }

    fun insertLocation(lat: Double, lng: Double) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COLUMN_LAT, lat)
            put(COLUMN_LNG, lng)
        }
        db.insert(TABLE_NAME, null, values)
        db.close()
    }

    fun getAllLocations(): List<Pair<Double, Double>> {
        val list = mutableListOf<Pair<Double, Double>>()
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT $COLUMN_LAT, $COLUMN_LNG FROM $TABLE_NAME", null)
        if (cursor.moveToFirst()) {
            do {
                val lat = cursor.getDouble(0)
                val lng = cursor.getDouble(1)
                list.add(Pair(lat, lng))
            } while (cursor.moveToNext())
        }
        cursor.close()
        db.close()
        return list
    }
}