// import React, {useState, useEffect} from 'react';
// import {
//   View,
//   Text,
//   Button,
//   PermissionsAndroid,
//   Platform,
//   StyleSheet,
//   Alert,
//   DeviceEventEmitter,
//   ScrollView,
//   Linking,
// } from 'react-native';
// import {NativeModules} from 'react-native';
// import SQLite from 'react-native-sqlite-storage';
// import RNAndroidLocationEnabler from 'react-native-android-location-enabler';
// const {BackgroundLocationModule} = NativeModules;

// const App = () => {
//   const [location, setLocation] = useState<{lat: number; lng: number} | null>(
//     null,
//   );
//   const [isTracking, setIsTracking] = useState(false);
//   const [savedLocations, setSavedLocations] = useState<
//     {lat: number; lng: number}[]
//   >([]);

//   const db = SQLite.openDatabase(
//     {name: 'locations.db', location: 'default'},
//     () => console.log('📂 DB Opened'),
//     e => console.log('❌ DB Error', e),
//   );

//   // 🔹 Create table once
//   useEffect(() => {
//     db.transaction(tx => {
//       tx.executeSql(
//         `CREATE TABLE IF NOT EXISTS locations (
//           id INTEGER PRIMARY KEY AUTOINCREMENT,
//           latitude REAL,
//           longitude REAL,
//           timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
//         )`,
//         [],
//         () => console.log('✅ Table ready'),
//         (_, err) => {
//           console.log('❌ Table creation error', err);
//           return false;
//         },
//       );
//     });
//   }, []);

//   // 🔹 Listen for native location updates
//   useEffect(() => {
//     const sub = DeviceEventEmitter.addListener('LocationUpdate', loc => {
//       console.log('📡 Location update received:', loc);

//       if (!loc?.latitude || !loc?.longitude) return;

//       setLocation({lat: loc.latitude, lng: loc.longitude});

//       db.transaction(tx => {
//         tx.executeSql(
//           'INSERT INTO locations (latitude, longitude) VALUES (?, ?)',
//           [loc.latitude, loc.longitude],
//           () => console.log('✅ Location saved:', loc),
//           (_, error) => {
//             console.log('❌ Insert error:', error);
//             return false;
//           },
//         );
//       });

//       fetchLocations();
//     });

//     return () => sub.remove();
//   }, []);

//   const fetchLocations = () => {
//     db.transaction(tx => {
//       tx.executeSql(
//         'SELECT latitude, longitude FROM locations ORDER BY id DESC LIMIT 5',
//         [],
//         (_, results) => {
//           const rows = results.rows;
//           let arr: {lat: number; lng: number}[] = [];
//           for (let i = 0; i < rows.length; i++) {
//             arr.push({lat: rows.item(i).latitude, lng: rows.item(i).longitude});
//           }
//           setSavedLocations(arr);
//         },
//       );
//     });
//   };

//   // 🔹 Improved permission request
//   const requestLocationPermission = async (): Promise<boolean> => {
//     if (Platform.OS === 'android') {
//       try {
//         const granted = await PermissionsAndroid.requestMultiple([
//           PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//           PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
//           PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
//         ]);

//         const fine =
//           granted['android.permission.ACCESS_FINE_LOCATION'] ===
//           PermissionsAndroid.RESULTS.GRANTED;
//         const coarse =
//           granted['android.permission.ACCESS_COARSE_LOCATION'] ===
//           PermissionsAndroid.RESULTS.GRANTED;
//         const background =
//           granted['android.permission.ACCESS_BACKGROUND_LOCATION'] ===
//           PermissionsAndroid.RESULTS.GRANTED;

//         // ❌ If no location at all
//         if (!fine && !coarse) {
//           Alert.alert(
//             'Permission Required',
//             'Location permission is required to track your position.',
//             [
//               {text: 'Cancel', style: 'cancel'},
//               {text: 'Open Settings', onPress: () => Linking.openSettings()},
//             ],
//           );
//           return false;
//         }

//         // ❌ If background denied on Android 10+
//         if (Platform.Version >= 29 && !background) {
//           Alert.alert(
//             'Background Location Needed',
//             'Please allow "Allow all the time" for location in settings.',
//             [
//               {text: 'Cancel', style: 'cancel'},
//               {text: 'Open Settings', onPress: () => Linking.openSettings()},
//             ],
//           );
//           return false;
//         }

