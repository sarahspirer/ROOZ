import React, { useState } from 'react';
import { usePhocusStore } from '../../store/phocusStore';
import { useCompliance } from '../../hooks/useCompliance';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Live Dashboard',
  classes: 'Classes',
  students: 'Students',
  violations: 'Violations',
  rewards: 'Rewards',
  reports: 'Reports',
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function TopBar() {
  const { toggleSidebar, activeView, auth, clearAuth } = usePhocusStore();
  const { compliancePercent, color } = useCompliance();
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [flash, setFlash] = useState<'idle' | 'success' | 'error'>('idle');
  const push = usePushNotifications();

  const colorClass =
    color === 'green'
      ? 'text-compliance-green'
      : color === 'yellow'
        ? 'text-compliance-yellow'
        : 'text-compliance-red';

  const handleReset = async () => {
    setResetting(true);
    setShowConfirm(false);
    try {
      const token = localStorage.getItem('rooz_token');
      const res = await fetch(`${API_URL}/api/simulator/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) throw new Error('Reset failed');
      setFlash('success');
    } catch {
      setFlash('error');
    } finally {
      setResetting(false);
      setTimeout(() => setFlash('idle'), 3000);
    }
  };

  return (
    <>
      <header className="h-14 bg-surface-card border-b border-surface-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded hover:bg-surface-border text-surface-muted hover:text-white transition-colors"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <h1 className="font-semibold text-white">{VIEW_LABELS[activeView] ?? activeView}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Live compliance badge */}
          <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-lg px-3 py-1.5">
            <div className={`w-2 h-2 rounded-full bg-current animate-pulse-slow ${colorClass}`} />
            <span className="text-xs text-surface-muted">School Compliance</span>
            <span className={`text-sm font-bold ${colorClass}`}>{compliancePercent}%</span>
          </div>

          {/* Push notifications toggle */}
          {push.supported && (
            <button
              onClick={push.subscribed ? push.unsubscribe : push.subscribe}
              disabled={push.loading}
              title={push.subscribed ? 'Disable push alerts' : 'Enable push alerts'}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                ${push.subscribed
                  ? 'bg-compliance-green/10 border-compliance-green/30 text-compliance-green hover:bg-compliance-green/20'
                  : 'bg-surface border-surface-border text-surface-muted hover:text-white hover:border-white/20'
                }
                ${push.loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {push.subscribed ? '🔔' : '🔕'}
              {push.subscribed ? 'Alerts On' : 'Alerts Off'}
            </button>
          )}

          {/* Demo Reset button */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={resetting}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
              ${flash === 'success'
                ? 'bg-compliance-green/10 border-compliance-green/40 text-compliance-green'
                : flash === 'error'
                  ? 'bg-compliance-red/10 border-compliance-red/40 text-compliance-red'
                  : 'bg-accent-500/10 border-accent-500/30 text-accent-500 hover:bg-accent-500/20'
              }
              ${resetting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {resetting ? (
              <span className="animate-spin">↻</span>
            ) : flash === 'success' ? (
              '✓'
            ) : flash === 'error' ? (
              '✕'
            ) : (
              '⟳'
            )}
            {resetting ? 'Resetting…' : flash === 'success' ? 'Reset!' : flash === 'error' ? 'Failed' : 'Reset Demo'}
          </button>

          {/* User info */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold text-white">
              {auth.user?.name?.charAt(0) ?? '?'}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-medium text-white">{auth.user?.name}</div>
              <div className="text-xs text-surface-muted capitalize">{auth.user?.role?.toLowerCase()}</div>
            </div>
            <button
              onClick={clearAuth}
              className="ml-2 text-xs text-surface-muted hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent-500/15 border border-accent-500/30 flex items-center justify-center text-xl">
                ⟳
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Reset Demo</h2>
                <p className="text-surface-muted text-xs">This cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-surface-muted mb-6 leading-relaxed">
              All student scores, violations, and streaks will be wiped and the live simulator will restart from a clean slate.
              Use this before a pitch or demo.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-surface-border text-surface-muted hover:text-white hover:border-white/20 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-sm font-bold transition-colors"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
