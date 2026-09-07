import React, { useEffect, useRef, useState } from 'react';
import { useCompliance } from '../../hooks/useCompliance';

export function ComplianceMeter() {
  const { compliance, compliancePercent, color, loading } = useCompliance();
  const [displayPercent, setDisplayPercent] = useState(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const start = displayPercent;
    const end = compliancePercent;
    const duration = 900;
    const startTime = performance.now();
    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPercent(Math.round(start + (end - start) * eased));
      if (progress < 1) animRef.current = requestAnimationFrame(step);
    }
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [compliancePercent]);

  const ringColor = color === 'green' ? '#34C759' : color === 'yellow' ? '#FF9500' : '#C8102E';
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (compliancePercent / 100) * circumference;

  return (
    <div className="card flex flex-col">
      <p className="section-label mb-4">school compliance</p>

      {loading ? (
        <div className="w-40 h-40 rounded-full bg-surface animate-pulse mx-auto" />
      ) : (
        <div className="relative w-40 h-40 mx-auto">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 176 176">
            <circle cx="88" cy="88" r={radius} fill="none" stroke="#F2F2F7" strokeWidth="10" />
            <circle
              cx="88" cy="88" r={radius} fill="none"
              stroke={ringColor} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-black text-5xl tabular-nums tracking-tighter" style={{ color: ringColor }}>{displayPercent}</span>
            <span className="text-sm text-surface-muted font-medium">%</span>
          </div>
        </div>
      )}

      {compliance && (
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-black text-compliance-green">{compliance.compliantCount}</div>
            <div className="stat-label">on task</div>
          </div>
          <div>
            <div className="text-2xl font-black text-compliance-yellow">{compliance.nonCompliantCount}</div>
            <div className="stat-label">off task</div>
          </div>
          <div>
            <div className="text-2xl font-black text-surface-muted">{compliance.offlineCount}</div>
            <div className="stat-label">offline</div>
          </div>
        </div>
      )}
    </div>
  );
}
