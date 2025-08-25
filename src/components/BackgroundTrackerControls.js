import React, {useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {startBackgroundTracking, stopBackgroundTracking} from '../background/BackgroundTracker';
import config from '../config/locationConfig';

export default function BackgroundTrackerControls() {
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');

  const start = async () => {
    setMsg('');
    try {
      await startBackgroundTracking(); // uses config.minTimeMs & config.minDistanceM
      setRunning(true);
      setMsg(`Started (every ${config.minTimeMs/60000} min, ≥${config.minDistanceM} m)`);
    } catch (e) {
      setMsg(String(e?.message || e));
    }
  };

  const stop = async () => {
    await stopBackgroundTracking();
    setRunning(false);
    setMsg('Stopped');
  };

  return (
    <View style={{gap: 12, padding: 16}}>
      <Pressable
        onPress={start}
        style={{backgroundColor: running ? '#555' : '#0a7', padding: 12, borderRadius: 10}}>
        <Text style={{color: 'white', textAlign: 'center'}}>
          {running ? 'Running…' : 'Start Background Tracking'}
        </Text>
      </Pressable>

      <Pressable
        onPress={stop}
        style={{backgroundColor: '#a00', padding: 12, borderRadius: 10}}>
        <Text style={{color: 'white', textAlign: 'center'}}>Stop Background Tracking</Text>
      </Pressable>

      {!!msg && <Text>{msg}</Text>}
    </View>
  );
}