//         return true;
//       } catch (err) {
//         console.warn('Permission error:', err);
//         return false;
//       }
//     }
//     return true;
//   };

//   // 🔹 Start service safely
//   const startBackground = async () => {
//     const hasPermission = await requestLocationPermission();
//     if (!hasPermission) return;

//     try {
//       BackgroundLocationModule.startService();
//       setIsTracking(true);
//       console.log('🚀 Background service started');
//     } catch (e) {
//       console.log('❌ Failed to start service', e);
//       Alert.alert('Error', 'Failed to start background service.');
//     }
//   };

//   // 🔹 Stop service safely
//   const stopBackground = () => {
//     try {
//       BackgroundLocationModule.stopService();
//       setIsTracking(false);
//       console.log('🛑 Background service stopped');
//     } catch (e) {
//       console.log('❌ Failed to stop service', e);
//     }
//   };

//   // 🔹 Auto re-check when user comes back from settings
//   useEffect(() => {
//     const sub = Linking.addEventListener('url', async () => {
//       const granted = await requestLocationPermission();
//       if (granted && !isTracking) {
//         BackgroundLocationModule.startService();
//         setIsTracking(true);
//       }
//     });
//     return () => sub.remove();
//   }, [isTracking]);

//   return (
//     <View style={styles.container}>
//       {!isTracking ? (
//         <Button
//           title="▶️ Start Background Tracking"
//           color="green"
//           onPress={startBackground}
//         />
//       ) : (
//         <Button
//           title="⏹ Stop Background Tracking"
//           color="red"
//           onPress={stopBackground}
//         />
//       )}

//       {location && (
//         <Text style={styles.text}>
//           Current → Lat: {location.lat ?? '—'}, Lng: {location.lng ?? '—'}
//         </Text>
//       )}

//       <Text style={styles.heading}>📍 Last 5 Saved Locations</Text>
//       <ScrollView style={{marginTop: 10}}>
//         {savedLocations.map((loc, i) => (
//           <Text key={i} style={styles.text}>
//             {i + 1}. Lat: {loc.lat ?? '—'}, Lng: {loc.lng ?? '—'}
//           </Text>
//         ))}
//       </ScrollView>
//     </View>
//   );
// };

// export default App;

// const styles = StyleSheet.create({
//   container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20},
//   text: {marginTop: 10, fontSize: 16},
//   heading: {marginTop: 20, fontSize: 18, fontWeight: 'bold'},
// });
























import React, {useState, useEffect, useCallback} from 'react';
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
  AppState,
} from 'react-native';
import {NativeModules} from 'react-native';
import SQLite from 'react-native-sqlite-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './lib/supabase';
import DeviceInfo from 'react-native-device-info';

const {BackgroundLocationModule} = NativeModules;

type Row = {
  id: number;
  latitude: number;
  longitude: number;
  created_at: number; // epoch ms
  device_id: string;
  user_id?: string | null; // optional
};

