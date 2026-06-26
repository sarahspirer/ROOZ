import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { saveSubscription, removeSubscription, VAPID_PUBLIC_KEY } from '../services/pushNotifications';

const router = Router();
router.use(authenticate);

router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post('/subscribe', (req: Request, res: Response) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) {
    res.status(400).json({ error: 'Invalid subscription' });
    return;
  }
  saveSubscription((req as any).userId, subscription);
  res.json({ ok: true });
});

router.post('/unsubscribe', (req: Request, res: Response) => {
  removeSubscription((req as any).userId);
  res.json({ ok: true });
});

export default router;
