import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { applyConsequence, resolveViolation, getActiveViolations } from '../services/enforcement';

const router = Router();
router.use(authenticate);

const createViolationSchema = z.object({
  studentId: z.string(),
  description: z.string().min(1),
  appAttempted: z.string().optional(),
});

// POST /api/violations — record a new violation
router.post('/', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createViolationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await applyConsequence(
    parsed.data.studentId,
    parsed.data.description,
    parsed.data.appAttempted,
  );

  res.status(201).json({ consequence: result });
});

// GET /api/violations — active violations for school
router.get('/', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const violations = await getActiveViolations(req.user!.schoolId);
  res.json({ violations });
});

// GET /api/violations/student/:studentId
router.get('/student/:studentId', async (req: Request, res: Response): Promise<void> => {
  const { resolved, limit = '50' } = req.query;

  const violations = await prisma.violation.findMany({
    where: {
      studentId: req.params.studentId,
      ...(resolved !== undefined ? { resolved: resolved === 'true' } : {}),
    },
    orderBy: { timestamp: 'desc' },
    take: parseInt(String(limit), 10),
  });

  res.json({ violations });
});

// PATCH /api/violations/:id/resolve
router.patch('/:id/resolve', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  await resolveViolation(req.params.id);
  res.json({ ok: true });
});

// POST /api/violations/resolve-student/:studentId — resolve all active violations for a student
router.post('/resolve-student/:studentId', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { count } = await prisma.violation.updateMany({
    where: { studentId: req.params.studentId, resolved: false },
    data: { resolved: true, resolvedAt: new Date() },
  });
  await prisma.student.update({
    where: { id: req.params.studentId },
    data: { status: 'COMPLIANT' },
  });
  res.json({ resolved: count });
});

export default router;
