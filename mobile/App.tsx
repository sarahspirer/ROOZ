import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
  ScrollView, Animated, Vibration, FlatList,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  login, getStudentById, sendHeartbeat, setToken,
  StudentData, getRewards, claimReward, RewardData,
  API_URL, registerPushToken,
} from './services/api';
import { FocusScoreRing } from './components/FocusScoreRing';

// Screen Time — no-op until native module is active
let screenTimeLock: ((apps: string[]) => Promise<void>) | null = null;
let screenTimeUnlock: (() => Promise<void>) | null = null;
try {
  const ST = require('./modules/screen-time');
  screenTimeLock = ST.lockStudentDevice;
  screenTimeUnlock = ST.unlockStudentDevice;
} catch { /* pending */ }

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

// ── Design tokens ─────────────────────────────────────────────────────────────
const RED = '#C8102E';
const BLACK = '#1d1d1f';
const GRAY = '#8e8e93';
const LIGHT = '#f2f2f7';
const WHITE = '#ffffff';
const GREEN = '#34C759';
const ORANGE = '#FF9500';
const BLUE = '#007AFF';
const BORDER = '#e5e5ea';

const TYPE_ICON: Record<string, string> = {
  HOMEWORK: '📚', PROJECT: '🗂', READING: '📖',
  STUDY_GUIDE: '📋', QUIZ: '✏️', TEST: '📝', OTHER: '📌',
};
const TYPE_COLOR: Record<string, string> = {
  HOMEWORK: BLUE, PROJECT: '#8B5CF6', READING: GREEN,
  STUDY_GUIDE: ORANGE, QUIZ: '#EC4899', TEST: RED, OTHER: GRAY,
};
const TIER_COLOR: Record<string, string> = {
  BRONZE: '#d97706', SILVER: '#94a3b8', GOLD: '#eab308', ELITE: '#a855f7',
};

