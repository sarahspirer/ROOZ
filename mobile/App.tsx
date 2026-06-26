import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
  ScrollView, Animated, Vibration,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { login, getStudentById, sendHeartbeat, setToken, StudentData, getRewards, claimReward, RewardData, API_URL } from './services/api';
import { FocusScoreRing } from './components/FocusScoreRing';

const C = {
  bg: '#080808', card: '#111111', border: '#1f1f1f', muted: '#555555', white: '#ffffff',
  orange: '#f97316', orangeDim: '#f9731620', orangeBorder: '#f9731640',
  purple: '#a855f7', green: '#22c55e', greenDim: '#22c55e18', greenBorder: '#22c55e40',
  red: '#ef4444', redDim: '#ef444418', redBorder: '#ef444440',
};
const TIER_COLORS: Record<string, string> = { BRONZE: '#d97706', SILVER: '#94a3b8', GOLD: '#eab308', ELITE: '#a855f7' };

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
      Alert.alert('Login Failed', err.message ?? 'Check your credentials.');
    } finally { setLoading(false); }
  };
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={s.loginWrap}>
        <View style={s.logoWrap}>
          <View style={s.logoBox}><Text style={s.logoLetter}>R</Text></View>
          <Text style={s.logoName}>ROOZ</Text>
          <Text style={s.logoSub}>School Focus System</Text>
        </View>
        <View style={s.form}>
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Email</Text>
            <TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={C.muted} placeholder="you@school.edu" />
          </View>
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Password</Text>
            <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={C.muted} placeholder="••••••••" />
          </View>
          <TouchableOpacity style={[s.loginBtn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color={C.white} /> : <Text style={s.loginBtnText}>Sign In</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ClassModeScreen({ user, student }: { user: any; student: StudentData }) {
  const [data, setData] = useState<StudentData>(student);
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [lockedClass, setLockedClass] = useState<{ className: string } | null>(null);
  const [toast, setToast] = useState<{ description: string; level: string } | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lockAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(-120)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const deviceId = useRef(`device-${user.id}`).current;
  const isCompliant = data.status === 'COMPLIANT';
  const tierColor = TIER_COLORS[data.tier] ?? C.orange;
  const beat = useCallback(async () => { try { await sendHeartbeat(data.id, deviceId); } catch {} }, [data.id]);
  useEffect(() => { beat(); const t = setInterval(beat, 30000); return () => clearInterval(t); }, [beat]);
  useEffect(() => {
    const t = setInterval(async () => { try { const u = await getStudentById(user.studentId); setData(u); } catch {} }, 10000);
    return () => clearInterval(t);
  }, [user.id]);
  useEffect(() => {
    getRewards().then(setRewards).catch(() => {});
  }, []);

  const showToast = useCallback((description: string, level: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ description, level });
    Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: -120, duration: 300, useNativeDriver: true }).start(() => setToast(null));
    }, 4000);
  }, []);

  // Socket — join student + class rooms, listen for violations and lock/unlock
  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('join:student', student.id);
      (student.classEnrollments ?? []).forEach((e) => socket.emit('join:class', e.class.id));
    });
    socket.on('student:violation', (event: { description: string; level: string }) => {
      Vibration.vibrate([0, 200, 100, 200]);
      showToast(event.description, event.level);
    });
    socket.on('class:status', (event: { classId: string; className: string; isLocked: boolean }) => {
      const enrolled = (student.classEnrollments ?? []).some((e) => e.class.id === event.classId);
      if (!enrolled) return;
      if (event.isLocked) {
        setLockedClass({ className: event.className });
        Vibration.vibrate([0, 300, 150, 300, 150, 300]);
        Animated.spring(lockAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
      } else {
        setLockedClass(null);
        lockAnim.setValue(0);
      }
    });
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      socket.disconnect();
    };
  }, [student.id]);
  useEffect(() => {
    if (!isCompliant) {
      Vibration.vibrate([0, 200, 100, 200]);
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.stopAnimation(); pulseAnim.setValue(1); }
  }, [isCompliant]);

  const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'ELITE'];
  const studentTierIdx = tierOrder.indexOf(data.tier);

  const handleClaim = async (reward: RewardData) => {
    setClaiming(reward.id);
    try {
      await claimReward(reward.id, data.id);
      setClaimed((prev) => new Set([...prev, reward.id]));
      Alert.alert('Reward Claimed!', `Your claim for "${reward.name}" has been submitted for approval.`);
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('Already claimed')) {
        setClaimed((prev) => new Set([...prev, reward.id]));
        Alert.alert('Already Claimed', 'You already have a pending or approved claim for this reward.');
      } else if (msg.includes('does not meet')) {
        Alert.alert('Not Yet', 'You need a higher tier or score to claim this reward.');
      } else {
        Alert.alert('Error', msg || 'Could not submit claim.');
      }
    } finally {
      setClaiming(null);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[s.statusBanner, { backgroundColor: isCompliant ? C.greenDim : C.redDim, borderColor: isCompliant ? C.greenBorder : C.redBorder, transform: [{ scale: pulseAnim }] }]}>
          <View style={[s.dot, { backgroundColor: isCompliant ? C.green : C.red }]} />
          <Text style={[s.statusText, { color: isCompliant ? C.green : C.red }]}>{isCompliant ? 'CLASS MODE — EARNING POINTS' : 'PUT YOUR PHONE DOWN'}</Text>
        </Animated.View>
        <View style={s.header}>
          <View style={s.brandRow}>
            <View style={s.logoBoxSm}><Text style={s.logoLetterSm}>R</Text></View>
            <Text style={s.brand}>ROOZ</Text>
          </View>
          <Text style={s.studentName}>{user.name}</Text>
        </View>
        <View style={s.ringWrap}><FocusScoreRing score={data.focusScore} tier={data.tier} size={200} /></View>
        <View style={s.statsRow}>
          <View style={s.statCard}><Text style={[s.statVal, { color: C.orange }]}>{data.dailyScore}</Text><Text style={s.statLbl}>Today</Text></View>
          <View style={s.statCard}><Text style={[s.statVal, { color: C.orange }]}>{data.weeklyScore}</Text><Text style={s.statLbl}>This Week</Text></View>
          <View style={s.statCard}><Text style={[s.statVal, { color: C.orange }]}>🔥 {data.streak}</Text><Text style={s.statLbl}>Streak</Text></View>
        </View>
        <View style={[s.tierBadge, { borderColor: tierColor + '50', backgroundColor: tierColor + '15' }]}>
          <Text style={[s.tierTxt, { color: tierColor }]}>{data.tier} TIER</Text>
        </View>
        {data.totalViolations > 0 && (
          <View style={s.violWrap}><Text style={s.violTxt}>⚠ {data.totalViolations} violation{data.totalViolations !== 1 ? 's' : ''} this session</Text></View>
        )}
        <Text style={s.tip}>{isCompliant ? 'Every minute in focus earns points toward rewards.' : 'Violation recorded. Put your phone down to continue earning.'}</Text>

        {/* Rewards */}
        {rewards.length > 0 && (
          <View style={s.rewardsSection}>
            <Text style={s.rewardsHeading}>Rewards</Text>
            {rewards.map((reward) => {
              const color = TIER_COLORS[reward.requiredTier] ?? C.orange;
              const meetsReq = studentTierIdx >= tierOrder.indexOf(reward.requiredTier) && data.focusScore >= reward.requiredScore;
              const isClaimed = claimed.has(reward.id);
              const isLoading = claiming === reward.id;
              return (
                <View key={reward.id} style={[s.rewardCard, { borderColor: color + '30' }]}>
                  <View style={[s.rewardIcon, { backgroundColor: color + '18', borderColor: color + '40' }]}>
                    <Text style={{ fontSize: 18 }}>★</Text>
                  </View>
                  <View style={s.rewardBody}>
                    <Text style={s.rewardName}>{reward.name}</Text>
                    <Text style={s.rewardDesc}>{reward.description}</Text>
                    <View style={s.rewardMeta}>
                      <Text style={[s.rewardTier, { color, borderColor: color + '40' }]}>{reward.requiredTier}</Text>
                      <Text style={s.rewardPts}>{reward.requiredScore.toLocaleString()} pts</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[s.claimBtn,
                      isClaimed && s.claimBtnClaimed,
                      !meetsReq && !isClaimed && s.claimBtnLocked,
                      { borderColor: isClaimed ? C.green + '50' : meetsReq ? color + '60' : C.border },
                    ]}
                    onPress={() => !isClaimed && meetsReq && handleClaim(reward)}
                    disabled={isLoading || isClaimed || !meetsReq}
                    activeOpacity={0.75}
                  >
                    {isLoading
                      ? <ActivityIndicator size="small" color={color} />
                      : <Text style={[s.claimBtnTxt, { color: isClaimed ? C.green : meetsReq ? color : C.muted }]}>
                          {isClaimed ? '✓ Claimed' : meetsReq ? 'Claim' : 'Locked'}
                        </Text>
                    }
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Violation toast */}
      {toast && (
        <Animated.View style={[s.toast, toast.level === 'ESCALATION' && s.toastEscalation, { transform: [{ translateY: toastAnim }] }]}>
          <Text style={s.toastIcon}>{toast.level === 'ESCALATION' ? '🚨' : '⚠️'}</Text>
          <View style={s.toastBody}>
            <Text style={s.toastTitle}>{toast.level === 'ESCALATION' ? 'BYPASS DETECTED' : 'VIOLATION'}</Text>
            <Text style={s.toastDesc} numberOfLines={2}>{toast.description}</Text>
          </View>
        </Animated.View>
      )}

      {/* Full-screen lock overlay */}
      {lockedClass && (
        <Animated.View style={[s.lockOverlay, { opacity: lockAnim, transform: [{ scale: lockAnim.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1] }) }] }]}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <View style={s.lockIconWrap}>
            <Text style={s.lockEmoji}>🔒</Text>
          </View>
          <Text style={s.lockTitle}>CLASS IN SESSION</Text>
          <Text style={s.lockClass}>{lockedClass.className}</Text>
          <Text style={s.lockSub}>Your teacher has locked your phone.{'\n'}Put it away and focus.</Text>
          <View style={s.lockScorePill}>
            <Text style={s.lockScoreTxt}>You're on {data.tier} tier · {data.focusScore} pts</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

export default function Root() {
  const [session, setSession] = useState<{ token: string; user: any } | null>(null);
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(false);
  const handleLogin = async (token: string, user: any) => {
    if (user.role !== 'STUDENT') { Alert.alert('Students Only', 'Admins use the web dashboard.'); return; }
    setLoading(true);
    try { const d = await getStudentById(user.studentId); setSession({ token, user }); setStudent(d); }
    catch { Alert.alert('Error', 'Could not load your student record.'); }
    finally { setLoading(false); }
  };
  if (loading) return <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={C.orange} /></View>;
  if (!session || !student) return <LoginScreen onLogin={handleLogin} />;
  return <ClassModeScreen user={session.user} student={student} />;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 48, alignItems: 'center' },
  loginWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoWrap: { alignItems: 'center', marginBottom: 48 },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: C.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20 },
  logoLetter: { fontSize: 32, fontWeight: '900', color: C.white },
  logoName: { fontSize: 36, fontWeight: '900', color: C.white, letterSpacing: 4 },
  logoSub: { fontSize: 14, color: C.muted, marginTop: 6 },
  form: { gap: 16 },
  inputWrap: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: C.muted },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C.white, fontSize: 16 },
  loginBtn: { backgroundColor: C.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: C.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
  loginBtnText: { fontSize: 17, fontWeight: '800', color: C.white },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 9, marginTop: 16, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  header: { alignItems: 'center', marginTop: 20, marginBottom: 4 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  logoBoxSm: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  logoLetterSm: { fontSize: 14, fontWeight: '900', color: C.white },
  brand: { fontSize: 18, fontWeight: '900', color: C.white, letterSpacing: 3 },
  studentName: { fontSize: 24, fontWeight: '700', color: C.white },
  ringWrap: { marginVertical: 24 },
  statsRow: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 11, color: C.muted, marginTop: 3, fontWeight: '600' },
  tierBadge: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 16 },
  tierTxt: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  violWrap: { backgroundColor: C.redDim, borderWidth: 1, borderColor: C.redBorder, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16, width: '100%' },
  violTxt: { color: C.red, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  tip: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  rewardsSection: { width: '100%', marginTop: 32 },
  rewardsHeading: { fontSize: 14, fontWeight: '800', color: C.muted, letterSpacing: 1.2, marginBottom: 12, textTransform: 'uppercase' },
  rewardCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  rewardIcon: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rewardBody: { flex: 1, gap: 3 },
  rewardName: { fontSize: 14, fontWeight: '700', color: C.white },
  rewardDesc: { fontSize: 12, color: C.muted, lineHeight: 17 },
  rewardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  rewardTier: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  rewardPts: { fontSize: 11, color: C.muted },
  claimBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  claimBtnClaimed: { backgroundColor: C.green + '12' },
  claimBtnLocked: { opacity: 0.45 },
  claimBtnTxt: { fontSize: 12, fontWeight: '700' },
  toast: { position: 'absolute', top: 56, left: 16, right: 16, zIndex: 90, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#2a0000', borderWidth: 1, borderColor: C.redBorder, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, shadowColor: C.red, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
  toastEscalation: { backgroundColor: '#1a0020', borderColor: C.purple + '60' },
  toastIcon: { fontSize: 24 },
  toastBody: { flex: 1 },
  toastTitle: { fontSize: 11, fontWeight: '800', color: C.red, letterSpacing: 1.2 },
  toastDesc: { fontSize: 13, color: C.white, marginTop: 2, lineHeight: 18 },
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  lockIconWrap: { width: 100, height: 100, borderRadius: 28, backgroundColor: '#1a0000', borderWidth: 2, borderColor: '#ef444440', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  lockEmoji: { fontSize: 48 },
  lockTitle: { fontSize: 28, fontWeight: '900', color: C.white, letterSpacing: 3, textAlign: 'center' },
  lockClass: { fontSize: 16, fontWeight: '700', color: C.red, marginTop: 8, textAlign: 'center' },
  lockSub: { fontSize: 15, color: C.muted, marginTop: 16, textAlign: 'center', lineHeight: 24 },
  lockScorePill: { marginTop: 40, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 100, paddingHorizontal: 20, paddingVertical: 10 },
  lockScoreTxt: { fontSize: 13, color: C.muted, fontWeight: '600' },
});
