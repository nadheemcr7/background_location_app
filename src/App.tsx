







// import React, {useState, useEffect, useCallback} from 'react';
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
//   AppState,
// } from 'react-native';
// import {NativeModules} from 'react-native';
// import SQLite from 'react-native-sqlite-storage';
// import NetInfo from '@react-native-community/netinfo';
// import { supabase } from './lib/supabase';
// import DeviceInfo from 'react-native-device-info';

// const {BackgroundLocationModule} = NativeModules;

// type Row = {
//   id: number;
//   latitude: number;
//   longitude: number;
//   created_at: number; // epoch ms
//   device_id: string;
//   user_id?: string | null; // optional
// };

// const App = () => {
//   const [location, setLocation] = useState<{lat: number; lng: number; ts: number} | null>(null);
//   const [isTracking, setIsTracking] = useState(false);
//   const [savedLocations, setSavedLocations] = useState<Row[]>([]);
//   const [online, setOnline] = useState<boolean | null>(null);
//   const [deviceId, setDeviceId] = useState<string>('');

//   useEffect(() => {
//     setDeviceId(DeviceInfo.getUniqueId());
//   }, []);

//   const db = SQLite.openDatabase(
//     {name: 'locations.db', location: 'default'},
//     () => console.log('📂 DB Opened'),
//     e => console.log('❌ DB Error', e),
//   );

//   // Ensure table exists (matches native table)
//   useEffect(() => {
//     db.transaction(tx => {
//       tx.executeSql(
//         `CREATE TABLE IF NOT EXISTS locations (
//           id INTEGER PRIMARY KEY AUTOINCREMENT,
//           latitude REAL NOT NULL,
//           longitude REAL NOT NULL,
//           created_at INTEGER NOT NULL,
//           device_id TEXT,
//           user_id TEXT,
//           synced INTEGER NOT NULL DEFAULT 0
//         )`,
//         [],
//       );
//     });
//   }, []);

//   // Listen for native "current" updates → refresh UI + try sync
//   const trySyncBatch = useCallback(async () => {
//     if (online !== true) return;
//     try {
//       const batch = await getUnsynced();
//       if (!batch.length) return;

//       const payload = batch.map(b => ({
//         user_id: b.user_id || null,
//         device_id: b.device_id || deviceId,
//         lat: b.latitude,
//         lng: b.longitude,
//         created_at: new Date(b.created_at).toISOString(),
//       }));

//       const { error } = await supabase.from('location_points').insert(payload);
//       if (error) {
//         console.log('❌ Supabase insert failed:', error.message);
//         return;
//       }

//       await markSynced(batch.map(b => b.id));
//       console.log(`✅ Synced ${batch.length} rows to Supabase`);
//       fetchLatest(); // refresh UI after sync
//     } catch (e) {
//       console.log('❌ Sync error:', e);
//     }
//   }, [online, deviceId]);

//   useEffect(() => {
//     const sub = DeviceEventEmitter.addListener('LocationUpdate', (loc: any) => {
//       if (!loc?.latitude || !loc?.longitude) return;
//       setLocation({lat: loc.latitude, lng: loc.longitude, ts: Math.floor(loc.timestamp) });
//       fetchLatest();       // UI refresh
//       trySyncBatch();      // attempt to push up to 5
//     });
//     return () => sub.remove();
//   }, [trySyncBatch]);

//   // App state & connectivity → attempt sync when foreground/online
//   useEffect(() => {
//     const appSub = AppState.addEventListener('change', s => {
//       if (s === 'active') trySyncBatch();
//     });
//     const netSub = NetInfo.addEventListener(state => {
//       setOnline(state.isConnected === true);
//       if (state.isConnected) trySyncBatch();
//     });
//     return () => { appSub.remove(); netSub(); };
//   }, [trySyncBatch]);

//   const fetchLatest = useCallback(() => {
//     db.transaction(tx => {
//       tx.executeSql(
//         'SELECT id, latitude, longitude, created_at, device_id, user_id FROM locations ORDER BY id DESC LIMIT 10',
//         [],
//         (_, results) => {
//           const rows = results.rows;
//           const arr: Row[] = [];
//           for (let i = 0; i < rows.length; i++) {
//             const it = rows.item(i);
//             arr.push({
//               id: it.id,
//               latitude: it.latitude,
//               longitude: it.longitude,
//               created_at: it.created_at,
//               device_id: it.device_id,
//               user_id: it.user_id,
//             });
//           }
//           setSavedLocations(arr);
//         },
//       );
//     });
//   }, []);

