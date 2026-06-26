import { useEffect, useState } from 'react';
import { usePhocusStore } from '../store/phocusStore';
import { complianceApi } from '../lib/api';

export function useCompliance() {
  const compliance = usePhocusStore((s) => s.compliance);
  const setCompliance = usePhocusStore((s) => s.setCompliance);
  const [loading, setLoading] = useState(!compliance);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (compliance) return; // already hydrated via socket or previous fetch

    setLoading(true);
    complianceApi
      .school()
      .then((res) => setCompliance(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const compliancePercent = compliance?.compliancePercent ?? 0;

  const color =
    compliancePercent >= 95
      ? 'green'
      : compliancePercent >= 80
        ? 'yellow'
        : 'red';

  return { compliance, compliancePercent, color, loading, error };
}
