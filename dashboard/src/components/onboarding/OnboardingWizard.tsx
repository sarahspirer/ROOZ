import React, { useState, useRef } from 'react';

interface StudentRow { name: string; email: string; grade: string }
interface TeacherRow { name: string; email: string }

type Step = 'welcome' | 'students' | 'teachers' | 'done';

function parseCSV(text: string, type: 'students' | 'teachers'): StudentRow[] | TeacherRow[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  // Detect and skip header row
  const first = lines[0].toLowerCase();
  const start = first.includes('name') || first.includes('email') ? 1 : 0;
  return lines.slice(start).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (type === 'students') {
      return { name: cols[0] ?? '', email: cols[1] ?? '', grade: cols[2] ?? '9' };
    }
    return { name: cols[0] ?? '', email: cols[1] ?? '' };
  });
}

const STUDENT_TEMPLATE = `name,email,grade
Alex Rivera,alex.rivera@school.edu,10
Maya Patel,maya.patel@school.edu,11`;

const TEACHER_TEMPLATE = `name,email
Ms. Thompson,thompson@school.edu
Mr. Davis,davis@school.edu`;

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i < current ? 'bg-brand-600 text-white' :
              i === current ? 'bg-brand-500 text-white ring-2 ring-brand-500/30' :
              'bg-surface-border text-surface-muted'
            }`}>
              {i < current ? '✓' : i + 1}
            </div>
            <span className={`text-xs ${i === current ? 'text-white' : 'text-surface-muted'}`}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-2 mb-5 ${i < current ? 'bg-brand-600' : 'bg-surface-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function CSVImportPanel({
  type, label, template, onImport, importing
}: {
  type: 'students' | 'teachers';
  label: string;
  template: string;
  onImport: (rows: any[]) => Promise<{ created: number; skipped: number; errors: string[] } | null>;
  importing: boolean;
}) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleParse = (csv: string) => {
    setText(csv);
    const rows = parseCSV(csv, type);
    setPreview(rows.filter((r: any) => r.name && r.email));
    setResult(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleParse(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const r = await onImport(preview);
    setResult(r);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-muted">
          Paste CSV or upload a file. Columns: <code className="text-brand-500 text-xs">name, email{type === 'students' ? ', grade' : ''}</code>
        </p>
        <button
          onClick={() => handleParse(template)}
          className="text-xs text-accent-500 hover:text-accent-400 transition-colors"
        >
          Load example
        </button>
      </div>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => handleParse(e.target.value)}
          placeholder={`name,email${type === 'students' ? ',grade' : ''}\nJohn Smith,john@school.edu${type === 'students' ? ',10' : ''}`}
          rows={5}
          className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-white font-mono placeholder-surface-muted focus:outline-none focus:border-brand-500 transition-colors resize-none"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute bottom-3 right-3 text-xs bg-surface-card border border-surface-border text-surface-muted hover:text-white px-2 py-1 rounded-lg transition-colors"
        >
          Upload file
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
      </div>

      {preview.length > 0 && !result && (
        <div className="bg-surface border border-surface-border rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-surface-border flex items-center justify-between">
            <span className="text-xs text-surface-muted font-medium">Preview — {preview.length} {label}</span>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {preview.slice(0, 8).map((row, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2 border-b border-surface-border/50 last:border-0 text-sm">
                <span className="text-white flex-1 truncate">{row.name}</span>
                <span className="text-surface-muted flex-1 truncate">{row.email}</span>
                {type === 'students' && <span className="text-surface-muted w-12">Gr. {row.grade}</span>}
              </div>
            ))}
            {preview.length > 8 && (
              <div className="px-4 py-2 text-xs text-surface-muted">+{preview.length - 8} more</div>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className={`rounded-xl px-4 py-3 border text-sm ${
          result.errors.length > 0
            ? 'bg-compliance-red/10 border-compliance-red/30 text-compliance-red'
            : 'bg-compliance-green/10 border-compliance-green/30 text-compliance-green'
        }`}>
          ✓ {result.created} {label} created · {result.skipped} skipped
          {result.errors.length > 0 && <div className="mt-1 text-xs">{result.errors.slice(0, 3).join(', ')}</div>}
        </div>
      )}

      {preview.length > 0 && !result && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {importing ? 'Importing…' : `Import ${preview.length} ${label}`}
        </button>
      )}
    </div>
  );
}

export function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState({ students: 0, teachers: 0 });

  const steps = ['Welcome', 'Students', 'Teachers', 'Done'];
  const stepIndex = { welcome: 0, students: 1, teachers: 2, done: 3 }[step];

  const importStudents = async (rows: StudentRow[]) => {
    setImporting(true);
    try {
      const token = localStorage.getItem('rooz_token');
      const r = await fetch('/api/onboarding/import-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ students: rows }),
      });
      const data = await r.json();
      setSummary((s) => ({ ...s, students: s.students + data.created }));
      return data;
    } finally {
      setImporting(false);
    }
  };

  const importTeachers = async (rows: TeacherRow[]) => {
    setImporting(true);
    try {
      const token = localStorage.getItem('rooz_token');
      const r = await fetch('/api/onboarding/import-teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teachers: rows }),
      });
      const data = await r.json();
      setSummary((s) => ({ ...s, teachers: s.teachers + data.created }));
      return data;
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-border">
          <div>
            <h2 className="text-white font-bold text-lg">School Setup</h2>
            <p className="text-surface-muted text-xs mt-0.5">Get your school running in minutes</p>
          </div>
          <button onClick={onClose} className="text-surface-muted hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-6">
          <StepIndicator steps={steps} current={stepIndex} />

          {/* Step: Welcome */}
          {step === 'welcome' && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-3xl mx-auto">🏫</div>
              <div>
                <h3 className="text-white font-semibold text-lg">Welcome to ROOZ</h3>
                <p className="text-surface-muted text-sm mt-2 leading-relaxed">
                  Let's get your school set up. We'll import your students and teachers so the dashboard is ready to go.
                  This takes about 2 minutes.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { icon: '📋', label: 'Import students via CSV' },
                  { icon: '👩‍🏫', label: 'Add your teachers' },
                  { icon: '🚀', label: 'Go live instantly' },
                ].map(({ icon, label }) => (
                  <div key={label} className="bg-surface border border-surface-border rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">{icon}</div>
                    <div className="text-xs text-surface-muted">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Students */}
          {step === 'students' && (
            <div>
              <h3 className="text-white font-semibold mb-1">Import Students</h3>
              <CSVImportPanel
                type="students" label="students"
                template={STUDENT_TEMPLATE}
                onImport={importStudents}
                importing={importing}
              />
            </div>
          )}

          {/* Step: Teachers */}
          {step === 'teachers' && (
            <div>
              <h3 className="text-white font-semibold mb-1">Import Teachers</h3>
              <CSVImportPanel
                type="teachers" label="teachers"
                template={TEACHER_TEMPLATE}
                onImport={importTeachers}
                importing={importing}
              />
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-compliance-green/15 border border-compliance-green/30 flex items-center justify-center text-3xl mx-auto">✓</div>
              <div>
                <h3 className="text-white font-semibold text-lg">You're all set!</h3>
                <p className="text-surface-muted text-sm mt-2">
                  {summary.students > 0 && `${summary.students} students`}
                  {summary.students > 0 && summary.teachers > 0 && ' and '}
                  {summary.teachers > 0 && `${summary.teachers} teachers`}
                  {(summary.students > 0 || summary.teachers > 0) ? ' added to your school.' : 'Setup complete.'}
                </p>
              </div>
              <div className="bg-surface border border-surface-border rounded-xl p-4 text-left text-sm text-surface-muted space-y-1.5">
                <div>📱 Students log in at <span className="text-white">myrooz.com</span> with their school email</div>
                <div>🔑 Default password: <code className="text-brand-500">changeme123</code></div>
                <div>📊 Their scores appear live on this dashboard</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 pb-6 gap-3">
          {step !== 'welcome' && step !== 'done' ? (
            <button
              onClick={() => setStep(step === 'teachers' ? 'students' : 'welcome')}
              className="px-4 py-2.5 rounded-xl border border-surface-border text-surface-muted hover:text-white hover:border-white/20 transition-colors text-sm"
            >
              Back
            </button>
          ) : <div />}

          {step === 'welcome' && (
            <button onClick={() => setStep('students')}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors">
              Get Started →
            </button>
          )}
          {step === 'students' && (
            <button onClick={() => setStep('teachers')}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors">
              Next: Add Teachers →
            </button>
          )}
          {step === 'teachers' && (
            <button onClick={() => setStep('done')}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors">
              Finish Setup →
            </button>
          )}
          {step === 'done' && (
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors">
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