//   // Get up to 5 unsynced rows
//   const getUnsynced = (): Promise<Row[]> =>
//     new Promise(resolve => {
//       db.readTransaction(tx => {
//         tx.executeSql(
//           'SELECT id, latitude, longitude, created_at, device_id, user_id FROM locations WHERE synced=0 ORDER BY id ASC LIMIT 5',
//           [],
//           (_, res) => {
//             const rows = res.rows;
//             const arr: Row[] = [];
//             for (let i = 0; i < rows.length; i++) {
//               const it = rows.item(i);
//               arr.push({
//                 id: it.id,
//                 latitude: it.latitude,
//                 longitude: it.longitude,
//                 created_at: it.created_at,
//                 device_id: it.device_id || deviceId,
//                 user_id: it.user_id,
//               });
//             }
//             resolve(arr);
//           },
//         );
//       });
//     });

//   const markSynced = (ids: number[]) =>
//     new Promise<void>(resolve => {
//       if (!ids.length) return resolve();
//       db.transaction(tx => {
//         const placeholders = ids.map(() => '?').join(',');
//         tx.executeSql(
//           `UPDATE locations SET synced=1 WHERE id IN (${placeholders})`,
//           ids.map(String),
//           () => resolve(),
//         );
//       });
//     });

//   // Permissions
//   const requestLocationPermission = async (): Promise<boolean> => {
//     if (Platform.OS === 'android') {
//       try {
//         const granted = await PermissionsAndroid.requestMultiple([
//           PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//           PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
//         ]);

//         const fine =
//           granted['android.permission.ACCESS_FINE_LOCATION'] ===
//           PermissionsAndroid.RESULTS.GRANTED;
//         const coarse =
//           granted['android.permission.ACCESS_COARSE_LOCATION'] ===
//           PermissionsAndroid.RESULTS.GRANTED;

//         if (!fine && !coarse) {
//           Alert.alert(
//             'Permission Required',
//             'Location permission is required to track your position.',
//             [{text: 'OK'}],
//           );
//           return false;
//         }

//         if (Platform.Version >= 29) {
//           const background = await PermissionsAndroid.request(
//             PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
//           );
//           if (background !== PermissionsAndroid.RESULTS.GRANTED) {
//             Alert.alert(
//               'Background Location Needed',
//               'To track in background, please allow "Allow all the time".',
//               [{text: 'OK'}],
//             );
//             return false;
//           }
//         }

//         return true;
//       } catch (err) {
//         console.warn('Permission error:', err);
//         return false;
//       }
//     }
//     return true;
//   };

//   const startBackground = async () => {
//     const hasPermission = await requestLocationPermission();
//     if (!hasPermission) return;

//     try {
//       BackgroundLocationModule.startService();
//       setIsTracking(true);
//       fetchLatest();
//       trySyncBatch();
//       console.log('🚀 Background service started');
//     } catch (e) {
//       console.log('❌ Failed to start service', e);
//       Alert.alert('Error', 'Failed to start background service.');
//     }
//   };

//   const stopBackground = () => {
//     try {
//       BackgroundLocationModule.stopService();
//       setIsTracking(false);
//       console.log('🛑 Background service stopped');
//     } catch (e) {
//       console.log('❌ Failed to stop service', e);
//     }
//   };

//   const fmt = (ms: number) => {
//     const d = new Date(ms);
//     return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
//   };

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
//           Current → Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)} @ {fmt(location.ts)}
//         </Text>
//       )}

//       <Text style={styles.heading}>📍 Last 10 Saved Locations</Text>
//       <ScrollView style={{marginTop: 10, alignSelf: 'stretch'}}>
//         {savedLocations.map((row) => (
//           <Text key={row.id} style={styles.text}>
//             #{row.id} · {row.latitude.toFixed(6)}, {row.longitude.toFixed(6)} · {fmt(row.created_at)}
//           </Text>
//         ))}
//       </ScrollView>
//     </View>
//   );
// };

// export default App;

// const styles = StyleSheet.create({
//   container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20},
//   text: {marginTop: 8, fontSize: 15},
//   heading: {marginTop: 20, fontSize: 18, fontWeight: 'bold'},
// });












import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { NativeModules } from 'react-native';
import SQLite from 'react-native-sqlite-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './lib/supabase';
import DeviceInfo from 'react-native-device-info';
import { WebView } from 'react-native-webview';

const { BackgroundLocationModule } = NativeModules;

type Row = {
  id: number;
  latitude: number;
  longitude: number;
  created_at: number;
  device_id: string;
  user_id?: string | null;
};

