import React, { useState } from "react";
import {
  View,
  Text,
  Button,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import { NativeModules } from "react-native";

const { OneShotLocation } = NativeModules;

const App = () => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // ✅ Request location + background permissions
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION, // Needed for Android 10+
        ]);

        const fineGranted =
          granted["android.permission.ACCESS_FINE_LOCATION"] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const coarseGranted =
          granted["android.permission.ACCESS_COARSE_LOCATION"] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const bgGranted =
          granted["android.permission.ACCESS_BACKGROUND_LOCATION"] ===
          PermissionsAndroid.RESULTS.GRANTED;

        return fineGranted || coarseGranted || bgGranted;
      } catch (err) {
        console.warn("Permission error:", err);
        return false;
      }
    }
    return true; // iOS not needed here
  };

  // 📍 Get single location
  const getLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setError("Permission denied");
      return;
    }

    try {
      const loc = await OneShotLocation.getCurrentLocation();
      setLocation({
        lat: loc.latitude,
        lng: loc.longitude,
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to get location");
    }
  };

  // 🚀 Start background tracking
  const startBackground = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert(
        "Permission Required",
        "Background location permission is required to track your location even when the app is closed."
      );
      return;
    }

    try {
      OneShotLocation.startBackgroundLocation();
      setIsTracking(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to start background tracking");
    }
  };

  // ⏹ Stop background tracking
  const stopBackground = async () => {
    try {
      OneShotLocation.stopBackgroundLocation();
      setIsTracking(false);
    } catch (err: any) {
      setError(err.message || "Failed to stop background tracking");
    }
  };

  return (
    <View style={styles.container}>
      <Button title="📍 Get Current Location" onPress={getLocation} />

      <View style={{ height: 20 }} />

      {!isTracking ? (
        <Button
          title="▶️ Start Background Tracking"
          color="green"
          onPress={startBackground}
        />
      ) : (
        <Button
          title="⏹ Stop Background Tracking"
          color="red"
          onPress={stopBackground}
        />
      )}

      {location && (
        <Text style={styles.text}>
          Latitude: {location.lat} {"\n"}
          Longitude: {location.lng}
        </Text>
      )}

      {isTracking && (
        <Text style={styles.tracking}>Tracking in background...</Text>
      )}

      {error && <Text style={styles.error}>⚠️ {error}</Text>}
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  tracking: {
    marginTop: 20,
    fontSize: 16,
    color: "green",
    fontWeight: "bold",
  },
  error: {
    marginTop: 20,
    fontSize: 14,
    color: "red",
    textAlign: "center",
  },
});