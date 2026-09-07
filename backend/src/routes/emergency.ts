import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { eventBus } from '../events/eventBus';
import { pushEmergencyUnlock, pushToAllStudents } from '../services/expoPush';
import { log } from '../middleware/logger';

const router = Router();
router.use(authenticate, requireRole('ADMIN', 'TEACHER'));

// POST /api/emergency/unlock
// Instantly unlock ALL student devices campus-wide
router.post('/unlock', async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.user!;

  // Mark all students COMPLIANT (unlocked)
  await prisma.student.updateMany({
    where: { user: { schoolId } },
    data: { status: 'COMPLIANT' },
  });

  // End all active sessions
  const activeSessions = await prisma.session.findMany({
    where: { endedAt: null, class: { schoolId } },
    select: { id: true, classId: true, class: { select: { name: true } } },
  });

  if (activeSessions.length > 0) {
    await prisma.session.updateMany({
      where: { id: { in: activeSessions.map((s) => s.id) } },
      data: { endedAt: new Date(), isLocked: false },
    });

    // Emit unlock event for each class
    for (const session of activeSessions) {
      eventBus.emit('class:status:changed', {
        classId: session.classId,
        className: session.class.name,
        isLocked: false,
        compliancePercent: 100,
        activeStudents: 0,
        violations: 0,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Send push notification to all student devices
  await pushEmergencyUnlock(schoolId);

  // Broadcast emergency event via socket
  eventBus.emit('emergency:unlock', { schoolId, timestamp: new Date().toISOString() });

  log('warn', `[Emergency] Campus-wide unlock triggered by ${req.user!.userId}`);

  res.json({ ok: true, sessionsEnded: activeSessions.length });
});

// POST /api/emergency/announce
// Send an announcement to all student lock screens
router.post('/announce', async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.user!;
  const { title, body } = req.body;

  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'title and body are required' });
    return;
  }

  await pushToAllStudents(schoolId, title.trim(), body.trim(), { type: 'ANNOUNCEMENT' });

  // Also broadcast via socket so the app can show a banner
  eventBus.emit('announcement', { schoolId, title: title.trim(), body: body.trim(), timestamp: new Date().toISOString() });

  res.json({ ok: true });
});

export default router;
