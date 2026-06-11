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

      const [lostResult, scrapResult, articlesResult] = await Promise.all([
        supabase
          .from('electronic_cards')
          .select('id, product_id')
          .in('status', ['cancelled', 'blocked', 'removed'])
          .gte('created_at', start)
          .lt('created_at', end),
        supabase
          .from('losses')
          .select('loss_count, cost_tnd, loss_zone')
          .gte('created_at', start)
          .lt('created_at', end),
        supabase
          .from('articles')
          .select('id, unit_price, assembly_count'),
      ]);

      if (lostResult.error) throw lostResult.error;
      if (scrapResult.error) throw scrapResult.error;

      const lostCards = lostResult.data || [];
      const scrapRecords = scrapResult.data || [];
      const articles = articlesResult.data || [];

      const articleCostMap = new Map<string, number>();
      for (const a of articles) {
        articleCostMap.set(a.id, Number(a.unit_price || 0) * Number(a.assembly_count || 0));
      }

      let lostCardCost = 0;
      for (const card of lostCards) {
        const pid = card.product_id;
        lostCardCost += pid ? (articleCostMap.get(pid) || 0) : 0;
      }

      let scrapCost = 0;
      let zone1 = 0;
      let zone2 = 0;

      scrapRecords.forEach((row) => {
        const qty = Math.max(0, Number(row.loss_count || 0));
        const cost = Math.max(0, Number(row.cost_tnd || 0));
        scrapCost += cost;

        const z = (row.loss_zone ?? '').toLowerCase();
        if (z.includes('1') && !z.includes('3')) zone1 += qty;
        else if (z.includes('2') || (z.includes('3') && !z.includes('1'))) zone2 += qty;
      });

      setSummary({
        totalCost: lostCardCost + scrapCost,
        totalCards: lostCards.length + scrapRecords.length,
        zone1,
        zone2,
      });
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electronic_cards' }, fetchLosses)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLosses]);

  return { ...summary, loading, refetch: fetchLosses };
}
