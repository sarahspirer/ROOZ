import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { reportsApi } from '../../lib/api';

interface HeatCell {
  classId: string;
  className: string;
  room?: string;
  compliancePercent: number;
  avgDailyScore: number;
  total: number;
  compliant: number;
}

function heatColor(percent: number): string {
  if (percent >= 95) return 'from-compliance-green/30 to-compliance-green/10 border-compliance-green/30';
  if (percent >= 85) return 'from-compliance-green/20 to-compliance-green/5 border-compliance-green/20';
  if (percent >= 75) return 'from-compliance-yellow/30 to-compliance-yellow/10 border-compliance-yellow/30';
  if (percent >= 60) return 'from-orange-500/30 to-orange-500/10 border-orange-500/30';
  return 'from-compliance-red/30 to-compliance-red/10 border-compliance-red/30';
}

export function HeatMapGrid() {
  const [cells, setCells] = useState<HeatCell[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi
      .classHeatmap()
      .then((res) => setCells(res.data.heatmap))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-6">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">
        School Heat Map
      </h3>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-28 bg-surface-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : cells.length === 0 ? (
        <div className="text-center py-12 text-surface-muted">No class data available</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {cells.map((cell) => (
            <div
              key={cell.classId}
              className={clsx(
                'bg-gradient-to-br border rounded-xl p-4 transition-transform hover:scale-[1.02] cursor-default',
                heatColor(cell.compliancePercent),
              )}
            >
              <div className="font-semibold text-white text-sm truncate">{cell.className}</div>
              {cell.room && (
                <div className="text-xs text-white/60 mt-0.5">Rm {cell.room}</div>
              )}
              <div className="text-3xl font-bold text-white mt-3">
                {cell.compliancePercent}%
              </div>
              <div className="text-xs text-white/70 mt-1">
                {cell.compliant}/{cell.total} compliant
              </div>
              <div className="text-xs text-white/50 mt-0.5">
                Avg score: {cell.avgDailyScore}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
