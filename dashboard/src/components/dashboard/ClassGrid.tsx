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

function cellColor(percent: number): string {
  if (percent >= 95) return 'bg-compliance-green/20 border-compliance-green/40 text-compliance-green';
  if (percent >= 80) return 'bg-compliance-yellow/20 border-compliance-yellow/40 text-compliance-yellow';
  return 'bg-compliance-red/20 border-compliance-red/40 text-compliance-red';
}

export function ClassGrid() {
  const classStatuses = usePhocusStore((s) => s.classStatuses);
  const [cells, setCells] = useState<HeatCell[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi
      .classHeatmap()
      .then((res) => setCells(res.data.heatmap))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Merge live socket updates
  const merged = cells.map((cell) => {
    const live = classStatuses[cell.classId];
    if (live) return { ...cell, compliancePercent: live.compliancePercent };
    return cell;
  });

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
        Class Compliance Heat Map
      </h3>

      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-surface-border animate-pulse" />
          ))}
        </div>
      ) : merged.length === 0 ? (
        <div className="text-center py-8 text-surface-muted text-sm">No classes found</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {merged.map((cell) => (
            <div
              key={cell.classId}
              className={clsx(
                'border rounded-lg p-3 transition-all cursor-pointer hover:scale-[1.02]',
                cellColor(cell.compliancePercent),
              )}
            >
              <div className="font-semibold text-sm truncate">{cell.className}</div>
              {cell.room && <div className="text-xs opacity-70 mt-0.5">Room {cell.room}</div>}
              <div className="text-2xl font-bold mt-2">
                <AnimatedNumber
                  value={cell.compliancePercent}
                  format={(v) => `${v}%`}
                  flashClass={cell.compliancePercent >= 80 ? 'text-compliance-green' : 'text-compliance-red'}
                />
              </div>
              <div className="text-xs opacity-70 mt-1">
                {cell.compliant}/{cell.total} students
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
