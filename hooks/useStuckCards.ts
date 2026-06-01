import { getSupabaseClient } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

export interface StuckCardRow {
  id: string;
  card_id: string;
  stage: string;
  enteredAt: string;
  minutesAtStage: number;
  severity: 'warning' | 'critical';
}

// Maximum time a card can be stuck before triggering an alert (10 minutes)
export const STUCK_THRESHOLD_MINUTES = 10;

const lastWriteByCardId = new Map<string, number>();
const ALERT_WRITE_COOLDOWN_MS = 5 * 60 * 1000; // 5 min between DB writes per card

export function useStuckCards(thresholdMinutes = STUCK_THRESHOLD_MINUTES) {
  const [stuckCards, setStuckCards] = useState<StuckCardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStuck = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // First: try DB-authoritative alerts table (written by backend)
      const { data: alertData, error: alertError } = await supabase
        .from('alerts')
        .select('id, title, message, severity, created_at, card_id')
        .eq('type', 'STUCK_CARD')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!alertError && alertData && alertData.length > 0) {
        // Batch-check if referenced cards are still stuck
        const cardIds = [...new Set(alertData.map(a => a.card_id).filter(Boolean))];
        const cardUpdatedMap = new Map<string, string>();
        if (cardIds.length > 0) {
          const { data: cards } = await supabase
            .from('electronic_cards')
            .select('card_id, updated_at, status')
            .in('card_id', cardIds);
          (cards || []).forEach(c => cardUpdatedMap.set(c.card_id, c.updated_at));
        }

        const now = Date.now();
        const rows: StuckCardRow[] = alertData
          .filter((alert) => {
            const cardId = alert.card_id;
            const cardUpdated = cardUpdatedMap.get(cardId);
            // Skip if card was updated after this alert was created (no longer stuck)
            if (cardUpdated && new Date(cardUpdated) > new Date(alert.created_at)) return false;
            return true;
          })
          .map((alert) => {
            const alertTime = new Date(alert.created_at).getTime();
            const minutesSinceAlert = Math.floor((now - alertTime) / 60000);
            return {
              id: String(alert.id),
              card_id: alert.card_id || alert.title?.replace('Stuck Card: ', '') || 'Unknown',
              stage: 'Unknown',
              enteredAt: alert.created_at,
              // Recalculate from alert creation time; cap at 60 min to avoid absurd values
              minutesAtStage: Math.min(minutesSinceAlert, 60),
              severity: (alert.severity === 'high' || alert.severity === 'critical')
                ? 'critical'
                : 'warning',
            };
          });

        rows.sort((a, b) => b.minutesAtStage - a.minutesAtStage);
        setStuckCards(rows);
        setLoading(false);
        return;
      }

      // Fallback — query electronic_cards directly. Compute elapsed time client-side.
      const { data, error } = await supabase
        .from('electronic_cards')
        .select('id, card_id, current_machine, status, stage_entered_at, updated_at, created_at')
        .in('status', ['in_progress', 'on_hold'])
        .not('card_id', 'like', 'TEST-%')
        .order('updated_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      const now = Date.now();

      const rows: StuckCardRow[] = (data || [])
        .map((card) => {
          const enteredAt = card.stage_entered_at || card.created_at || card.updated_at;
          // BUG 3 FIX: client-side duration computation from updated_at
          const minutesAtStage = enteredAt
            ? Math.floor((now - new Date(enteredAt).getTime()) / 60000)
            : 0;
          return { card, enteredAt, minutesAtStage };
        })
        .filter(({ minutesAtStage }) => minutesAtStage >= thresholdMinutes)
        .map(({ card, enteredAt, minutesAtStage }) => {
          const severity: StuckCardRow['severity'] =
            minutesAtStage >= thresholdMinutes * 3 ? 'critical' : 'warning';
          return {
            id: String(card.id),
            card_id: card.card_id,
            stage: card.current_machine || 'Unknown',
            enteredAt: enteredAt || card.updated_at,
            minutesAtStage,
            severity,
          };
        });

      rows.sort((a, b) => b.minutesAtStage - a.minutesAtStage);

      // Deduplicate by card_id — keep the entry with the most time stuck
      const seen = new Set<string>();
      const deduped = rows.filter((r) => {
        if (seen.has(r.card_id)) return false;
        seen.add(r.card_id);
        return true;
      });

      setStuckCards(deduped);

      // Write newly detected stuck cards to alerts table so badge/notifications show them
      if (deduped.length > 0) {
        const s = getSupabaseClient();
        if (s) {
          for (const card of deduped) {
            const lastWrite = lastWriteByCardId.get(card.card_id) || 0;
            if (Date.now() - lastWrite > ALERT_WRITE_COOLDOWN_MS) {
              lastWriteByCardId.set(card.card_id, Date.now());
              s.from('alerts').insert({
                card_id: card.card_id,
                type: 'STUCK_CARD',
                title: `Stuck Card: ${card.card_id}`,
                message: `Card ${card.card_id} has been stuck at ${card.stage} for ${card.minutesAtStage} minutes.`,
                severity: card.severity === 'critical' ? 'high' : 'medium',
                is_read: false,
                created_at: new Date().toISOString(),
              }).then(({ error }) => {
                if (error && error.code !== '23505') {
                  console.error('Failed to write stuck alert:', error);
                }
              });
            }
          }
        }
      }
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
    const interval = setInterval(fetchStuck, 30000);

    const channel = supabase
      .channel('stuck_cards_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'electronic_cards' },
        fetchStuck
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
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
