import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/students — list students for a school
router.get('/', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.user!;
  const { grade, status, tier, search } = req.query;

  const students = await prisma.student.findMany({
    where: {
      user: {
        schoolId,
        ...(search ? { name: { contains: String(search), mode: 'insensitive' } } : {}),
      },
      ...(grade ? { grade: String(grade) } : {}),
      ...(status ? { status: String(status) as any } : {}),
      ...(tier ? { tier: String(tier) as any } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      devices: { select: { deviceId: true, platform: true, lastHeartbeat: true, isActive: true } },
      _count: { select: { violations: true } },
    },
    orderBy: { focusScore: 'desc' },
  });

  res.json({ students });
});

// GET /api/students/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true, schoolId: true } },
      devices: true,
      violations: { orderBy: { timestamp: 'desc' }, take: 20 },
      rewards: { include: { reward: true }, orderBy: { claimedAt: 'desc' } },
      classEnrollments: { include: { class: { select: { id: true, name: true, room: true } } } },
    },
  });

  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  res.json({ student });
});

// GET /api/students/:id/events
router.get('/:id/events', async (req: Request, res: Response): Promise<void> => {
  const { limit = '50', offset = '0' } = req.query;

  const events = await prisma.complianceEvent.findMany({
    where: { studentId: req.params.id },
    orderBy: { timestamp: 'desc' },
    take: parseInt(String(limit), 10),
    skip: parseInt(String(offset), 10),
  });

  res.json({ events });
});

// GET /api/students/:id/score
router.get('/:id/score', async (req: Request, res: Response): Promise<void> => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      focusScore: true,
      dailyScore: true,
      weeklyScore: true,
      tier: true,
      streak: true,
      totalViolations: true,
      status: true,
      lastSeen: true,
    },
  });

  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  res.json({ score: student });
});

export default router;
