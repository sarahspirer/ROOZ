import prisma from '../db/prisma';
import { log } from '../middleware/logger';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

async function sendBatch(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) log('warn', `[ExpoPush] HTTP ${res.status}`);
  } catch (err: any) {
    log('error', '[ExpoPush] batch failed', err.message);
  }
}

export async function pushToAllStudents(
  schoolId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const devices = await prisma.device.findMany({
    where: {
      expoPushToken: { not: null },
      isActive: true,
      student: { user: { schoolId } },
    },
    select: { expoPushToken: true },
  });

  const messages: PushMessage[] = devices
    .filter((d) => d.expoPushToken)
    .map((d) => ({
      to: d.expoPushToken!,
      title,
      body,
      sound: 'default',
      priority: 'high',
      data,
    }));

  await sendBatch(messages);
  log('info', `[ExpoPush] Sent to ${messages.length} devices`);
}

export async function pushToStudent(
  studentId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const devices = await prisma.device.findMany({
    where: { studentId, expoPushToken: { not: null }, isActive: true },
    select: { expoPushToken: true },
  });

  const messages: PushMessage[] = devices
    .filter((d) => d.expoPushToken)
    .map((d) => ({ to: d.expoPushToken!, title, body, sound: 'default', priority: 'high', data }));

  await sendBatch(messages);
}

export async function pushEmergencyUnlock(schoolId: string): Promise<void> {
  await pushToAllStudents(
    schoolId,
    '🔓 Emergency — Phones Unlocked',
    'Your school has activated Emergency Mode. Phones are now unlocked.',
    { type: 'EMERGENCY_UNLOCK' },
  );
}

export async function pushToSchool(schoolId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  return pushToAllStudents(schoolId, title, body, data);
}

export async function pushToClass(classId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId },
    select: { studentId: true },
  });

  const devices = await prisma.device.findMany({
    where: {
      expoPushToken: { not: null },
      isActive: true,
      studentId: { in: enrollments.map(e => e.studentId) },
    },
    select: { expoPushToken: true },
  });

  const messages: PushMessage[] = devices
    .filter(d => d.expoPushToken)
    .map(d => ({ to: d.expoPushToken!, title, body, sound: 'default', priority: 'high', data }));

  await sendBatch(messages);
  log('info', `[ExpoPush] Sent to class ${classId}: ${messages.length} devices`);
}
