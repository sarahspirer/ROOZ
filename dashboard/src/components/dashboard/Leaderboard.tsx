import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { reportsApi } from '../../lib/api';
import { usePhocusStore } from '../../store/phocusStore';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import type { LeaderboardEntry, Tier } from '../../types';

const TIER_COLORS: Record<Tier, string> = {
  BRONZE: 'text-amber-600',
  SILVER: 'text-slate-400',
  GOLD: 'text-yellow-400',
  ELITE: 'text-purple-400',
};

const TIER_BG: Record<Tier, string> = {
  BRONZE: 'bg-amber-600/10',
  SILVER: 'bg-slate-400/10',
  GOLD: 'bg-yellow-400/10',
  ELITE: 'bg-purple-400/10',
};

const RANK_ICONS = ['🥇', '🥈', '🥉'];

export function Leaderboard() {
  const { openStudent, studentScores } = usePhocusStore((s) => ({ openStudent: s.openStudent, studentScores: s.studentScores }));
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi
      .leaderboard(10)
      .then((res) => setEntries(res.data.leaderboard))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card flex flex-col">
      <p className="section-label mb-4">focus leaderboard</p>

      <div className="space-y-1">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-6 h-4 bg-surface rounded animate-pulse" />
                <div className="flex-1 h-4 bg-surface rounded animate-pulse" />
                <div className="w-12 h-4 bg-surface rounded animate-pulse" />
              </div>
            ))
          : entries.map((entry, idx) => (
              <div
                key={entry.id}
                onClick={() => openStudent(entry.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-surface transition-colors"
              >
                <div className="w-6 text-center text-sm shrink-0 font-bold">
                  {idx < 3 ? RANK_ICONS[idx] : <span className="text-surface-muted text-xs">{idx + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{entry.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={clsx('text-xs font-bold lowercase', TIER_COLORS[entry.tier])}>
                      {entry.tier.toLowerCase()}
                    </span>
                    {entry.streak > 0 && (
                      <span className="text-xs text-surface-muted">· 🔥 {entry.streak}d</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <AnimatedNumber
                    value={studentScores[entry.id]?.focusScore ?? entry.focusScore}
                    format={(v) => v.toLocaleString()}
                    className="text-sm font-black text-gray-900 tabular-nums"
                    flashClass="text-compliance-green"
                  />
                  <div className="text-xs text-surface-muted">pts</div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
