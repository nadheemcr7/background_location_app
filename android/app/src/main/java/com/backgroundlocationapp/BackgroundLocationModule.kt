package com.backgroundlocationapp

import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = BackgroundLocationModule.NAME)
class BackgroundLocationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "BackgroundLocationModule"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun startService() {
        val intent = Intent(reactContext, LocationService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }

        // Ask user to disable battery optimizations
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = reactContext.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
            val pkg = reactContext.packageName
            if (!pm.isIgnoringBatteryOptimizations(pkg)) {
                val optimizationIntent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                optimizationIntent.data = Uri.parse("package:$pkg")
                optimizationIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                reactContext.startActivity(optimizationIntent)
            }
        }
    }

    @ReactMethod
    fun stopService() {
        val intent = Intent(reactContext, LocationService::class.java)
        reactContext.stopService(intent)
    }

    // Expose saved locations to React Native
    @ReactMethod
    fun getSavedLocations(promise: Promise) {
        try {
            val dbHelper = LocationDatabaseHelper(reactContext)
            val list = dbHelper.getAllLocations()
            val array = Arguments.createArray()

            list.forEach { row ->
                val map = Arguments.createMap()
                map.putInt("id", row.id)
                map.putDouble("latitude", row.latitude)
                map.putDouble("longitude", row.longitude)
                map.putDouble("timestamp", row.createdAtMs.toDouble())
                map.putString("deviceId", row.deviceId)
                array.pushMap(map)
            }

            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("DB_ERROR", e.message)
        }
    }
}