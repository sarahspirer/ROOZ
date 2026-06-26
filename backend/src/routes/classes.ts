import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { eventBus } from '../events/eventBus';

const router = Router();
router.use(authenticate);

// GET /api/classes?includeStudents=true
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { schoolId, role, userId } = req.user!;
  const includeStudents = req.query.includeStudents === 'true';

  // Teachers only see their own classes
  let teacherIdFilter: string | undefined;
  if (role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    teacherIdFilter = teacher?.id;
  }

  const classes = await prisma.class.findMany({
    where: { schoolId, ...(teacherIdFilter ? { teacherId: teacherIdFilter } : {}) },
    include: {
      teacher: { include: { user: { select: { name: true, email: true } } } },
      _count: { select: { enrollments: true, sessions: true } },
      sessions: {
        where: { endedAt: null },
        take: 1,
        orderBy: { startedAt: 'desc' },
      },
      ...(includeStudents ? {
        enrollments: {
          include: {
            student: {
              select: {
                id: true,
                focusScore: true,
                totalViolations: true,
                status: true,
                user: { select: { name: true } },
              },
            },
          },
        },
      } : {}),
    },
  });

  res.json({ classes });
});

// GET /api/classes/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const cls = await prisma.class.findUnique({
    where: { id: req.params.id },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      enrollments: {
        include: {
          student: {
            include: { user: { select: { name: true } } },
            select: {
              id: true,
              focusScore: true,
              dailyScore: true,
              tier: true,
              status: true,
              streak: true,
              user: true,
            },
          },
        },
      },
      sessions: { orderBy: { startedAt: 'desc' }, take: 10 },
    },
  });

  if (!cls) {
    res.status(404).json({ error: 'Class not found' });
    return;
  }

  res.json({ class: cls });
});

// POST /api/classes/:id/sessions/start
router.post(
  '/:id/sessions/start',
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const { allowedApps = [] } = req.body;

    const session = await prisma.session.create({
      data: {
        classId: req.params.id,
        isLocked: true,
        lockedBy: req.user!.userId,
        allowedApps,
      },
    });

    const cls = await prisma.class.findUnique({
      where: { id: req.params.id },
      select: { name: true },
    });

    eventBus.emit('class:status:changed', {
      classId: req.params.id,
      className: cls?.name ?? '',
      compliancePercent: 100,
      activeStudents: 0,
      violations: 0,
      isLocked: true,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ session });
  },
);

// POST /api/classes/:id/sessions/:sessionId/end
router.post(
  '/:id/sessions/:sessionId/end',
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const session = await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { endedAt: new Date(), isLocked: false },
    });

    res.json({ session });
  },
);

// POST /api/classes/:id/enroll
router.post(
  '/:id/enroll',
  requireRole('ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const { studentIds } = z.object({ studentIds: z.array(z.string()) }).parse(req.body);

    await prisma.classEnrollment.createMany({
      data: studentIds.map((studentId) => ({ classId: req.params.id, studentId })),
      skipDuplicates: true,
    });

    res.json({ enrolled: studentIds.length });
  },
);

export default router;
