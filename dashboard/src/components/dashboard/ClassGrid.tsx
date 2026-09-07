import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { usePhocusStore } from '../../store/phocusStore';
import { reportsApi } from '../../lib/api';
import { AnimatedNumber } from '../ui/AnimatedNumber';

interface HeatCell {
  classId: string;
  className: string;
  room?: string;
  compliancePercent: number;
  total: number;
  compliant: number;
  avgDailyScore: number;
}

function cellAccent(percent: number) {
  if (percent >= 95) return { color: '#34C759', bg: 'rgba(52,199,89,0.08)' };
  if (percent >= 80) return { color: '#FF9500', bg: 'rgba(255,149,0,0.08)' };
  return { color: '#C8102E', bg: 'rgba(200,16,46,0.06)' };
}

export function ClassGrid() {
  const classStatuses = usePhocusStore((s) => s.classStatuses);
  const [cells, setCells] = useState<HeatCell[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi.classHeatmap()
      .then((res) => setCells(res.data.heatmap))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const merged = cells.map((cell) => {
    const live = classStatuses[cell.classId];
    return live ? { ...cell, compliancePercent: live.compliancePercent } : cell;
  });

  return (
    <div className="card">
      <p className="section-label mb-4">class compliance</p>

      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : merged.length === 0 ? (
        <div className="text-center py-8 text-surface-muted text-sm">no classes yet</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {merged.map((cell) => {
            const { color, bg } = cellAccent(cell.compliancePercent);
            return (
              <div
                key={cell.classId}
                className="rounded-xl p-3 transition-all cursor-pointer hover:scale-[1.02]"
                style={{ background: bg }}
              >
                <div className="text-xs font-semibold text-gray-700 truncate lowercase">{cell.className}</div>
                {cell.room && <div className="text-xs text-surface-muted mt-0.5">room {cell.room}</div>}
                <div className="text-3xl font-black mt-2 tabular-nums tracking-tighter" style={{ color }}>
                  <AnimatedNumber
                    value={cell.compliancePercent}
                    format={(v) => `${v}%`}
                    flashClass=""
                  />
                </div>
                <div className="text-xs text-surface-muted mt-1">
                  {cell.compliant}/{cell.total} students
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
