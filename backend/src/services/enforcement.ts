import prisma from '../db/prisma';
import { ViolationLevel } from '../types/events';
import { recordViolation } from './focusScore';
import { sendParentAlert } from './notifications';
import { eventBus } from '../events/eventBus';
import { log } from '../middleware/logger';

export interface ConsequenceResult {
  level: ViolationLevel;
  action: string;
  notifiedParent: boolean;
  notifiedAdmin: boolean;
}

/**
 * Consequence ladder:
 *   1 violation → WARNING notification
 *   2 violations → RESTRICTION (tighter app controls)
 *   3 violations → ADMIN_FLAG (flagged to admin dashboard)
 *   4+ violations → ESCALATION (parent notified + admin action required)
 */
export async function applyConsequence(
  studentId: string,
  description: string,
  appAttempted?: string,
): Promise<ConsequenceResult> {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: { user: { include: { school: true } }, parents: { include: { parent: { include: { user: true } } } } },
  });

  const violationCount = student.totalViolations + 1; // after this one is recorded

  let level: ViolationLevel;
  let action: string;
  let notifiedParent = false;
  let notifiedAdmin = false;

  if (violationCount === 1) {
    level = 'WARNING';
    action = 'Warning issued to student';
  } else if (violationCount === 2) {
    level = 'RESTRICTION';
    action = 'App restrictions tightened';
  } else if (violationCount === 3) {
    level = 'ADMIN_FLAG';
    action = 'Flagged to school administrator';
    notifiedAdmin = true;
  } else {
    level = 'ESCALATION';
    action = 'Parent notified, administrator action required';
    notifiedParent = true;
    notifiedAdmin = true;
  }

  // Record the violation and apply score penalty
  await recordViolation(studentId, level, description, appAttempted);

  // Emit event for admin dashboard
  if (notifiedAdmin) {
    eventBus.emit('alert:raised', {
      id: `enf-${Date.now()}`,
      studentId,
      studentName: student.user.name,
      level,
      description: `${action}: ${description}`,
      requiresAction: level === 'ADMIN_FLAG' || level === 'ESCALATION',
      timestamp: new Date().toISOString(),
    });
  }

  // Notify parent if escalated
  if (notifiedParent && student.parents.length > 0) {
    for (const ps of student.parents) {
      try {
        await sendParentAlert(
          ps.parent.user.email,
          student.user.name,
          level,
          description,
          appAttempted,
        );
      } catch (err) {
        log('error', `Failed to notify parent ${ps.parent.user.email}`, err);
      }
    }

    await prisma.complianceEvent.create({
      data: {
        studentId,
        type: 'PARENT_ALERT',
        payload: { level, description, violationCount },
      },
    });
  }

  log('info', `Consequence applied for ${studentId} (violation #${violationCount}): ${level}`);

  return { level, action, notifiedParent, notifiedAdmin };
}

export async function resolveViolation(violationId: string): Promise<void> {
  await prisma.violation.update({
    where: { id: violationId },
    data: { resolved: true, resolvedAt: new Date() },
  });
}

export async function getActiveViolations(schoolId: string) {
  return prisma.violation.findMany({
    where: {
      resolved: false,
      student: { user: { schoolId } },
    },
    include: {
      student: { include: { user: { select: { name: true } } } },
    },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });
}
