import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

export function usePerformanceMetrics() {
  const [trg, setTrg] = useState<number | null>(null);
  const [trs, setTrs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('performance_metrics')
        .select('trg_percent, trs_percent, produced_cards, expected_cards, operating_hours')
        .order('metric_date', { ascending: false })
        .order('hour', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        let trgVal = Number(row.trg_percent);
        let trsVal = Number(row.trs_percent);
        if (!trgVal || Number.isNaN(trgVal)) {
          const expected = Number(row.expected_cards || 0);
          const produced = Number(row.produced_cards || 0);
          if (expected > 0) trgVal = (produced / expected) * 100;
        }
        if (!trsVal || Number.isNaN(trsVal)) {
          trsVal = trgVal * (Number(row.operating_hours || 0) / 24);
        }
        setTrg(trgVal);
        setTrs(trsVal);
      }
      setLoading(false);
    };

    fetchMetrics();
    const channel = supabase
      .channel('metrics_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'performance_metrics' }, fetchMetrics)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { trg, trs, loading };
}