interface Assignment {
  id: string;
  title: string;
  description?: string;
  type: string;
  dueDate?: string;
  points?: number;
  className: string;
  droppedAt: string;
  completed: boolean;
  completedAt?: string;
  class?: { name: string };
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function fetchAssignments(token: string): Promise<Assignment[]> {
  const res = await fetch(`${API_URL}/api/assignments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return (data.assignments ?? []).map((a: any) => ({
    ...a,
    className: a.class?.name ?? a.className ?? '',
  }));
}

async function markComplete(token: string, id: string, done: boolean) {
  await fetch(`${API_URL}/api/assignments/${id}/complete`, {
    method: done ? 'POST' : 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const res = await login(email.trim(), password.trim());
      setToken(res.token);
      onLogin(res.token, res.user);
    } catch (err: any) {
      Alert.alert('sign in failed', err.message ?? 'Check your credentials.');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />
      <View style={s.loginWrap}>
        <View style={s.loginLogo}>
          <View style={[s.logoBox, { backgroundColor: RED }]}>
            <Text style={s.logoLetter}>R</Text>
          </View>
          <Text style={s.logoWordmark}>rooz</Text>
          <Text style={s.logoTagline}>school focus system</Text>
        </View>

        <View style={s.loginForm}>
          <TextInput
            style={s.loginInput}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email"
            placeholderTextColor={GRAY}
            returnKeyType="next"
          />
          <TextInput
            style={s.loginInput}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="password"
            placeholderTextColor={GRAY}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            style={[s.loginBtn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={WHITE} />
              : <Text style={s.loginBtnText}>sign in</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Homework Tab ──────────────────────────────────────────────────────────────
function HomeworkTab({ token, newDrop }: { token: string; newDrop: Assignment | null }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setAssignments(await fetchAssignments(token)); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Inject new drop in real-time
  useEffect(() => {
    if (!newDrop) return;
    setAssignments((prev) => {
      if (prev.some((a) => a.id === newDrop.id)) return prev;
      return [newDrop, ...prev];
    });
  }, [newDrop]);

  const toggle = async (a: Assignment) => {
    setCompleting(a.id);
    try {
      await markComplete(token, a.id, !a.completed);
      setAssignments((prev) => prev.map((x) => x.id === a.id ? { ...x, completed: !x.completed } : x));
    } catch { /* ignore */ }
    finally { setCompleting(null); }
  };

  const pending = assignments.filter((a) => !a.completed);
  const done = assignments.filter((a) => a.completed);

  const renderItem = (a: Assignment) => {
    const color = TYPE_COLOR[a.type] ?? GRAY;
    const dueDate = a.dueDate ? new Date(a.dueDate) : null;
    const isOverdue = dueDate && !a.completed && dueDate < new Date();
    const daysUntil = dueDate
      ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000)
      : null;

    return (
      <View key={a.id} style={[s.hwCard, a.completed && s.hwCardDone]}>
        <View style={[s.hwTypeDot, { backgroundColor: color }]} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.hwClass}>{a.className}</Text>
            <View style={[s.hwTypePill, { backgroundColor: color + '18' }]}>
              <Text style={[s.hwTypePillText, { color }]}>{a.type.toLowerCase()}</Text>
            </View>
          </View>
          <Text style={[s.hwTitle, a.completed && s.hwTitleDone]} numberOfLines={2}>
            {a.title}
          </Text>
          {a.description && !a.completed && (
            <Text style={s.hwDesc} numberOfLines={2}>{a.description}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
            {dueDate && (
              <Text style={[s.hwDue, isOverdue && s.hwDueOverdue]}>
                {isOverdue ? '⚠ overdue' : daysUntil === 0 ? 'due today' : daysUntil === 1 ? 'due tomorrow' : `due ${dueDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`}
              </Text>
            )}
            {a.points && <Text style={s.hwPoints}>{a.points} pts</Text>}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => toggle(a)}
          disabled={completing === a.id}
          style={[s.hwCheck, a.completed && s.hwCheckDone]}
          activeOpacity={0.7}
        >
          {completing === a.id
            ? <ActivityIndicator size="small" color={a.completed ? WHITE : GRAY} />
            : <Text style={[s.hwCheckMark, a.completed && { color: WHITE }]}>
                {a.completed ? '✓' : ''}
              </Text>
          }
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={RED} /></View>;
  }

  return (
    <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={s.tabHeading}>homework</Text>

      {assignments.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyTitle}>nothing yet</Text>
          <Text style={s.emptyBody}>when your teacher drops an assignment{'\n'}it appears here instantly</Text>
        </View>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <Text style={s.sectionLabel}>to do · {pending.length}</Text>
              {pending.map(renderItem)}
            </>
          )}
          {done.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { marginTop: 24 }]}>done · {done.length}</Text>
              {done.map(renderItem)}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ── Focus Tab (main class-mode screen) ───────────────────────────────────────
function FocusTab({
  user, student, token,
  onViolation, onLockChange,
}: {
  user: any; student: StudentData; token: string;
  onViolation: (msg: string, level: string) => void;
  onLockChange: (locked: boolean, className?: string) => void;
}) {
  const [data, setData] = useState<StudentData>(student);
  const [lockedClass, setLockedClass] = useState<{ className: string } | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lockAnim = useRef(new Animated.Value(0)).current;
  const socketRef = useRef<Socket | null>(null);
  const deviceId = useRef(`device-${user.id}`).current;
  const isCompliant = data.status === 'COMPLIANT';
  const tierColor = TIER_COLOR[data.tier] ?? ORANGE;

  const beat = useCallback(async () => {
    try {
      let location: { lat: number; lng: number } | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      } catch {}
      await sendHeartbeat(data.id, deviceId, location);
    } catch {}
  }, [data.id]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          const t = await Notifications.getExpoPushTokenAsync();
          await registerPushToken(data.id, deviceId, t.data);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => { beat(); const t = setInterval(beat, 30000); return () => clearInterval(t); }, [beat]);
  useEffect(() => {
    const t = setInterval(async () => {
      try { setData(await getStudentById(user.studentId)); } catch {}
    }, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('join:student', student.id);
      (student.classEnrollments ?? []).forEach((e: any) => socket.emit('join:class', e.class.id));
    });
    socket.on('student:violation', (e: { description: string; level: string }) => {
      Vibration.vibrate([0, 200, 100, 200]);
      onViolation(e.description, e.level);
    });
    socket.on('class:status', (e: { classId: string; className: string; isLocked: boolean; allowedApps?: string[] }) => {
      const enrolled = (student.classEnrollments ?? []).some((en: any) => en.class.id === e.classId);
      if (!enrolled) return;
      if (e.isLocked) {
        setLockedClass({ className: e.className });
        Vibration.vibrate([0, 300, 150, 300, 150, 300]);
        Animated.spring(lockAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
        screenTimeLock?.(e.allowedApps ?? []).catch(() => {});
        onLockChange(true, e.className);
      } else {
        setLockedClass(null);
        lockAnim.setValue(0);
        screenTimeUnlock?.().catch(() => {});
        onLockChange(false);
      }
    });
    socket.on('emergency:unlock', () => {
      setLockedClass(null);
      lockAnim.setValue(0);
      screenTimeUnlock?.().catch(() => {});
      onLockChange(false);
    });
    return () => { socket.disconnect(); };
  }, [student.id]);

  useEffect(() => {
    if (!isCompliant) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.stopAnimation(); pulseAnim.setValue(1); }
  }, [isCompliant]);

  return (
    <>
      <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
        <Text style={s.tabHeading}>focus</Text>

        {/* Status pill */}
        <Animated.View style={[s.statusPill, { backgroundColor: isCompliant ? GREEN + '18' : RED + '18', borderColor: isCompliant ? GREEN + '40' : RED + '40', transform: [{ scale: pulseAnim }] }]}>
          <View style={[s.statusDot, { backgroundColor: isCompliant ? GREEN : RED }]} />
          <Text style={[s.statusPillText, { color: isCompliant ? GREEN : RED }]}>
            {isCompliant ? 'earning points' : 'put your phone down'}
          </Text>
        </Animated.View>

        {/* Name */}
        <Text style={s.studentName}>{user.name?.split(' ')[0]}</Text>

        {/* Score ring */}
        <View style={s.ringWrap}>
          <FocusScoreRing score={data.focusScore} tier={data.tier} size={200} />
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: tierColor }]}>{data.dailyScore}</Text>
            <Text style={s.statLbl}>today</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: tierColor }]}>{data.weeklyScore}</Text>
            <Text style={s.statLbl}>this week</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: tierColor }]}>🔥 {data.streak}</Text>
            <Text style={s.statLbl}>streak</Text>
          </View>
        </View>

        {/* Tier */}
        <View style={[s.tierPill, { borderColor: tierColor + '50', backgroundColor: tierColor + '12' }]}>
          <Text style={[s.tierText, { color: tierColor }]}>{data.tier.toLowerCase()} tier</Text>
        </View>

        {data.totalViolations > 0 && (
          <View style={s.violRow}>
            <Text style={s.violText}>⚠ {data.totalViolations} violation{data.totalViolations !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </ScrollView>

      {/* Full-screen lock overlay */}
      {lockedClass && (
        <Animated.View style={[s.lockOverlay, { opacity: lockAnim }]}>
          <StatusBar barStyle="light-content" />
          <Text style={s.lockEmoji}>🔒</Text>
          <Text style={s.lockTitle}>class in session</Text>
          <Text style={s.lockClassName}>{lockedClass.className}</Text>
          <Text style={s.lockSub}>put your phone away{'\n'}and focus</Text>
          <View style={s.lockBadge}>
            <Text style={s.lockBadgeText}>{data.tier.toLowerCase()} · {data.focusScore} pts</Text>
          </View>
        </Animated.View>
      )}
    </>
  );
}

// ── Rewards Tab ───────────────────────────────────────────────────────────────
function RewardsTab({ student, token }: { student: StudentData; token: string }) {
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'ELITE'];
  const studentTierIdx = tierOrder.indexOf(student.tier);

  useEffect(() => { getRewards().then(setRewards).catch(() => {}); }, []);

  const handleClaim = async (reward: RewardData) => {
    setClaiming(reward.id);
    try {
      await claimReward(reward.id, student.id);
      setClaimed((prev) => new Set([...prev, reward.id]));
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('Already claimed')) { setClaimed((prev) => new Set([...prev, reward.id])); }
      else { Alert.alert('not yet', msg || 'Could not claim.'); }
    } finally { setClaiming(null); }
  };

  return (
    <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={s.tabHeading}>rewards</Text>

      {rewards.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>⭐</Text>
          <Text style={s.emptyTitle}>no rewards yet</Text>
          <Text style={s.emptyBody}>keep earning points to unlock rewards</Text>
        </View>
      ) : rewards.map((reward) => {
        const color = TIER_COLOR[reward.requiredTier] ?? ORANGE;
        const meetsReq = studentTierIdx >= tierOrder.indexOf(reward.requiredTier) && student.focusScore >= reward.requiredScore;
        const isClaimed = claimed.has(reward.id);

        return (
          <View key={reward.id} style={[s.rewardCard, { borderColor: color + '30' }]}>
            <View style={[s.rewardDot, { backgroundColor: color + '20', borderColor: color + '40' }]}>
              <Text style={{ fontSize: 20 }}>★</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rewardName}>{reward.name}</Text>
              <Text style={s.rewardDesc}>{reward.description}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Text style={[s.rewardTier, { color, borderColor: color + '40' }]}>{reward.requiredTier.toLowerCase()}</Text>
                <Text style={s.rewardPts}>{reward.requiredScore.toLocaleString()} pts</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.claimBtn, { borderColor: isClaimed ? GREEN + '60' : meetsReq ? color + '60' : BORDER, backgroundColor: isClaimed ? GREEN + '15' : meetsReq ? color + '12' : 'transparent' }]}
              onPress={() => !isClaimed && meetsReq && handleClaim(reward)}
              disabled={!!claiming || isClaimed || !meetsReq}
              activeOpacity={0.75}
            >
              {claiming === reward.id
                ? <ActivityIndicator size="small" color={color} />
                : <Text style={[s.claimBtnText, { color: isClaimed ? GREEN : meetsReq ? color : GRAY }]}>
                    {isClaimed ? '✓' : meetsReq ? 'claim' : '🔒'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function StudentApp({ user, student, token }: { user: any; student: StudentData; token: string }) {
  const [tab, setTab] = useState<'focus' | 'homework' | 'rewards'>('focus');
  const [homeworkBadge, setHomeworkBadge] = useState(0);
  const [toast, setToast] = useState<{ text: string; level: string } | null>(null);
  const [newDrop, setNewDrop] = useState<Assignment | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const toastAnim = useRef(new Animated.Value(-120)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const showToast = (text: string, level: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, level });
    Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: -120, duration: 300, useNativeDriver: true }).start(() => setToast(null));
    }, 4500);
  };

  // Socket for homework drops (separate from FocusTab socket)
  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('join:student', student.id);
      (student.classEnrollments ?? []).forEach((e: any) => socket.emit('join:class', e.class.id));
    });
    socket.on('homework:dropped', ({ assignment }: { assignment: Assignment }) => {
      setNewDrop(assignment);
      setHomeworkBadge((n) => n + 1);
      Vibration.vibrate([0, 100, 50, 100]);
      showToast(`📚 ${assignment.className}: ${assignment.title}`, 'HOMEWORK');
    });
    socket.on('announcement', (e: { title: string; body: string }) => {
      showToast(`📢 ${e.title}`, 'INFO');
    });
    return () => { socket.disconnect(); };
  }, [student.id]);

  // Clear badge when homework tab opened
  useEffect(() => {
    if (tab === 'homework') setHomeworkBadge(0);
  }, [tab]);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      {/* ROOZ wordmark */}
      <View style={s.appHeader}>
        <Text style={s.appWordmark}>ROOZ</Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === 'focus' && (
          <FocusTab
            user={user} student={student} token={token}
            onViolation={(msg, level) => showToast(msg, level)}
            onLockChange={(locked) => setIsLocked(locked)}
          />
        )}
        {tab === 'homework' && <HomeworkTab token={token} newDrop={newDrop} />}
        {tab === 'rewards' && <RewardsTab student={student} token={token} />}
      </View>

      {/* Bottom tab bar */}
      {!isLocked && (
        <View style={s.tabBar}>
          {([
            { id: 'focus', icon: '◎', label: 'focus' },
            { id: 'homework', icon: '📚', label: 'homework', badge: homeworkBadge },
            { id: 'rewards', icon: '★', label: 'rewards' },
          ] as const).map((t) => (
            <TouchableOpacity
              key={t.id}
              style={s.tabBtn}
              onPress={() => setTab(t.id)}
              activeOpacity={0.7}
            >
              <View style={s.tabBtnInner}>
                <Text style={[s.tabIcon, tab === t.id && { color: RED }]}>{t.icon}</Text>
                {t.badge && t.badge > 0 ? (
                  <View style={s.badge}><Text style={s.badgeText}>{t.badge}</Text></View>
                ) : null}
              </View>
              <Text style={[s.tabLabel, tab === t.id && { color: RED, fontWeight: '700' }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Toast */}
      {toast && (
        <Animated.View style={[s.toast, toast.level === 'ESCALATION' && s.toastAlert, { transform: [{ translateY: toastAnim }] }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.toastTitle, toast.level === 'ESCALATION' && { color: RED }]}>
              {toast.level === 'ESCALATION' ? '🚨 bypass detected' : toast.level === 'HOMEWORK' ? 'new assignment' : toast.level === 'INFO' ? 'announcement' : 'violation'}
            </Text>
            <Text style={s.toastBody} numberOfLines={2}>{toast.text}</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Root() {
  const [session, setSession] = useState<{ token: string; user: any } | null>(null);
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (token: string, user: any) => {
    if (user.role !== 'STUDENT') { Alert.alert('students only', 'Admins and teachers use the web dashboard at rooz-production.up.railway.app'); return; }
    setLoading(true);
    try { setStudent(await getStudentById(user.studentId)); setSession({ token, user }); }
    catch { Alert.alert('error', 'Could not load your record. Try again.'); }
    finally { setLoading(false); }
  };

  if (loading) return <View style={[s.root, s.center]}><ActivityIndicator size="large" color={RED} /></View>;
  if (!session || !student) return <LoginScreen onLogin={handleLogin} />;
  return <StudentApp user={session.user} student={student} token={session.token} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHITE },
  appHeader: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 8, backgroundColor: WHITE },
  appWordmark: { fontSize: 22, fontWeight: '900', color: RED, letterSpacing: 2 },
  center: { justifyContent: 'center', alignItems: 'center' },

  // Login
  loginWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  loginLogo: { alignItems: 'center', marginBottom: 56 },
  logoBox: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: RED, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20 },
  logoLetter: { fontSize: 28, fontWeight: '900', color: WHITE },
  logoWordmark: { fontSize: 40, fontWeight: '900', color: BLACK, letterSpacing: 2 },
  logoTagline: { fontSize: 13, color: GRAY, marginTop: 6, fontWeight: '500' },
  loginForm: { gap: 12 },
  loginInput: { backgroundColor: LIGHT, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, fontSize: 16, color: BLACK },
  loginBtn: { backgroundColor: RED, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 8, shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16 },
  loginBtnText: { fontSize: 17, fontWeight: '700', color: WHITE, letterSpacing: 0.3 },

  // Tabs
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER, paddingBottom: 20, paddingTop: 10, backgroundColor: WHITE },
  tabBtn: { flex: 1, alignItems: 'center', gap: 4 },
  tabBtnInner: { position: 'relative' },
  tabIcon: { fontSize: 22, color: GRAY },
  tabLabel: { fontSize: 10, color: GRAY, fontWeight: '600', letterSpacing: 0.3 },
  badge: { position: 'absolute', top: -4, right: -8, backgroundColor: RED, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontWeight: '800', color: WHITE },

  // Shared tab
  tabScroll: { flex: 1 },
  tabContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  tabHeading: { fontSize: 34, fontWeight: '900', color: BLACK, letterSpacing: -0.5, marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: GRAY, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },

  // Focus tab
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start', marginBottom: 24 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  studentName: { fontSize: 28, fontWeight: '800', color: BLACK, marginBottom: 8 },
  ringWrap: { alignItems: 'center', marginVertical: 28 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: LIGHT, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', tabularNums: true } as any,
  statLbl: { fontSize: 11, color: GRAY, marginTop: 3, fontWeight: '600' },
  tierPill: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 20, paddingVertical: 8, alignSelf: 'center', marginBottom: 16 },
  tierText: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  violRow: { backgroundColor: RED + '12', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  violText: { color: RED, fontSize: 13, fontWeight: '600' },

  // Lock overlay
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0a0a0a', zIndex: 100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  lockEmoji: { fontSize: 56, marginBottom: 24 },
  lockTitle: { fontSize: 32, fontWeight: '900', color: WHITE, letterSpacing: -0.5 },
  lockClassName: { fontSize: 18, fontWeight: '700', color: RED, marginTop: 8, textAlign: 'center' },
  lockSub: { fontSize: 16, color: '#6e6e73', marginTop: 20, textAlign: 'center', lineHeight: 26 },
  lockBadge: { marginTop: 40, backgroundColor: '#1c1c1e', borderRadius: 100, paddingHorizontal: 20, paddingVertical: 10 },
  lockBadgeText: { fontSize: 13, color: '#6e6e73', fontWeight: '600' },

  // Homework tab
  hwCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: WHITE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  hwCardDone: { opacity: 0.5 },
  hwTypeDot: { width: 4, height: '100%' as any, borderRadius: 2, minHeight: 48 },
  hwClass: { fontSize: 11, fontWeight: '700', color: GRAY, letterSpacing: 0.5, textTransform: 'uppercase' },
  hwTypePill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  hwTypePillText: { fontSize: 10, fontWeight: '700' },
  hwTitle: { fontSize: 16, fontWeight: '700', color: BLACK, lineHeight: 22 },
  hwTitleDone: { textDecorationLine: 'line-through', color: GRAY },
  hwDesc: { fontSize: 13, color: GRAY, lineHeight: 18 },
  hwDue: { fontSize: 12, fontWeight: '600', color: GRAY },
  hwDueOverdue: { color: RED },
  hwPoints: { fontSize: 12, color: GRAY },
  hwCheck: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  hwCheckDone: { backgroundColor: GREEN, borderColor: GREEN },
  hwCheckMark: { fontSize: 14, fontWeight: '900', color: GRAY },

  // Rewards tab
  rewardCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: WHITE, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 },
  rewardDot: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rewardName: { fontSize: 15, fontWeight: '700', color: BLACK },
  rewardDesc: { fontSize: 13, color: GRAY, marginTop: 2, lineHeight: 18 },
  rewardTier: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  rewardPts: { fontSize: 11, color: GRAY, alignSelf: 'center' },
  claimBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  claimBtnText: { fontSize: 13, fontWeight: '700' },

  // Toast
  toast: { position: 'absolute', top: 60, left: 16, right: 16, zIndex: 99, backgroundColor: WHITE, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, flexDirection: 'row', alignItems: 'center' },
  toastAlert: { backgroundColor: RED + '08', borderWidth: 1, borderColor: RED + '30' },
  toastTitle: { fontSize: 11, fontWeight: '800', color: GRAY, letterSpacing: 1, marginBottom: 3 },
  toastBody: { fontSize: 14, color: BLACK, fontWeight: '600', lineHeight: 20 },

  // Empty states
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: BLACK, marginBottom: 8 },
  emptyBody: { fontSize: 15, color: GRAY, textAlign: 'center', lineHeight: 22 },
});
