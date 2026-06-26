import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { reportsApi } from '../../lib/api';

interface TrendPoint {
  date: string;
  compliant: number;
  violations: number;
}

const DAYS_OPTIONS = [7, 14, 30];

export function ComplianceTrend() {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsApi
      .complianceTrend(days)
      .then((res) => setData(res.data.trend))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Compliance Trend
        </h3>
        <div className="flex gap-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                days === d
                  ? 'bg-brand-600 text-white'
                  : 'text-surface-muted hover:text-white'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-surface-border rounded-lg animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="compliantGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="violationsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend wrapperStyle={{ color: '#475569', fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="compliant"
              name="Compliant"
              stroke="#22c55e"
              fill="url(#compliantGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="violations"
              name="Violations"
              stroke="#ef4444"
              fill="url(#violationsGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
