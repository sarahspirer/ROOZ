import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireRole('ADMIN'));

const StudentImportSchema = z.array(z.object({
  name: z.string().min(1),
  email: z.string().email(),
  grade: z.string().default('9'),
}));

const TeacherImportSchema = z.array(z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().optional(),
}));

// POST /api/onboarding/preview-csv
// Parses and validates a CSV payload without writing to DB
router.post('/preview-csv', async (req: Request, res: Response): Promise<void> => {
  const { rows, type } = req.body;
  const schema = type === 'teachers' ? TeacherImportSchema : StudentImportSchema;
  const parsed = schema.safeParse(rows);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    return;
  }
  res.json({ valid: true, count: parsed.data.length, rows: parsed.data });
});

// POST /api/onboarding/import-students
router.post('/import-students', async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.user!.schoolId;
  const parsed = StudentImportSchema.safeParse(req.body.students);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid student data' });
    return;
  }

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const s of parsed.data) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: s.email } });
      if (existing) { results.skipped++; continue; }

      const user = await prisma.user.create({
        data: { email: s.email, name: s.name, role: 'STUDENT', schoolId },
      });
      await prisma.student.create({
        data: { userId: user.id, grade: s.grade },
      });
      results.created++;
    } catch (e: any) {
      results.errors.push(`${s.email}: ${e.message}`);
    }
  }

  res.json(results);
});

// POST /api/onboarding/import-teachers
router.post('/import-teachers', async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.user!.schoolId;
  const parsed = TeacherImportSchema.safeParse(req.body.teachers);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid teacher data' });
    return;
  }

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const t of parsed.data) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: t.email } });
      if (existing) { results.skipped++; continue; }

      const user = await prisma.user.create({
        data: { email: t.email, name: t.name, role: 'TEACHER', schoolId },
      });
      await prisma.teacher.create({
        data: { userId: user.id },
      });
      results.created++;
    } catch (e: any) {
      results.errors.push(`${t.email}: ${e.message}`);
    }
  }

  res.json(results);
});

export default router;
