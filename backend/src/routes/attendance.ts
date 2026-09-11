import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { io } from '../index';

const router = Router();

// GET /api/attendance/class/:classId?date=YYYY-MM-DD
router.get('/class/:classId', async (req: Request, res: Response) => {
  const { classId } = req.params;
  const dateStr = req.query.date as string | undefined;

  const date = dateStr ? new Date(dateStr) : new Date();
  // Normalize to noon UTC so day boundaries don't shift
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  const dayEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));

  const [enrollments, records] = await Promise.all([
    prisma.classEnrollment.findMany({
      where: { classId },
      include: { student: { include: { user: { select: { name: true, email: true } } } } },
    }),
    prisma.attendance.findMany({
      where: { classId, date: { gte: dayStart, lte: dayEnd } },
    }),
  ]);

  const recordMap = new Map(records.map((r) => [r.studentId, r]));

  const result = enrollments.map((e) => {
    const record = recordMap.get(e.studentId);
    return {
      studentId: e.studentId,
      name: e.student.user.name,
      email: e.student.user.email,
      status: record?.status ?? null,
      note: record?.note ?? null,
      attendanceId: record?.id ?? null,
      markedAt: record?.markedAt ?? null,
    };
  });

  res.json({ date: dayStart.toISOString().slice(0, 10), students: result });
});

// POST /api/attendance — upsert one student's attendance for the day
// body: { classId, studentId, status, note?, date?, markedBy }
router.post('/', async (req: Request, res: Response) => {
  const { classId, studentId, status, note, date: dateStr, markedBy } = req.body;

  if (!classId || !studentId || !status || !markedBy) {
    return res.status(400).json({ error: 'classId, studentId, status, markedBy required' });
  }

  const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${validStatuses.join(', ')}` });
  }

  const date = dateStr ? new Date(dateStr) : new Date();
  const dayNoon = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));

  const record = await prisma.attendance.upsert({
    where: { classId_studentId_date: { classId, studentId, date: dayNoon } },
    create: { classId, studentId, status, note, date: dayNoon, markedBy },
    update: { status, note, markedAt: new Date(), markedBy },
    include: { student: { include: { user: { select: { name: true } } } } },
  });

  const event = {
    classId,
    studentId,
    studentName: record.student.user.name,
    status: record.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
    markedAt: record.markedAt.toISOString(),
  };
  io.to(`class:${classId}`).emit('attendance:updated', event);

  res.json(record);
});

// PATCH /api/attendance/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, note, markedBy } = req.body;

  const record = await prisma.attendance.update({
    where: { id },
    data: { ...(status && { status }), ...(note !== undefined && { note }), markedAt: new Date(), markedBy },
    include: { student: { include: { user: { select: { name: true } } } } },
  });

  io.to(`class:${record.classId}`).emit('attendance:updated', {
    classId: record.classId,
    studentId: record.studentId,
    studentName: record.student.user.name,
    status: record.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
    markedAt: record.markedAt.toISOString(),
  });

  res.json(record);
});

export default router;