const App = () => {
  const [location, setLocation] = useState<{lat: number; lng: number; ts: number} | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [savedLocations, setSavedLocations] = useState<Row[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    setDeviceId(DeviceInfo.getUniqueId());
  }, []);

  const db = SQLite.openDatabase(
    {name: 'locations.db', location: 'default'},
    () => console.log('📂 DB Opened'),
    e => console.log('❌ DB Error', e),
  );

  // Ensure table exists (matches native table)
  useEffect(() => {
    db.transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          created_at INTEGER NOT NULL,
          device_id TEXT,
          user_id TEXT,
          synced INTEGER NOT NULL DEFAULT 0
        )`,
        [],
      );
    });
  }, []);

  // Listen for native "current" updates → refresh UI + try sync
  const trySyncBatch = useCallback(async () => {
    if (online !== true) return;
    try {
      const batch = await getUnsynced();
      if (!batch.length) return;

      const payload = batch.map(b => ({
        user_id: b.user_id || null,
        device_id: b.device_id || deviceId,
        lat: b.latitude,
        lng: b.longitude,
        created_at: new Date(b.created_at).toISOString(),
      }));

      const { error } = await supabase.from('location_points').insert(payload);
      if (error) {
        console.log('❌ Supabase insert failed:', error.message);
        return;
      }

      await markSynced(batch.map(b => b.id));
      console.log(`✅ Synced ${batch.length} rows to Supabase`);
      fetchLatest(); // refresh UI after sync
    } catch (e) {
      console.log('❌ Sync error:', e);
    }
  }, [online, deviceId]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('LocationUpdate', (loc: any) => {
      if (!loc?.latitude || !loc?.longitude) return;
      setLocation({lat: loc.latitude, lng: loc.longitude, ts: Math.floor(loc.timestamp) });
      fetchLatest();       // UI refresh
      trySyncBatch();      // attempt to push up to 5
    });
    return () => sub.remove();
  }, [trySyncBatch]);

  // App state & connectivity → attempt sync when foreground/online
  useEffect(() => {
    const appSub = AppState.addEventListener('change', s => {
      if (s === 'active') trySyncBatch();
    });
    const netSub = NetInfo.addEventListener(state => {
      setOnline(state.isConnected === true);
      if (state.isConnected) trySyncBatch();
    });
    return () => { appSub.remove(); netSub(); };
  }, [trySyncBatch]);

  const fetchLatest = useCallback(() => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT id, latitude, longitude, created_at, device_id, user_id FROM locations ORDER BY id DESC LIMIT 10',
        [],
        (_, results) => {
          const rows = results.rows;
          const arr: Row[] = [];
          for (let i = 0; i < rows.length; i++) {
            const it = rows.item(i);
            arr.push({
              id: it.id,
              latitude: it.latitude,
              longitude: it.longitude,
              created_at: it.created_at,
              device_id: it.device_id,
              user_id: it.user_id,
            });
          }
          setSavedLocations(arr);
        },
      );
    });
  }, []);

  // Get up to 5 unsynced rows
  const getUnsynced = (): Promise<Row[]> =>
    new Promise(resolve => {
      db.readTransaction(tx => {
        tx.executeSql(
          'SELECT id, latitude, longitude, created_at, device_id, user_id FROM locations WHERE synced=0 ORDER BY id ASC LIMIT 5',
          [],
          (_, res) => {
            const rows = res.rows;
            const arr: Row[] = [];
            for (let i = 0; i < rows.length; i++) {
              const it = rows.item(i);
              arr.push({
                id: it.id,
                latitude: it.latitude,
                longitude: it.longitude,
                created_at: it.created_at,
                device_id: it.device_id || deviceId,
                user_id: it.user_id,
              });
            }
            resolve(arr);
          },
        );
      });
    });

  const markSynced = (ids: number[]) =>
    new Promise<void>(resolve => {
      if (!ids.length) return resolve();
      db.transaction(tx => {
        const placeholders = ids.map(() => '?').join(',');
        tx.executeSql(
          `UPDATE locations SET synced=1 WHERE id IN (${placeholders})`,
          ids.map(String),
          () => resolve(),
        );
      });
    });

  // Permissions
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        const fine =
          granted['android.permission.ACCESS_FINE_LOCATION'] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const coarse =
          granted['android.permission.ACCESS_COARSE_LOCATION'] ===
          PermissionsAndroid.RESULTS.GRANTED;

        if (!fine && !coarse) {
          Alert.alert(
            'Permission Required',
            'Location permission is required to track your position.',
            [{text: 'OK'}],
          );
          return false;
        }

        if (Platform.Version >= 29) {
          const background = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          );
          if (background !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              'Background Location Needed',
              'To track in background, please allow "Allow all the time".',
              [{text: 'OK'}],
            );
            return false;
          }
        }

        return true;
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  const startBackground = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    try {
      BackgroundLocationModule.startService();
      setIsTracking(true);
      fetchLatest();
      trySyncBatch();
      console.log('🚀 Background service started');
    } catch (e) {
      console.log('❌ Failed to start service', e);
      Alert.alert('Error', 'Failed to start background service.');
    }
  };

  const stopBackground = () => {
    try {
      BackgroundLocationModule.stopService();
      setIsTracking(false);
      console.log('🛑 Background service stopped');
    } catch (e) {
      console.log('❌ Failed to stop service', e);
    }
  };

  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
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
          Current → Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)} @ {fmt(location.ts)}
        </Text>
      )}

      <Text style={styles.heading}>📍 Last 10 Saved Locations</Text>
      <ScrollView style={{marginTop: 10, alignSelf: 'stretch'}}>
        {savedLocations.map((row) => (
          <Text key={row.id} style={styles.text}>
            #{row.id} · {row.latitude.toFixed(6)}, {row.longitude.toFixed(6)} · {fmt(row.created_at)}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20},
  text: {marginTop: 8, fontSize: 15},
  heading: {marginTop: 20, fontSize: 18, fontWeight: 'bold'},
});