import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { pushToClass, pushToSchool } from '../services/expoPush';

const router = Router();
router.use(authenticate);

// GET /api/notifications — list upcoming + recent for this school
router.get('/', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.user!;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

  const notifications = await prisma.scheduledNotification.findMany({
    where: { schoolId, scheduledAt: { gte: since } },
    orderBy: { scheduledAt: 'asc' },
  });

  res.json({ notifications });
});

// POST /api/notifications — schedule a notification
router.post('/', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { schoolId, userId } = req.user!;

  const body = z.object({
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(500),
    type: z.enum(['HOMEWORK', 'ASSIGNMENT', 'TEST', 'REMINDER', 'ANNOUNCEMENT']),
    scheduledAt: z.string().datetime(),
    classId: z.string().optional(),
  }).parse(req.body);

  const notification = await prisma.scheduledNotification.create({
    data: {
      schoolId,
      classId: body.classId,
      title: body.title,
      body: body.body,
      type: body.type,
      scheduledAt: new Date(body.scheduledAt),
      createdBy: userId,
    },
  });

  res.json({ notification });
});

// POST /api/notifications/:id/send — send immediately
router.post('/:id/send', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.user!;

  const notification = await prisma.scheduledNotification.findFirst({
    where: { id: req.params.id, schoolId },
  });

  if (!notification) { res.status(404).json({ error: 'Not found' }); return; }

  if (notification.classId) {
    await pushToClass(notification.classId, notification.title, notification.body, { type: notification.type });
  } else {
    await pushToSchool(schoolId, notification.title, notification.body, { type: notification.type });
  }

  await prisma.scheduledNotification.update({
    where: { id: notification.id },
    data: { sentAt: new Date() },
  });

  res.json({ ok: true });
});

// DELETE /api/notifications/:id — cancel
router.delete('/:id', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.user!;
  await prisma.scheduledNotification.deleteMany({
    where: { id: req.params.id, schoolId, sentAt: null },
  });
  res.json({ ok: true });
});

export default router;
