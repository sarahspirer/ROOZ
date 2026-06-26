import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { usePhocusStore } from '../../store/phocusStore';
import type { ActivityEvent } from '../../types';


const SEVERITY_STYLES: Record<ActivityEvent['severity'], string> = {
  info: 'text-brand-500 bg-brand-500/10',
  warning: 'text-compliance-yellow bg-compliance-yellow/10',
  critical: 'text-compliance-red bg-compliance-red/10',
};

const TYPE_ICONS: Record<string, string> = {
  HEARTBEAT: '♥',
  VIOLATION: '⚠',
  BYPASS_ATTEMPT: '🚫',
  LOCK: '🔒',
  UNLOCK: '🔓',
  REWARD_EARNED: '★',
  TIER_CHANGE: '▲',
  SCORE_UPDATE: '↑',
  PARENT_ALERT: '📞',
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function ActivityFeed() {
  const { activityFeed, openStudent } = usePhocusStore((s) => ({ activityFeed: s.activityFeed, openStudent: s.openStudent }));
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Live Activity</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-compliance-green animate-pulse" />
          <span className="text-xs text-surface-muted">Live</span>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain">
        {activityFeed.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-surface-muted text-sm">
            Waiting for events…
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {activityFeed.map((event, idx) => (
              <div
                key={event.id}
                onClick={() => event.studentId && openStudent(event.studentId)}
                className={clsx(
                  'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-border/30 cursor-pointer',
                  idx === 0 && 'animate-scroll-up',
                )}
              >
                <div
                  className={clsx(
                    'w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5',
                    SEVERITY_STYLES[event.severity],
                  )}
                >
                  {TYPE_ICONS[event.type] ?? '•'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {event.studentName || 'Student'}
                    </span>
                    <span className="text-xs text-surface-muted shrink-0">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-surface-muted mt-0.5 truncate">{event.description}</p>
                  {event.className && (
                    <span className="text-xs text-brand-500 mt-0.5 inline-block">
                      {event.className}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
