package com.backgroundlocationapp

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class LocationDatabaseHelper(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "locations.db"
        private const val DATABASE_VERSION = 4
        private const val TABLE_NAME = "locations"
        private const val COLUMN_ID = "id"
        private const val COLUMN_LATITUDE = "latitude"
        private const val COLUMN_LONGITUDE = "longitude"
        private const val COLUMN_CREATED_AT = "created_at"
        private const val COLUMN_DEVICE_ID = "device_id"
        private const val COLUMN_SYNCED = "synced"
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS $TABLE_NAME (
                $COLUMN_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COLUMN_LATITUDE REAL NOT NULL,
                $COLUMN_LONGITUDE REAL NOT NULL,
                $COLUMN_CREATED_AT INTEGER NOT NULL,
                $COLUMN_DEVICE_ID TEXT NOT NULL,
                $COLUMN_SYNCED INTEGER NOT NULL DEFAULT 0
            )
        """.trimIndent())
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 3) {
            db.execSQL("DROP TABLE IF EXISTS $TABLE_NAME")
            onCreate(db)
            return
        }
        if (oldVersion == 3) {
            db.execSQL("ALTER TABLE $TABLE_NAME ADD COLUMN $COLUMN_DEVICE_ID TEXT")
            db.execSQL("ALTER TABLE $TABLE_NAME ADD COLUMN $COLUMN_CREATED_AT INTEGER")
            db.execSQL("ALTER TABLE $TABLE_NAME ADD COLUMN $COLUMN_SYNCED INTEGER NOT NULL DEFAULT 0")
        }
    }

    fun insertLocation(
        latitude: Double,
        longitude: Double,
        createdAtMs: Long,
        deviceId: String
    ): Long {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COLUMN_LATITUDE, latitude)
            put(COLUMN_LONGITUDE, longitude)
            put(COLUMN_CREATED_AT, createdAtMs)
            put(COLUMN_DEVICE_ID, deviceId)
            put(COLUMN_SYNCED, 0)
        }
        val id = db.insert(TABLE_NAME, null, values)
        db.close()
        return id
    }

    fun getLastLocation(): LastLoc? {
        val db = readableDatabase
        val c: Cursor = db.rawQuery(
            "SELECT $COLUMN_LATITUDE, $COLUMN_LONGITUDE, $COLUMN_CREATED_AT FROM $TABLE_NAME ORDER BY $COLUMN_ID DESC LIMIT 1",
            null
        )
        var res: LastLoc? = null
        if (c.moveToFirst()) {
            res = LastLoc(
                c.getDouble(0),
                c.getDouble(1),
                c.getLong(2)
            )
        }
        c.close()
        db.close()
        return res
    }

    fun getUnsyncedBatch(limit: Int): List<Row> {
        val rows = mutableListOf<Row>()
        val db = readableDatabase
        val c = db.rawQuery(
            "SELECT $COLUMN_ID, $COLUMN_LATITUDE, $COLUMN_LONGITUDE, $COLUMN_CREATED_AT, $COLUMN_DEVICE_ID " +
                    "FROM $TABLE_NAME WHERE $COLUMN_SYNCED = 0 ORDER BY $COLUMN_ID ASC LIMIT ?",
            arrayOf(limit.toString())
        )
        if (c.moveToFirst()) {
            do {
                rows.add(
                    Row(
                        id = c.getInt(0),
                        latitude = c.getDouble(1),
                        longitude = c.getDouble(2),
                        createdAtMs = c.getLong(3),
                        deviceId = c.getString(4)
                    )
                )
            } while (c.moveToNext())
        }
        c.close()
        db.close()
        return rows
    }

    fun markSynced(ids: List<Int>) {
        if (ids.isEmpty()) return
        val db = writableDatabase
        val placeholders = ids.joinToString(",") { "?" }
        val args = ids.map { it.toString() }.toTypedArray()
        db.execSQL("UPDATE $TABLE_NAME SET $COLUMN_SYNCED = 1 WHERE $COLUMN_ID IN ($placeholders)", args)
        db.close()
    }

    fun getLatest(limit: Int): List<Row> {
        val rows = mutableListOf<Row>()
        val db = readableDatabase
        val c = db.rawQuery(
            "SELECT $COLUMN_ID, $COLUMN_LATITUDE, $COLUMN_LONGITUDE, $COLUMN_CREATED_AT, $COLUMN_DEVICE_ID " +
                    "FROM $TABLE_NAME ORDER BY $COLUMN_ID DESC LIMIT ?",
            arrayOf(limit.toString())
        )
        if (c.moveToFirst()) {
            do {
                rows.add(
                    Row(
                        id = c.getInt(0),
                        latitude = c.getDouble(1),
                        longitude = c.getDouble(2),
                        createdAtMs = c.getLong(3),
                        deviceId = c.getString(4)
                    )
                )
            } while (c.moveToNext())
        }
        c.close()
        db.close()
        return rows
    }

    // ✅ NEW: used by BackgroundLocationModule
    fun getAllLocations(): List<Row> {
        val rows = mutableListOf<Row>()
        val db = readableDatabase
        val c = db.rawQuery(
            "SELECT $COLUMN_ID, $COLUMN_LATITUDE, $COLUMN_LONGITUDE, $COLUMN_CREATED_AT, $COLUMN_DEVICE_ID FROM $TABLE_NAME ORDER BY $COLUMN_ID ASC",
            null
        )
        if (c.moveToFirst()) {
            do {
                rows.add(
                    Row(
                        id = c.getInt(0),
                        latitude = c.getDouble(1),
                        longitude = c.getDouble(2),
                        createdAtMs = c.getLong(3),
                        deviceId = c.getString(4)
                    )
                )
            } while (c.moveToNext())
        }
        c.close()
        db.close()
        return rows
    }

    data class Row(
        val id: Int,
        val latitude: Double,
        val longitude: Double,
        val createdAtMs: Long,
        val deviceId: String
    )
    data class LastLoc(val latitude: Double, val longitude: Double, val createdAtMs: Long)
}