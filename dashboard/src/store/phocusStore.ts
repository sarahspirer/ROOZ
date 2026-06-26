import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type {
  ComplianceUpdateEvent,
  ActivityEvent,
  AlertEvent,
  ClassStatusEvent,
  StudentScoreEvent,
} from '../types';

const MAX_FEED_EVENTS = 50;

interface AuthState {
  token: string | null;
  user: { id: string; name: string; role: string; schoolId: string } | null;
}

interface PhocusState {
  // Auth
  auth: AuthState;
  setAuth: (token: string, user: AuthState['user']) => void;
  clearAuth: () => void;

  // Compliance
  compliance: ComplianceUpdateEvent | null;
  setCompliance: (event: ComplianceUpdateEvent) => void;

  // Activity feed
  activityFeed: ActivityEvent[];
  pushActivity: (event: ActivityEvent) => void;

  // Alerts
  alerts: AlertEvent[];
  pushAlert: (alert: AlertEvent) => void;
  dismissAlert: (id: string) => void;

  // Class statuses (keyed by classId)
  classStatuses: Record<string, ClassStatusEvent>;
  setClassStatus: (event: ClassStatusEvent) => void;

  // Student scores (keyed by studentId)
  studentScores: Record<string, StudentScoreEvent>;
  setStudentScore: (event: StudentScoreEvent) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  activeView: string;
  setActiveView: (view: string) => void;

  // Student drawer
  openStudentId: string | null;
  openStudent: (id: string) => void;
  closeStudent: () => void;
}

export const usePhocusStore = create<PhocusState>()(
  devtools(
    subscribeWithSelector((set) => ({
      // Auth
      auth: {
        token: localStorage.getItem('rooz_token'),
        user: (() => {
          try {
            return JSON.parse(localStorage.getItem('rooz_user') ?? 'null');
          } catch {
            return null;
          }
        })(),
      },
      setAuth: (token, user) => {
        localStorage.setItem('rooz_token', token);
        localStorage.setItem('rooz_user', JSON.stringify(user));
        set({ auth: { token, user } });
      },
      clearAuth: () => {
        localStorage.removeItem('rooz_token');
        localStorage.removeItem('rooz_user');
        set({ auth: { token: null, user: null } });
      },

      // Compliance
      compliance: null,
      setCompliance: (event) => set({ compliance: event }),

      // Activity feed
      activityFeed: [],
      pushActivity: (event) =>
        set((state) => ({
          activityFeed: [event, ...state.activityFeed].slice(0, MAX_FEED_EVENTS),
        })),

      // Alerts
      alerts: [],
      pushAlert: (alert) =>
        set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 100) })),
      dismissAlert: (id) =>
        set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),

      // Class statuses
      classStatuses: {},
      setClassStatus: (event) =>
        set((state) => ({
          classStatuses: { ...state.classStatuses, [event.classId]: event },
        })),

      // Student scores
      studentScores: {},
      setStudentScore: (event) =>
        set((state) => ({
          studentScores: { ...state.studentScores, [event.studentId]: event },
        })),

      // UI
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      activeView: 'dashboard',
      setActiveView: (view) => set({ activeView: view }),

      // Student drawer
      openStudentId: null,
      openStudent: (id) => set({ openStudentId: id }),
      closeStudent: () => set({ openStudentId: null }),
    })),
    { name: 'rooz-store' },
  ),
);
