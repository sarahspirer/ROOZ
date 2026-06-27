import React, { useEffect } from 'react';
import { usePhocusStore } from './store/phocusStore';
import { useSocket } from './hooks/useSocket';
import { Sidebar, RoozLogo } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';

// Views
import { ComplianceMeter } from './components/dashboard/ComplianceMeter';
import { ClassGrid } from './components/dashboard/ClassGrid';
import { ActivityFeed } from './components/dashboard/ActivityFeed';
import { Leaderboard } from './components/dashboard/Leaderboard';
import { AlertsPanel } from './components/dashboard/AlertsPanel';
import { ClassesView } from './components/classes/ClassesView';
import { StudentsView } from './components/students/StudentsView';
import { ReportsView } from './components/reports/ReportsView';
import { RewardsView } from './components/rewards/RewardsView';
import { TeacherView } from './components/teacher/TeacherView';
import { ParentView } from './components/parent/ParentView';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { StudentDrawer } from './components/students/StudentDrawer';

function LoginPage() {
  const setAuth = usePhocusStore((s) => s.setAuth);
  const [email, setEmail] = React.useState('admin@phocus.school');
  const [password, setPassword] = React.useState('password');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Login failed');
      setAuth(data.token, data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-3">
            <RoozLogo size="lg" />
          </div>
          <p className="text-surface-muted mt-2">School Phone Management System</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-surface-card border border-surface-border rounded-2xl p-8 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-surface-muted mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-muted mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors"
              required
            />
          </div>
          {error && <div className="text-compliance-red text-sm">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg py-3 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

function DashboardHome() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      {/* Left column */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        <ComplianceMeter />
        <AlertsPanel />
      </div>

      {/* Middle column */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <ClassGrid />
        <ActivityFeed />
      </div>

      {/* Right column */}
      <div className="lg:col-span-1">
        <Leaderboard />
      </div>
    </div>
  );
}

const VIEW_COMPONENTS: Record<string, React.ComponentType> = {
  dashboard: DashboardHome,
  classes: ClassesView,
  students: StudentsView,
  reports: ReportsView,
  rewards: RewardsView,
};

export function App() {
  const { auth, activeView, clearAuth } = usePhocusStore();
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  useSocket();

  if (!auth.token || !auth.user) {
    return <LoginPage />;
  }

  // Parents get a read-only child summary view
  if (auth.user.role === 'PARENT') {
    return (
      <div className="flex h-screen bg-surface overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-card shrink-0">
            <RoozLogo size="md" />
            <div className="flex items-center gap-3">
              <span className="text-xs text-surface-muted">{auth.user.name}</span>
              <button onClick={clearAuth} className="text-xs text-surface-muted hover:text-white transition-colors">Sign out</button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <ParentView />
          </div>
        </div>
      </div>
    );
  }

  // Teachers get a focused single-view UI
  if (auth.user.role === 'TEACHER') {
    return (
      <div className="flex h-screen bg-surface overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-border bg-surface-card shrink-0">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-xs">R</div>
            <span className="font-bold text-white tracking-wide">ROOZ</span>
            <span className="ml-auto text-xs text-surface-muted">{auth.user.name}</span>
          </div>
          <main className="flex-1 overflow-y-auto p-6">
            <TeacherView />
          </main>
        </div>
      </div>
    );
  }

  const ViewComponent = VIEW_COMPONENTS[activeView] ?? DashboardHome;

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar onSetup={() => setShowOnboarding(true)} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <ViewComponent />
        </main>
      </div>
      {showOnboarding && <OnboardingWizard onClose={() => setShowOnboarding(false)} />}
      <StudentDrawer />
    </div>
  );
}
