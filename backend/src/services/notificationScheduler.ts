import prisma from '../db/prisma';
import { pushToClass, pushToSchool } from './expoPush';

export function startNotificationScheduler() {
  // Check every 60 seconds for due notifications
  setInterval(async () => {
    try {
      const due = await prisma.scheduledNotification.findMany({
        where: {
          sentAt: null,
          scheduledAt: { lte: new Date() },
        },
      });

      for (const n of due) {
        try {
          if (n.classId) {
            await pushToClass(n.classId, n.title, n.body, { type: n.type });
          } else {
            await pushToSchool(n.schoolId, n.title, n.body, { type: n.type });
          }
          await prisma.scheduledNotification.update({
            where: { id: n.id },
            data: { sentAt: new Date() },
          });
          console.log(`[Scheduler] Sent notification "${n.title}" to ${n.classId ?? n.schoolId}`);
        } catch (err) {
          console.error(`[Scheduler] Failed to send notification ${n.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error checking notifications:', err);
    }
  }, 60_000);

  console.log('[Scheduler] Notification scheduler started');
}
