package com.backgroundlocationapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.pm.PackageManager
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.content.pm.ServiceInfo
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.backgroundlocationapp.R

class LocationService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest
    private val CHANNEL_ID = "LocationChannel"
    private var locationCallback: LocationCallback? = null
    private lateinit var dbHelper: LocationDatabaseHelper

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        // Start foreground immediately so OS doesn't kill us (Android 12+ policy)
        startForegroundServiceSafely()

        // High accuracy, every 10 sec
        locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            10_000L
        )
            .setMinUpdateIntervalMillis(10_000L)
            .setMinUpdateDistanceMeters(0f)
            .build()

        dbHelper = LocationDatabaseHelper(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startLocationUpdates()
        return START_STICKY
    }

    private fun startForegroundServiceSafely() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Background Location",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Background Location Running")
            .setContentText("Tracking every 10 sec")
            .setSmallIcon(R.mipmap.ic_launcher)
            .build()

        val hasFine = ContextCompat.checkSelfPermission(
            this, android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(
            this, android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasAnyLocation = hasFine || hasCoarse

        val hasFgsLocation =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Normal (non-runtime) permission; GRANTED if declared in manifest
                ContextCompat.checkSelfPermission(
                    this, android.Manifest.permission.FOREGROUND_SERVICE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
            } else true

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasFgsLocation && hasAnyLocation) {
                startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            } else {
                // Fallback without type to avoid SecurityException
                startForeground(1, notification)
            }
        } catch (_: SecurityException) {
            // Final safety net: still show a foreground notification (no type)
            startForeground(1, notification)
        }
    }

    private fun startLocationUpdates() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    // Save to SQLite
                    dbHelper.insertLocation(location.latitude, location.longitude)

                    // Emit to RN
                    val app = application as ReactApplication
                    val context: ReactContext? =
                        app.reactNativeHost.reactInstanceManager.currentReactContext

                    val params: WritableMap = Arguments.createMap().apply {
                        putDouble("latitude", location.latitude)
                        putDouble("longitude", location.longitude)
                        putDouble("accuracy", location.accuracy.toDouble())
                        putDouble("timestamp", System.currentTimeMillis().toDouble())
                    }

                    context?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("LocationUpdate", params)
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                mainLooper
            )
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        locationCallback = null
        stopForeground(true)
        stopSelf()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}