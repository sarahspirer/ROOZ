import React from 'react';
import type { Violation } from '../../types';

const LEVEL_COLOR: Record<string, string> = {
  WARNING: '#3b82f6',
  RESTRICTION: '#eab308',
  ADMIN_FLAG: '#f97316',
  ESCALATION: '#ef4444',
};

interface Props {
  violations: Violation[];
  maxBars?: number;
}

export function ViolationSparkline({ violations, maxBars = 20 }: Props) {
  if (violations.length === 0) {
    return (
      <div className="flex items-center justify-center h-12 text-xs text-surface-muted">
        No violations — clean record
      </div>
    );
  }

  // Most recent first, cap at maxBars, then reverse so oldest is left
  const recent = violations.slice(0, maxBars).reverse();
  const maxImpact = Math.max(...recent.map((v) => Math.abs(v.scoreImpact)), 1);

  return (
    <div>
      <div className="flex items-end gap-[3px] h-12">
        {recent.map((v, i) => {
          const heightPct = Math.max(Math.abs(v.scoreImpact) / maxImpact, 0.08);
          const color = LEVEL_COLOR[v.level] ?? '#94a3b8';
          return (
            <div
              key={v.id ?? i}
              className="flex-1 rounded-sm min-w-[4px] group relative"
              style={{ height: `${heightPct * 100}%`, backgroundColor: color, opacity: 0.85 }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl">
                  <div className="font-semibold" style={{ color }}>{v.level}</div>
                  <div className="text-surface-muted mt-0.5">{v.description}</div>
                  <div className="text-compliance-red mt-0.5">{v.scoreImpact} pts</div>
                  <div className="text-surface-muted mt-0.5">
                    {new Date(v.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="w-2 h-2 bg-surface-card border-r border-b border-surface-border rotate-45 -mt-1" />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-surface-muted">
        <span>
          {new Date(recent[0].timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <span>{violations.length} total violation{violations.length !== 1 ? 's' : ''}</span>
        <span>
          {new Date(recent[recent.length - 1].timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
}
