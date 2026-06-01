import { getSupabaseClient } from '@/lib/supabase';
import { getTodayDateString } from '@/lib/dates';
import { useState, useEffect } from 'react';

export interface PerformanceConfig {
  expected?: number;
  cycleTimeSeconds?: number;
  shiftHours?: number;
}

export function usePerformanceMetrics(
  _produced: number,  // kept for API compat — not used for calculation
  _totalLosses: number,
  _config: PerformanceConfig = {}
) {
  const [trg, setTrg] = useState(0);
  const [trs, setTrs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const today = getTodayDateString();

        const { data, error } = await supabase
          .from('production_performance')
          .select('trg_percentage, trs_percentage')
          .eq('date', today)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setTrg(Number(data.trg_percentage ?? 0));
          setTrs(Number(data.trs_percentage ?? 0));
        } else {
          // No row for today — show 0, never calculate client-side
          setTrg(0);
          setTrs(0);
        }
      } catch (e) {
        console.warn('Metrics fetch failed:', e);
        setTrg(0);
        setTrs(0);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    const channel = supabase
      .channel('perf-metrics-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_performance',
        },
        () => { fetchMetrics(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);  // no dependencies on produced/losses — we only read from DB

  return { performance: trg, trg, trs, loading };
}
