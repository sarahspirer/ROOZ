import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useCompliance } from '../../hooks/useCompliance';

export function ComplianceMeter() {
  const { compliance, compliancePercent, color, loading } = useCompliance();
  const [displayPercent, setDisplayPercent] = useState(0);
  const animRef = useRef<number | null>(null);

  // Animate the number on update
  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const start = displayPercent;
    const end = compliancePercent;
    const duration = 800;
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPercent(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      }
    }

    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [compliancePercent]);

  const textColor =
    color === 'green'
      ? 'text-compliance-green'
      : color === 'yellow'
        ? 'text-compliance-yellow'
        : 'text-compliance-red';

  const ringColor =
    color === 'green' ? '#22c55e' : color === 'yellow' ? '#eab308' : '#ef4444';

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (compliancePercent / 100) * circumference;

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-6 flex flex-col items-center">
      <div className="text-sm font-medium text-surface-muted mb-4 uppercase tracking-wider">
        School Compliance
      </div>

      {loading ? (
        <div className="w-48 h-48 rounded-full bg-surface-border animate-pulse" />
      ) : (
        <div className="relative w-48 h-48">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            {/* Background ring */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#334155"
              strokeWidth="12"
            />
            {/* Progress ring */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.8s ease' }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={clsx('text-5xl font-bold tabular-nums', textColor)}>
              {displayPercent}
            </span>
            <span className="text-lg text-surface-muted">%</span>
          </div>
        </div>
      )}

      {/* Stats row */}
      {compliance && (
        <div className="mt-4 grid grid-cols-3 gap-4 w-full text-center">
          <div>
            <div className="text-compliance-green text-lg font-bold">{compliance.compliantCount}</div>
            <div className="text-xs text-surface-muted">Compliant</div>
          </div>
          <div>
            <div className="text-compliance-yellow text-lg font-bold">{compliance.nonCompliantCount}</div>
            <div className="text-xs text-surface-muted">Violations</div>
          </div>
          <div>
            <div className="text-surface-muted text-lg font-bold">{compliance.offlineCount}</div>
            <div className="text-xs text-surface-muted">Offline</div>
          </div>
        </div>
      )}
    </div>
  );
}
