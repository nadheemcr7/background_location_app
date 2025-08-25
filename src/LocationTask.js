import AsyncStorage from '@react-native-async-storage/async-storage';
import {haversineDistance} from './utils/haversine';

async function saveLocation(point) {
  let stored = await AsyncStorage.getItem('locations');
  let arr = stored ? JSON.parse(stored) : [];
  arr.push(point);
  await AsyncStorage.setItem('locations', JSON.stringify(arr));
}

async function flushLocations() {
  let stored = await AsyncStorage.getItem('locations');
  if (!stored) return;
  let arr = JSON.parse(stored);

  if (arr.length > 0) {
    try {
      await fetch('https://example.com/api/locations', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({locations: arr}),
      });
      await AsyncStorage.removeItem('locations');
      console.log('✅ Uploaded', arr.length, 'locations');
    } catch (e) {
      console.error('Upload failed, keeping data', e);
    }
  }
}

export const LocationTask = async () => {
  console.log('📍 Background task triggered');

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const {latitude, longitude} = pos.coords;
        const now = Date.now();

        let lastPoint = await AsyncStorage.getItem('lastPoint');
        lastPoint = lastPoint ? JSON.parse(lastPoint) : null;

        let shouldSave = false;
        if (!lastPoint) {
          shouldSave = true;
        } else {
          const dist = haversineDistance(
            lastPoint.latitude,
            lastPoint.longitude,
            latitude,
            longitude,
          );
          const timeDiff = now - lastPoint.timestamp;
          if (dist >= 50 && timeDiff >= 5 * 60 * 1000) {
            shouldSave = true;
          }
        }

        if (shouldSave) {
          const point = {latitude, longitude, timestamp: now};
          await saveLocation(point);
          await AsyncStorage.setItem('lastPoint', JSON.stringify(point));
          console.log('✅ Saved point', point);
        }

        if (navigator.onLine) {
          await flushLocations();
        }

        resolve(true);
      },
      err => {
        console.error('❌ Error getting location', err);
        resolve(false);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  });
};