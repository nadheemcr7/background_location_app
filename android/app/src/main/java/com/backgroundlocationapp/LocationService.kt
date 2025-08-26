package com.backgroundlocationapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.content.pm.ServiceInfo
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject

class LocationService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest
    private val CHANNEL_ID = "LocationChannel"
    private var locationCallback: LocationCallback? = null
    private lateinit var dbHelper: LocationDatabaseHelper

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        // ✅ 10 second interval + 0m displacement
        locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            10_000L // every 10 sec
        )
            .setMinUpdateIntervalMillis(10_000L)
            .setMinUpdateDistanceMeters(0f) // no minimum distance
            .build()

        dbHelper = LocationDatabaseHelper(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundService()
        startLocationUpdates()
        return START_NOT_STICKY   // ✅ do not auto-restart after stopService()
    }

    private fun startForegroundService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Background Location",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Background Location Running")
            .setContentText("Tracking every 10 sec")
            .setSmallIcon(R.mipmap.ic_launcher)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(1, notification)
        }
    }

    private fun startLocationUpdates() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    val data = JSONObject()
                    data.put("latitude", location.latitude)
                    data.put("longitude", location.longitude)

                    // ✅ Save in SQLite
                    dbHelper.insertLocation(location.latitude, location.longitude)

                    // ✅ Send to React Native JS (if app is alive)
                    val app = application as ReactApplication
                    val context: ReactContext? =
                        app.reactNativeHost.reactInstanceManager.currentReactContext

                    context?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("LocationUpdate", data.toString())
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback as LocationCallback,
                mainLooper
            )
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
        }
        stopForeground(true) // ✅ remove notification
        stopSelf()           // ✅ ensure service is killed
    }

    override fun onBind(intent: Intent?): IBinder? = null
}