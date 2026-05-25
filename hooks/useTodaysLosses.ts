import { getSupabaseClient } from '@/lib/supabase';
import { useState, useEffect, useCallback } from 'react';

export type LossesRange = 'today' | 'week' | 'month';

export interface LossSummary {
  totalCost: number;
  totalCards: number;
  zone1: number;
  zone2: number;
}

function getRangeStart(range: LossesRange): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  if (range === 'week') {
    start.setUTCDate(start.getUTCDate() - 7);
  } else if (range === 'month') {
    start.setUTCDate(1);
  }

  return start.toISOString();
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
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const startFilter = getRangeStart(range);

      const { data, error } = await supabase
        .from('production_losses')
        .select('zone_from, quantity, estimated_cost_tnd')
        .gte('loss_date', startFilter);

      if (error) throw error;

      let zone1 = 0;
      let zone2 = 0;
      let totalCost = 0;
      let totalCards = 0;
      data?.forEach((row) => {
        totalCost += Number(row.estimated_cost_tnd || 0);
        totalCards += Number(row.quantity || 0);
        if (row.zone_from === 'capteur1') zone1 += Number(row.quantity || 0);
        if (row.zone_from === 'capteur2') zone2 += Number(row.quantity || 0);
      });
      setSummary({ totalCost, totalCards, zone1, zone2 });
    } catch (err) {
      console.error('💰 Loss fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    fetchLosses();

    const channel = supabase
      .channel('losses_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_losses' }, fetchLosses)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLosses]);

  return { ...summary, loading, refetch: fetchLosses };
}
