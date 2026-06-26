import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Tier } from '../../types';

interface FocusRingProps {
  score: number;
  maxScore?: number;
  tier: Tier;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

const TIER_COLORS: Record<Tier, string> = {
  BRONZE: '#b45309',
  SILVER: '#94a3b8',
  GOLD: '#eab308',
  ELITE: '#a855f7',
};

const TIER_TEXT: Record<Tier, string> = {
  BRONZE: 'text-amber-600',
  SILVER: 'text-slate-400',
  GOLD: 'text-yellow-400',
  ELITE: 'text-purple-400',
};

export function FocusRing({
  score,
  maxScore = 3000,
  tier,
  size = 120,
  strokeWidth = 10,
  showLabel = true,
}: FocusRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPercent = Math.min(score / maxScore, 1);

  const [animatedOffset, setAnimatedOffset] = useState(circumference);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const targetOffset = circumference - fillPercent * circumference;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const start = animatedOffset;
    const end = targetOffset;
    const duration = 600;
    const startTime = performance.now();

    function step(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      setAnimatedOffset(start + (end - start) * eased);
      if (progress < 1) animRef.current = requestAnimationFrame(step);
    }

    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [score, maxScore]);

  const color = TIER_COLORS[tier];
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#334155"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
        />
      </svg>
      {/* Center content - positioned absolutely over SVG */}
      <div
        className="flex flex-col items-center justify-center"
        style={{ marginTop: -(size + 4) }}
      >
        <span
          className="font-bold tabular-nums"
          style={{ fontSize: size * 0.2 }}
        >
          {score.toLocaleString()}
        </span>
        {showLabel && (
          <span className={clsx('text-xs font-semibold', TIER_TEXT[tier])}>{tier}</span>
        )}
      </div>
      {showLabel && (
        <div style={{ marginTop: size * 0.05 }} />
      )}
    </div>
  );
}
