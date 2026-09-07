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

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function ReportsView() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('rooz_token');
      const res = await fetch(`${API_URL}/api/reports/compliance-export`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const data = await res.json();

      // Build a clean text report and download as JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rooz-compliance-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
    finally { setExporting(false); }
  };

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
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Compliance Reports</h2>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-brand-500/40 bg-brand-600/10 text-brand-400 hover:bg-brand-600/20 transition-all disabled:opacity-50"
        >
          {exporting ? '…' : '⬇'} Export Report
        </button>
      </div>

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
