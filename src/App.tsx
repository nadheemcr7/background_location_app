import React, { useState } from "react";
import {
  View,
  Text,
  Button,
  PermissionsAndroid,
  Platform,
  StyleSheet,
} from "react-native";
import { NativeModules } from "react-native";

const { OneShotLocation } = NativeModules;

const App = () => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // ✅ Request both Fine + Coarse permissions (needed for Android 12+)
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        const fineGranted =
          granted["android.permission.ACCESS_FINE_LOCATION"] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const coarseGranted =
          granted["android.permission.ACCESS_COARSE_LOCATION"] ===
          PermissionsAndroid.RESULTS.GRANTED;

        return fineGranted || coarseGranted; // either is enough
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS (not used here)
  };

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

  return (
    <View style={styles.container}>
      <Button title="Get Location" onPress={getLocation} />
      {location && (
        <Text style={styles.text}>
          Latitude: {location.lat} {"\n"}Longitude: {location.lng}
        </Text>
      )}
      {error && <Text style={styles.error}>Error: {error}</Text>}
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
  },
  text: {
    marginTop: 20,
    fontSize: 16,
  },
  error: {
    marginTop: 20,
    fontSize: 14,
    color: "red",
  },
});