import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import config from '../config/locationConfig';

const { LocationServiceModule } = NativeModules;

export async function requestAndroidLocationPerms() {
  if (Platform.OS !== 'android') return true;

  const needs = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];

  if (Platform.Version >= 29) {
    needs.push(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
  }
  if (Platform.Version >= 33) {
    // optional but recommended so the foreground notification is shown without issues
    needs.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const res = await PermissionsAndroid.requestMultiple(needs);
  const granted = Object.values(res).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
  return granted;
}

export async function startBackgroundTracking(custom = {}) {
  const ok = await requestAndroidLocationPerms();
  if (!ok) throw new Error('Location permissions not granted (including background).');

  const options = {
    minTimeMs: config.minTimeMs,
    minDistanceM: config.minDistanceM,
    notifTitle: config.notifTitle,
    notifText: config.notifText,
    ...custom,
  };
  await LocationServiceModule.startService(options);
}

export async function stopBackgroundTracking() {
  await LocationServiceModule.stopService();
}

export async function getOneShotLocation() {
  const ok = await requestAndroidLocationPerms();
  if (!ok) throw new Error('Location permissions not granted.');
  const loc = await LocationServiceModule.getCurrentLocation();
  return loc; // { latitude, longitude, accuracy, provider, time }
}

