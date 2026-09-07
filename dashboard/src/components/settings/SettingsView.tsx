import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface SchoolSettings {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  geofenceRadius: number;
  schoolHoursStart: string;
  schoolHoursEnd: string;
  graceMinutes: number;
  allowedApps: string[];
  policyEmailsEnabled: boolean;
}

const COMMON_APPS = [
  { id: 'com.google.ios.apps.classroom', label: 'Google Classroom' },
  { id: 'com.microsoft.teams', label: 'Microsoft Teams' },
  { id: 'com.instructure.icanvas', label: 'Canvas' },
  { id: 'com.schoology.Schoology', label: 'Schoology' },
  { id: 'com.google.chrome.ios', label: 'Chrome' },
  { id: 'com.apple.mobilemail', label: 'Mail' },
  { id: 'com.apple.mobilecal', label: 'Calendar' },
  { id: 'com.kahoot.kahoot', label: 'Kahoot' },
  { id: 'com.duolingo.duolingo', label: 'Duolingo' },
  { id: 'com.quizlet.quizlet', label: 'Quizlet' },
];

export function SettingsView() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const token = localStorage.getItem('rooz_token');
    fetch(`${API_URL}/api/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSettings(d.school))
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('rooz_token');
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      setFlash('saved');
    } catch { setFlash('error'); }
    finally {
      setSaving(false);
      setTimeout(() => setFlash('idle'), 3000);
    }
  };

  const toggleApp = (appId: string) => {
    if (!settings) return;
    const has = settings.allowedApps.includes(appId);
    setSettings({ ...settings, allowedApps: has ? settings.allowedApps.filter(a => a !== appId) : [...settings.allowedApps, appId] });
  };

  if (!settings) return (
    <div className="flex items-center justify-center h-64 text-surface-muted text-sm lowercase">loading…</div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* School hours */}
      <div className="card">
        <p className="section-label mb-4">school hours</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-surface-muted lowercase block mb-1.5">start</label>
            <input
              type="time"
              value={settings.schoolHoursStart}
              onChange={e => setSettings({ ...settings, schoolHoursStart: e.target.value })}
              className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-900 font-semibold focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-xs text-surface-muted lowercase block mb-1.5">end</label>
            <input
              type="time"
              value={settings.schoolHoursEnd}
              onChange={e => setSettings({ ...settings, schoolHoursEnd: e.target.value })}
              className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-900 font-semibold focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Grace period */}
      <div className="card">
        <p className="section-label mb-1">grace period</p>
        <p className="text-xs text-surface-muted mb-4">minutes students have to lock in after arriving on campus</p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1} max={15}
            value={settings.graceMinutes}
            onChange={e => setSettings({ ...settings, graceMinutes: Number(e.target.value) })}
            className="flex-1 accent-brand-500"
          />
          <span className="text-3xl font-black w-12 text-right tabular-nums" style={{ color: '#C8102E' }}>
            {settings.graceMinutes}
          </span>
          <span className="text-xs text-surface-muted">min</span>
        </div>
      </div>

      {/* Geofence */}
      <div className="card">
        <p className="section-label mb-1">campus geofence</p>
        <p className="text-xs text-surface-muted mb-4">set your school's coordinates and radius</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-surface-muted lowercase block mb-1.5">latitude</label>
            <input
              type="number" step="0.000001"
              value={settings.lat ?? ''}
              onChange={e => setSettings({ ...settings, lat: parseFloat(e.target.value) || null })}
              placeholder="25.761681"
              className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-xs text-surface-muted lowercase block mb-1.5">longitude</label>
            <input
              type="number" step="0.000001"
              value={settings.lng ?? ''}
              onChange={e => setSettings({ ...settings, lng: parseFloat(e.target.value) || null })}
              placeholder="-80.191790"
              className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-surface-muted lowercase block mb-1.5">radius (meters)</label>
          <div className="flex items-center gap-4">
            <input
              type="range" min={50} max={1000} step={25}
              value={settings.geofenceRadius}
              onChange={e => setSettings({ ...settings, geofenceRadius: Number(e.target.value) })}
              className="flex-1 accent-brand-500"
            />
            <span className="text-xl font-black tabular-nums w-16 text-right" style={{ color: '#C8102E' }}>
              {settings.geofenceRadius}m
            </span>
          </div>
        </div>
      </div>

      {/* Allowed apps */}
      <div className="card">
        <p className="section-label mb-1">allowed apps during lock-in</p>
        <p className="text-xs text-surface-muted mb-4">these apps stay available when a student's phone is locked</p>
        <div className="space-y-2">
          {COMMON_APPS.map(app => (
            <button
              key={app.id}
              onClick={() => toggleApp(app.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left ${
                settings.allowedApps.includes(app.id)
                  ? 'bg-compliance-green/8 border border-compliance-green/30'
                  : 'bg-surface border border-transparent hover:border-surface-border'
              }`}
            >
              <span className="text-sm font-medium text-gray-900">{app.label}</span>
              <span className={`text-xs font-bold ${settings.allowedApps.includes(app.id) ? 'text-compliance-green' : 'text-surface-muted'}`}>
                {settings.allowedApps.includes(app.id) ? '✓ allowed' : 'blocked'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Policy emails */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-label mb-0.5">automated violation emails</p>
            <p className="text-xs text-surface-muted">students receive an email when a violation is recorded</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, policyEmailsEnabled: !settings.policyEmailsEnabled })}
            className={`relative w-11 h-6 rounded-full transition-all ${settings.policyEmailsEnabled ? 'bg-compliance-green' : 'bg-surface-border'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.policyEmailsEnabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Bypass detection info */}
      <div className="card">
        <p className="section-label mb-3">bypass detection</p>
        <div className="space-y-3">
          {[
            { label: 'heartbeat monitoring', desc: 'device compliance verified every 60 seconds', active: true },
            { label: 'fake device detection', desc: 'flags burner phones and SIM-swapped devices', active: true },
            { label: 'bluetooth monitoring', desc: 'blocks AirPods, Apple Watch, connected peripherals', active: true },
            { label: 'hotspot detection', desc: 'identifies students sharing data with unlocked devices', active: true },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-compliance-green/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-compliance-green text-xs">✓</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 lowercase">{item.label}</div>
                <div className="text-xs text-surface-muted">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pb-6">
        {flash === 'saved' && <span className="text-sm text-compliance-green font-medium">✓ saved</span>}
        {flash === 'error' && <span className="text-sm text-compliance-red font-medium">failed to save</span>}
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: '#C8102E' }}
        >
          {saving ? 'saving…' : 'save changes'}
        </button>
      </div>
    </div>
  );
}
