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
        val intent = Intent(reactContext, LocationService::class.java) // ✅ fixed reference
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }

        // ✅ Request battery optimization ignore (needed for background tracking)
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
        val intent = Intent(reactContext, LocationService::class.java) // ✅ consistent reference
        reactContext.stopService(intent)
    }

    // ✅ Expose saved locations to React Native
    @ReactMethod
    fun getSavedLocations(promise: Promise) {
        val dbHelper = LocationDatabaseHelper(reactContext)
        val list = dbHelper.getAllLocations()
        val array = Arguments.createArray()

        list.forEach {
            val map = Arguments.createMap()
            map.putInt("id", it["id"] as Int)
            map.putDouble("latitude", it["latitude"] as Double)
            map.putDouble("longitude", it["longitude"] as Double)
            map.putString("timestamp", it["timestamp"] as String)
            array.pushMap(map)
        }

        promise.resolve(array)
    }
}