import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { studentsApi } from '../../lib/api';
import { StudentProfile } from './StudentProfile';
import type { Student, Tier, ComplianceStatus } from '../../types';

const TIER_BADGE: Record<Tier, string> = {
  BRONZE: 'bg-amber-600/10 text-amber-600',
  SILVER: 'bg-slate-400/10 text-slate-400',
  GOLD: 'bg-yellow-400/10 text-yellow-400',
  ELITE: 'bg-purple-400/10 text-purple-400',
};

const STATUS_DOT: Record<ComplianceStatus, string> = {
  COMPLIANT: 'bg-compliance-green',
  NON_COMPLIANT: 'bg-compliance-yellow',
  OFFLINE: 'bg-surface-muted',
  BYPASSING: 'bg-compliance-red',
};

export function StudentsView() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    studentsApi
      .list(search ? { search } : undefined)
      .then((res) => {
        setStudents(
          res.data.students.map((s: any) => ({
            id: s.id,
            userId: s.userId,
            name: s.user.name,
            email: s.user.email,
            grade: s.grade,
            focusScore: s.focusScore,
            dailyScore: s.dailyScore,
            weeklyScore: s.weeklyScore,
            tier: s.tier,
            streak: s.streak,
            totalViolations: s._count.violations,
            status: s.status,
            lastSeen: s.lastSeen,
          })),
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  if (selectedId) {
    return <StudentProfile studentId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="search"
          placeholder="Search students…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface-card border border-surface-border rounded-lg px-4 py-2 text-sm text-white placeholder-surface-muted focus:outline-none focus:border-brand-500 w-64"
        />
        <div className="text-sm text-surface-muted">{students.length} students</div>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-border">
              {['Name', 'Grade', 'Status', 'Focus Score', 'Daily', 'Tier', 'Streak', 'Violations'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-surface-muted uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-surface-border rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : students.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-surface-border/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedId(s.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white text-sm">{s.name}</div>
                      <div className="text-xs text-surface-muted">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-muted">{s.grade}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-2 h-2 rounded-full', STATUS_DOT[s.status])} />
                        <span className="text-xs text-white">{s.status.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-white tabular-nums">
                      {s.focusScore.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-white tabular-nums">{s.dailyScore}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', TIER_BADGE[s.tier])}>
                        {s.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {s.streak > 0 ? `🔥 ${s.streak}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={s.totalViolations > 0 ? 'text-compliance-red font-bold' : 'text-surface-muted'}>
                        {s.totalViolations}
                      </span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
