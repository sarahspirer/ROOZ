import React, { useEffect, useState, useCallback } from 'react';

const TIER_COLOR: Record<string, string> = {
  BRONZE: '#d97706', SILVER: '#94a3b8', GOLD: '#eab308', ELITE: '#a855f7',
};

interface Reward {
  id: string; name: string; description: string;
  requiredTier: string; requiredScore: number;
  _count: { claims: number };
}

interface Claim {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  claimedAt: string;
  note?: string;
  reward: { id: string; name: string; description: string; requiredTier: string };
  student: { id: string; user: { name: string } };
}

type Tab = 'pending' | 'approved' | 'denied' | 'catalog';

export function RewardsView() {
  const [tab, setTab] = useState<Tab>('pending');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const token = () => localStorage.getItem('rooz_token') ?? '';

  const loadRewards = useCallback(async () => {
    const r = await fetch(`${import.meta.env.VITE_API_URL}/api/rewards`, { headers: { Authorization: `Bearer ${token()}` } });
    const d = await r.json();
    setRewards(d.rewards ?? []);
  }, []);

  const loadClaims = useCallback(async (status: string) => {
    setLoading(true);
    const r = await fetch(`${import.meta.env.VITE_API_URL}/api/rewards/claims?status=${status}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const d = await r.json();
    setClaims(d.claims ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'catalog') { loadRewards(); setLoading(false); }
    else loadClaims(tab.toUpperCase());
  }, [tab]);

  const review = async (claimId: string, action: 'approve' | 'deny', note?: string) => {
    setActing(claimId);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rewards/claims/${claimId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ note }),
      });
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
    } finally {
      setActing(null);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'denied', label: 'Denied' },
    { id: 'catalog', label: 'Catalog' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Rewards</h2>
          <p className="text-surface-muted text-sm mt-0.5">Review student reward claims</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-card border border-surface-border rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-brand-600 text-white' : 'text-surface-muted hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending / Approved / Denied claims */}
      {tab !== 'catalog' && (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-12 text-surface-muted">
            {tab === 'pending' ? '✓ No pending claims' : `No ${tab} claims`}
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <div key={claim.id}
                className="bg-surface-card border border-surface-border rounded-2xl p-5 flex items-start gap-4">
                {/* Tier badge */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                  style={{ backgroundColor: TIER_COLOR[claim.reward.requiredTier] + '20',
                    border: `1px solid ${TIER_COLOR[claim.reward.requiredTier]}40` }}>
                  ★
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{claim.reward.name}</p>
                      <p className="text-sm text-surface-muted mt-0.5">{claim.reward.description}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${
                      claim.status === 'PENDING' ? 'bg-brand-500/15 text-brand-500' :
                      claim.status === 'APPROVED' ? 'bg-compliance-green/15 text-compliance-green' :
                      'bg-compliance-red/15 text-compliance-red'
                    }`}>{claim.status}</span>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-surface-muted">
                    <span className="font-medium text-white">{claim.student.user.name}</span>
                    <span>·</span>
                    <span>{new Date(claim.claimedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                    })}</span>
                    <span className="px-1.5 py-0.5 rounded border text-xs"
                      style={{ color: TIER_COLOR[claim.reward.requiredTier],
                        borderColor: TIER_COLOR[claim.reward.requiredTier] + '40' }}>
                      {claim.reward.requiredTier}
                    </span>
                  </div>

                  {claim.note && (
                    <p className="mt-2 text-xs text-surface-muted italic">"{claim.note}"</p>
                  )}
                </div>

                {/* Actions — only on PENDING */}
                {claim.status === 'PENDING' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => review(claim.id, 'deny')}
                      disabled={acting === claim.id}
                      className="px-3 py-1.5 rounded-lg border border-compliance-red/40 text-compliance-red hover:bg-compliance-red/10 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      Deny
                    </button>
                    <button
                      onClick={() => review(claim.id, 'approve')}
                      disabled={acting === claim.id}
                      className="px-3 py-1.5 rounded-lg bg-compliance-green/15 border border-compliance-green/40 text-compliance-green hover:bg-compliance-green/25 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {acting === claim.id ? '…' : 'Approve'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Catalog */}
      {tab === 'catalog' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map((r) => {
            const color = TIER_COLOR[r.requiredTier];
            return (
              <div key={r.id} className="bg-surface-card border border-surface-border rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: color + '20', border: `1px solid ${color}40` }}>
                    ★
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full"
                    style={{ color, backgroundColor: color + '15', border: `1px solid ${color}30` }}>
                    {r.requiredTier}
                  </span>
                </div>
                <h3 className="font-semibold text-white">{r.name}</h3>
                <p className="text-sm text-surface-muted mt-1">{r.description}</p>
                <div className="mt-3 pt-3 border-t border-surface-border flex items-center justify-between text-xs text-surface-muted">
                  <span>{r.requiredScore.toLocaleString()} pts required</span>
                  <span>{r._count.claims} claims</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
