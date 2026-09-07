import { NativeModule, requireNativeModule } from 'expo-modules-core';

declare class ScreenTimeModuleType extends NativeModule {
  requestAuthorization(): Promise<boolean>;
  lockDevice(allowedBundleIds: string[]): Promise<boolean>;
  unlockDevice(): Promise<boolean>;
  isAuthorized(): Promise<boolean>;
  getAuthorizationStatus(): Promise<'notDetermined' | 'denied' | 'approved' | 'unknown'>;
}

const ScreenTimeModule = requireNativeModule<ScreenTimeModuleType>('ScreenTime');

export async function requestScreenTimeAuthorization(): Promise<boolean> {
  return ScreenTimeModule.requestAuthorization();
}

export async function lockStudentDevice(allowedBundleIds: string[] = []): Promise<boolean> {
  return ScreenTimeModule.lockDevice(allowedBundleIds);
}

export async function unlockStudentDevice(): Promise<boolean> {
  return ScreenTimeModule.unlockDevice();
}

export async function isScreenTimeAuthorized(): Promise<boolean> {
  return ScreenTimeModule.isAuthorized();
}

export async function getScreenTimeStatus(): Promise<string> {
  return ScreenTimeModule.getAuthorizationStatus();
}
