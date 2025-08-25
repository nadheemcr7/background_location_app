import React, { useState } from 'react';
import { NativeModules, PermissionsAndroid, Platform, Pressable, Text, View } from 'react-native';

const { OneShotLocation } = NativeModules;

export default function TestLocationButton() {
  const [last, setLast] = useState(null);
  const [error, setError] = useState('');

  const requestPerms = async () => {
    if (Platform.OS !== 'android') return true;
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    const res = await PermissionsAndroid.requestMultiple([fine, coarse]);
    return (
      res[fine] === PermissionsAndroid.RESULTS.GRANTED ||
      res[coarse] === PermissionsAndroid.RESULTS.GRANTED
    );
  };

  const onPress = async () => {
    setError('');
    const ok = await requestPerms();
    if (!ok) {
      setError('Location permission denied');
      return;
    }
    try {
      const loc = await OneShotLocation.getCurrentLocation(10000); // 10s timeout
      console.log('Location:', loc); // Debug log
      setLast(loc);
    } catch (e) {
      const errorMsg = e?.message || String(e);
      console.log('Error:', errorMsg); // Debug log
      setError(errorMsg);
    }
  };

  return (
    <View style={{ gap: 12, padding: 16 }}>
      <Pressable
        onPress={onPress}
        style={{ backgroundColor: '#222', padding: 12, borderRadius: 10 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>Get One-shot Location</Text>
      </Pressable>
      {last && (
        <Text>
          Last: {last.latitude.toFixed(5)}, {last.longitude.toFixed(5)} • acc ±
          {typeof last.accuracy === 'number' ? last.accuracy.toFixed(0) : '?'} m
        </Text>
      )}
      {!!error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}