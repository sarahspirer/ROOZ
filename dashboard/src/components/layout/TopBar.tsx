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

  // Emergency Mode
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyDone, setEmergencyDone] = useState(false);

  // Announcement
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announceSending, setAnnounceSending] = useState(false);
  const [announceFlash, setAnnounceFlash] = useState<'idle' | 'sent' | 'error'>('idle');

  const handleEmergencyUnlock = async () => {
    setEmergencyLoading(true);
    try {
      const token = localStorage.getItem('rooz_token');
      await fetch(`${API_URL}/api/emergency/unlock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      setEmergencyDone(true);
      setTimeout(() => { setEmergencyDone(false); setShowEmergency(false); }, 3000);
    } catch { /* ignore */ }
    finally { setEmergencyLoading(false); }
  };

  const handleAnnounce = async () => {
    if (!announceTitle.trim() || !announceBody.trim()) return;
    setAnnounceSending(true);
    try {
      const token = localStorage.getItem('rooz_token');
      const res = await fetch(`${API_URL}/api/emergency/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ title: announceTitle.trim(), body: announceBody.trim() }),
      });
      if (!res.ok) throw new Error();
      setAnnounceFlash('sent');
      setAnnounceTitle(''); setAnnounceBody('');
      setTimeout(() => { setAnnounceFlash('idle'); setShowAnnounce(false); }, 2000);
    } catch { setAnnounceFlash('error'); setTimeout(() => setAnnounceFlash('idle'), 3000); }
    finally { setAnnounceSending(false); }
  };

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

          {/* Emergency Mode */}
          <button
            onClick={() => setShowEmergency(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-compliance-red/40 bg-compliance-red/10 text-compliance-red hover:bg-compliance-red/20 transition-all"
          >
            🚨 Emergency
          </button>

          {/* Announce */}
          <button
            onClick={() => setShowAnnounce(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-surface-border bg-surface text-surface-muted hover:text-white hover:border-white/20 transition-all"
          >
            📢 Announce
          </button>

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

      {/* Emergency Mode modal */}
      {showEmergency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-card border border-compliance-red/40 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            {emergencyDone ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">🔓</div>
                <h2 className="text-compliance-green font-bold text-xl mb-2">All Devices Unlocked</h2>
                <p className="text-surface-muted text-sm">Students have been notified. Emergency mode active.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-compliance-red/15 border border-compliance-red/40 flex items-center justify-center text-xl">🚨</div>
                  <div>
                    <h2 className="text-white font-bold text-lg">Emergency Mode</h2>
                    <p className="text-compliance-red text-xs font-semibold">CAMPUS-WIDE UNLOCK</p>
                  </div>
                </div>
                <p className="text-sm text-surface-muted mb-6 leading-relaxed">
                  This will instantly unlock <strong className="text-white">every student device</strong> on campus, end all class sessions, and send an emergency notification to all students. Use only in a real emergency.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowEmergency(false)} className="flex-1 py-2.5 rounded-xl border border-surface-border text-surface-muted hover:text-white transition-colors text-sm font-medium">Cancel</button>
                  <button onClick={handleEmergencyUnlock} disabled={emergencyLoading} className="flex-1 py-2.5 rounded-xl bg-compliance-red hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
                    {emergencyLoading ? 'Unlocking…' : '🔓 Unlock All Now'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Announcement modal */}
      {showAnnounce && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-brand-600/15 border border-brand-600/30 flex items-center justify-center text-xl">📢</div>
              <div>
                <h2 className="text-white font-bold text-lg">Send Announcement</h2>
                <p className="text-surface-muted text-xs">Pushes to all student lock screens</p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              <input
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="Title (e.g. Lunch in the gym today)"
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm placeholder-surface-muted focus:outline-none focus:border-brand-500"
              />
              <textarea
                value={announceBody}
                onChange={(e) => setAnnounceBody(e.target.value)}
                placeholder="Message body…"
                rows={3}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-white text-sm placeholder-surface-muted focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>
            {announceFlash === 'sent' && <p className="text-compliance-green text-xs mb-3">✓ Announcement sent to all students</p>}
            {announceFlash === 'error' && <p className="text-compliance-red text-xs mb-3">Failed to send. Try again.</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowAnnounce(false)} className="flex-1 py-2.5 rounded-xl border border-surface-border text-surface-muted hover:text-white transition-colors text-sm font-medium">Cancel</button>
              <button onClick={handleAnnounce} disabled={announceSending || !announceTitle.trim() || !announceBody.trim()} className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {announceSending ? 'Sending…' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}

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
