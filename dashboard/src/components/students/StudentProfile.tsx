import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { FocusRing } from './FocusRing';
import { ViolationSparkline } from './ViolationSparkline';
import { studentsApi, violationsApi, rewardsApi } from '../../lib/api';
import type { Student, Violation } from '../../types';

interface Props {
  studentId: string;
  onBack: () => void;
  hideBackButton?: boolean;
}

const STATUS_STYLES = {
  COMPLIANT: 'bg-compliance-green/10 text-compliance-green',
  NON_COMPLIANT: 'bg-compliance-yellow/10 text-compliance-yellow',
  OFFLINE: 'bg-surface-border text-surface-muted',
  BYPASSING: 'bg-compliance-red/10 text-compliance-red',
};

export function StudentProfile({ studentId, onBack, hideBackButton = false }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      studentsApi.get(studentId),
      violationsApi.student(studentId),
    ])
      .then(([sRes, vRes]) => {
        const raw = sRes.data.student;
        setStudent({
          id: raw.id,
          userId: raw.userId,
          name: raw.user.name,
          email: raw.user.email,
          grade: raw.grade,
          focusScore: raw.focusScore,
          dailyScore: raw.dailyScore,
          weeklyScore: raw.weeklyScore,
          tier: raw.tier,
          streak: raw.streak,
          totalViolations: raw.totalViolations,
          status: raw.status,
          lastSeen: raw.lastSeen,
        });
        setViolations(vRes.data.violations);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-muted">Loading…</div>
    );
  }

  if (!student) {
    return <div className="text-compliance-red p-4">Student not found</div>;
  }

  return (
    <div className="space-y-6">
      {!hideBackButton && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-surface-muted hover:text-white transition-colors"
        >
          ← Back to students
        </button>
      )}

      {/* Profile header */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 flex items-start gap-6">
        <FocusRing score={student.focusScore} tier={student.tier} size={140} />

        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{student.name}</h2>
              <div className="text-surface-muted mt-1">{student.email}</div>
              <div className="text-surface-muted text-sm">Grade {student.grade}</div>
            </div>
            <span className={clsx('text-xs font-bold px-3 py-1 rounded-full', STATUS_STYLES[student.status])}>
              {student.status.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-surface p-3 rounded-lg">
              <div className="text-2xl font-bold text-white">{student.dailyScore}</div>
              <div className="text-xs text-surface-muted mt-1">Today</div>
            </div>
            <div className="bg-surface p-3 rounded-lg">
              <div className="text-2xl font-bold text-white">{student.weeklyScore}</div>
              <div className="text-xs text-surface-muted mt-1">This week</div>
            </div>
            <div className="bg-surface p-3 rounded-lg">
              <div className="text-2xl font-bold text-white">🔥 {student.streak}</div>
              <div className="text-xs text-surface-muted mt-1">Day streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* Violation sparkline */}
      <div className="bg-surface-card border border-surface-border rounded-xl px-5 py-4">
        <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider mb-3">
          Violation History
        </div>
        <ViolationSparkline violations={violations} />
      </div>

      {/* Violations */}
      <div className="bg-surface-card border border-surface-border rounded-xl">
        <div className="px-4 py-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            Recent Violations ({violations.length})
          </h3>
        </div>
        {violations.length === 0 ? (
          <div className="text-center py-8 text-surface-muted text-sm">No violations — keep it up!</div>
        ) : (
          <div className="divide-y divide-surface-border">
            {violations.map((v) => (
              <div key={v.id} className="flex items-start gap-3 px-4 py-3">
                <div className={clsx(
                  'text-xs font-bold px-2 py-1 rounded shrink-0',
                  v.level === 'ESCALATION' ? 'bg-compliance-red/10 text-compliance-red' :
                  v.level === 'ADMIN_FLAG' ? 'bg-orange-500/10 text-orange-400' :
                  v.level === 'RESTRICTION' ? 'bg-compliance-yellow/10 text-compliance-yellow' :
                  'bg-blue-500/10 text-blue-400',
                )}>
                  {v.level}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{v.description}</div>
                  {v.appAttempted && (
                    <div className="text-xs text-surface-muted mt-0.5">App: {v.appAttempted}</div>
                  )}
                </div>
                <div className="text-xs text-compliance-red shrink-0">{v.scoreImpact}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
