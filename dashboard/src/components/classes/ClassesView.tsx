import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { classesApi } from '../../lib/api';
import { ClassDrillDown } from './ClassDrillDown';

interface ClassItem {
  id: string;
  name: string;
  room?: string;
  grade?: string;
  teacherName?: string;
  enrollmentCount: number;
  isLocked: boolean;
  hasActiveSession: boolean;
}

export function ClassesView() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    classesApi
      .list()
      .then((res) => {
        setClasses(
          res.data.classes.map((c: any) => ({
            id: c.id,
            name: c.name,
            room: c.room,
            grade: c.grade,
            teacherName: c.teacher?.user?.name,
            enrollmentCount: c._count.enrollments,
            isLocked: c.sessions?.[0]?.isLocked ?? false,
            hasActiveSession: c.sessions?.length > 0 && !c.sessions[0].endedAt,
          })),
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (selectedId) {
    return <ClassDrillDown classId={selectedId} onBack={() => { setSelectedId(null); load(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-surface-muted">{classes.length} classes</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 bg-surface-card border border-surface-border rounded-xl animate-pulse" />
            ))
          : classes.map((cls) => (
              <div
                key={cls.id}
                className="bg-surface-card border border-surface-border rounded-xl p-4 cursor-pointer hover:border-brand-500/50 transition-all"
                onClick={() => setSelectedId(cls.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{cls.name}</h3>
                    {cls.room && <div className="text-xs text-surface-muted">Room {cls.room}</div>}
                  </div>
                  {cls.hasActiveSession && (
                    <div className={clsx(
                      'text-xs font-bold px-2 py-1 rounded',
                      cls.isLocked
                        ? 'bg-compliance-red/10 text-compliance-red'
                        : 'bg-compliance-green/10 text-compliance-green',
                    )}>
                      {cls.isLocked ? '🔒 Locked' : '● Active'}
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-1">
                  {cls.teacherName && (
                    <div className="text-sm text-surface-muted">👤 {cls.teacherName}</div>
                  )}
                  <div className="text-sm text-surface-muted">👥 {cls.enrollmentCount} students</div>
                  {cls.grade && <div className="text-sm text-surface-muted">Grade {cls.grade}</div>}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
