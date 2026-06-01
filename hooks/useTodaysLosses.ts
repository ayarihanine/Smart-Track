import { getSupabaseClient } from '@/lib/supabase';
import { getRangeBounds } from '@/lib/dates';
import { useState, useEffect, useCallback } from 'react';

export type LossesRange = 'today' | 'week' | 'month';

export interface LossSummary {
  totalCost: number;
  totalCards: number;
  zone1: number;
  zone2: number;
}

export function useTodaysLosses(range: LossesRange = 'today') {
  const [summary, setSummary] = useState<LossSummary>({
    totalCost: 0,
    totalCards: 0,
    zone1: 0,
    zone2: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchLosses = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) { setLoading(false); return; }

    try {
      setLoading(true);
      const { start, end } = getRangeBounds(range);

      // BUG 2 FIX: Fetch cost_tnd directly from losses table — no frontend math.
      // Upper bound (.lt) ensures 'today' never accidentally includes tomorrow.
      const { data, error } = await supabase
        .from('losses')
        .select('loss_count, cost_tnd, loss_zone')
        .gte('created_at', start)
        .lt('created_at', end);

      if (error) throw error;
      if (!data || data.length === 0) {
        setSummary({ totalCost: 0, totalCards: 0, zone1: 0, zone2: 0 });
        return;
      }

      let totalCards = 0;
      let totalCost  = 0;
      let zone1 = 0;
      let zone2 = 0;

      data.forEach((row) => {
        const cards = Math.max(0, Number(row.loss_count || 0));
        // BUG 2 FIX: cost_tnd comes directly from DB — never computed here
        const cost  = Math.max(0, Number(row.cost_tnd  || 0));
        totalCards += cards;
        totalCost  += cost;

        const z = (row.loss_zone ?? '').toLowerCase();
        if (z.includes('1') && !z.includes('3')) zone1 += cards;
        else if (z.includes('2') || (z.includes('3') && !z.includes('1'))) zone2 += cards;
      });

      setSummary({ totalCost, totalCards, zone1, zone2 });
    } catch (err) {
      console.error('Loss fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) { setLoading(false); return; }

    fetchLosses();

    const channel = supabase
      .channel('pertes_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'losses' }, fetchLosses)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLosses]);

  return { ...summary, loading, refetch: fetchLosses };
}
