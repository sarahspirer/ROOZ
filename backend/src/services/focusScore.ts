import prisma from '../db/prisma';
import { Tier, ViolationLevel } from '../types/events';
import { eventBus } from '../events/eventBus';
import { log } from '../middleware/logger';

const TIER_THRESHOLDS: Record<Tier, number> = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 1500,
  ELITE: 3000,
};

const VIOLATION_SCORE_IMPACT: Record<ViolationLevel, number> = {
  WARNING: -10,
  RESTRICTION: -20,
  ADMIN_FLAG: -25,
  ESCALATION: -50,
};

function tierForScore(score: number): Tier {
  if (score >= TIER_THRESHOLDS.ELITE) return 'ELITE';
  if (score >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (score >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
}

export async function addCompliantMinute(studentId: string): Promise<void> {
  const student = await prisma.student.update({
    where: { id: studentId },
    data: {
      focusScore: { increment: 1 },
      dailyScore: { increment: 1 },
      weeklyScore: { increment: 1 },
      lastSeen: new Date(),
    },
  });

  const newTier = tierForScore(student.focusScore);

  if (newTier !== student.tier) {
    await prisma.student.update({
      where: { id: studentId },
      data: { tier: newTier },
    });

    await prisma.complianceEvent.create({
      data: {
        studentId,
        type: 'TIER_CHANGE',
        payload: { previousTier: student.tier, newTier, focusScore: student.focusScore },
      },
    });

    eventBus.emit('activity:logged', {
      id: `tc-${Date.now()}`,
      studentId,
      studentName: '',
      type: 'TIER_CHANGE',
      description: `Reached ${newTier} tier`,
      severity: 'info',
      timestamp: new Date().toISOString(),
    });

    log('info', `Student ${studentId} advanced to ${newTier} tier`);
  }

  eventBus.emit('student:score:updated', {
    studentId,
    focusScore: student.focusScore + 1,
    dailyScore: student.dailyScore + 1,
    weeklyScore: student.weeklyScore + 1,
    tier: newTier,
    streak: student.streak,
    status: student.status as import('../types/events').ComplianceStatus,
    timestamp: new Date().toISOString(),
  });
}

export async function recordViolation(
  studentId: string,
  level: ViolationLevel,
  description: string,
  appAttempted?: string,
): Promise<number> {
  const scoreImpact = VIOLATION_SCORE_IMPACT[level];

  // Fetch current scores to enforce floor of 0
  const current = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { focusScore: true, dailyScore: true, weeklyScore: true },
  });

  const [student] = await Promise.all([
    prisma.student.update({
      where: { id: studentId },
      data: {
        focusScore: Math.max(0, current.focusScore + scoreImpact),
        dailyScore: Math.max(0, current.dailyScore + scoreImpact),
        weeklyScore: Math.max(0, current.weeklyScore + scoreImpact),
        totalViolations: { increment: 1 },
        streak: 0,
      },
    }),
    prisma.violation.create({
      data: {
        studentId,
        level,
        description,
        appAttempted,
        scoreImpact,
      },
    }),
    prisma.complianceEvent.create({
      data: {
        studentId,
        type: level === 'ESCALATION' ? 'BYPASS_ATTEMPT' : 'VIOLATION',
        payload: { level, description, appAttempted, scoreImpact },
      },
    }),
  ]);

  eventBus.emit('alert:raised', {
    id: `v-${Date.now()}`,
    studentId,
    studentName: '',
    level,
    description,
    requiresAction: level === 'ADMIN_FLAG' || level === 'ESCALATION',
    timestamp: new Date().toISOString(),
  });

  log('warn', `Violation ${level} for student ${studentId}: ${description}`);
  return scoreImpact;
}

export async function updateTier(studentId: string): Promise<Tier> {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  const newTier = tierForScore(student.focusScore);

  if (newTier !== student.tier) {
    await prisma.student.update({ where: { id: studentId }, data: { tier: newTier } });
    log('info', `Tier updated for ${studentId}: ${student.tier} → ${newTier}`);
  }

  return newTier;
}

export async function incrementStreak(studentId: string): Promise<void> {
  await prisma.student.update({
    where: { id: studentId },
    data: { streak: { increment: 1 } },
  });
}

export async function resetDailyScores(): Promise<number> {
  const result = await prisma.student.updateMany({
    data: { dailyScore: 0 },
  });
  log('info', `Daily scores reset for ${result.count} students`);
  return result.count;
}

export async function resetWeeklyScores(): Promise<number> {
  const result = await prisma.student.updateMany({
    data: { weeklyScore: 0, streak: 0 },
  });
  log('info', `Weekly scores reset for ${result.count} students`);
  return result.count;
}

export async function getSchoolComplianceSummary(schoolId: string) {
  const students = await prisma.student.findMany({
    where: { user: { schoolId } },
    select: { status: true },
  });

  const total = students.length;
  const compliantCount = students.filter((s) => s.status === 'COMPLIANT').length;
  const nonCompliantCount = students.filter((s) => s.status === 'NON_COMPLIANT').length;
  const offlineCount = students.filter((s) => s.status === 'OFFLINE').length;
  const bypassingCount = students.filter((s) => s.status === 'BYPASSING').length;
  const compliancePercent = total > 0 ? Math.round((compliantCount / total) * 100) : 100;

  return {
    schoolId,
    compliancePercent,
    totalStudents: total,
    compliantCount,
    nonCompliantCount,
    offlineCount,
    bypassingCount,
    timestamp: new Date().toISOString(),
  };
}
