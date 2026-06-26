import React, { useEffect, useRef } from 'react';
import { usePhocusStore } from '../../store/phocusStore';
import { StudentProfile } from './StudentProfile';

export function StudentDrawer() {
  const { openStudentId, closeStudent } = usePhocusStore((s) => ({
    openStudentId: s.openStudentId,
    closeStudent: s.closeStudent,
  }));
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!openStudentId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeStudent(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openStudentId]);

  if (!openStudentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="flex-1 bg-black/50 backdrop-blur-sm"
        onClick={closeStudent}
      />

      {/* Panel */}
      <div className="w-full max-w-xl bg-surface border-l border-surface-border flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <span className="text-sm font-semibold text-surface-muted uppercase tracking-wider">Student Detail</span>
          <button
            onClick={closeStudent}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-muted hover:text-white hover:bg-surface-card transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <StudentProfile studentId={openStudentId} onBack={closeStudent} hideBackButton />
        </div>
      </div>
    </div>
  );
}
