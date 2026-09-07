import React, { useState } from 'react';
import { usePhocusStore } from '../../store/phocusStore';
import { useCompliance } from '../../hooks/useCompliance';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'live dashboard',
  classes: 'classes',
  students: 'students',
  violations: 'violations',
  rewards: 'rewards',
  reports: 'reports',
  settings: 'settings',
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
      <header className="h-14 bg-white border-b border-surface-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-surface text-surface-muted hover:text-gray-900 transition-colors"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <h1 className="font-bold text-gray-900 lowercase tracking-tight">{VIEW_LABELS[activeView] ?? activeView}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Live compliance pill */}
          <div className="flex items-center gap-2 bg-surface rounded-xl px-3 py-1.5">
            <div className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse-slow ${colorClass}`} />
            <span className={`text-sm font-black tabular-nums ${colorClass}`}>{compliancePercent}%</span>
            <span className="text-xs text-surface-muted">compliance</span>
          </div>

          {/* Emergency */}
          <button
            onClick={() => setShowEmergency(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-compliance-red text-white hover:opacity-90 transition-all"
          >
            🚨 emergency
          </button>

          {/* Announce */}
          <button
            onClick={() => setShowAnnounce(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface text-gray-600 hover:bg-surface-border transition-all"
          >
            📢 announce
          </button>

          {/* Push toggle */}
          {push.supported && (
            <button
              onClick={push.subscribed ? push.unsubscribe : push.subscribe}
              disabled={push.loading}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${push.loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${push.subscribed ? 'bg-compliance-green/10 text-compliance-green' : 'bg-surface text-surface-muted hover:bg-surface-border'}`}
            >
              {push.subscribed ? '🔔 on' : '🔕 off'}
            </button>
          )}

          {/* Reset demo */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={resetting}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${resetting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${flash === 'success' ? 'bg-compliance-green/10 text-compliance-green' : flash === 'error' ? 'bg-compliance-red/10 text-compliance-red' : 'bg-surface text-surface-muted hover:bg-surface-border'}`}
          >
            {resetting ? '↻' : flash === 'success' ? '✓ reset' : flash === 'error' ? '✕ failed' : '⟳ reset demo'}
          </button>

          {/* User */}
          <div className="flex items-center gap-2 pl-1 border-l border-surface-border ml-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: '#C8102E' }}>
              {auth.user?.name?.charAt(0) ?? '?'}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-gray-900 leading-tight">{auth.user?.name}</div>
              <div className="text-xs text-surface-muted lowercase">{auth.user?.role?.toLowerCase()}</div>
            </div>
            <button onClick={clearAuth} className="ml-1 text-xs text-surface-muted hover:text-gray-900 transition-colors lowercase">out</button>
          </div>
        </div>
      </header>

      {/* Emergency Mode modal */}
      {showEmergency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            {emergencyDone ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">🔓</div>
                <h2 className="text-compliance-green font-bold text-xl mb-2">All Devices Unlocked</h2>
                <p className="text-surface-muted text-sm">Students have been notified.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-compliance-red/10 flex items-center justify-center text-xl">🚨</div>
                  <div>
                    <h2 className="text-gray-900 font-bold text-lg">Emergency Mode</h2>
                    <p className="text-compliance-red text-xs font-semibold">CAMPUS-WIDE UNLOCK</p>
                  </div>
                </div>
                <p className="text-sm text-surface-muted mb-6 leading-relaxed">
                  This will instantly unlock <strong className="text-gray-900">every student device</strong> on campus, end all class sessions, and send an emergency notification.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowEmergency(false)} className="flex-1 py-2.5 rounded-xl bg-surface text-gray-700 text-sm font-medium hover:bg-surface-border transition-colors">Cancel</button>
                  <button onClick={handleEmergencyUnlock} disabled={emergencyLoading} className="flex-1 py-2.5 rounded-xl bg-compliance-red text-white text-sm font-bold transition-colors disabled:opacity-50 hover:opacity-90">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-xl">📢</div>
              <div>
                <h2 className="text-gray-900 font-bold text-lg">Send Announcement</h2>
                <p className="text-surface-muted text-xs">Pushes to all student lock screens</p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              <input
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="Title (e.g. Lunch in the gym today)"
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-surface-muted focus:outline-none focus:border-brand-500"
              />
              <textarea
                value={announceBody}
                onChange={(e) => setAnnounceBody(e.target.value)}
                placeholder="Message body…"
                rows={3}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-surface-muted focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>
            {announceFlash === 'sent' && <p className="text-compliance-green text-xs mb-3">✓ Sent to all students</p>}
            {announceFlash === 'error' && <p className="text-compliance-red text-xs mb-3">Failed to send. Try again.</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowAnnounce(false)} className="flex-1 py-2.5 rounded-xl bg-surface text-gray-700 text-sm font-medium hover:bg-surface-border transition-colors">Cancel</button>
              <button onClick={handleAnnounce} disabled={announceSending || !announceTitle.trim() || !announceBody.trim()} className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-50 hover:opacity-90" style={{ background: '#C8102E' }}>
                {announceSending ? 'Sending…' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-xl">⟳</div>
              <div>
                <h2 className="text-gray-900 font-bold text-lg">Reset Demo</h2>
                <p className="text-surface-muted text-xs">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-surface-muted mb-6 leading-relaxed">
              All student scores, violations, and streaks will be wiped. Use this before a pitch or demo.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-surface text-gray-700 text-sm font-medium hover:bg-surface-border transition-colors">Cancel</button>
              <button onClick={handleReset} className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors hover:opacity-90" style={{ background: '#C8102E' }}>Yes, Reset</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
