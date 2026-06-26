import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';

const HEARTBEAT_TASK = 'PHOCUS_HEARTBEAT';
const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3001';

interface HeartbeatConfig {
  deviceId: string;
  studentId: string;
  platform: string;
}

let config: HeartbeatConfig | null = null;

export function configureHeartbeat(cfg: HeartbeatConfig): void {
  config = cfg;
}

async function sendHeartbeat(): Promise<void> {
  if (!config) return;
  const token = null; // retrieve from secure storage in production

  await fetch(`${API_URL}/api/compliance/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: config.deviceId,
      studentId: config.studentId,
      platform: config.platform,
    }),
  });
}

// Register background task
TaskManager.defineTask(HEARTBEAT_TASK, async () => {
  try {
    await sendHeartbeat();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundHeartbeat(): Promise<void> {
  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    console.warn('[PHOCUS] Background fetch not available');
    return;
  }

  await BackgroundFetch.registerTaskAsync(HEARTBEAT_TASK, {
    minimumInterval: 60, // every minute
    stopOnTerminate: false,
    startOnBoot: true,
  });
  console.log('[PHOCUS] Background heartbeat registered');
}

export async function unregisterBackgroundHeartbeat(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(HEARTBEAT_TASK);
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(HEARTBEAT_TASK);
  }
}

export { sendHeartbeat };
