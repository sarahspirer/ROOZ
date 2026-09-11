import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { io } from '../index';
import { pushToClass } from '../services/expoPush';

const router = Router();
router.use(authenticate);

// GET /api/assignments — for student: all assignments from enrolled classes (last 30 days)
//                        for teacher/admin: assignments they created
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { userId, role, schoolId } = req.user!;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (role === 'STUDENT') {
    const student = await prisma.student.findFirst({ where: { userId } });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const enrollments = await prisma.classEnrollment.findMany({
      where: { studentId: student.id },
      select: { classId: true },
    });
    const classIds = enrollments.map((e) => e.classId);

    const assignments = await prisma.assignment.findMany({
      where: { classId: { in: classIds }, droppedAt: { gte: since } },
      include: {
        class: { select: { id: true, name: true } },
        completions: { where: { studentId: student.id }, select: { completedAt: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { droppedAt: 'desc' }],
    });

    res.json({
      assignments: assignments.map((a) => ({
        ...a,
        completed: a.completions.length > 0,
        completedAt: a.completions[0]?.completedAt ?? null,
      })),
    });
    return;
  }

  // Teacher / Admin — see what they dropped
  const assignments = await prisma.assignment.findMany({
    where: { createdBy: userId, droppedAt: { gte: since } },
    include: {
      class: { select: { id: true, name: true } },
      _count: { select: { completions: true } },
    },
    orderBy: { droppedAt: 'desc' },
  });

  res.json({ assignments });
});

// GET /api/assignments/class/:classId — teacher sees all for a class with completion counts
router.get('/class/:classId', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const totalStudents = await prisma.classEnrollment.count({ where: { classId: req.params.classId } });

  const assignments = await prisma.assignment.findMany({
    where: { classId: req.params.classId, droppedAt: { gte: since } },
    include: { _count: { select: { completions: true } } },
    orderBy: { droppedAt: 'desc' },
  });

  res.json({
    assignments: assignments.map((a) => ({
      ...a,
      completionCount: a._count.completions,
      totalStudents,
      completionRate: totalStudents > 0 ? Math.round((a._count.completions / totalStudents) * 100) : 0,
    })),
  });
});

// POST /api/assignments — teacher drops homework to a class in real-time
router.post('/', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.user!;

  const body = z.object({
    classId: z.string(),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    type: z.enum(['HOMEWORK', 'PROJECT', 'READING', 'STUDY_GUIDE', 'QUIZ', 'TEST', 'OTHER']).default('HOMEWORK'),
    dueDate: z.string().datetime().optional(),
    points: z.number().int().min(0).optional(),
  }).parse(req.body);

  const assignment = await prisma.assignment.create({
    data: {
      classId: body.classId,
      createdBy: userId,
      title: body.title,
      description: body.description,
      type: body.type,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      points: body.points,
    },
    include: { class: { select: { id: true, name: true } } },
  });

  // Real-time: push to all students in the class via socket
  io.to(`class:${body.classId}`).emit('homework:dropped', {
    assignment: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      type: assignment.type,
      dueDate: assignment.dueDate?.toISOString() ?? null,
      points: assignment.points,
      className: assignment.class.name,
      droppedAt: assignment.droppedAt.toISOString(),
    },
  });

  // Also send push notification so students see it on their lock screen
  const typeEmoji: Record<string, string> = {
    HOMEWORK: '📚', PROJECT: '🗂', READING: '📖',
    STUDY_GUIDE: '📋', QUIZ: '✏️', TEST: '📋', OTHER: '📌',
  };
  const dueSuffix = body.dueDate
    ? ` · Due ${new Date(body.dueDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
    : '';

  await pushToClass(
    body.classId,
    `${typeEmoji[body.type] ?? '📚'} ${body.type.toLowerCase()} dropped`,
    `${body.title}${dueSuffix}`,
    { type: 'homework_dropped', assignmentId: assignment.id },
  ).catch(() => { /* non-fatal */ });

  res.json({ assignment });
});

// PATCH /api/assignments/:id — teacher edits title/description/dueDate
router.patch('/:id', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.user!;
  const body = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    points: z.number().int().min(0).nullable().optional(),
  }).parse(req.body);

  const existing = await prisma.assignment.findFirst({ where: { id: req.params.id, createdBy: userId } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const updated = await prisma.assignment.update({
    where: { id: req.params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
      ...(body.points !== undefined && { points: body.points }),
    },
    include: { class: { select: { id: true, name: true } } },
  });

  io.to(`class:${updated.classId}`).emit('homework:updated', {
    assignment: {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      type: updated.type,
      dueDate: updated.dueDate?.toISOString() ?? null,
      points: updated.points,
      className: updated.class.name,
      droppedAt: updated.droppedAt.toISOString(),
    },
  });
  res.json({ assignment: updated });
});

// DELETE /api/assignments/:id
router.delete('/:id', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.user!;
  const existing = await prisma.assignment.findFirst({ where: { id: req.params.id, createdBy: userId } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  await prisma.assignmentCompletion.deleteMany({ where: { assignmentId: req.params.id } });
  await prisma.assignment.delete({ where: { id: req.params.id } });
  io.to(`class:${existing.classId}`).emit('homework:deleted', { assignmentId: req.params.id });
  res.json({ ok: true });
});

// POST /api/assignments/:id/complete — student marks done
router.post('/:id/complete', requireRole('STUDENT'), async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.user!;
  const student = await prisma.student.findFirst({ where: { userId } });
  if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

  await prisma.assignmentCompletion.upsert({
    where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: student.id } },
    create: { assignmentId: req.params.id, studentId: student.id },
    update: {},
  });
  res.json({ ok: true });
});

// DELETE /api/assignments/:id/complete — student un-marks
router.delete('/:id/complete', requireRole('STUDENT'), async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.user!;
  const student = await prisma.student.findFirst({ where: { userId } });
  if (!student) { res.status(404).json({ error: 'Student not found' }); return; }
  await prisma.assignmentCompletion.deleteMany({
    where: { assignmentId: req.params.id, studentId: student.id },
  });
  res.json({ ok: true });
});

export default router;
