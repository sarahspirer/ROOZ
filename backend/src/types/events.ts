// Shared event types — imported by both backend and dashboard

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'OFFLINE' | 'BYPASSING';
export type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'ELITE';
export type ViolationLevel = 'WARNING' | 'RESTRICTION' | 'ADMIN_FLAG' | 'ESCALATION';
export type EventType =
  | 'HEARTBEAT'
  | 'VIOLATION'
  | 'BYPASS_ATTEMPT'
  | 'LOCK'
  | 'UNLOCK'
  | 'REWARD_EARNED'
  | 'TIER_CHANGE'
  | 'SCORE_UPDATE'
  | 'PARENT_ALERT';

// Payloads ----------------------------------------------------------------

export interface HeartbeatPayload {
  deviceId: string;
  platform: string;
  batteryLevel?: number;
  isJailbroken?: boolean;
}

export interface ViolationPayload {
  level: ViolationLevel;
  description: string;
  appAttempted?: string;
  scoreImpact: number;
}

export interface ScoreUpdatePayload {
  focusScore: number;
  dailyScore: number;
  weeklyScore: number;
  tier: Tier;
  streak: number;
}

export interface TierChangePayload {
  previousTier: Tier;
  newTier: Tier;
  focusScore: number;
}

export interface LockUnlockPayload {
  sessionId: string;
  classId: string;
  className: string;
  lockedBy?: string;
  allowedApps?: string[];
}

// Socket events -----------------------------------------------------------

export interface ServerToClientEvents {
  // School-wide broadcast
  'compliance:update': (data: ComplianceUpdateEvent) => void;
  'activity:new': (data: ActivityEvent) => void;
  'alert:new': (data: AlertEvent) => void;
  'class:status': (data: ClassStatusEvent) => void;

  // Student-specific
  'student:score': (data: StudentScoreEvent) => void;
  'student:status': (data: StudentStatusEvent) => void;
  'session:lock': (data: LockUnlockPayload) => void;
  'session:unlock': (data: LockUnlockPayload) => void;
  'student:violation': (data: { studentId: string; description: string; level: string; app?: string }) => void;
}

export interface ClientToServerEvents {
  'join:school': (schoolId: string) => void;
  'join:class': (classId: string) => void;
  'join:student': (studentId: string) => void;
  'leave:school': (schoolId: string) => void;
  'leave:class': (classId: string) => void;
}

// Event shapes ------------------------------------------------------------

export interface ComplianceUpdateEvent {
  schoolId: string;
  compliancePercent: number;
  totalStudents: number;
  compliantCount: number;
  nonCompliantCount: number;
  offlineCount: number;
  bypassingCount: number;
  timestamp: string;
}

export interface ActivityEvent {
  id: string;
  studentId: string;
  studentName: string;
  classId?: string;
  className?: string;
  type: EventType;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

export interface AlertEvent {
  id: string;
  studentId: string;
  studentName: string;
  level: ViolationLevel;
  description: string;
  requiresAction: boolean;
  timestamp: string;
}

export interface ClassStatusEvent {
  classId: string;
  className: string;
  compliancePercent: number;
  activeStudents: number;
  violations: number;
  isLocked: boolean;
  timestamp: string;
}

export interface StudentScoreEvent {
  studentId: string;
  focusScore: number;
  dailyScore: number;
  weeklyScore: number;
  tier: Tier;
  streak: number;
  status: ComplianceStatus;
  timestamp: string;
}

export interface StudentStatusEvent {
  studentId: string;
  status: ComplianceStatus;
  lastSeen: string;
  timestamp: string;
}
