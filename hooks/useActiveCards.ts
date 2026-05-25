import { getSupabaseClient } from '@/lib/supabase';
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('electronic_cards')
        .select('id, card_id, current_machine, status, stage_entered_at, created_at')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const now = Date.now();
      const activeCards: ActiveCard[] = [];
      let completed = 0;
      let blocked = 0;

      data?.forEach((card) => {
        if (card.card_id?.startsWith('TEST-')) return;

        const duration = card.stage_entered_at
          ? Math.floor((now - new Date(card.stage_entered_at).getTime()) / 60000)
          : 0;

        if (card.status === 'in_progress') {
          activeCards.push({
            id: String(card.id),
            card_id: card.card_id,
            stage: card.current_machine || 'Unknown',
            machine: card.current_machine || 'Unknown',
            status: card.status,
            enteredAt: card.stage_entered_at || card.created_at,
            durationMinutes: duration,
          });
        } else if (card.status === 'completed') {
          completed++;
        } else if (card.status === 'blocked' || card.status === 'on_hold') {
          blocked++;
        }
      });

      setCards(activeCards);
      setStats({
        inProgress: activeCards.length,
        completed,
        blocked,
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
    const interval = setInterval(fetchCards, 5000);

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
