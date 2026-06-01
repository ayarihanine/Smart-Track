import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { getRangeBounds } from '@/lib/dates';

export type LossesFilter = 'today' | 'week' | 'month';

export interface LossBreakdown {
  zone1: number;
  zone2: number;
}

export interface TodaysLossCostResult {
  totalCost: number;
  totalCards: number;
  breakdown: LossBreakdown;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTodaysLossCost(filter: LossesFilter = 'today'): TodaysLossCostResult {
  const [totalCost, setTotalCost] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [breakdown, setBreakdown] = useState<LossBreakdown>({ zone1: 0, zone2: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLossCost = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const supabase = getSupabaseClient();
    if (!supabase) { setError('Supabase not configured'); setIsLoading(false); return; }

    try {
      const { start, end } = getRangeBounds(filter);

      const { data, error: dbError } = await supabase
        .from('losses')
        .select('loss_count, cost_tnd, loss_zone')
        .gte('created_at', start)
        .lt('created_at', end);

      if (dbError) throw dbError;

      let sumCards = 0;
      let sumCost = 0;
      let zone1 = 0;
      let zone2 = 0;

      for (const row of data ?? []) {
        const cards = Number(row.loss_count ?? 0);
        sumCards += cards;
        sumCost += Number(row.cost_tnd ?? 0);
        const z = (row.loss_zone ?? '').toLowerCase();
        if (z.includes('1') && !z.includes('3')) zone1 += cards;
        else if (z.includes('2') || (z.includes('3') && !z.includes('1'))) zone2 += cards;
      }

      setTotalCost(sumCost);
      setTotalCards(sumCards);
      setBreakdown({ zone1, zone2 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch loss data';
      console.error('useTodaysLossCost failed:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchLossCost(); }, [fetchLossCost]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('use-todays-loss-cost')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'losses' }, () => {
        fetchLossCost();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLossCost]);

  return { totalCost, totalCards, breakdown, isLoading, error, refetch: fetchLossCost };
}
