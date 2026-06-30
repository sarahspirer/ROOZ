import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { processHeartbeat } from '../services/heartbeat';
import { getSchoolComplianceSummary } from '../services/focusScore';

const router = Router();

// POST /api/heartbeat — device heartbeat (unauthenticated by device token)
router.post('/heartbeat', async (req: Request, res: Response): Promise<void> => {
  const { deviceId, studentId, platform, batteryLevel, isJailbroken, lat, lng } = req.body;

  if (!deviceId || !studentId) {
    res.status(400).json({ error: 'deviceId and studentId are required' });
    return;
  }

  try {
    await processHeartbeat(deviceId, studentId, { platform, batteryLevel, isJailbroken, lat, lng });
    res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record heartbeat' });
  }
});

// GET /api/compliance/school — school-level compliance (admin)
router.get(
  '/school',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  async (req: Request, res: Response): Promise<void> => {
    const { schoolId } = req.user!;
    const summary = await getSchoolComplianceSummary(schoolId);
    res.json(summary);
  },
);

// GET /api/compliance/class/:classId — class-level compliance
router.get(
  '/class/:classId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const students = await prisma.student.findMany({
      where: {
        classEnrollments: { some: { classId: req.params.classId } },
      },
      select: { id: true, status: true, focusScore: true, dailyScore: true, tier: true },
    });

    const total = students.length;
    const compliantCount = students.filter((s) => s.status === 'COMPLIANT').length;
    const percent = total > 0 ? Math.round((compliantCount / total) * 100) : 100;

    res.json({
      classId: req.params.classId,
      compliancePercent: percent,
      totalStudents: total,
      compliantCount,
      students,
    });
  },
);

export default router;
