import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  Button,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Alert,
  DeviceEventEmitter,
  ScrollView,
} from 'react-native';
import {NativeModules} from 'react-native';
import SQLite from 'react-native-sqlite-storage';

const {BackgroundLocationModule} = NativeModules;

const App = () => {
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(
    null,
  );
  const [isTracking, setIsTracking] = useState(false);
  const [savedLocations, setSavedLocations] = useState<
    {lat: number; lng: number}[]
  >([]);

  const db = SQLite.openDatabase(
    {name: 'locations.db', location: 'default'},
    () => console.log('📂 DB Opened'),
    e => console.log('❌ DB Error', e),
  );

  // Create table once
  useEffect(() => {
    db.transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          latitude REAL,
          longitude REAL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        [],
        () => console.log('✅ Table ready'),
        (_, err) => {
          console.log('❌ Table creation error', err);
          return false;
        },
      );
    });
  }, []);

  // Listen for native location updates
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('LocationUpdate', loc => {
      setLocation({lat: loc.latitude, lng: loc.longitude});
  
      db.transaction(tx => {
        tx.executeSql(
          'INSERT INTO locations (latitude, longitude) VALUES (?, ?)',
          [loc.latitude, loc.longitude],
          () => console.log('✅ Location saved:', loc),
          (_, error) => {
            console.log('❌ Insert error:', error);
            return false;
          },
        );
      });
  
      fetchLocations();
    });
  
    return () => sub.remove();
  }, []);

  const fetchLocations = () => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT latitude, longitude FROM locations ORDER BY id DESC LIMIT 5',
        [],
        (_, results) => {
          const rows = results.rows;
          let arr: {lat: number; lng: number}[] = [];
          for (let i = 0; i < rows.length; i++) {
            arr.push({lat: rows.item(i).latitude, lng: rows.item(i).longitude});
          }
          setSavedLocations(arr);
        },
      );
    });
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        ]);
        return Object.values(granted).every(
          res => res === PermissionsAndroid.RESULTS.GRANTED,
        );
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  const startBackground = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Background location permission required.',
      );
      return;
    }
    BackgroundLocationModule.startService();
    setIsTracking(true);
  };

  const stopBackground = async () => {
    BackgroundLocationModule.stopService();
    setIsTracking(false);
  };

  return (
    <View style={styles.container}>
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
          Current → Lat: {location.lat}, Lng: {location.lng}
        </Text>
      )}

      <Text style={styles.heading}>📍 Last 5 Saved Locations</Text>
      <ScrollView style={{marginTop: 10}}>
        {savedLocations.map((loc, i) => (
          <Text key={i} style={styles.text}>
            {i + 1}. Lat: {loc.lat}, Lng: {loc.lng}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20},
  text: {marginTop: 10, fontSize: 16},
  heading: {marginTop: 20, fontSize: 18, fontWeight: 'bold'},
});