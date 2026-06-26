import { Router } from 'express';
import { startSimulator, stopSimulator, isSimulatorRunning, resetDemo } from '../services/simulator';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({ running: isSimulatorRunning() });
});

router.post('/start', async (_req, res) => {
  await startSimulator();
  res.json({ running: true, message: 'Demo simulator started' });
});

router.post('/stop', (_req, res) => {
  stopSimulator();
  res.json({ running: false, message: 'Demo simulator stopped' });
});

router.post('/reset', async (_req, res) => {
  await resetDemo();
  res.json({ ok: true, message: 'Demo reset — all scores cleared and simulator restarted' });
});

export default router;
