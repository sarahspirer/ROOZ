import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
  ScrollView, Animated, Vibration,
} from 'react-native';
import { login, getStudentByUserId, sendHeartbeat, setToken, StudentData } from '../services/api';
import { FocusScoreRing } from '../components/FocusScoreRing';

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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const deviceId = useRef(`device-${user.id}`).current;
  const isCompliant = data.status === 'COMPLIANT';
  const tierColor = TIER_COLORS[data.tier] ?? C.orange;
  const beat = useCallback(async () => { try { await sendHeartbeat(data.id, deviceId); } catch {} }, [data.id]);
  useEffect(() => { beat(); const t = setInterval(beat, 30000); return () => clearInterval(t); }, [beat]);
  useEffect(() => {
    const t = setInterval(async () => { try { const u = await getStudentByUserId(user.id); setData(u); } catch {} }, 10000);
    return () => clearInterval(t);
  }, [user.id]);
  useEffect(() => {
    if (!isCompliant) {
      Vibration.vibrate([0, 200, 100, 200]);
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.stopAnimation(); pulseAnim.setValue(1); }
  }, [isCompliant]);
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
      </ScrollView>
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
    try { const d = await getStudentByUserId(user.id); setSession({ token, user }); setStudent(d); }
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
});
