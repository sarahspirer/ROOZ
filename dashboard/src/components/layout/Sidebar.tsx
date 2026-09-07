import React from 'react';
import clsx from 'clsx';
import { usePhocusStore } from '../../store/phocusStore';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'dashboard', icon: '▦' },
  { id: 'classes', label: 'classes', icon: '⬛' },
  { id: 'students', label: 'students', icon: '◉' },
  { id: 'violations', label: 'violations', icon: '⚠' },
  { id: 'rewards', label: 'rewards', icon: '★' },
  { id: 'reports', label: 'reports', icon: '▣' },
  { id: 'settings', label: 'settings', icon: '⚙' },
] as const;

export function RoozLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fontSize = size === 'sm' ? 18 : size === 'md' ? 26 : 38;
  return (
    <span
      style={{
        fontFamily: "'Nunito', -apple-system, sans-serif",
        fontWeight: 900,
        color: '#C8102E',
        fontSize,
        letterSpacing: '-0.03em',
        lineHeight: 1,
      }}
    >
      rooz
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
      <div className="flex items-center gap-2.5 px-4 py-5 min-h-[64px]">
        {sidebarOpen ? (
          <div className="flex items-center gap-1.5">
            {/* Kangaroo emoji as mascot */}
            <span style={{ fontSize: 22 }}>🦘</span>
            <RoozLogo size="md" />
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-black"
            style={{ background: '#C8102E', fontFamily: 'Nunito, sans-serif' }}
          >
            r
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
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
              activeView === item.id
                ? 'text-white font-semibold'
                : 'text-surface-muted hover:text-gray-900 hover:bg-surface font-medium',
            )}
            style={activeView === item.id ? { background: '#C8102E' } : {}}
          >
            <span className="text-sm shrink-0">{item.icon}</span>
            {sidebarOpen && <span className="lowercase">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-surface-border space-y-1">
        {onSetup && (
          <button
            onClick={onSetup}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-muted hover:text-gray-900 hover:bg-surface transition-all"
          >
            <span className="text-sm shrink-0">⚙</span>
            {sidebarOpen && <span className="lowercase">onboard school</span>}
          </button>
        )}
        {sidebarOpen && (
          <div className="px-3 pt-1">
            <div className="text-xs text-surface-muted">v1.0 · $4.99/student/mo</div>
          </div>
        )}
      </div>
    </aside>
  );
}
