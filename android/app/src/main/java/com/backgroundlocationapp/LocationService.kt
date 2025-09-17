package com.backgroundlocationapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlin.coroutines.resume
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class LocationService : Service() {

    companion object {
        const val TAG = "LocationService"
        const val ACTION_LOCATION_UPDATE = "com.backgroundlocationapp.LOCATION_UPDATE"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var dbHelper: LocationDatabaseHelper
    private var trackingJob: Job? = null
    private val client = OkHttpClient()

    private val CHECK_INTERVAL_MS = 30_000L
    private val DISTANCE_THRESHOLD_METERS = 10.0
    private val ACCURACY_THRESHOLD_METERS = 30.0
    private val SUPABASE_URL = "https://ezcivoiepeyrfaykqkfl.supabase.co"
    private val SUPABASE_TABLE = "location_points"
    private val SUPABASE_KEY = "YOUR_SUPABASE_KEY_HERE"

    private val deviceId: String by lazy {
        Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
            ?: UUID.randomUUID().toString()
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        dbHelper = LocationDatabaseHelper(this)
        startForegroundService()
        Log.d(TAG, "Service created. Device ID: $deviceId")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startTrackingLoop()
        return START_STICKY
    }

    override fun onDestroy() {
        trackingJob?.cancel()
        stopForeground(STOP_FOREGROUND_DETACH)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startForegroundService() {
        val channelId = "location_tracking_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId, "Location Tracking", NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }

        val smallIconRes = applicationInfo.icon

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Tracking Location")
            .setContentText("Background location tracking active")
            .setSmallIcon(smallIconRes)
            .setOngoing(true)
            .build()

        startForeground(1, notification)
    }

    private fun startTrackingLoop() {
        if (trackingJob?.isActive == true) return

        trackingJob = CoroutineScope(Dispatchers.IO).launch {
            var lastSaved: LocationDatabaseHelper.LastLoc? = dbHelper.getLastLocation()
            Log.d(TAG, "Tracking loop started. Last saved location: $lastSaved")

            while (isActive) {
                val loc = getCurrentLocation()
                if (loc != null) {
                    // 🔹 Always log every location
                    Log.d(TAG, "Current location: lat=${loc.latitude}, lng=${loc.longitude}, acc=${loc.accuracy}")

                    // 🔹 Emit to RN UI always
                    emitCurrentToJs(loc)

                    // 🔹 Only save if first location or moved enough
                    if (lastSaved == null) {
                        dbHelper.insertLocation(loc.latitude, loc.longitude, System.currentTimeMillis(), deviceId)
                        lastSaved = LocationDatabaseHelper.LastLoc(loc.latitude, loc.longitude, System.currentTimeMillis())
                        Log.d(TAG, "First location saved to DB")
                        syncIfBatchReady()
                    } else {
                        val dist = distanceMeters(lastSaved.latitude, lastSaved.longitude, loc.latitude, loc.longitude)
                        if (dist > DISTANCE_THRESHOLD_METERS) {
                            dbHelper.insertLocation(loc.latitude, loc.longitude, System.currentTimeMillis(), deviceId)
                            lastSaved = LocationDatabaseHelper.LastLoc(loc.latitude, loc.longitude, System.currentTimeMillis())
                            Log.d(TAG, "Location saved to DB. Distance moved: $dist meters")
                            syncIfBatchReady()
                        }
                    }
                }
                delay(CHECK_INTERVAL_MS)
            }
        }
    }

    private suspend fun getCurrentLocation(): Location? = suspendCancellableCoroutine { cont ->
        try {
            fusedLocationClient
                .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { loc -> cont.resume(loc) }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to get location", e)
                    cont.resume(null)
                }
        } catch (e: Exception) {
            Log.e(TAG, "Exception in getCurrentLocation", e)
            cont.resume(null)
        }
    }

    private fun distanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Float {
        val res = FloatArray(1)
        Location.distanceBetween(lat1, lon1, lat2, lon2, res)
        return res[0]
    }

    private fun syncIfBatchReady() {
        val unsynced = dbHelper.getUnsyncedBatch(5)
        if (unsynced.size >= 5 && isOnline()) {
            pushBatchToSupabase(unsynced)
        }
    }

    private fun pushBatchToSupabase(batch: List<LocationDatabaseHelper.Row>) {
        try {
            val jsonArray = JSONArray()
            for (row in batch) {
                val obj = JSONObject()
                obj.put("device_id", row.deviceId)
                obj.put("lat", row.latitude)
                obj.put("lng", row.longitude)
                obj.put("created_at", java.time.Instant.ofEpochMilli(row.createdAtMs).toString())
                jsonArray.put(obj)
            }

            val body = jsonArray.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$SUPABASE_URL/rest/v1/$SUPABASE_TABLE")
                .addHeader("apikey", SUPABASE_KEY)
                .addHeader("Authorization", "Bearer $SUPABASE_KEY")
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "resolution=merge-duplicates")
                .post(body)
                .build()

            val resp = client.newCall(request).execute()
            if (resp.isSuccessful) dbHelper.markSynced(batch.map { it.id })
            resp.close()
            Log.d(TAG, "Batch synced to Supabase: size=${batch.size}")
        } catch (e: Exception) {
            Log.e(TAG, "Error syncing batch", e)
        }
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        val net = cm.activeNetworkInfo
        return net != null && net.isConnected
    }

    private fun emitCurrentToJs(loc: Location) {
        try {
            val reactApp = applicationContext as ReactApplication
            val reactContext = reactApp.reactNativeHost.reactInstanceManager.currentReactContext

            if (reactContext != null) {
                val params = Arguments.createMap().apply {
                    putDouble("latitude", loc.latitude)
                    putDouble("longitude", loc.longitude)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                }

                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("LocationUpdate", params)
            } else {
                Log.w(TAG, "ReactContext not ready yet, skipping emit")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit location to RN", e)
        }
    }
}