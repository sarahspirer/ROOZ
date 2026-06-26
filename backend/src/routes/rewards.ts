import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { eventBus } from '../events/eventBus';

const router = Router();
router.use(authenticate);

const createRewardSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  requiredTier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'ELITE']).default('BRONZE'),
  requiredScore: z.number().int().min(0).default(0),
});

// GET /api/rewards
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const rewards = await prisma.reward.findMany({
    where: { schoolId: req.user!.schoolId, isActive: true },
    include: { _count: { select: { claims: true } } },
    orderBy: [{ requiredTier: 'asc' }, { requiredScore: 'asc' }],
  });
  res.json({ rewards });
});

// POST /api/rewards
router.post('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createRewardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const reward = await prisma.reward.create({
    data: { ...parsed.data, schoolId: req.user!.schoolId },
  });
  res.status(201).json({ reward });
});

// POST /api/rewards/:id/claim — student submits a claim (PENDING)
router.post('/:id/claim', async (req: Request, res: Response): Promise<void> => {
  const { studentId } = req.body;
  if (!studentId) { res.status(400).json({ error: 'studentId required' }); return; }

  const reward = await prisma.reward.findUnique({ where: { id: req.params.id } });
  if (!reward || !reward.isActive) { res.status(404).json({ error: 'Reward not found' }); return; }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { name: true } } },
  });
  if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

  const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'ELITE'];
  if (tierOrder.indexOf(student.tier) < tierOrder.indexOf(reward.requiredTier) ||
      student.focusScore < reward.requiredScore) {
    res.status(403).json({ error: 'Student does not meet reward requirements' });
    return;
  }

  // Check for existing pending/approved claim
  const existing = await prisma.studentReward.findFirst({
    where: { studentId, rewardId: req.params.id, status: { in: ['PENDING', 'APPROVED'] } },
  });
  if (existing) { res.status(409).json({ error: 'Already claimed or pending' }); return; }

  const claim = await prisma.studentReward.create({
    data: { studentId, rewardId: req.params.id, status: 'PENDING' },
    include: { reward: true },
  });

  eventBus.emit('activity:logged', {
    id: `reward-${claim.id}`,
    studentId,
    studentName: student.user.name,
    type: 'REWARD_EARNED' as const,
    description: `Claimed reward: ${reward.name}`,
    severity: 'info' as const,
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({ claim });
});

// GET /api/rewards/claims — admin/teacher sees all pending claims
router.get('/claims', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { status = 'PENDING' } = req.query;
  const claims = await prisma.studentReward.findMany({
    where: {
      status: status as any,
      student: { user: { schoolId: req.user!.schoolId } },
    },
    include: {
      reward: true,
      student: { include: { user: { select: { name: true } } } },
    },
    orderBy: { claimedAt: 'desc' },
  });
  res.json({ claims });
});

// POST /api/rewards/claims/:claimId/approve
router.post('/claims/:claimId/approve', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { note } = req.body;
  const claim = await prisma.studentReward.update({
    where: { id: req.params.claimId },
    data: { status: 'APPROVED', reviewedBy: req.user!.userId, reviewedAt: new Date(), note },
    include: { reward: true, student: { include: { user: { select: { name: true } } } } },
  });
  res.json({ claim });
});

// POST /api/rewards/claims/:claimId/deny
router.post('/claims/:claimId/deny', requireRole('ADMIN', 'TEACHER'), async (req: Request, res: Response): Promise<void> => {
  const { note } = req.body;
  const claim = await prisma.studentReward.update({
    where: { id: req.params.claimId },
    data: { status: 'DENIED', reviewedBy: req.user!.userId, reviewedAt: new Date(), note },
    include: { reward: true, student: { include: { user: { select: { name: true } } } } },
  });
  res.json({ claim });
});

// GET /api/rewards/student/:studentId
router.get('/student/:studentId', async (req: Request, res: Response): Promise<void> => {
  const claims = await prisma.studentReward.findMany({
    where: { studentId: req.params.studentId },
    include: { reward: true },
    orderBy: { claimedAt: 'desc' },
  });
  res.json({ claims });
});

export default router;
