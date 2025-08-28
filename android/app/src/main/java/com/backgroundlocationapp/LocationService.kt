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

class LocationService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var dbHelper: LocationDatabaseHelper
    private var trackingJob: Job? = null
    private val client = OkHttpClient()

    private val CHECK_INTERVAL_MS = 30_000L       // every 30 seconds
    private val DISTANCE_THRESHOLD_METERS = 10.0  // 10 meters
    private val SUPABASE_URL = "https://ezcivoiepeyrfaykqkfl.supabase.co"
    private val SUPABASE_TABLE = "location_points"
    private val SUPABASE_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6Y2l2b2llcGV5cmZheWtxa2ZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDQ3MTA0MywiZXhwIjoyMDYwMDQ3MDQzfQ.bmMal1PS6dpGSfr2QNdJI5Waqehl5UwJRtLLMTzmx-0"

    // Use a stable device ID instead of random UUID each boot
    private val deviceId: String by lazy {
        Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
            ?: UUID.randomUUID().toString()
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        dbHelper = LocationDatabaseHelper(this)
        startForegroundService()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startTrackingLoop()
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        trackingJob?.cancel()
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

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Tracking Location")
            .setContentText("Background location tracking active")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .build()

        startForeground(1, notification)
    }

    private fun startTrackingLoop() {
        trackingJob = CoroutineScope(Dispatchers.IO).launch {
            var lastSaved: LocationDatabaseHelper.LastLoc? = null

            while (isActive) {
                val loc = getCurrentLocation()
                if (loc != null) {
                    if (lastSaved == null) {
                        // First fix → always save
                        dbHelper.insertLocation(
                            loc.latitude,
                            loc.longitude,
                            System.currentTimeMillis(),
                            deviceId
                        )
                        lastSaved = LocationDatabaseHelper.LastLoc(
                            loc.latitude, loc.longitude, System.currentTimeMillis()
                        )
                    } else {
                        val dist = distanceMeters(
                            lastSaved.latitude,
                            lastSaved.longitude,
                            loc.latitude,
                            loc.longitude
                        )
                        if (dist > DISTANCE_THRESHOLD_METERS) {
                            dbHelper.insertLocation(
                                loc.latitude,
                                loc.longitude,
                                System.currentTimeMillis(),
                                deviceId
                            )
                            lastSaved = LocationDatabaseHelper.LastLoc(
                                loc.latitude, loc.longitude, System.currentTimeMillis()
                            )
                        }
                    }
                    // Try sync if batch ready
                    syncIfBatchReady()
                }
                delay(CHECK_INTERVAL_MS)
            }
        }
    }

    private suspend fun getCurrentLocation(): Location? = suspendCancellableCoroutine { cont ->
        try {
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { loc -> cont.resume(loc, null) }
                .addOnFailureListener { _ -> cont.resume(null, null) }
        } catch (e: Exception) {
            cont.resume(null, null)
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
                .post(body)
                .build()

            val resp = client.newCall(request).execute()
            if (resp.isSuccessful) {
                dbHelper.markSynced(batch.map { it.id })
            }
            resp.close()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        val net = cm.activeNetworkInfo
        return net != null && net.isConnected
    }
}