const App = () => {
  const [location, setLocation] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [savedLocations, setSavedLocations] = useState<Row[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');

  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);

  // Initialize DB and device ID
  useEffect(() => {
    setDeviceId(DeviceInfo.getUniqueId());
    dbRef.current = SQLite.openDatabase(
      { name: 'locations.db', location: 'default' },
      () => console.log('📂 DB Opened'),
      e => console.log('❌ DB Error', e),
    );
  }, []);

  // Ensure table exists
  useEffect(() => {
    if (!dbRef.current) return;
    dbRef.current.transaction(tx => {
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
  }, [dbRef.current]);

  // Fetch latest 10 locations
  const fetchLatest = useCallback(() => {
    if (!dbRef.current) return;
    dbRef.current.transaction(tx => {
      tx.executeSql(
        'SELECT id, latitude, longitude, created_at, device_id, user_id FROM locations ORDER BY id DESC LIMIT 10',
        [],
        (_, results) => {
          const arr: Row[] = [];
          for (let i = 0; i < results.rows.length; i++) {
            arr.push(results.rows.item(i));
          }
          setSavedLocations(arr);
        },
      );
    });
  }, []);

  // Get unsynced rows (batch of 5)
  const getUnsynced = (): Promise<Row[]> =>
    new Promise(resolve => {
      if (!dbRef.current) return resolve([]);
      dbRef.current.readTransaction(tx => {
        tx.executeSql(
          'SELECT id, latitude, longitude, created_at, device_id, user_id FROM locations WHERE synced=0 ORDER BY id ASC LIMIT 5',
          [],
          (_, res) => {
            const arr: Row[] = [];
            for (let i = 0; i < res.rows.length; i++) {
              arr.push(res.rows.item(i));
            }
            resolve(arr);
          },
        );
      });
    });

  const markSynced = (ids: number[]) =>
    new Promise<void>(resolve => {
      if (!dbRef.current || !ids.length) return resolve();
      dbRef.current.transaction(tx => {
        const placeholders = ids.map(() => '?').join(',');
        tx.executeSql(
          `UPDATE locations SET synced=1 WHERE id IN (${placeholders})`,
          ids,
          () => resolve(),
        );
      });
    });

  // Sync batch to Supabase
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
      fetchLatest();
    } catch (e) {
      console.log('❌ Sync error:', e);
    }
  }, [online, deviceId, fetchLatest]);

  // Listen to native LocationUpdate events
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('LocationUpdate', (loc: any) => {
      if (loc?.latitude == null || loc?.longitude == null) return;
      console.log(`📍 LocationUpdate JS: lat=${loc.latitude}, lng=${loc.longitude}`);
      setLocation({ lat: loc.latitude, lng: loc.longitude, ts: Math.floor(loc.timestamp) });
      fetchLatest();
      trySyncBatch();
    });
    return () => sub.remove();
  }, [fetchLatest, trySyncBatch]);

  // AppState & Network listener
  useEffect(() => {
    const appSub = AppState.addEventListener('change', s => {
      if (s === 'active') trySyncBatch();
    });

    const netUnsub = NetInfo.addEventListener(state => {
      setOnline(state.isConnected === true);
      if (state.isConnected) trySyncBatch();
    });

    return () => {
      appSub.remove();
      netUnsub();
    };
  }, [trySyncBatch]);

  // Auto-refresh saved list every 30s
  useEffect(() => {
    const interval = setInterval(fetchLatest, 30_000);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  // Request location permission
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        const fine = granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;
        const coarse = granted['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;

        if (!fine && !coarse) {
          Alert.alert('Permission Required', 'Location permission is required to track your position.', [{ text: 'OK' }]);
          return false;
        }

        if (Platform.Version >= 29) {
          const background = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
          if (background !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Background Location Needed', 'Please allow "Allow all the time".', [{ text: 'OK' }]);
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
    <View style={{ flex: 1 }}>
      {/* WebView */}
      <View style={{ flex: 1 }}>
        <WebView source={{ uri: 'https://www.google.com' }} style={{ flex: 1 }} />
      </View>

      {/* Saved Locations */}
      <ScrollView style={{ maxHeight: 150, backgroundColor: '#fafafa' }}>
        {savedLocations.map(row => (
          <Text key={row.id} style={styles.text}>
            #{row.id} · {row.latitude.toFixed(6)}, {row.longitude.toFixed(6)} · {fmt(row.created_at)}
          </Text>
        ))}
      </ScrollView>

      {/* Footer Controls */}
      <View style={styles.footer}>
        {!isTracking ? (
          <Button title="▶️ Start" color="green" onPress={startBackground} />
        ) : (
          <Button title="⏹ Stop" color="red" onPress={stopBackground} />
        )}
        {location ? (
          <Text style={styles.text}>
            Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
          </Text>
        ) : (
          <Text style={styles.text}>Fetching current location...</Text>
        )}
      </View>
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  text: { margin: 6, fontSize: 14 },
  footer: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 10,
  },
});