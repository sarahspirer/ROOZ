import prisma from '../db/prisma';
import { env } from '../config/env';
import { eventBus } from '../events/eventBus';
import { log } from '../middleware/logger';

const OFFLINE_CHECK_INTERVAL = 30_000; // run sweep every 30s

let sweepInterval: ReturnType<typeof setInterval> | null = null;

export async function processHeartbeat(
  deviceId: string,
  studentId: string,
  meta: { platform: string; batteryLevel?: number; isJailbroken?: boolean },
): Promise<void> {
  const now = new Date();

  await Promise.all([
    prisma.device.update({
      where: { deviceId },
      data: { lastHeartbeat: now, isJailbroken: meta.isJailbroken ?? false },
    }),
    prisma.student.update({
      where: { id: studentId },
      data: { lastSeen: now, status: 'COMPLIANT' },
    }),
    prisma.complianceEvent.create({
      data: {
        studentId,
        type: 'HEARTBEAT',
        payload: meta,
      },
    }),
  ]);

  eventBus.emit('student:score:updated', {
    studentId,
    focusScore: 0, // caller should fetch fresh values
    dailyScore: 0,
    weeklyScore: 0,
    tier: 'BRONZE',
    streak: 0,
    status: 'COMPLIANT',
    timestamp: now.toISOString(),
  });
}

async function markOfflineStudents(): Promise<void> {
  const cutoff = new Date(Date.now() - env.HEARTBEAT_TIMEOUT_MS);

  const stale = await prisma.student.findMany({
    where: {
      lastSeen: { lt: cutoff },
      status: { in: ['COMPLIANT', 'NON_COMPLIANT'] },
    },
    select: { id: true, user: { select: { name: true, schoolId: true } } },
  });

  if (stale.length === 0) return;

  const ids = stale.map((s) => s.id);

  await prisma.student.updateMany({
    where: { id: { in: ids } },
    data: { status: 'OFFLINE' },
  });

  for (const student of stale) {
    eventBus.emit('student:score:updated', {
      studentId: student.id,
      focusScore: 0,
      dailyScore: 0,
      weeklyScore: 0,
      tier: 'BRONZE',
      streak: 0,
      status: 'OFFLINE',
      timestamp: new Date().toISOString(),
    });

    eventBus.emit('activity:logged', {
      id: `offline-${student.id}-${Date.now()}`,
      studentId: student.id,
      studentName: student.user.name,
      type: 'HEARTBEAT',
      description: 'Device went offline',
      severity: 'warning',
      timestamp: new Date().toISOString(),
    });

    eventBus.emit('student:offline', {
      studentId: student.id,
      studentName: student.user.name,
    });
  }

  log('warn', `Marked ${stale.length} students as OFFLINE`);

  // Trigger compliance recalculate per affected school
  const schoolIds = [...new Set(stale.map((s) => s.user.schoolId))];
  for (const schoolId of schoolIds) {
    eventBus.emit('compliance:recalculate', schoolId);
  }
}

export function startHeartbeatWatcher(): void {
  if (sweepInterval) return;
  sweepInterval = setInterval(() => {
    markOfflineStudents().catch((err) =>
      log('error', 'Heartbeat sweep error', err),
    );
  }, OFFLINE_CHECK_INTERVAL);
  log('info', 'Heartbeat watcher started');
}

export function stopHeartbeatWatcher(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
}
