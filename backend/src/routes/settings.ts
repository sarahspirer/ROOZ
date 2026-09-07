import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/settings — get school config
router.get('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.user!;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      address: true,
      lat: true,
      lng: true,
      geofenceRadius: true,
      timezone: true,
      schoolHoursStart: true,
      schoolHoursEnd: true,
      graceMinutes: true,
      allowedApps: true,
      policyEmailsEnabled: true,
    },
  });
  res.json({ school });
});

// PUT /api/settings — update school config
router.put('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.user!;
  const body = z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    geofenceRadius: z.number().int().min(50).max(5000).optional(),
    schoolHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    schoolHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    graceMinutes: z.number().int().min(1).max(30).optional(),
    allowedApps: z.array(z.string()).optional(),
    policyEmailsEnabled: z.boolean().optional(),
  }).parse(req.body);

  const school = await prisma.school.update({
    where: { id: schoolId },
    data: body,
  });

  res.json({ school });
});

export default router;
