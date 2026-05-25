import { getSupabaseClient } from '@/lib/supabase';
import { useState, useEffect } from 'react';

export interface PerformanceConfig {
  expected?: number;
  cycleTimeSeconds?: number;
  shiftHours?: number;
}

export function usePerformanceMetrics(
  produced: number,
  totalLosses: number,
  config: PerformanceConfig = {}
) {
  const [trg, setTrg] = useState(0);
  const [trs, setTrs] = useState(0);
  const [loading, setLoading] = useState(true);

  const expected = config.expected ?? 10;
  const cycleTime = config.cycleTimeSeconds ?? 5;
  const shiftHours = config.shiftHours ?? 8;

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const fetchMetrics = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('performance_metrics')
          .select('trg_percentage, trs_percentage')
          .order('metric_date', { ascending: false })
          .limit(1);

        if (!error && data?.length && data[0].trg_percentage != null) {
          const dbTrg = Number(data[0].trg_percentage) || 0;
          const dbTrs = Number(data[0].trs_percentage) || dbTrg * 0.85;
          setTrg(dbTrg);
          setTrs(dbTrs);
        } else {
          const maxPossible = shiftHours > 0 && cycleTime > 0 ? (shiftHours * 3600) / cycleTime : 0;
          const performance = maxPossible > 0 ? (produced / maxPossible) * 100 : expected > 0 ? (produced / expected) * 100 : 0;
          const quality = produced > 0 ? ((produced - totalLosses) / produced) * 100 : 100;
          const calcTrg = Math.min(100, (performance * quality) / 100);
          setTrg(calcTrg);
          setTrs(calcTrg * 0.85);
        }
      } catch (e) {
        console.warn('Metrics fetch failed, using defaults');
        const maxPossible = shiftHours > 0 && cycleTime > 0 ? (shiftHours * 3600) / cycleTime : 0;
        const performance = maxPossible > 0 ? (produced / maxPossible) * 100 : 0;
        const quality = produced > 0 ? ((produced - totalLosses) / produced) * 100 : 100;
        const calcTrg = Math.min(100, (performance * quality) / 100);
        setTrg(calcTrg);
        setTrs(calcTrg * 0.85);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [produced, totalLosses, expected, cycleTime, shiftHours]);

  return { trg, trs, loading };
}
