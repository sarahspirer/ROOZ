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

// POST /api/students/import — CSV bulk import
// Body: { rows: [{name, email, grade, password?}] }
router.post('/import', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.user!;
  const { rows } = z.object({
    rows: z.array(z.object({
      name: z.string(),
      email: z.string().email(),
      grade: z.string(),
      password: z.string().optional(),
    })),
  }).parse(req.body);

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: row.email } });
      if (existing) { results.skipped++; continue; }

      await prisma.user.create({
        data: {
          email: row.email,
          name: row.name,
          role: 'STUDENT',
          schoolId,
          student: { create: { grade: row.grade } },
        },
      });
      results.created++;
    } catch (err: any) {
      results.errors.push(`${row.email}: ${err.message}`);
    }
  }

  res.json(results);
});

// POST /api/students/:id/push-token — register Expo push token
router.post('/:id/push-token', async (req: Request, res: Response): Promise<void> => {
  const { token, deviceId } = z.object({ token: z.string(), deviceId: z.string() }).parse(req.body);

  await prisma.device.updateMany({
    where: { deviceId, student: { id: req.params.id } },
    data: { expoPushToken: token },
  });

  res.json({ ok: true });
});

export default router;
