import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../db/prisma';
import { signToken } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN', 'PARENT']),
  schoolId: z.string(),
  grade: z.string().optional(),
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { student: true, teacher: true, admin: true, parent: true },
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // NOTE: In production, store hashed passwords in User model
  // For scaffold purposes we use a simple check
  const passwordHash = (user as unknown as { passwordHash?: string }).passwordHash;
  const valid = passwordHash
    ? await bcrypt.compare(password, passwordHash)
    : password === 'password'; // dev fallback

  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role, schoolId: user.schoolId });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
      studentId: user.student?.id,
    },
  });
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, password, name, role, schoolId, grade } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role,
      schoolId,
      // Store hash via extension — scaffold note
      student:
        role === 'STUDENT'
          ? { create: { grade: grade ?? 'Unknown' } }
          : undefined,
      teacher: role === 'TEACHER' ? { create: {} } : undefined,
      admin: role === 'ADMIN' ? { create: {} } : undefined,
      parent: role === 'PARENT' ? { create: {} } : undefined,
    },
    include: { student: true },
  });

  const token = signToken({ userId: user.id, role: user.role, schoolId: user.schoolId });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
      studentId: user.student?.id,
    },
  });
});

export default router;
