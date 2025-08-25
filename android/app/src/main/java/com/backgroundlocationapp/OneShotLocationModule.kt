package com.backgroundlocationapp

import android.annotation.SuppressLint
import android.content.Intent
import android.location.Location
import android.os.Build
import com.facebook.react.bridge.*
import com.google.android.gms.location.LocationServices
import com.google.android.gms.tasks.CancellationTokenSource

class OneShotLocationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OneShotLocation"

    // ✅ One-shot location
    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getCurrentLocation(promise: Promise) {
        val fusedLocationClient =
            LocationServices.getFusedLocationProviderClient(reactApplicationContext)

        val cancellationTokenSource = CancellationTokenSource()

        fusedLocationClient.getCurrentLocation(
            com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
            cancellationTokenSource.token
        )
            .addOnSuccessListener { location: Location? ->
                if (location != null) {
                    val map = Arguments.createMap()
                    map.putDouble("latitude", location.latitude)
                    map.putDouble("longitude", location.longitude)
                    promise.resolve(map)
                } else {
                    promise.reject("LOCATION_ERROR", "Unable to fetch location")
                }
            }
            .addOnFailureListener { e ->
                promise.reject("LOCATION_ERROR", e.message)
            }
    }

    // ✅ Start background location service
    @ReactMethod
    fun startBackgroundLocation() {
        val context = reactApplicationContext
        val serviceIntent = Intent(context, LocationService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}