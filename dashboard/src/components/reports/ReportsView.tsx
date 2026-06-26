import React, { useEffect, useState } from 'react';
import { ComplianceTrend } from './ComplianceTrend';
import { HeatMapGrid } from './HeatMapGrid';
import { Leaderboard } from '../dashboard/Leaderboard';
import { reportsApi, studentsApi, violationsApi } from '../../lib/api';

interface OverviewMetrics {
  avgCompliance: number;
  totalViolations: number;
  topClass: string;
  worstClass: string;
  repeatOffenders: number;
}

function MetricCard({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className={`text-3xl font-bold ${color} tabular-nums`}>{value}</div>
      {sub && <div className="text-xs text-surface-muted mt-1">{sub}</div>}
    </div>
  );
}

export function ReportsView() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);

  useEffect(() => {
    Promise.all([
      reportsApi.classHeatmap(),
      violationsApi.list(),
      studentsApi.list(),
    ]).then(([heatmapRes, violationsRes, studentsRes]) => {
      const heatmap: any[] = heatmapRes.data.heatmap ?? [];
      const violations: any[] = violationsRes.data.violations ?? [];
      const students: any[] = studentsRes.data.students ?? [];

      const avg =
        heatmap.length > 0
          ? Math.round(heatmap.reduce((s: number, c: any) => s + c.compliancePercent, 0) / heatmap.length)
          : 0;

      const sorted = [...heatmap].sort((a, b) => b.compliancePercent - a.compliancePercent);
      const topClass = sorted[0]?.className ?? '—';
      const worstClass = sorted[sorted.length - 1]?.className ?? '—';

      const repeatOffenders = students.filter((s: any) => s.totalViolations >= 3).length;

      setMetrics({
        avgCompliance: avg,
        totalViolations: violations.length,
        topClass,
        worstClass,
        repeatOffenders,
      });
    }).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Avg Compliance"
          value={metrics ? `${metrics.avgCompliance}%` : '—'}
          color={
            metrics
              ? metrics.avgCompliance >= 95
                ? 'text-compliance-green'
                : metrics.avgCompliance >= 80
                ? 'text-compliance-yellow'
                : 'text-compliance-red'
              : 'text-white'
          }
        />
        <MetricCard
          label="Total Violations"
          value={metrics?.totalViolations ?? '—'}
          sub="last 30 days"
          color="text-compliance-red"
        />
        <MetricCard
          label="Top Class"
          value={metrics?.topClass ?? '—'}
          sub="highest compliance"
          color="text-compliance-green"
        />
        <MetricCard
          label="Needs Attention"
          value={metrics?.worstClass ?? '—'}
          sub="lowest compliance"
          color="text-compliance-yellow"
        />
        <MetricCard
          label="Repeat Offenders"
          value={metrics?.repeatOffenders ?? '—'}
          sub="3+ violations"
          color="text-compliance-red"
        />
      </div>

      {/* Trend chart */}
      <ComplianceTrend />

      {/* Heatmap + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HeatMapGrid />
        </div>
        <Leaderboard />
      </div>
    </div>
  );
}
