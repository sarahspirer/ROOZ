import { AppState, AppStateStatus, Alert } from 'react-native';

export type ClassModeState = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

interface ClassModeConfig {
  sessionId: string;
  classId: string;
  className: string;
  allowedApps: string[];
  endsAt?: Date;
  onViolation?: (appName: string) => void;
}

let currentConfig: ClassModeConfig | null = null;
let modeState: ClassModeState = 'INACTIVE';
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

export function activateClassMode(config: ClassModeConfig): void {
  currentConfig = config;
  modeState = 'LOCKED';

  // Listen for app state changes — when app goes background in class mode, flag as violation
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  console.log('[PHOCUS ClassMode] Activated for', config.className);
}

export function deactivateClassMode(): void {
  currentConfig = null;
  modeState = 'INACTIVE';
  appStateSubscription?.remove();
  appStateSubscription = null;
  console.log('[PHOCUS ClassMode] Deactivated');
}

export function getClassModeState(): ClassModeState {
  return modeState;
}

export function getCurrentSession(): ClassModeConfig | null {
  return currentConfig;
}

function handleAppStateChange(nextState: AppStateStatus): void {
  if (!currentConfig || modeState !== 'LOCKED') return;

  if (nextState === 'background' || nextState === 'inactive') {
    console.warn('[PHOCUS ClassMode] App went to background during class mode');
    currentConfig.onViolation?.('Background switch');
  }
}

export function isAppAllowed(bundleId: string): boolean {
  if (!currentConfig) return true;
  return currentConfig.allowedApps.includes(bundleId);
}

export function showClassModeAlert(): void {
  Alert.alert(
    '📵 Class Mode Active',
    'Your phone is in class mode. Please put it away and focus on the lesson.',
    [{ text: 'OK', style: 'default' }],
  );
}
