import React, { useState } from 'react';
import clsx from 'clsx';
import { usePhocusStore } from '../../store/phocusStore';
import { violationsApi } from '../../lib/api';
import type { AlertEvent, ViolationLevel } from '../../types';

const LEVEL_STYLES: Record<ViolationLevel, { bg: string; text: string; label: string }> = {
  WARNING:     { bg: 'bg-blue-500/8',   text: 'text-blue-400',          label: 'Warning' },
  RESTRICTION: { bg: 'bg-yellow-500/8', text: 'text-compliance-yellow', label: 'Restriction' },
  ADMIN_FLAG:  { bg: 'bg-orange-500/8', text: 'text-orange-400',        label: 'Admin Flag' },
  ESCALATION:  { bg: 'bg-red-500/8',    text: 'text-compliance-red',    label: '🚨 Escalation' },
};

type ActionState = 'idle' | 'resolving' | 'resolved' | 'contacting' | 'contacted';

function AlertRow({ alert, onDismiss }: { alert: AlertEvent; onDismiss: () => void }) {
  const openStudent = usePhocusStore((s) => s.openStudent);
  const [action, setAction] = useState<ActionState>('idle');
  const style = LEVEL_STYLES[alert.level];
  const isEscalation = alert.level === 'ESCALATION' || alert.level === 'ADMIN_FLAG';

  const handleResolve = async () => {
    setAction('resolving');
    try {
      await violationsApi.resolveStudent(alert.studentId);
      setAction('resolved');
      setTimeout(onDismiss, 1200);
    } catch {
      setAction('idle');
    }
  };

  const handleContact = async () => {
    setAction('contacting');
    await new Promise((r) => setTimeout(r, 800));
    setAction('contacted');
    setTimeout(onDismiss, 1500);
  };

  return (
    <div className={clsx('px-4 py-3 transition-all', style.bg)}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className={clsx('text-xs font-bold uppercase tracking-wide shrink-0', style.text)}>
              {style.label}
            </span>
            <span className="text-xs text-surface-muted shrink-0">
              {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button
            onClick={() => openStudent(alert.studentId)}
            className="text-sm font-semibold text-white hover:text-brand-500 transition-colors text-left mt-0.5"
          >
            {alert.studentName}
          </button>
          <p className="text-xs text-surface-muted mt-0.5 truncate">{alert.description}</p>
        </div>
        {!isEscalation && (
          <button
            onClick={onDismiss}
            className="shrink-0 text-surface-muted hover:text-white transition-colors text-lg leading-none mt-0.5"
          >
            ×
          </button>
        )}
      </div>

      {/* Action buttons for escalations */}
      {isEscalation && alert.requiresAction && (
        <div className="mt-3 flex items-center gap-2">
          {action === 'resolved' ? (
            <span className="text-xs text-compliance-green font-semibold">✓ Resolved</span>
          ) : action === 'contacted' ? (
            <span className="text-xs text-compliance-green font-semibold">✓ Parent notified</span>
          ) : (
            <>
              <button
                onClick={handleResolve}
                disabled={action !== 'idle'}
                className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-card text-white transition-colors disabled:opacity-50"
              >
                {action === 'resolving' ? 'Resolving…' : 'Resolve'}
              </button>
              <button
                onClick={handleContact}
                disabled={action !== 'idle'}
                className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-compliance-red/40 bg-compliance-red/10 hover:bg-compliance-red/20 text-compliance-red transition-colors disabled:opacity-50"
              >
                {action === 'contacting' ? 'Notifying…' : 'Contact Parent'}
              </button>
              <button
                onClick={onDismiss}
                className="w-6 shrink-0 text-surface-muted hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AlertsPanel() {
  const { alerts, dismissAlert } = usePhocusStore();

  const escalations = alerts.filter((a) => a.level === 'ESCALATION' || a.level === 'ADMIN_FLAG');
  const others = alerts.filter((a) => a.level !== 'ESCALATION' && a.level !== 'ADMIN_FLAG');
  const sorted = [...escalations, ...others];

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl flex flex-col">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Alerts</h3>
        {escalations.length > 0 && (
          <span className="bg-compliance-red text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
            {escalations.length}
          </span>
        )}
      </div>

      <div className="divide-y divide-surface-border max-h-96 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-surface-muted text-sm">
            No active alerts
          </div>
        ) : (
          sorted.slice(0, 20).map((alert) => (
            <AlertRow key={alert.id} alert={alert} onDismiss={() => dismissAlert(alert.id)} />
          ))
        )}
      </div>
    </div>
  );
}
