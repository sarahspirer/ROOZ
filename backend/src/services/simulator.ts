/**
 * PHOCUS Demo Simulator
 * Generates realistic student activity for demo / investor mode.
 * Fires real DB writes + event bus events so the dashboard updates live.
 */

import { prisma } from '../db/prisma';
import { eventBus } from '../events/eventBus';
import { addCompliantMinute, recordViolation, getSchoolComplianceSummary } from './focusScore';
import { log } from '../middleware/logger';
import { nanoid } from '../utils/nanoid';

const SCHOOL_ID = 'school-miami-demo';
const TICK_MS = 4_000;          // main loop cadence
const VIOLATION_CHANCE = 0.06;  // 6% chance per tick a student triggers a violation
const RECOVERY_CHANCE = 0.35;   // 35% chance a non-compliant student recovers each tick
const BYPASS_CHANCE = 0.015;    // 1.5% chance of bypass attempt

let running = false;
let tickInterval: ReturnType<typeof setInterval> | null = null;

const VIOLATION_SCENARIOS = [
  { desc: 'Attempted to open Instagram', app: 'com.instagram.app', impact: -10 },
  { desc: 'Attempted to open TikTok', app: 'com.zhiliaoapp.musically', impact: -10 },
  { desc: 'Attempted to open Snapchat', app: 'com.snapchat.android', impact: -10 },
  { desc: 'Attempted to open YouTube', app: 'com.google.android.youtube', impact: -10 },
  { desc: 'Attempted to open Discord', app: 'com.discord', impact: -10 },
  { desc: 'VPN connection detected', app: null, impact: -25 },
  { desc: 'App uninstall attempt blocked', app: null, impact: -25 },
  { desc: 'Jailbreak tool detected', app: null, impact: -50 },
];

const ACTIVITY_MESSAGES = [
  (name: string) => `${name} opened Google Classroom`,
  (name: string) => `${name} returned to compliance`,
  (name: string) => `${name} is active in class`,
  (name: string) => `${name} submitted an assignment`,
];

async function tick() {
  try {
    const students = await prisma.student.findMany({
      include: { user: { select: { name: true } } },
      where: { user: { schoolId: SCHOOL_ID } },
    });

    if (students.length === 0) return;

    const updates: Promise<void>[] = [];

    for (const student of students) {
      const r = Math.random();

      // --- Non-compliant / offline → recovery ---
      if (student.status === 'NON_COMPLIANT' || student.status === 'OFFLINE') {
        if (Math.random() < RECOVERY_CHANCE) {
          updates.push(recoverStudent(student));
        }
        continue;
      }

      // --- Compliant student: chance of violation or bypass ---
      if (r < BYPASS_CHANCE) {
        updates.push(triggerBypass(student));
      } else if (r < BYPASS_CHANCE + VIOLATION_CHANCE) {
        updates.push(triggerViolation(student));
      } else {
        // Normal compliant tick — earn a point
        updates.push(compliantTick(student));
      }
    }

    await Promise.allSettled(updates);

    // Broadcast updated compliance summary
    const summary = await getSchoolComplianceSummary(SCHOOL_ID);
    eventBus.emit('compliance:recalculate', SCHOOL_ID);

  } catch (err) {
    log('error', '[Simulator] Tick error', err);
  }
}

async function compliantTick(student: any) {
  await addCompliantMinute(student.id);

  // Occasionally emit a positive activity event (1 in 5 ticks)
  if (Math.random() < 0.2) {
    const msgFn = ACTIVITY_MESSAGES[Math.floor(Math.random() * ACTIVITY_MESSAGES.length)];
    eventBus.emit('activity:logged', {
      id: nanoid(),
      studentId: student.id,
      studentName: student.user.name,
      type: 'HEARTBEAT' as const,
      description: msgFn(student.user.name),
      severity: 'info' as const,
      timestamp: new Date().toISOString(),
    });
  }
}

