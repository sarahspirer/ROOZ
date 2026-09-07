import React from 'react';
import clsx from 'clsx';
import { usePhocusStore } from '../../store/phocusStore';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'classes', label: 'Classes', icon: '⬛' },
  { id: 'students', label: 'Students', icon: '◉' },
  { id: 'violations', label: 'Violations', icon: '⚠' },
  { id: 'rewards', label: 'Rewards', icon: '★' },
  { id: 'reports', label: 'Reports', icon: '▣' },
] as const;

export function RoozLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { my: 'text-sm', rooz: 'text-base' },
    md: { my: 'text-lg', rooz: 'text-2xl' },
    lg: { my: 'text-2xl', rooz: 'text-4xl' },
  };
  return (
    <span className="inline-flex items-baseline leading-none">
      <span
        style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, color: '#C8102E' }}
        className={clsx('tracking-tight', sizes[size].rooz)}
      >
        ROOZ
      </span>
    </span>
  );
}

export function Sidebar({ onSetup }: { onSetup?: () => void }) {
  const { sidebarOpen, activeView, setActiveView } = usePhocusStore();

  return (
    <aside
      className={clsx(
        'flex flex-col bg-white border-r border-surface-border transition-all duration-300 shrink-0',
        sidebarOpen ? 'w-52' : 'w-16',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 min-h-[64px]">
        {sidebarOpen ? (
          <RoozLogo size="md" />
        ) : (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#C8102E', fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 14, color: 'white' }}>
            R
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeView === item.id
                ? 'text-white'
                : 'text-surface-muted hover:text-gray-900 hover:bg-surface-border/60',
            )}
            style={activeView === item.id ? { background: '#C8102E' } : {}}
          >
            <span className="text-base shrink-0">{item.icon}</span>
            {sidebarOpen && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-surface-border space-y-1">
        {onSetup && (
          <button
            onClick={onSetup}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              'text-surface-muted hover:text-gray-900 hover:bg-surface-border/60',
            )}
          >
            <span className="text-base shrink-0">⚙</span>
            {sidebarOpen && <span>Onboard School</span>}
          </button>
        )}
        {sidebarOpen && (
          <div className="text-xs text-surface-muted px-3 pt-1">
            <div className="font-semibold text-gray-700">ROOZ v1.0</div>
          </div>
        )}
      </div>
    </aside>
  );
}
