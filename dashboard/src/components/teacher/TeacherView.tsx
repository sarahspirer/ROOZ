import React, { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import { classesApi } from '../../lib/api';
import { usePhocusStore } from '../../store/phocusStore';
import { useSocket } from '../../hooks/useSocket';
import { StudentDrawer } from '../students/StudentDrawer';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type NotifType = 'HOMEWORK' | 'ASSIGNMENT' | 'TEST' | 'REMINDER' | 'ANNOUNCEMENT';

interface ScheduledNotif {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  scheduledAt: string;
  sentAt: string | null;
  classId: string | null;
}

const TYPE_META: Record<NotifType, { icon: string; label: string; color: string }> = {
  HOMEWORK:     { icon: '📚', label: 'homework',     color: '#007AFF' },
  ASSIGNMENT:   { icon: '📝', label: 'assignment',   color: '#FF9500' },
  TEST:         { icon: '📋', label: 'test',         color: '#C8102E' },
  REMINDER:     { icon: '🔔', label: 'reminder',     color: '#34C759' },
  ANNOUNCEMENT: { icon: '📢', label: 'announcement', color: '#8E8E93' },
};

interface StudentRow {
  id: string;
  name: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'OFFLINE' | 'BYPASSING';
  focusScore: number;
  violations: number;
}

interface ClassDetail {
  id: string;
  name: string;
  room?: string;
  sessionId: string | null;
  isLocked: boolean;
  compliancePercent: number;
  students: StudentRow[];
  allowedApps: string[];
}

const STATUS_DOT: Record<string, string> = {
  COMPLIANT: 'bg-compliance-green',
  NON_COMPLIANT: 'bg-compliance-yellow',
  OFFLINE: 'bg-surface-muted',
  BYPASSING: 'bg-compliance-red',
};

const STATUS_LABEL: Record<string, string> = {
  COMPLIANT: 'Compliant',
  NON_COMPLIANT: 'Distracted',
  OFFLINE: 'Offline',
  BYPASSING: '⚠️ Bypassing',
};

function formatDay(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'today';
  if (d.toDateString() === tomorrow.toDateString()) return 'tomorrow';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Groups notifications by calendar day label
function groupByDay(notifs: ScheduledNotif[]) {
  const map = new Map<string, ScheduledNotif[]>();
  for (const n of notifs) {
    const key = new Date(n.scheduledAt).toDateString();
    const label = formatDay(n.scheduledAt);
    const full = `${key}|||${label}`;
    if (!map.has(full)) map.set(full, []);
    map.get(full)!.push(n);
  }
  return Array.from(map.entries()).map(([key, items]) => ({
    label: key.split('|||')[1],
    items: items.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
  }));
}

export function TeacherView() {
  const { classStatuses, openStudent } = usePhocusStore();
  useSocket();

  const [tab, setTab] = useState<'class' | 'notifications' | 'homework'>('class');
  const [classes, setClasses] = useState<ClassDetail[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassDetail | null>(null);
  const [locking, setLocking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allowAppInput, setAllowAppInput] = useState('');
  const [showAppModal, setShowAppModal] = useState(false);

  // Homework Drop
  const [showHwModal, setShowHwModal] = useState(false);
  const [hwType, setHwType] = useState<'HOMEWORK' | 'PROJECT' | 'READING' | 'STUDY_GUIDE' | 'QUIZ' | 'TEST' | 'OTHER'>('HOMEWORK');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDesc, setHwDesc] = useState('');
  const [hwDueDate, setHwDueDate] = useState('');
  const [hwDueTime, setHwDueTime] = useState('23:59');
  const [hwPoints, setHwPoints] = useState('');
  const [hwDropping, setHwDropping] = useState(false);
  const [hwFlash, setHwFlash] = useState<'idle' | 'dropped' | 'error'>('idle');
  const [classAssignments, setClassAssignments] = useState<any[]>([]);

  // Notifications
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifType, setNotifType] = useState<NotifType>('HOMEWORK');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifDate, setNotifDate] = useState('');   // YYYY-MM-DD
  const [notifTime, setNotifTime] = useState('');   // HH:MM
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [notifTarget, setNotifTarget] = useState<'class' | 'all'>('class');
  const [notifSending, setNotifSending] = useState(false);
  const [notifFlash, setNotifFlash] = useState<'idle' | 'sent' | 'scheduled' | 'error'>('idle');
  const [scheduledNotifs, setScheduledNotifs] = useState<ScheduledNotif[]>([]);
  const [bellTime, setBellTime] = useState<string | null>(null);
  const [notifFilter, setNotifFilter] = useState<'upcoming' | 'sent'>('upcoming');

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await classesApi.list(true);
      const raw = res.data.classes as any[];
      const mapped: ClassDetail[] = raw.map((c) => {
        const session = c.sessions?.[0];
        const students: StudentRow[] = (c.enrollments ?? []).map((e: any) => ({
          id: e.student.id,
          name: e.student.user?.name ?? '—',
          status: e.student.status,
          focusScore: e.student.focusScore,
          violations: e.student.totalViolations,
        }));
        const compliant = students.filter((s) => s.status === 'COMPLIANT').length;
        const pct = students.length > 0 ? Math.round((compliant / students.length) * 100) : 100;
        return { id: c.id, name: c.name, room: c.room, sessionId: session?.id ?? null, isLocked: session?.isLocked ?? false, compliancePercent: pct, students, allowedApps: session?.allowedApps ?? [] };
      });
      setClasses(mapped);
      if (mapped.length > 0 && !selectedClass) setSelectedClass(mapped[0]);
      else if (selectedClass) { const u = mapped.find((c) => c.id === selectedClass.id); if (u) setSelectedClass(u); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('rooz_token');
      const res = await fetch(`${API_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token ?? ''}` } });
      const data = await res.json();
      setScheduledNotifs(data.notifications ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => {
    loadNotifications();
    (async () => {
      try {
        const token = localStorage.getItem('rooz_token');
        const res = await fetch(`${API_URL}/api/settings`, { headers: { Authorization: `Bearer ${token ?? ''}` } });
        const data = await res.json();
        setBellTime(data.schoolHoursEnd ?? null);
      } catch { /* ignore */ }
    })();
  }, [loadNotifications]);

  useEffect(() => {
    if (selectedClass && classStatuses[selectedClass.id]) loadClasses();
  }, [classStatuses]);

  useEffect(() => {
    if (selectedClass && tab === 'homework') loadAssignments(selectedClass.id);
    if (selectedClass && tab === 'class') loadAttendance(selectedClass.id);
  }, [tab, selectedClass?.id]);

  const handleLock = async () => {
    if (!selectedClass) return;
    setLocking(true);
    try { await classesApi.startSession(selectedClass.id, selectedClass.allowedApps); await loadClasses(); }
    catch (err) { console.error(err); } finally { setLocking(false); }
  };

  const handleUnlock = async () => {
    if (!selectedClass?.sessionId) return;
    setLocking(true);
    try { await classesApi.endSession(selectedClass.id, selectedClass.sessionId); await loadClasses(); }
    catch (err) { console.error(err); } finally { setLocking(false); }
  };

  const openNotifModal = (preset?: { date: string; time: string }) => {
    setNotifTitle(''); setNotifBody(''); setNotifType('HOMEWORK');
    setNotifFlash('idle'); setNotifTarget(selectedClass ? 'class' : 'all');
    if (preset) { setNotifDate(preset.date); setNotifTime(preset.time); setSendMode('schedule'); }
    else { setNotifDate(''); setNotifTime(''); setSendMode('now'); }
    setShowNotifModal(true);
  };

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const offsetDay = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) return;
    setNotifSending(true);
    try {
      const token = localStorage.getItem('rooz_token');
      let scheduledAt: string;
      if (sendMode === 'now') {
        scheduledAt = new Date().toISOString();
      } else {
        if (!notifDate || !notifTime) { setNotifFlash('error'); setNotifSending(false); return; }
        scheduledAt = new Date(`${notifDate}T${notifTime}:00`).toISOString();
      }
      const payload: any = {
        title: notifTitle.trim(), body: notifBody.trim(), type: notifType, scheduledAt,
        classId: notifTarget === 'class' && selectedClass ? selectedClass.id : undefined,
      };
      const res = await fetch(`${API_URL}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const { notification } = await res.json();

      if (sendMode === 'now' || new Date(scheduledAt) <= new Date()) {
        await fetch(`${API_URL}/api/notifications/${notification.id}/send`, { method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` } });
        setNotifFlash('sent');
      } else {
        setNotifFlash('scheduled');
      }
      await loadNotifications();
      setTimeout(() => { setNotifFlash('idle'); setShowNotifModal(false); }, 1800);
    } catch { setNotifFlash('error'); setTimeout(() => setNotifFlash('idle'), 3000); }
    finally { setNotifSending(false); }
  };

  const cancelNotification = async (id: string) => {
    try {
      const token = localStorage.getItem('rooz_token');
      await fetch(`${API_URL}/api/notifications/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token ?? ''}` } });
      await loadNotifications();
    } catch { /* ignore */ }
  };

  // Attendance
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: string; attendanceId: string | null }>>({});
  const [attendanceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [markingAttendance, setMarkingAttendance] = useState<string | null>(null);

  const loadAttendance = useCallback(async (classId: string) => {
    try {
      const token = localStorage.getItem('rooz_token');
      const res = await fetch(`${API_URL}/api/attendance/class/${classId}?date=${attendanceDate}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const data = await res.json();
      const map: Record<string, { status: string; attendanceId: string | null }> = {};
      for (const s of (data.students ?? [])) {
        map[s.studentId] = { status: s.status ?? 'UNMARKED', attendanceId: s.attendanceId };
      }
      setAttendanceMap(map);
    } catch { /* ignore */ }
  }, [attendanceDate]);

  const markAttendance = async (classId: string, studentId: string, status: string) => {
    setMarkingAttendance(studentId);
    try {
      const token = localStorage.getItem('rooz_token');
      const res = await fetch(`${API_URL}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ classId, studentId, status, markedBy: 'teacher', date: attendanceDate }),
      });
      if (res.ok) await loadAttendance(classId);
    } catch { /* ignore */ }
    finally { setMarkingAttendance(null); }
  };

  const loadAssignments = useCallback(async (classId: string) => {
    try {
      const token = localStorage.getItem('rooz_token');
      const res = await fetch(`${API_URL}/api/assignments/class/${classId}`, { headers: { Authorization: `Bearer ${token ?? ''}` } });
      const data = await res.json();
      setClassAssignments(data.assignments ?? []);
    } catch { /* ignore */ }
  }, []);

  const openHwModal = () => {
    setHwTitle(''); setHwDesc(''); setHwType('HOMEWORK');
    setHwDueDate(''); setHwDueTime('23:59'); setHwPoints('');
    setHwFlash('idle'); setShowHwModal(true);
  };

  const dropHomework = async () => {
    if (!hwTitle.trim() || !selectedClass) return;
    setHwDropping(true);
    try {
      const token = localStorage.getItem('rooz_token');
      const payload: any = {
        classId: selectedClass.id,
        title: hwTitle.trim(),
        description: hwDesc.trim() || undefined,
        type: hwType,
        points: hwPoints ? parseInt(hwPoints) : undefined,
        dueDate: hwDueDate ? new Date(`${hwDueDate}T${hwDueTime}:00`).toISOString() : undefined,
      };
      const res = await fetch(`${API_URL}/api/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setHwFlash('dropped');
      await loadAssignments(selectedClass.id);
      setTimeout(() => { setHwFlash('idle'); setShowHwModal(false); }, 1800);
    } catch { setHwFlash('error'); setTimeout(() => setHwFlash('idle'), 3000); }
    finally { setHwDropping(false); }
  };

  const deleteAssignment = async (id: string) => {
    try {
      const token = localStorage.getItem('rooz_token');
      await fetch(`${API_URL}/api/assignments/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token ?? ''}` } });
      if (selectedClass) await loadAssignments(selectedClass.id);
    } catch { /* ignore */ }
  };

  const handleAllowApp = async () => {
    if (!selectedClass || !allowAppInput.trim()) return;
    const newApps = [...selectedClass.allowedApps, allowAppInput.trim()];
    if (selectedClass.sessionId) await classesApi.endSession(selectedClass.id, selectedClass.sessionId);
    await classesApi.startSession(selectedClass.id, newApps);
    setAllowAppInput(''); setShowAppModal(false);
    await loadClasses();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-surface-muted">Loading your classes…</div></div>;
  }

  const cls = selectedClass;
  const complianceColor = !cls ? 'text-gray-900' : cls.compliancePercent >= 95 ? 'text-compliance-green' : cls.compliancePercent >= 80 ? 'text-compliance-yellow' : 'text-compliance-red';

  const upcoming = scheduledNotifs.filter((n) => !n.sentAt).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const sent = scheduledNotifs.filter((n) => !!n.sentAt).sort((a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime());
  const upcomingGroups = groupByDay(upcoming);

  return (
    <div className="flex gap-6 h-full">
      {/* Left: class selector */}
      {classes.length > 1 && (
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <div className="section-label mb-1">your classes</div>
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedClass(c); setTab('class'); }}
              className={clsx('text-left px-4 py-3 rounded-xl border transition-all', c.id === cls?.id ? 'bg-brand-600/20 border-brand-500 text-gray-900' : 'bg-surface-card border-surface-border text-surface-muted hover:text-gray-900 hover:border-surface-muted')}
            >
              <div className="font-medium text-sm">{c.name}</div>
              {c.room && <div className="text-xs mt-0.5">Room {c.room}</div>}
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className={clsx('w-1.5 h-1.5 rounded-full', c.isLocked ? 'bg-compliance-red' : 'bg-compliance-green')} />
                <span className="text-xs">{c.compliancePercent}%</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main panel */}
      {cls ? (
        <div className="flex-1 flex flex-col gap-5 min-w-0">

          {/* Tab bar */}
          <div className="flex gap-1 bg-surface rounded-xl p-1 w-fit">
            {([
              { id: 'class', label: '🏫 class' },
              { id: 'homework', label: '📚 homework' + (classAssignments.filter((a) => !a.completionRate || a.completionRate < 100).length > 0 ? ` · ${classAssignments.filter((a) => !a.completionRate || a.completionRate < 100).length}` : '') },
              { id: 'notifications', label: '📬 notify' + (upcoming.length > 0 ? ` · ${upcoming.length}` : '') },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx('px-4 py-1.5 rounded-lg text-sm font-semibold transition-all', tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-surface-muted hover:text-gray-900')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── CLASS TAB ── */}
          {tab === 'class' && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{cls.name}</h1>
                  {cls.room && <div className="text-surface-muted mt-0.5">Room {cls.room}</div>}
                </div>
                <div className="text-right">
                  <div className={clsx('text-5xl font-black tabular-nums', complianceColor)}>{cls.compliancePercent}%</div>
                  <div className="text-xs text-surface-muted mt-1">class compliance</div>
                </div>
              </div>

              <div className="flex gap-3">
                {!cls.isLocked ? (
                  <button onClick={handleLock} disabled={locking} className="flex-1 bg-compliance-red hover:bg-red-600 disabled:opacity-50 text-white text-2xl font-black rounded-2xl py-8 transition-all active:scale-95 shadow-lg shadow-red-500/20">
                    {locking ? 'Locking…' : '🔒  LOCK CLASS'}
                  </button>
                ) : (
                  <button onClick={handleUnlock} disabled={locking} className="flex-1 bg-compliance-green hover:bg-green-600 disabled:opacity-50 text-white text-2xl font-black rounded-2xl py-8 transition-all active:scale-95 shadow-lg shadow-green-500/20">
                    {locking ? 'Unlocking…' : '🔓  UNLOCK CLASS'}
                  </button>
                )}
                <button onClick={() => setShowAppModal(true)} className="card text-gray-900 font-semibold rounded-2xl px-6 transition-colors">+ app</button>
              </div>

              {cls.allowedApps.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-surface-muted self-center">allowed:</span>
                  {cls.allowedApps.map((app) => (
                    <span key={app} className="text-xs bg-brand-600/10 text-brand-400 border border-brand-600/20 px-2.5 py-1 rounded-full">{app.split('.').pop()}</span>
                  ))}
                </div>
              )}

              <div className="card overflow-hidden flex-1">
                <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
                  <h3 className="section-label">students ({cls.students.length})</h3>
                  <div className="flex items-center gap-4 text-xs text-surface-muted">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-compliance-green inline-block" />{cls.students.filter((s) => s.status === 'COMPLIANT').length} on track</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-compliance-red inline-block" />{cls.students.filter((s) => s.status !== 'COMPLIANT').length} off</span>
                  </div>
                </div>
                <div className="divide-y divide-surface-border max-h-[460px] overflow-y-auto">
                  {cls.students.length === 0 ? (
                    <div className="px-4 py-8 text-center text-surface-muted text-sm">no students enrolled</div>
                  ) : (
                    cls.students
                      .sort((a, b) => { const o = { BYPASSING: 0, NON_COMPLIANT: 1, OFFLINE: 2, COMPLIANT: 3 }; return (o[a.status] ?? 4) - (o[b.status] ?? 4); })
                      .map((student) => {
                        const att = attendanceMap[student.id];
                        const attStatus = att?.status ?? 'UNMARKED';
                        const isMarking = markingAttendance === student.id;
                        const attConfig: Record<string, { label: string; color: string; bg: string }> = {
                          PRESENT:  { label: '✓ here',  color: '#34C759', bg: '#34C75918' },
                          LATE:     { label: '⏱ late',  color: '#FF9500', bg: '#FF950018' },
                          ABSENT:   { label: '✗ absent', color: '#C8102E', bg: '#C8102E18' },
                          EXCUSED:  { label: '~ excused', color: '#8E8E93', bg: '#8E8E9318' },
                          UNMARKED: { label: 'mark',    color: '#8E8E93', bg: '#F2F2F7' },
                        };
                        const cfg = attConfig[attStatus];
                        return (
                          <div key={student.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-border/20 transition-colors">
                            <div className={clsx('w-2.5 h-2.5 rounded-full shrink-0', STATUS_DOT[student.status])} />
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openStudent(student.id)}>
                              <div className="text-sm font-medium text-gray-900 truncate">{student.name}</div>
                              <div className="text-xs text-surface-muted">{STATUS_LABEL[student.status]}</div>
                            </div>
                            {/* Attendance quick-mark */}
                            <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {attStatus !== 'UNMARKED' ? (
                                <span className="text-xs font-bold px-2.5 py-1 rounded-lg cursor-default" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                              ) : null}
                              {(['PRESENT', 'LATE', 'ABSENT'] as const).map((s) => (
                                <button
                                  key={s}
                                  disabled={isMarking}
                                  onClick={() => markAttendance(cls.id, student.id, s)}
                                  title={s.toLowerCase()}
                                  className={clsx(
                                    'w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all',
                                    attStatus === s ? 'opacity-0 pointer-events-none' : 'opacity-40 hover:opacity-100',
                                  )}
                                  style={{ background: s === 'PRESENT' ? '#34C75918' : s === 'LATE' ? '#FF950018' : '#C8102E18' }}
                                >
                                  {s === 'PRESENT' ? '✓' : s === 'LATE' ? '⏱' : '✗'}
                                </button>
                              ))}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-bold text-gray-900 tabular-nums">{student.focusScore}</div>
                              <div className="text-xs text-surface-muted">pts</div>
                            </div>
                            {student.violations > 0 && <div className="text-xs font-bold text-compliance-red bg-compliance-red/10 rounded px-2 py-0.5 shrink-0">{student.violations}×</div>}
                          </div>
                        );
                      })
                  )}
                </div>
                {/* Attendance summary footer */}
                {cls.students.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-surface-border flex gap-5 text-xs text-surface-muted bg-surface/50">
                    {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const).map((s) => {
                      const count = Object.values(attendanceMap).filter((a) => a.status === s).length;
                      const colors: Record<string, string> = { PRESENT: '#34C759', LATE: '#FF9500', ABSENT: '#C8102E', EXCUSED: '#8E8E93' };
                      return count > 0 ? (
                        <span key={s} className="font-semibold" style={{ color: colors[s] }}>
                          {s === 'PRESENT' ? '✓' : s === 'LATE' ? '⏱' : s === 'ABSENT' ? '✗' : '~'} {count} {s.toLowerCase()}
                        </span>
                      ) : null;
                    })}
                    <span className="ml-auto">{new Date(attendanceDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── HOMEWORK TAB ── */}
          {tab === 'homework' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">homework</h1>
                  <p className="text-sm text-surface-muted mt-0.5">drops appear instantly on student phones</p>
                </div>
                <button
                  onClick={openHwModal}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: '#C8102E' }}
                >
                  📚 drop homework
                </button>
              </div>

              {classAssignments.length === 0 ? (
                <div className="card py-16 text-center">
                  <div className="text-5xl mb-4">📭</div>
                  <div className="font-bold text-gray-900 text-lg">nothing dropped yet</div>
                  <div className="text-surface-muted text-sm mt-2">drop homework while students are still in their seats</div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {classAssignments.map((a) => {
                    const typeColors: Record<string, string> = { HOMEWORK: '#007AFF', PROJECT: '#8B5CF6', READING: '#34C759', STUDY_GUIDE: '#FF9500', QUIZ: '#EC4899', TEST: '#C8102E', OTHER: '#8E8E93' };
                    const color = typeColors[a.type] ?? '#8E8E93';
                    const due = a.dueDate ? new Date(a.dueDate) : null;
                    return (
                      <div key={a.id} className="card flex items-center gap-4">
                        <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{a.type.toLowerCase()}</span>
                            {due && <span className="text-xs text-surface-muted">· due {due.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
                            {a.points && <span className="text-xs text-surface-muted">· {a.points} pts</span>}
                          </div>
                          <div className="font-semibold text-gray-900">{a.title}</div>
                          {a.description && <div className="text-sm text-surface-muted mt-1 truncate">{a.description}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-black tabular-nums" style={{ color: a.completionRate >= 80 ? '#34C759' : a.completionRate >= 50 ? '#FF9500' : '#C8102E' }}>{a.completionRate ?? 0}%</div>
                          <div className="text-xs text-surface-muted">{a.completionCount ?? 0}/{a.totalStudents} done</div>
                        </div>
                        <button onClick={() => deleteAssignment(a.id)} className="text-xs text-surface-muted hover:text-compliance-red transition-colors px-2 py-1 rounded shrink-0">×</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === 'notifications' && (
            <>
              {/* Header + compose button */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">notifications</h1>
                  <p className="text-sm text-surface-muted mt-0.5">schedule for this class or all students</p>
                </div>
                <button
                  onClick={() => openNotifModal()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: '#C8102E' }}
                >
                  + new notification
                </button>
              </div>

              {/* Quick-schedule presets */}
              <div className="card p-4">
                <div className="section-label mb-3">quick schedule</div>
                <div className="flex gap-2 flex-wrap">
                  {bellTime && (
                    <button onClick={() => openNotifModal({ date: todayStr(), time: bellTime })} className="px-3 py-2 bg-surface rounded-xl text-xs font-semibold text-gray-700 hover:bg-surface-border transition-colors">
                      🔔 today at bell ({bellTime})
                    </button>
                  )}
                  <button onClick={() => openNotifModal({ date: offsetDay(1), time: '08:00' })} className="px-3 py-2 bg-surface rounded-xl text-xs font-semibold text-gray-700 hover:bg-surface-border transition-colors">📅 tomorrow morning</button>
                  <button onClick={() => openNotifModal({ date: offsetDay(1), time: bellTime ?? '15:00' })} className="px-3 py-2 bg-surface rounded-xl text-xs font-semibold text-gray-700 hover:bg-surface-border transition-colors">🌇 tomorrow at bell</button>
                  {/* Next Monday */}
                  {(() => { const d = new Date(); const daysUntilMon = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + daysUntilMon); return (
                    <button onClick={() => openNotifModal({ date: d.toISOString().slice(0, 10), time: '08:00' })} className="px-3 py-2 bg-surface rounded-xl text-xs font-semibold text-gray-700 hover:bg-surface-border transition-colors">📆 next monday</button>
                  ); })()}
                  <button onClick={() => openNotifModal()} className="px-3 py-2 bg-surface rounded-xl text-xs font-semibold text-gray-700 hover:bg-surface-border transition-colors">🚀 send now</button>
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex gap-1 bg-surface rounded-xl p-1 w-fit">
                {(['upcoming', 'sent'] as const).map((f) => (
                  <button key={f} onClick={() => setNotifFilter(f)} className={clsx('px-4 py-1.5 rounded-lg text-sm font-semibold transition-all', notifFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-surface-muted')}>
                    {f === 'upcoming' ? `upcoming (${upcoming.length})` : `sent (${sent.length})`}
                  </button>
                ))}
              </div>

              {/* Upcoming — grouped by day */}
              {notifFilter === 'upcoming' && (
                <div className="flex flex-col gap-4">
                  {upcomingGroups.length === 0 ? (
                    <div className="card py-12 text-center">
                      <div className="text-4xl mb-3">📭</div>
                      <div className="text-gray-900 font-semibold">nothing scheduled</div>
                      <div className="text-surface-muted text-sm mt-1">use the presets above or + new notification</div>
                    </div>
                  ) : (
                    upcomingGroups.map((group) => (
                      <div key={group.label} className="card overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-surface-border">
                          <span className="section-label">{group.label}</span>
                        </div>
                        <div className="divide-y divide-surface-border">
                          {group.items.map((n) => {
                            const meta = TYPE_META[n.type];
                            return (
                              <div key={n.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${meta.color}18` }}>
                                  {meta.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-gray-900 truncate">{n.title}</div>
                                  <div className="text-xs text-surface-muted truncate">{n.body}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                                    <span className="text-surface-muted text-xs">·</span>
                                    <span className="text-xs text-surface-muted">{formatTime(n.scheduledAt)}</span>
                                    <span className="text-surface-muted text-xs">·</span>
                                    <span className="text-xs text-surface-muted">{n.classId ? cls.name : 'all students'}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => cancelNotification(n.id)}
                                  className="text-xs text-surface-muted hover:text-compliance-red transition-colors px-3 py-1.5 rounded-lg hover:bg-compliance-red/5 shrink-0"
                                >
                                  cancel
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Sent history */}
              {notifFilter === 'sent' && (
                <div className="card overflow-hidden">
                  {sent.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="text-4xl mb-3">📤</div>
                      <div className="text-surface-muted text-sm">no notifications sent yet</div>
                    </div>
                  ) : (
                    <div className="divide-y divide-surface-border">
                      {sent.map((n) => {
                        const meta = TYPE_META[n.type];
                        return (
                          <div key={n.id} className="flex items-center gap-3 px-4 py-3 opacity-70">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${meta.color}18` }}>
                              {meta.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate">{n.title}</div>
                              <div className="text-xs text-surface-muted truncate">{n.body}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                                <span className="text-surface-muted text-xs">·</span>
                                <span className="text-xs text-surface-muted">sent {new Date(n.sentAt!).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {formatTime(n.sentAt!)}</span>
                              </div>
                            </div>
                            <div className="text-compliance-green text-xs font-bold shrink-0">✓ sent</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-surface-muted">No classes assigned</div>
      )}

      <StudentDrawer />

      {/* ── NOTIFICATION COMPOSE MODAL ── */}
      {showNotifModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="px-6 pt-6 pb-4 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-xl">📬</div>
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">new notification</h2>
                  <p className="text-xs text-surface-muted">push to student lock screens</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Type picker */}
              <div>
                <div className="section-label mb-2">type</div>
                <div className="flex gap-2 flex-wrap">
                  {(Object.entries(TYPE_META) as [NotifType, typeof TYPE_META[NotifType]][]).map(([t, m]) => (
                    <button
                      key={t}
                      onClick={() => setNotifType(t)}
                      className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all')}
                      style={notifType === t ? { background: m.color, color: '#fff', borderColor: m.color } : { background: '#F2F2F7', color: '#8E8E93', borderColor: 'transparent' }}
                    >
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title + body */}
              <div className="space-y-3">
                <div>
                  <div className="section-label mb-1.5">title</div>
                  <input
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder={notifType === 'TEST' ? 'e.g. Chapter 5 test Friday' : notifType === 'HOMEWORK' ? 'e.g. Math worksheet due tomorrow' : 'title'}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-surface-muted focus:outline-none focus:border-brand-500"
                    autoFocus
                  />
                </div>
                <div>
                  <div className="section-label mb-1.5">message</div>
                  <textarea
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                    placeholder="details…"
                    rows={2}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-surface-muted focus:outline-none focus:border-brand-500 resize-none"
                  />
                </div>
              </div>

              {/* Send to */}
              {selectedClass && (
                <div>
                  <div className="section-label mb-2">send to</div>
                  <div className="flex gap-2">
                    {(['class', 'all'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setNotifTarget(t)}
                        className={clsx('flex-1 py-2 rounded-xl text-xs font-bold border transition-all')}
                        style={notifTarget === t ? { background: '#C8102E', color: '#fff', borderColor: '#C8102E' } : { background: '#F2F2F7', color: '#8E8E93', borderColor: 'transparent' }}
                      >
                        {t === 'class' ? `📍 ${cls?.name}` : '🏫 all students'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* When */}
              <div>
                <div className="section-label mb-2">when</div>
                <div className="flex gap-2 mb-3">
                  {(['now', 'schedule'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSendMode(m)}
                      className={clsx('flex-1 py-2 rounded-xl text-xs font-bold border transition-all')}
                      style={sendMode === m ? { background: '#C8102E', color: '#fff', borderColor: '#C8102E' } : { background: '#F2F2F7', color: '#8E8E93', borderColor: 'transparent' }}
                    >
                      {m === 'now' ? '🚀 send now' : '📅 schedule'}
                    </button>
                  ))}
                </div>

                {sendMode === 'schedule' && (
                  <div className="space-y-3">
                    {/* Preset shortcuts */}
                    <div className="flex gap-2 flex-wrap">
                      {bellTime && (
                        <button onClick={() => { setNotifDate(todayStr()); setNotifTime(bellTime); }} className="px-3 py-1.5 bg-surface rounded-lg text-xs font-semibold text-gray-700 hover:bg-surface-border transition-colors">
                          today at bell
                        </button>
                      )}
                      <button onClick={() => { setNotifDate(offsetDay(1)); setNotifTime('08:00'); }} className="px-3 py-1.5 bg-surface rounded-lg text-xs font-semibold text-gray-700 hover:bg-surface-border transition-colors">tomorrow 8am</button>
                      <button onClick={() => { setNotifDate(offsetDay(1)); setNotifTime(bellTime ?? '15:00'); }} className="px-3 py-1.5 bg-surface rounded-lg text-xs font-semibold text-gray-700 hover:bg-surface-border transition-colors">tomorrow at bell</button>
                      {(() => { const d = new Date(); const daysUntilMon = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + daysUntilMon); return (
                        <button onClick={() => { setNotifDate(d.toISOString().slice(0, 10)); setNotifTime('08:00'); }} className="px-3 py-1.5 bg-surface rounded-lg text-xs font-semibold text-gray-700 hover:bg-surface-border transition-colors">next monday</button>
                      ); })()}
                    </div>

                    {/* Date + time pickers */}
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={notifDate}
                        onChange={(e) => setNotifDate(e.target.value)}
                        min={todayStr()}
                        className="flex-1 bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-brand-500"
                      />
                      <input
                        type="time"
                        value={notifTime}
                        onChange={(e) => setNotifTime(e.target.value)}
                        className="w-36 bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    {notifDate && notifTime && (
                      <div className="text-xs text-surface-muted">
                        sends {formatDay(`${notifDate}T${notifTime}`)} at {notifTime}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              {notifFlash === 'sent' && <p className="text-compliance-green text-xs font-semibold mb-3">✓ sent to students</p>}
              {notifFlash === 'scheduled' && <p className="text-compliance-green text-xs font-semibold mb-3">✓ scheduled</p>}
              {notifFlash === 'error' && <p className="text-compliance-red text-xs font-semibold mb-3">something went wrong — try again</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowNotifModal(false)} className="px-5 py-2.5 rounded-xl bg-surface text-gray-700 text-sm font-medium hover:bg-surface-border transition-colors">
                  cancel
                </button>
                <button
                  onClick={sendNotification}
                  disabled={notifSending || !notifTitle.trim() || !notifBody.trim() || (sendMode === 'schedule' && (!notifDate || !notifTime))}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40 hover:opacity-90 active:scale-[0.98]"
                  style={{ background: '#C8102E' }}
                >
                  {notifSending ? 'sending…' : sendMode === 'now' ? '🚀 send now' : `📅 schedule`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HOMEWORK DROP MODAL ── */}
      {showHwModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-surface-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-xl">📚</div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">drop homework</h2>
                <p className="text-xs text-surface-muted">appears instantly on every student's phone</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Type */}
              <div>
                <div className="section-label mb-2">type</div>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { id: 'HOMEWORK', icon: '📚' }, { id: 'TEST', icon: '📝' },
                    { id: 'QUIZ', icon: '✏️' }, { id: 'PROJECT', icon: '🗂' },
                    { id: 'READING', icon: '📖' }, { id: 'STUDY_GUIDE', icon: '📋' },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setHwType(t.id)}
                      className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all')}
                      style={hwType === t.id ? { background: '#C8102E', color: '#fff', borderColor: '#C8102E' } : { background: '#F2F2F7', color: '#8E8E93', borderColor: 'transparent' }}
                    >
                      {t.icon} {t.id.toLowerCase().replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <div className="section-label mb-1.5">title</div>
                <input
                  value={hwTitle}
                  onChange={(e) => setHwTitle(e.target.value)}
                  placeholder={hwType === 'TEST' ? 'e.g. Chapter 5 test' : hwType === 'READING' ? 'e.g. Read pages 42–60' : 'e.g. Math worksheet p. 24'}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-surface-muted focus:outline-none focus:border-brand-500"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <div className="section-label mb-1.5">details <span className="normal-case font-normal text-surface-muted">(optional)</span></div>
                <textarea
                  value={hwDesc}
                  onChange={(e) => setHwDesc(e.target.value)}
                  placeholder="any extra instructions…"
                  rows={2}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-surface-muted focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              {/* Due + Points */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="section-label mb-1.5">due date</div>
                  <input
                    type="date"
                    value={hwDueDate}
                    onChange={(e) => setHwDueDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="w-28">
                  <div className="section-label mb-1.5">points</div>
                  <input
                    type="number"
                    value={hwPoints}
                    onChange={(e) => setHwPoints(e.target.value)}
                    placeholder="e.g. 100"
                    min="0"
                    className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              {hwFlash === 'dropped' && <p className="text-compliance-green text-xs font-semibold mb-3">✓ dropped to {selectedClass?.name}</p>}
              {hwFlash === 'error' && <p className="text-compliance-red text-xs font-semibold mb-3">something went wrong — try again</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowHwModal(false)} className="px-5 py-2.5 rounded-xl bg-surface text-gray-700 text-sm font-medium hover:bg-surface-border">cancel</button>
                <button
                  onClick={dropHomework}
                  disabled={hwDropping || !hwTitle.trim()}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40 hover:opacity-90"
                  style={{ background: '#C8102E' }}
                >
                  {hwDropping ? 'dropping…' : `📲 drop to ${selectedClass?.name}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Allow app modal */}
      {showAppModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Allow an App</h3>
            <p className="text-sm text-surface-muted">Enter the app bundle ID to temporarily allow during class.</p>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="e.g. com.desmos.calculator"
                value={allowAppInput}
                onChange={(e) => setAllowAppInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAllowApp()}
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-brand-500"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {['com.desmos.calculator', 'com.google.classroom', 'com.apple.camera'].map((app) => (
                  <button key={app} onClick={() => setAllowAppInput(app)} className="text-xs bg-surface border border-surface-border text-surface-muted hover:text-gray-900 px-2.5 py-1 rounded-full transition-colors">
                    {app.split('.').pop()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowAppModal(false); setAllowAppInput(''); }} className="flex-1 bg-surface border border-surface-border text-gray-900 rounded-xl py-2.5 font-medium">Cancel</button>
              <button onClick={handleAllowApp} disabled={!allowAppInput.trim()} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-gray-900 rounded-xl py-2.5 font-medium transition-colors">Allow</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
