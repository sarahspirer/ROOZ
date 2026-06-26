import webpush from 'web-push';
import { log } from '../middleware/logger';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

webpush.setVapidDetails(
  'mailto:admin@rooz.school',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

export { VAPID_PUBLIC_KEY };

// In-memory store: userId → push subscription
const subscriptions = new Map<string, webpush.PushSubscription>();

export function saveSubscription(userId: string, sub: webpush.PushSubscription) {
  subscriptions.set(userId, sub);
  log('info', `[Push] Subscription saved for user ${userId}`);
}

export function removeSubscription(userId: string) {
  subscriptions.delete(userId);
}

export async function sendPushToAll(payload: { title: string; body: string; icon?: string }) {
  if (subscriptions.size === 0) return;
  const message = JSON.stringify(payload);
  const sends = [...subscriptions.entries()].map(async ([userId, sub]) => {
    try {
      await webpush.sendNotification(sub, message);
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired or invalid — remove it
        subscriptions.delete(userId);
      } else {
        log('warn', `[Push] Failed to send to ${userId}: ${err.message}`);
      }
    }
  });
  await Promise.allSettled(sends);
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string }) {
  const sub = subscriptions.get(userId);
  if (!sub) return;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      subscriptions.delete(userId);
    }
  }
}
