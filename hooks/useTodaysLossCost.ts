import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

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

interface ProductionLossRow {
  estimated_cost_tnd: number | null;
  quantity: number | null;
}

function getFilterStartDate(filter: LossesFilter): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  if (filter === 'week') {
    const day = start.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setUTCDate(start.getUTCDate() - diff);
  } else if (filter === 'month') {
    start.setUTCDate(1);
  }

  return start.toISOString();
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
    if (!supabase) {
      setError('Supabase not configured');
      setIsLoading(false);
      return;
    }

    try {
      const startDate = getFilterStartDate(filter);

      const { data, error: dbError } = await supabase
        .from('production_losses')
        .select('estimated_cost_tnd, quantity')
        .gte('loss_date', startDate);

      if (dbError) throw dbError;

      const rows = (data ?? []) as ProductionLossRow[];

      let sumCost = 0;
      let sumCards = 0;

      for (const row of rows) {
        sumCost += Number(row.estimated_cost_tnd ?? 0);
        sumCards += Number(row.quantity ?? 0);
      }

      setTotalCost(sumCost);
      setTotalCards(sumCards);
      setBreakdown({ zone1: 0, zone2: 0 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch loss data';
      console.error('useTodaysLossCost failed:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLossCost();
  }, [fetchLossCost]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('use-todays-loss-cost')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'production_losses' },
        () => {
          fetchLossCost();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLossCost]);

  return {
    totalCost,
    totalCards,
    breakdown,
    isLoading,
    error,
    refetch: fetchLossCost,
  };
}
