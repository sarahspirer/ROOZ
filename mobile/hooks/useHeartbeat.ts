import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { sendHeartbeat, registerBackgroundHeartbeat, configureHeartbeat } from '../services/heartbeat';

const FOREGROUND_INTERVAL_MS = 30_000; // 30 seconds in foreground

interface HeartbeatOptions {
  deviceId: string;
  studentId: string;
  platform: string;
  enabled?: boolean;
}

export function useHeartbeat({ deviceId, studentId, platform, enabled = true }: HeartbeatOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    configureHeartbeat({ deviceId, studentId, platform });

    const ping = async () => {
      try {
        await sendHeartbeat();
        setLastPing(new Date());
        setError(null);
      } catch (err) {
        setError('Heartbeat failed');
      }
    };

    // Immediate first ping
    ping();

    // Foreground interval
    intervalRef.current = setInterval(ping, FOREGROUND_INTERVAL_MS);

    // Register background task
    registerBackgroundHeartbeat().catch(console.warn);

    // When app comes back to foreground, ping immediately
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ping();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [deviceId, studentId, platform, enabled]);

  return { lastPing, error };
}
