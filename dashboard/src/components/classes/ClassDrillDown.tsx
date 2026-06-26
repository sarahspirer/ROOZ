import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { classesApi } from '../../lib/api';
import { FocusRing } from '../students/FocusRing';

interface Props {
  classId: string;
  onBack: () => void;
}

export function ClassDrillDown({ classId, onBack }: Props) {
  const [cls, setCls] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);

  const load = () => {
    classesApi.get(classId).then((res) => setCls(res.data.class)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, [classId]);

  const activeSession = cls?.sessions?.[0] && !cls.sessions[0].endedAt ? cls.sessions[0] : null;

  const handleStartSession = async () => {
    setSessionLoading(true);
    try {
      await classesApi.startSession(classId);
      load();
    } finally {
      setSessionLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    setSessionLoading(true);
    try {
      await classesApi.endSession(classId, activeSession.id);
      load();
    } finally {
      setSessionLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-surface-muted">Loading…</div>;
  if (!cls) return <div className="text-compliance-red p-4">Class not found</div>;

  const students = cls.enrollments?.map((e: any) => e.student) ?? [];
  const total = students.length;
  const compliant = students.filter((s: any) => s.status === 'COMPLIANT').length;
  const compliancePercent = total > 0 ? Math.round((compliant / total) * 100) : 100;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-surface-muted hover:text-white transition-colors">
        ← Back to classes
      </button>

      <div className="bg-surface-card border border-surface-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{cls.name}</h2>
            {cls.room && <div className="text-surface-muted">Room {cls.room}</div>}
            {cls.teacher && <div className="text-surface-muted text-sm mt-1">Teacher: {cls.teacher.user.name}</div>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={clsx(
              'text-2xl font-bold',
              compliancePercent >= 95 ? 'text-compliance-green' :
              compliancePercent >= 80 ? 'text-compliance-yellow' : 'text-compliance-red',
            )}>
              {compliancePercent}% compliant
            </div>
            <div className="flex gap-2">
              {activeSession ? (
                <button
                  onClick={handleEndSession}
                  disabled={sessionLoading}
                  className="px-4 py-2 bg-compliance-red/10 text-compliance-red border border-compliance-red/30 rounded-lg text-sm font-medium hover:bg-compliance-red/20 transition-colors disabled:opacity-50"
                >
                  🔓 End Session
                </button>
              ) : (
                <button
                  onClick={handleStartSession}
                  disabled={sessionLoading}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  🔒 Start Session
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Student grid */}
      <div className="bg-surface-card border border-surface-border rounded-xl">
        <div className="px-4 py-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            Students ({total})
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
          {students.map((s: any) => (
            <div
              key={s.id}
              className={clsx(
                'flex flex-col items-center gap-2 p-3 rounded-xl border',
                s.status === 'COMPLIANT' ? 'border-compliance-green/20 bg-compliance-green/5' :
                s.status === 'BYPASSING' ? 'border-compliance-red/20 bg-compliance-red/5' :
                s.status === 'NON_COMPLIANT' ? 'border-compliance-yellow/20 bg-compliance-yellow/5' :
                'border-surface-border bg-surface',
              )}
            >
              <FocusRing score={s.dailyScore ?? 0} maxScore={500} tier={s.tier} size={64} strokeWidth={6} showLabel={false} />
              <div className="text-xs text-white text-center font-medium truncate w-full">
                {s.user?.name?.split(' ')[0]}
              </div>
              <div className="text-xs text-surface-muted">{s.status === 'COMPLIANT' ? '✓' : s.status === 'BYPASSING' ? '🚫' : s.status === 'OFFLINE' ? '○' : '⚠'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
