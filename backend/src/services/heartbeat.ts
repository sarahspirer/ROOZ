import prisma from '../db/prisma';
import { env } from '../config/env';
import { eventBus } from '../events/eventBus';
import { log } from '../middleware/logger';

const OFFLINE_CHECK_INTERVAL = 30_000; // run sweep every 30s
const EARTH_RADIUS_M = 6_371_000;

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function processHeartbeat(
  deviceId: string,
  studentId: string,
  meta: { platform: string; batteryLevel?: number; isJailbroken?: boolean; lat?: number; lng?: number },
): Promise<void> {
  const now = new Date();

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { status: true, user: { select: { name: true, schoolId: true } } },
  });
  if (!student) return;

  let isInsideGeofence = true;
  let distance: number | null = null;

  if (meta.lat != null && meta.lng != null) {
    const school = await prisma.school.findUnique({
      where: { id: student.user.schoolId },
      select: { lat: true, lng: true, geofenceRadius: true },
    });
    if (school?.lat != null && school?.lng != null) {
      distance = distanceMeters(meta.lat, meta.lng, school.lat, school.lng);
      isInsideGeofence = distance <= school.geofenceRadius;
    }
  }

  const newStatus = isInsideGeofence ? 'COMPLIANT' : 'NON_COMPLIANT';
  const wasInsideGeofence = student.status !== 'NON_COMPLIANT' || student.status === 'OFFLINE';

  await Promise.all([
    prisma.device.update({
      where: { deviceId },
      data: {
        lastHeartbeat: now,
        isJailbroken: meta.isJailbroken ?? false,
        ...(meta.lat != null && meta.lng != null ? { lastLat: meta.lat, lastLng: meta.lng } : {}),
      },
    }),
    prisma.student.update({
      where: { id: studentId },
      data: { lastSeen: now, status: newStatus },
    }),
    prisma.complianceEvent.create({
      data: {
        studentId,
        type: 'HEARTBEAT',
        payload: { ...meta, distanceFromSchool: distance },
      },
    }),
  ]);

  // Only fire a violation + alert on the transition into off-campus, not every heartbeat
  if (!isInsideGeofence && wasInsideGeofence) {
    await prisma.violation.create({
      data: {
        studentId,
        level: 'ESCALATION',
        description: 'Left school geofence',
        scoreImpact: -25,
        timestamp: now,
      },
    });

    eventBus.emit('student:violation', {
      studentId,
      description: 'Left school geofence',
      level: 'ESCALATION',
    });

    eventBus.emit('activity:logged', {
      id: `geofence-${studentId}-${Date.now()}`,
      studentId,
      studentName: student.user.name,
      type: 'VIOLATION',
      description: 'Left school geofence',
      severity: 'critical',
      timestamp: now.toISOString(),
    });
  }

  eventBus.emit('student:score:updated', {
    studentId,
    focusScore: 0, // caller should fetch fresh values
    dailyScore: 0,
    weeklyScore: 0,
    tier: 'BRONZE',
    streak: 0,
    status: newStatus,
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
