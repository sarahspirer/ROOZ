# PHOCUS — School Phone Management System

Real-time compliance tracking, behavior economics (rewards + consequences), and a live admin dashboard for managing student phone use in schools.

---

## Architecture

| Layer | Stack |
|---|---|
| Backend API | Node.js + Express + TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Real-time | Socket.io + Redis pub/sub |
| Admin Dashboard | React + TypeScript + Vite + Tailwind + Recharts |
| Student App | React Native + Expo |

---

## Quick Start

### 1. Start infrastructure

```bash
docker compose up postgres redis -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set JWT_SECRET to a long random string

npm install
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Run migrations
npm run dev             # Start dev server on :3001
```

### 3. Dashboard

```bash
cd dashboard
npm install
npm run dev             # Start Vite on :5173
```

### 4. Mobile (Expo)

```bash
cd mobile
npm install
npx expo start
```

---

## Key concepts

### Focus Score
- +1 point per compliant minute (device heartbeat received, no violations)
- -10 for WARNING, -20 for RESTRICTION, -25 for ADMIN_FLAG, -50 for ESCALATION
- Tier thresholds: Bronze=0, Silver=500, Gold=1500, Elite=3000

### Consequence Ladder
| Violation count | Level | Action |
|---|---|---|
| 1 | WARNING | Notification to student |
| 2 | RESTRICTION | Tighter app restrictions |
| 3 | ADMIN_FLAG | Flagged on admin dashboard |
| 4+ | ESCALATION | Parent email + admin action required |

### Heartbeat
- Device sends POST `/api/compliance/heartbeat` every 30s (foreground) + background task
- If no heartbeat received in 2 minutes → student marked OFFLINE
- Status propagates via Socket.io to all connected dashboards in real-time

### Socket.io Rooms
- `school:{schoolId}` — school-wide compliance events
- `class:{classId}` — class-specific status updates
- `student:{studentId}` — per-student score/status updates

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/register` | Register user |

### Students
| Method | Path | Description |
|---|---|---|
| GET | `/api/students` | List all students (admin/teacher) |
| GET | `/api/students/:id` | Student detail with violations + rewards |
| GET | `/api/students/:id/score` | Current score snapshot |
| GET | `/api/students/:id/events` | Compliance event history |

### Classes
| Method | Path | Description |
|---|---|---|
| GET | `/api/classes` | List classes |
| GET | `/api/classes/:id` | Class detail with enrolled students |
| POST | `/api/classes/:id/sessions/start` | Start a locked session |
| POST | `/api/classes/:id/sessions/:sid/end` | End a session |
| POST | `/api/classes/:id/enroll` | Enroll students |

### Compliance
| Method | Path | Description |
|---|---|---|
| POST | `/api/compliance/heartbeat` | Device heartbeat ping |
| GET | `/api/compliance/school` | School-wide compliance % |
| GET | `/api/compliance/class/:classId` | Per-class compliance |

### Violations
| Method | Path | Description |
|---|---|---|
| GET | `/api/violations` | Active violations (school) |
| POST | `/api/violations` | Record violation (triggers consequence ladder) |
| PATCH | `/api/violations/:id/resolve` | Resolve a violation |

### Rewards
| Method | Path | Description |
|---|---|---|
| GET | `/api/rewards` | List active rewards |
| POST | `/api/rewards` | Create reward (admin) |
| POST | `/api/rewards/:id/claim` | Claim a reward |

### Reports
| Method | Path | Description |
|---|---|---|
| GET | `/api/reports/compliance-trend?days=7` | Day-by-day compliance/violation counts |
| GET | `/api/reports/leaderboard?limit=10` | Top students by focus score |
| GET | `/api/reports/violations-summary` | Violation breakdown by level |
| GET | `/api/reports/class-heatmap` | Per-class compliance heatmap data |

---

## Project Structure

```
PHOCUS/
├── backend/          — Express API, Prisma, Socket.io, services
│   ├── src/
│   │   ├── index.ts          — Server entry, socket setup
│   │   ├── config/env.ts     — Zod-validated environment
│   │   ├── db/prisma.ts      — Prisma singleton
│   │   ├── events/eventBus.ts — Internal typed event bus
│   │   ├── routes/           — Express routers
│   │   ├── services/         — Business logic
│   │   │   ├── focusScore.ts — Scoring + tier system
│   │   │   ├── heartbeat.ts  — Device heartbeat + offline sweep
│   │   │   ├── enforcement.ts — Consequence ladder
│   │   │   └── notifications.ts — Email/push stubs
│   │   ├── sockets/handlers.ts — Socket.io event wiring
│   │   └── middleware/       — Auth (JWT), logger
│   └── prisma/schema.prisma  — Full data model
│
├── dashboard/        — React admin dashboard
│   ├── src/
│   │   ├── App.tsx           — Layout + view routing
│   │   ├── components/
│   │   │   ├── dashboard/    — ComplianceMeter, ClassGrid, ActivityFeed, Leaderboard, AlertsPanel
│   │   │   ├── classes/      — ClassesView, ClassDrillDown
│   │   │   ├── students/     — StudentsView, StudentProfile, FocusRing
│   │   │   └── reports/      — ComplianceTrend, HeatMapGrid, ReportsView
│   │   ├── hooks/            — useSocket, useCompliance
│   │   ├── store/            — Zustand (phocusStore)
│   │   └── lib/api.ts        — Axios API client
│
└── mobile/           — Expo React Native student app
    ├── app/          — Expo Router screens (index=ClassMode, profile)
    ├── components/   — ClassModeScreen, FocusScoreRing, RewardsBar
    ├── services/     — heartbeat, classMode, socket
    └── hooks/        — useHeartbeat
```

---

## Environment Variables

See `backend/.env.example` for all required variables. The only required changes from defaults are:

1. `JWT_SECRET` — must be a random string of 32+ characters
2. `DATABASE_URL` — if not using the docker-compose postgres default
