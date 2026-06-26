import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();
router.use(authenticate);
router.use(requireRole('PARENT', 'ADMIN'));

// GET /api/parents/me/children — returns all children with scores + recent violations
router.get('/me/children', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: {
      children: {
        include: {
          student: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              violations: {
                orderBy: { timestamp: 'desc' },
                take: 10,
              },
              classEnrollments: {
                include: { class: { select: { id: true, name: true, room: true } } },
              },
              rewards: {
                include: { reward: true },
                orderBy: { claimedAt: 'desc' },
                take: 5,
              },
            },
          },
        },
      },
    },
  });

  if (!parent) {
    res.status(404).json({ error: 'Parent record not found' });
    return;
  }

  const children = parent.children.map(({ student }) => ({
    id: student.id,
    name: student.user.name,
    email: student.user.email,
    grade: student.grade,
    focusScore: student.focusScore,
    dailyScore: student.dailyScore,
    weeklyScore: student.weeklyScore,
    tier: student.tier,
    streak: student.streak,
    status: student.status,
    totalViolations: student.totalViolations,
    recentViolations: student.violations,
    classes: student.classEnrollments.map((e) => e.class),
    recentRewards: student.rewards,
  }));

  res.json({ children });
});

export default router;
