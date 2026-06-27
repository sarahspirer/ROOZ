import axios from 'axios';

const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rooz_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rooz_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ── API helpers ──────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: Record<string, unknown> }>('/auth/login', { email, password }),
};

export const studentsApi = {
  list: (params?: Record<string, string>) => api.get('/students', { params }),
  get: (id: string) => api.get(`/students/${id}`),
  getScore: (id: string) => api.get(`/students/${id}/score`),
  getEvents: (id: string, limit = 50) => api.get(`/students/${id}/events`, { params: { limit } }),
};

export const classesApi = {
  list: (includeStudents = false) => api.get('/classes', { params: includeStudents ? { includeStudents: 'true' } : {} }),
  get: (id: string) => api.get(`/classes/${id}`),
  startSession: (id: string, allowedApps: string[] = []) =>
    api.post(`/classes/${id}/sessions/start`, { allowedApps }),
  endSession: (classId: string, sessionId: string) =>
    api.post(`/classes/${classId}/sessions/${sessionId}/end`),
  enroll: (classId: string, studentIds: string[]) =>
    api.post(`/classes/${classId}/enroll`, { studentIds }),
};

export const complianceApi = {
  school: () => api.get('/compliance/school'),
  class: (classId: string) => api.get(`/compliance/class/${classId}`),
};

export const violationsApi = {
  list: () => api.get('/violations'),
  student: (studentId: string) => api.get(`/violations/student/${studentId}`),
  create: (data: { studentId: string; description: string; appAttempted?: string }) =>
    api.post('/violations', data),
  resolve: (id: string) => api.patch(`/violations/${id}/resolve`),
  resolveStudent: (studentId: string) => api.post(`/violations/resolve-student/${studentId}`),
};

export const rewardsApi = {
  list: () => api.get('/rewards'),
  create: (data: Record<string, unknown>) => api.post('/rewards', data),
  claim: (rewardId: string, studentId: string) =>
    api.post(`/rewards/${rewardId}/claim`, { studentId }),
  studentClaims: (studentId: string) => api.get(`/rewards/student/${studentId}`),
};

export const reportsApi = {
  complianceTrend: (days = 7) => api.get('/reports/compliance-trend', { params: { days } }),
  leaderboard: (limit = 10) => api.get('/reports/leaderboard', { params: { limit } }),
  violationsSummary: () => api.get('/reports/violations-summary'),
  classHeatmap: () => api.get('/reports/class-heatmap'),
};
