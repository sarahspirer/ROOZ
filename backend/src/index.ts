import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ServerToClientEvents, ClientToServerEvents } from './types/events';

import { env } from './config/env';
import { requestLogger } from './middleware/logger';
import { registerSocketHandlers } from './sockets/handlers';
import { startHeartbeatWatcher } from './services/heartbeat';
import { startSimulator } from './services/simulator';

import authRouter from './routes/auth';
import studentsRouter from './routes/students';
import classesRouter from './routes/classes';
import complianceRouter from './routes/compliance';
import violationsRouter from './routes/violations';
import rewardsRouter from './routes/rewards';
import reportsRouter from './routes/reports';
import simulatorRouter from './routes/simulator';
import pushRouter from './routes/push';
import parentsRouter from './routes/parents';
import onboardingRouter from './routes/onboarding';
import { sendPushToAll } from './services/pushNotifications';
import { eventBus } from './events/eventBus';

const app = express();
const httpServer = createServer(app);

// ── Redis clients (pub/sub adapter for multi-instance Socket.io) ──────────────
const pubClient = new Redis(env.REDIS_URL);
const subClient = pubClient.duplicate();

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

io.adapter(createAdapter(pubClient, subClient));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/students', studentsRouter);
app.use('/api/classes', classesRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/violations', violationsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/simulator', simulatorRouter);
app.use('/api/push', pushRouter);
app.use('/api/parents', parentsRouter);
app.use('/api/onboarding', onboardingRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Push notification triggers ────────────────────────────────────────────────
eventBus.on('alert:raised', (alert: any) => {
  if (alert.level === 'ESCALATION') {
    sendPushToAll({
      title: '🚨 ROOZ Alert — Bypass Detected',
      body: `${alert.studentName}: ${alert.description}`,
    });
  }
});

eventBus.on('student:offline', (data: any) => {
  sendPushToAll({
    title: '📴 ROOZ — Student Offline',
    body: `${data.studentName} went offline`,
  });
});

// ── Socket handlers ───────────────────────────────────────────────────────────
registerSocketHandlers(io);

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`\n🔦 PHOCUS backend running on http://localhost:${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   CORS origin: ${env.CORS_ORIGIN}\n`);

  startHeartbeatWatcher();

  // Auto-start demo simulator in development
  if (env.NODE_ENV === 'development') {
    startSimulator().catch((err) => console.error('Simulator error:', err));
  }
});

export { io };
