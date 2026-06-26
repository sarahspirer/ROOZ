// All shared types — duplicated here from backend so dashboard is self-contained

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

// Socket event payloads -------------------------------------------------------

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

export interface LockUnlockPayload {
  sessionId: string;
  classId: string;
  className: string;
  lockedBy?: string;
  allowedApps?: string[];
}

export interface ServerToClientEvents {
  'compliance:update': (data: ComplianceUpdateEvent) => void;
  'activity:new': (data: ActivityEvent) => void;
  'alert:new': (data: AlertEvent) => void;
  'class:status': (data: ClassStatusEvent) => void;
  'student:score': (data: StudentScoreEvent) => void;
  'student:status': (data: StudentStatusEvent) => void;
  'session:lock': (data: LockUnlockPayload) => void;
  'session:unlock': (data: LockUnlockPayload) => void;
}

export interface ClientToServerEvents {
  'join:school': (schoolId: string) => void;
  'join:class': (classId: string) => void;
  'join:student': (studentId: string) => void;
  'leave:school': (schoolId: string) => void;
  'leave:class': (classId: string) => void;
}

// Dashboard-specific types ----------------------------------------------------

export interface Student {
  id: string;
  userId: string;
  name: string;
  email: string;
  grade: string;
  focusScore: number;
  dailyScore: number;
  weeklyScore: number;
  tier: Tier;
  streak: number;
  totalViolations: number;
  status: ComplianceStatus;
  lastSeen: string;
}

export interface ClassSummary {
  id: string;
  name: string;
  room?: string;
  grade?: string;
  building?: string;
  teacherName?: string;
  enrollmentCount: number;
  compliancePercent: number;
  activeStudents: number;
  violations: number;
  isLocked: boolean;
}

export interface Violation {
  id: string;
  studentId: string;
  studentName: string;
  level: ViolationLevel;
  description: string;
  appAttempted?: string;
  scoreImpact: number;
  timestamp: string;
  resolved: boolean;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  requiredTier: Tier;
  requiredScore: number;
  isActive: boolean;
  claimCount: number;
}

export interface ComplianceTrendPoint {
  date: string;
  compliant: number;
  violations: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  focusScore: number;
  weeklyScore: number;
  tier: Tier;
  streak: number;
}
