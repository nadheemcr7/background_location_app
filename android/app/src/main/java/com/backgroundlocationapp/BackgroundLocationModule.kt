package com.backgroundlocationapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = BackgroundLocationModule.NAME)
class BackgroundLocationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "BackgroundLocationModule"
    }

    private var registered = false

    override fun getName(): String = NAME

    override fun initialize() {
        super.initialize()
        registerReceiverIfNeeded()
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        unregisterReceiverIfNeeded()
    }

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != LocationService.ACTION_LOCATION_UPDATE) return
            val lat = intent.getDoubleExtra("latitude", 0.0)
            val lng = intent.getDoubleExtra("longitude", 0.0)
            val ts = intent.getDoubleExtra("timestamp", 0.0)

            val map = Arguments.createMap().apply {
                putDouble("latitude", lat)
                putDouble("longitude", lng)
                putDouble("timestamp", ts)
            }
            emitEventToJs("LocationUpdate", map)
        }
    }

    private fun emitEventToJs(event: String, params: WritableMap?) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, params)
        }
    }

    private fun registerReceiverIfNeeded() {
        if (registered) return
        val filter = IntentFilter(LocationService.ACTION_LOCATION_UPDATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactContext.registerReceiver(receiver, filter)
        }
        registered = true
    }

    private fun unregisterReceiverIfNeeded() {
        if (!registered) return
        try {
            reactContext.unregisterReceiver(receiver)
        } catch (_: Exception) {}
        registered = false
    }

    @ReactMethod
    fun startService() {
        registerReceiverIfNeeded()

        val intent = Intent(reactContext, LocationService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }

        // Ask user to disable battery optimizations
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
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
        unregisterReceiverIfNeeded()
    }

    // Expose saved locations to React Native (if you prefer native fetch)
    @ReactMethod
    fun getSavedLocations(promise: Promise) {
        try {
            val dbHelper = LocationDatabaseHelper(reactContext)
            val list = dbHelper.getLatest(10) // return latest 10 for UI
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