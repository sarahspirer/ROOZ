import Constants from 'expo-constants';

export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3001';

let authToken: string | null = null;

export function setToken(token: string) {
  authToken = token;
}

export function getToken(): string | null {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    schoolId: string;
    studentId?: string;
  };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export interface StudentData {
  id: string;
  focusScore: number;
  dailyScore: number;
  weeklyScore: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'ELITE';
  streak: number;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'OFFLINE' | 'BYPASSING';
  totalViolations: number;
  classEnrollments?: { class: { id: string; name: string; room?: string } }[];
}

export async function getStudentById(studentId: string): Promise<StudentData> {
  const data = await request<{ student: any }>(`/api/students/${studentId}`);
  if (!data.student) throw new Error('Student record not found');
  return data.student;
}

export async function sendHeartbeat(
  studentId: string,
  deviceId: string,
  location?: { lat: number; lng: number },
): Promise<void> {
  await request('/api/compliance/heartbeat', {
    method: 'POST',
    body: JSON.stringify({
      studentId,
      deviceId,
      platform: 'ios',
      ...(location ? { lat: location.lat, lng: location.lng } : {}),
    }),
  });
}

export interface RewardData {
  id: string;
  name: string;
  description: string;
  requiredTier: string;
  requiredScore: number;
}

export async function getRewards(): Promise<RewardData[]> {
  const data = await request<{ rewards: RewardData[] }>('/api/rewards');
  return data.rewards ?? [];
}

export async function claimReward(rewardId: string, studentId: string): Promise<void> {
  await request(`/api/rewards/${rewardId}/claim`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}
