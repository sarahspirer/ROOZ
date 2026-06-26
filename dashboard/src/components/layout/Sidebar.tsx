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
        style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900 }}
        className={clsx('text-white tracking-tight', sizes[size].rooz)}
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
        'flex flex-col bg-surface-card border-r border-surface-border transition-all duration-300 shrink-0',
        sidebarOpen ? 'w-56' : 'w-16',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-border min-h-[64px]">
        {sidebarOpen ? (
          <RoozLogo size="md" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0"
            style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 14, color: 'white' }}>
            R
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              activeView === item.id
                ? 'bg-brand-600 text-white'
                : 'text-surface-muted hover:text-white hover:bg-surface-border',
            )}
          >
            <span className="text-base shrink-0">{item.icon}</span>
            {sidebarOpen && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-surface-border space-y-2">
        {onSetup && (
          <button
            onClick={onSetup}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              'text-surface-muted hover:text-white hover:bg-surface-border',
            )}
          >
            <span className="text-base shrink-0">⚙</span>
            {sidebarOpen && <span>Onboard School</span>}
          </button>
        )}
        {sidebarOpen ? (
          <div className="text-xs text-surface-muted px-3">
            <div className="font-medium text-white">ROOZ v1.0</div>
            <div>School Safety System</div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-surface-border flex items-center justify-center text-xs mx-auto">
            ?
          </div>
        )}
      </div>
    </aside>
  );
}
