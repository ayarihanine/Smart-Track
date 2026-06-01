import { getSupabaseClient } from '@/lib/supabase';
import { getTodayBounds } from '@/lib/dates';
import { useCallback, useEffect, useState } from 'react';

export interface ActiveCard {
  id: string;
  card_id: string;
  stage: string;
  machine: string;
  status: string;
  enteredAt: string;
  durationMinutes: number;
}

export function useActiveCards() {
  const [cards, setCards] = useState<ActiveCard[]>([]);
  const [stats, setStats] = useState({
    inProgress: 0,
    completed: 0,
    blocked: 0,
    pending: 0,
    cancelled: 0,
    removed: 0,
    todayTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchCards = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { start, end } = getTodayBounds();

      const { data, error } = await supabase
        .from('electronic_cards')
        .select('id, card_id, current_machine, status, updated_at, stage_entered_at, created_at')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .not('card_id', 'like', 'TEST-%')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const activeCards: ActiveCard[] = [];
      let completed = 0;
      let blocked = 0;
      let pending = 0;
      let cancelled = 0;
      let removed = 0;

      data?.forEach((card) => {
        // BUG 3 FIX: Compute duration from updated_at (reflects last activity, not stage entry)
        const enteredAt = card.updated_at || card.stage_entered_at || card.created_at;
        const durationMinutes = enteredAt
          ? Math.floor((Date.now() - new Date(enteredAt).getTime()) / 60000)
          : 0;

        if (card.status === 'in_progress') {
          activeCards.push({
            id: String(card.id),
            card_id: card.card_id,
            stage: card.current_machine || 'Unknown',
            machine: card.current_machine || 'Unknown',
            status: card.status,
            enteredAt: enteredAt,
            durationMinutes: Math.max(0, durationMinutes),
          });
        } else if (card.status === 'completed') {
          completed++;
        } else if (card.status === 'blocked' || card.status === 'on_hold') {
          blocked++;
        } else if (card.status === 'pending') {
          pending++;
        } else if (card.status === 'cancelled') {
          cancelled++;
        } else if (card.status === 'removed') {
          removed++;
        }
      });

      setCards(activeCards);
      setStats({
        inProgress: activeCards.length,
        completed,
        blocked,
        pending,
        cancelled,
        removed,
        todayTotal: data?.length || 0,
      });
    } catch (err) {
      console.error('Failed to fetch cards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    fetchCards();
    const interval = setInterval(fetchCards, 30000);

    const channel = supabase
      .channel('cards_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'electronic_cards' },
        fetchCards
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchCards]);

  return { cards, stats, loading, refetch: fetchCards };
}
