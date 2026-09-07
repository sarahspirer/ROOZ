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

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function StudentsView() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const lines = importText.trim().split('\n').filter(Boolean);
      const rows = lines.map((line) => {
        const [name, email, grade, password] = line.split(',').map((s) => s.trim());
        return { name, email, grade, password };
      }).filter((r) => r.name && r.email && r.grade);

      const token = localStorage.getItem('rooz_token');
      const res = await fetch(`${API_URL}/api/students/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setImportResult(data);
      if (data.created > 0) {
        // Refresh list
        const updated = await studentsApi.list();
        setStudents(updated.data.students.map((s: any) => ({
          id: s.id, userId: s.userId, name: s.user.name, email: s.user.email, grade: s.grade,
          focusScore: s.focusScore, dailyScore: s.dailyScore, weeklyScore: s.weeklyScore,
          tier: s.tier, streak: s.streak, totalViolations: s._count.violations, status: s.status, lastSeen: s.lastSeen,
        })));
      }
    } catch { setImportResult({ created: 0, skipped: 0, errors: ['Import failed'] }); }
    finally { setImporting(false); }
  };

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
          className="card px-4 py-2 text-sm text-gray-900 placeholder-surface-muted focus:outline-none focus:border-brand-500 w-64"
        />
        <div className="text-sm text-surface-muted">{students.length} students</div>
        <button
          onClick={() => setShowImport(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-brand-500/40 bg-brand-600/10 text-brand-400 hover:bg-brand-600/20 transition-all"
        >
          ⬆ Import CSV
        </button>
      </div>

      {/* CSV Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-lg mx-4 shadow-2xl">
            <h2 className="text-gray-900 font-bold text-lg mb-1">Import Students</h2>
            <p className="text-surface-muted text-xs mb-4">One student per line: <code className="bg-surface px-1 rounded text-brand-400">Name, email@school.edu, Grade, password</code> (password optional, defaults to "password")</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"Emma Johnson, emma@student.rooz.school, 10\nJake Smith, jake@student.rooz.school, 11, mypassword"}
              rows={8}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-gray-900 text-xs font-mono placeholder-surface-muted focus:outline-none focus:border-brand-500 resize-none mb-4"
            />
            {importResult && (
              <div className="mb-4 p-3 rounded-lg bg-surface border border-surface-border text-xs space-y-1">
                <div className="text-compliance-green">✓ Created: {importResult.created}</div>
                <div className="text-surface-muted">↷ Skipped (already exist): {importResult.skipped}</div>
                {importResult.errors.map((e, i) => <div key={i} className="text-compliance-red">✕ {e}</div>)}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowImport(false); setImportResult(null); setImportText(''); }} className="flex-1 py-2.5 rounded-xl border border-surface-border text-surface-muted hover:text-gray-900 transition-colors text-sm font-medium">Close</button>
              <button onClick={handleImport} disabled={importing || !importText.trim()} className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-gray-900 text-sm font-bold transition-colors disabled:opacity-50">
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
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
                      <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                      <div className="text-xs text-surface-muted">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-muted">{s.grade}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-2 h-2 rounded-full', STATUS_DOT[s.status])} />
                        <span className="text-xs text-gray-900">{s.status.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 tabular-nums">
                      {s.focusScore.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 tabular-nums">{s.dailyScore}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', TIER_BADGE[s.tier])}>
                        {s.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
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