async function triggerViolation(student: any) {
  const scenario = VIOLATION_SCENARIOS[Math.floor(Math.random() * (VIOLATION_SCENARIOS.length - 3))]; // exclude harsh ones

  // Update student status + score
  await prisma.student.update({
    where: { id: student.id },
    data: { status: 'NON_COMPLIANT' },
  });

  await recordViolation(student.id, 'WARNING', scenario.desc, scenario.app ?? undefined);

  // Emit events
  eventBus.emit('activity:logged', {
    id: nanoid(),
    studentId: student.id,
    studentName: student.user.name,
    type: 'VIOLATION' as const,
    description: scenario.desc,
    severity: 'warning' as const,
    timestamp: new Date().toISOString(),
  });

  eventBus.emit('student:violation', {
    studentId: student.id,
    description: scenario.desc,
    level: 'WARNING',
    app: scenario.app ?? undefined,
  });
}

async function triggerBypass(student: any) {
  const scenario = VIOLATION_SCENARIOS[Math.floor(Math.random() * 2) + 5]; // VPN or uninstall

  await prisma.student.update({
    where: { id: student.id },
    data: { status: 'BYPASSING' },
  });

  await recordViolation(student.id, 'ESCALATION', scenario.desc);

  // (violation already written by recordViolation)
  eventBus.emit('activity:logged', {
    id: nanoid(),
    studentId: student.id,
    studentName: student.user.name,
    type: 'BYPASS_ATTEMPT' as const,
    description: `⚠️ ${scenario.desc} — ${student.user.name}`,
    severity: 'critical' as const,
    timestamp: new Date().toISOString(),
  });

  eventBus.emit('alert:raised', {
    id: nanoid(),
    studentId: student.id,
    studentName: student.user.name,
    level: 'ESCALATION' as const,
    description: scenario.desc,
    requiresAction: true,
    timestamp: new Date().toISOString(),
  });

  eventBus.emit('student:violation', {
    studentId: student.id,
    description: scenario.desc,
    level: 'ESCALATION',
  });
}

async function recoverStudent(student: any) {
  await prisma.student.update({
    where: { id: student.id },
    data: {
      status: 'COMPLIANT',
      lastSeen: new Date(),
    },
  });

  eventBus.emit('activity:logged', {
    id: nanoid(),
    studentId: student.id,
    studentName: student.user.name,
    type: 'HEARTBEAT' as const,
    description: `${student.user.name} returned to compliance`,
    severity: 'info' as const,
    timestamp: new Date().toISOString(),
  });
}

// Bootstrap: set all students to COMPLIANT so the dashboard starts green
async function warmUp() {
  const count = await prisma.student.updateMany({
    where: { user: { schoolId: SCHOOL_ID } },
    data: { status: 'COMPLIANT', lastSeen: new Date() },
  });
  log('info', `[Simulator] Warmed up ${count.count} students → COMPLIANT`);

  // Emit initial compliance
  const summary = await getSchoolComplianceSummary(SCHOOL_ID);
  eventBus.emit('compliance:recalculate', SCHOOL_ID);
}

export async function startSimulator() {
  if (running) return;
  running = true;

  await warmUp();

  tickInterval = setInterval(tick, TICK_MS);
  log('info', `[Simulator] Demo mode started (tick every ${TICK_MS / 1000}s)`);
}

export function stopSimulator() {
  if (tickInterval) clearInterval(tickInterval);
  running = false;
  log('info', '[Simulator] Stopped');
}

export function isSimulatorRunning() {
  return running;
}

export async function resetDemo(): Promise<void> {
  // 1. Stop the simulator
  stopSimulator();

  // 2. Wipe all compliance events and violations
  await prisma.complianceEvent.deleteMany({ where: { student: { user: { schoolId: SCHOOL_ID } } } });
  await prisma.violation.deleteMany({ where: { student: { user: { schoolId: SCHOOL_ID } } } });

  // 3. Reset all student scores and statuses back to BRONZE / starting values
  await prisma.student.updateMany({
    where: { user: { schoolId: SCHOOL_ID } },
    data: {
      focusScore: 0,
      dailyScore: 0,
      weeklyScore: 0,
      tier: 'BRONZE',
      streak: 0,
      totalViolations: 0,
      status: 'OFFLINE',
    },
  });

  log('info', '[Simulator] Demo reset — all scores cleared');

  // 4. Restart fresh
  await startSimulator();
  log('info', '[Simulator] Demo restarted clean');
}
