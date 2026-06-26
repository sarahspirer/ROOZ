import React, { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import { classesApi } from '../../lib/api';
import { usePhocusStore } from '../../store/phocusStore';
import { useSocket } from '../../hooks/useSocket';
import { StudentDrawer } from '../students/StudentDrawer';

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

export function TeacherView() {
  const { auth, classStatuses, openStudent } = usePhocusStore();
  useSocket();

  const [classes, setClasses] = useState<ClassDetail[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassDetail | null>(null);
  const [locking, setLocking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allowAppInput, setAllowAppInput] = useState('');
  const [showAppModal, setShowAppModal] = useState(false);

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

        return {
          id: c.id,
          name: c.name,
          room: c.room,
          sessionId: session?.id ?? null,
          isLocked: session?.isLocked ?? false,
          compliancePercent: pct,
          students,
          allowedApps: session?.allowedApps ?? [],
        };
      });

      setClasses(mapped);
      if (mapped.length > 0 && !selectedClass) {
        setSelectedClass(mapped[0]);
      } else if (selectedClass) {
        const updated = mapped.find((c) => c.id === selectedClass.id);
        if (updated) setSelectedClass(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  // Refresh when socket emits a class status change
  useEffect(() => {
    if (selectedClass && classStatuses[selectedClass.id]) {
      loadClasses();
    }
  }, [classStatuses]);

  const handleLock = async () => {
    if (!selectedClass) return;
    setLocking(true);
    try {
      const res = await classesApi.startSession(selectedClass.id, selectedClass.allowedApps);
      await loadClasses();
    } catch (err) {
      console.error(err);
    } finally {
      setLocking(false);
    }
  };

  const handleUnlock = async () => {
    if (!selectedClass?.sessionId) return;
    setLocking(true);
    try {
      await classesApi.endSession(selectedClass.id, selectedClass.sessionId);
      await loadClasses();
    } catch (err) {
      console.error(err);
    } finally {
      setLocking(false);
    }
  };

  const handleAllowApp = async () => {
    if (!selectedClass || !allowAppInput.trim()) return;
    const newApps = [...selectedClass.allowedApps, allowAppInput.trim()];
    // Restart session with new app list
    if (selectedClass.sessionId) await classesApi.endSession(selectedClass.id, selectedClass.sessionId);
    await classesApi.startSession(selectedClass.id, newApps);
    setAllowAppInput('');
    setShowAppModal(false);
    await loadClasses();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-surface-muted">Loading your classes…</div>
      </div>
    );
  }

  const cls = selectedClass;

  const complianceColor =
    !cls ? 'text-white'
    : cls.compliancePercent >= 95 ? 'text-compliance-green'
    : cls.compliancePercent >= 80 ? 'text-compliance-yellow'
    : 'text-compliance-red';

  return (
    <div className="flex gap-6 h-full">
      {/* Left: class selector (if multiple classes) */}
      {classes.length > 1 && (
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider mb-1">
            Your Classes
          </div>
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClass(c)}
              className={clsx(
                'text-left px-4 py-3 rounded-xl border transition-all',
                c.id === cls?.id
                  ? 'bg-brand-600/20 border-brand-500 text-white'
                  : 'bg-surface-card border-surface-border text-surface-muted hover:text-white hover:border-surface-muted',
              )}
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
        <div className="flex-1 flex flex-col gap-6 min-w-0">

          {/* Header row */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{cls.name}</h1>
              {cls.room && <div className="text-surface-muted mt-0.5">Room {cls.room}</div>}
            </div>
            <div className="text-right">
              <div className={clsx('text-5xl font-black tabular-nums', complianceColor)}>
                {cls.compliancePercent}%
              </div>
              <div className="text-xs text-surface-muted mt-1">class compliance</div>
            </div>
          </div>

          {/* BIG LOCK / UNLOCK BUTTON */}
          <div className="flex gap-4">
            {!cls.isLocked ? (
              <button
                onClick={handleLock}
                disabled={locking}
                className="flex-1 bg-compliance-red hover:bg-red-600 disabled:opacity-50 text-white text-2xl font-black rounded-2xl py-8 transition-all active:scale-95 shadow-lg shadow-red-500/20"
              >
                {locking ? 'Locking…' : '🔒  LOCK CLASS'}
              </button>
            ) : (
              <button
                onClick={handleUnlock}
                disabled={locking}
                className="flex-1 bg-compliance-green hover:bg-green-600 disabled:opacity-50 text-white text-2xl font-black rounded-2xl py-8 transition-all active:scale-95 shadow-lg shadow-green-500/20"
              >
                {locking ? 'Unlocking…' : '🔓  UNLOCK CLASS'}
              </button>
            )}

            <button
              onClick={() => setShowAppModal(true)}
              className="bg-surface-card border border-surface-border hover:border-brand-500 text-white font-semibold rounded-2xl px-6 transition-colors"
            >
              + Allow App
            </button>
          </div>

          {/* Allowed apps */}
          {cls.allowedApps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-surface-muted self-center">Allowed:</span>
              {cls.allowedApps.map((app) => (
                <span key={app} className="text-xs bg-brand-600/10 text-brand-400 border border-brand-600/20 px-2.5 py-1 rounded-full">
                  {app.split('.').pop()}
                </span>
              ))}
            </div>
          )}

          {/* Student list */}
          <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                Students ({cls.students.length})
              </h3>
              <div className="flex items-center gap-4 text-xs text-surface-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-compliance-green inline-block" />
                  {cls.students.filter((s) => s.status === 'COMPLIANT').length} compliant
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-compliance-red inline-block" />
                  {cls.students.filter((s) => s.status !== 'COMPLIANT').length} not
                </span>
              </div>
            </div>

            <div className="divide-y divide-surface-border max-h-[400px] overflow-y-auto">
              {cls.students.length === 0 ? (
                <div className="px-4 py-8 text-center text-surface-muted text-sm">
                  No students enrolled
                </div>
              ) : (
                cls.students
                  .sort((a, b) => {
                    // Non-compliant first
                    const order = { BYPASSING: 0, NON_COMPLIANT: 1, OFFLINE: 2, COMPLIANT: 3 };
                    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                  })
                  .map((student) => (
                    <div key={student.id} onClick={() => openStudent(student.id)} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-border/30 transition-colors">
                      <div className={clsx('w-2.5 h-2.5 rounded-full shrink-0', STATUS_DOT[student.status])} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{student.name}</div>
                        <div className="text-xs text-surface-muted">{STATUS_LABEL[student.status]}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-white tabular-nums">{student.focusScore}</div>
                        <div className="text-xs text-surface-muted">pts</div>
                      </div>
                      {student.violations > 0 && (
                        <div className="text-xs font-bold text-compliance-red bg-compliance-red/10 rounded px-2 py-0.5 shrink-0">
                          {student.violations}×
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-surface-muted">
          No classes assigned
        </div>
      )}

      <StudentDrawer />

      {/* Allow app modal */}
      {showAppModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-white">Allow an App</h3>
            <p className="text-sm text-surface-muted">
              Enter the app bundle ID to temporarily allow during class.
            </p>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="e.g. com.desmos.calculator"
                value={allowAppInput}
                onChange={(e) => setAllowAppInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAllowApp()}
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {['com.desmos.calculator', 'com.google.classroom', 'com.apple.camera'].map((app) => (
                  <button
                    key={app}
                    onClick={() => setAllowAppInput(app)}
                    className="text-xs bg-surface border border-surface-border text-surface-muted hover:text-white px-2.5 py-1 rounded-full transition-colors"
                  >
                    {app.split('.').pop()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAppModal(false); setAllowAppInput(''); }}
                className="flex-1 bg-surface border border-surface-border text-white rounded-xl py-2.5 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAllowApp}
                disabled={!allowAppInput.trim()}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl py-2.5 font-medium transition-colors"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
