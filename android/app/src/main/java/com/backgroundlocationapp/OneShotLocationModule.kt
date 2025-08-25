package com.backgroundlocationapp

import android.annotation.SuppressLint
import android.location.Location
import com.facebook.react.bridge.*
import com.google.android.gms.location.*

class OneShotLocationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "OneShotLocation"
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getCurrentLocation(promise: Promise) {
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(reactApplicationContext)

        // ✅ Try last known location first
        fusedLocationClient.lastLocation
            .addOnSuccessListener { location: Location? ->
                if (location != null) {
                    promise.resolve(toWritableMap(location))
                } else {
                    // ✅ Request a fresh location update if lastLocation is null
                    val request = LocationRequest.Builder(
                        Priority.PRIORITY_HIGH_ACCURACY, 1000L
                    ).setMaxUpdates(1).build()

                    fusedLocationClient.requestLocationUpdates(
                        request,
                        object : LocationCallback() {
                            override fun onLocationResult(result: LocationResult) {
                                fusedLocationClient.removeLocationUpdates(this)
                                val loc = result.lastLocation
                                if (loc != null) {
                                    promise.resolve(toWritableMap(loc))
                                } else {
                                    promise.reject("LOCATION_ERROR", "Unable to fetch location")
                                }
                            }
                        },
                        null
                    )
                }
            }
            .addOnFailureListener { e ->
                promise.reject("LOCATION_ERROR", e.message)
            }
    }

    private fun toWritableMap(location: Location): WritableMap {
        val map = Arguments.createMap()
        map.putDouble("latitude", location.latitude)
        map.putDouble("longitude", location.longitude)
        return map
    }
}