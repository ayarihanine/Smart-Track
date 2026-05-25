import { getSupabaseClient } from '@/lib/supabase';
import { getActiveElapsedMs } from '@/store/alertsStore';
import { useCallback, useEffect, useState } from 'react';

export interface StuckCardRow {
  id: string;
  card_id: string;
  stage: string;
  enteredAt: string;
  minutesAtStage: number;
  severity: 'warning' | 'critical';
}

export function useStuckCards(thresholdMinutes = 30) {
  const [stuckCards, setStuckCards] = useState<StuckCardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStuck = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('electronic_cards')
        .select('id, card_id, current_machine, status, stage_entered_at, updated_at')
        .eq('status', 'in_progress')
        .limit(100);

      if (error) throw error;

      const thresholdMs = thresholdMinutes * 60 * 1000;
      const rows: StuckCardRow[] = [];

      for (const card of data || []) {
        if (card.card_id?.startsWith('TEST-')) continue;

        const enteredAt = card.stage_entered_at || card.updated_at;
        const elapsedMs = getActiveElapsedMs(enteredAt, 8, 16);
        if (elapsedMs < thresholdMs) continue;

        const minutesAtStage = Math.floor(elapsedMs / 60000);
        rows.push({
          id: String(card.id),
          card_id: card.card_id,
          stage: card.current_machine || 'Unknown',
          enteredAt,
          minutesAtStage,
          severity: minutesAtStage >= 60 ? 'critical' : 'warning',
        });
      }

      rows.sort((a, b) => b.minutesAtStage - a.minutesAtStage);
      setStuckCards(rows);
    } catch (err) {
      console.error('useStuckCards fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [thresholdMinutes]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    fetchStuck();
    const interval = setInterval(fetchStuck, 10000);
    const channel = supabase
      .channel('stuck_cards_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'electronic_cards' },
        fetchStuck
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchStuck]);

  return { stuckCards, loading, refetch: fetchStuck };
}
