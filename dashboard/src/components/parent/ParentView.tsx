import React, { useEffect, useState } from 'react';
import { usePhocusStore } from '../../store/phocusStore';


const TIER_COLOR: Record<string, string> = {
  BRONZE: '#d97706', SILVER: '#94a3b8', GOLD: '#eab308', ELITE: '#a855f7',
};
const STATUS_COLOR: Record<string, string> = {
  COMPLIANT: '#22c55e', NON_COMPLIANT: '#f97316', OFFLINE: '#555555', BYPASSING: '#ef4444',
};
const STATUS_LABEL: Record<string, string> = {
  COMPLIANT: 'In Focus', NON_COMPLIANT: 'Distracted', OFFLINE: 'Offline', BYPASSING: 'Bypassing',
};

interface Child {
  id: string; name: string; grade: string;
  focusScore: number; dailyScore: number; weeklyScore: number;
  tier: string; streak: number; status: string; totalViolations: number;
  recentViolations: { id: string; description: string; level: string; timestamp: string }[];
  classes: { name: string; room: string }[];
}

export function ParentView() {
  const { auth } = usePhocusStore();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('rooz_token');
    fetch(`/api/parents/me/children`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setChildren(d.children ?? []);
        if (d.children?.length > 0) setSelected(d.children[0].id);
      })
      .catch(() => setError('Could not load your child\'s data.'))
      .finally(() => setLoading(false));
  }, []);

  const child = children.find((c) => c.id === selected);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || children.length === 0) return (
    <div className="flex-1 flex items-center justify-center text-surface-muted">
      {error || 'No children linked to this account.'}
    </div>
  );

  const tierColor = TIER_COLOR[child!.tier] ?? '#f97316';
  const statusColor = STATUS_COLOR[child!.status] ?? '#555';
  const maxScore = child!.tier === 'ELITE' ? 3000 : child!.tier === 'GOLD' ? 1500 : child!.tier === 'SILVER' ? 500 : 200;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl mx-auto w-full">

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex gap-2">
          {children.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                selected === c.id
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-surface-card border-surface-border text-surface-muted hover:text-white'
              }`}>
              {c.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Header card */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{child!.name}</h2>
            <p className="text-surface-muted text-sm">Grade {child!.grade} · {child!.classes.map(c => c.name).join(', ')}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border"
            style={{ color: statusColor, borderColor: statusColor + '40', backgroundColor: statusColor + '15' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
            {STATUS_LABEL[child!.status]}
          </div>
        </div>

        {/* Score ring row */}
        <div className="flex items-center gap-6">
          {/* Progress bar */}
          <div className="flex-1">
            <div className="flex justify-between text-xs text-surface-muted mb-1.5">
              <span style={{ color: tierColor, fontWeight: 600 }}>{child!.tier}</span>
              <span>{child!.focusScore.toLocaleString()} pts</span>
            </div>
            <div className="h-3 bg-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min((child!.focusScore / maxScore) * 100, 100)}%`, backgroundColor: tierColor }} />
            </div>
            <div className="text-xs text-surface-muted mt-1">
              {Math.max(0, maxScore - child!.focusScore).toLocaleString()} pts to next tier
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Today', value: child!.dailyScore, color: '#f97316' },
          { label: 'This Week', value: child!.weeklyScore, color: '#a855f7' },
          { label: 'Day Streak', value: `🔥 ${child!.streak}`, color: '#22c55e' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-card border border-surface-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold" style={{ color }}>{value}</div>
            <div className="text-xs text-surface-muted mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Violations */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Recent Activity</h3>
          {child!.totalViolations > 0 && (
            <span className="text-xs bg-compliance-red/15 text-compliance-red border border-compliance-red/30 px-2 py-0.5 rounded-full">
              {child!.totalViolations} total violation{child!.totalViolations !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {child!.recentViolations.length === 0 ? (
          <div className="text-sm text-surface-muted text-center py-4">
            ✓ No violations — great focus!
          </div>
        ) : (
          <div className="space-y-2">
            {child!.recentViolations.map((v) => (
              <div key={v.id} className="flex items-start gap-3 py-2 border-b border-surface-border last:border-0">
                <span className={`text-xs font-bold mt-0.5 ${v.level === 'ESCALATION' ? 'text-compliance-red' : 'text-brand-500'}`}>
                  {v.level === 'ESCALATION' ? '🚨' : '⚠'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{v.description}</p>
                  <p className="text-xs text-surface-muted mt-0.5">
                    {new Date(v.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tip */}
      <p className="text-xs text-surface-muted text-center pb-4">
        Scores update in real time. Talk to your child's teacher for questions about violations.
      </p>
    </div>
  );
}
