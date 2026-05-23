import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

export interface LossData {
  totalCost: number;
  totalCards: number;
  zone1: number;
  zone2: number;
}

export function useTodaysLosses() {
  const [data, setData] = useState<LossData>({ totalCost: 0, totalCards: 0, zone1: 0, zone2: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLosses = async () => {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const { data: rows, error } = await supabase
        .from('production_losses')
        .select('zone_from, quantity, estimated_cost_tnd')
        .gte('loss_date', `${today}T00:00:00+00:00`);

      if (!error && rows) {
        let zone1 = 0;
        let zone2 = 0;
        let totalCost = 0;
        let totalCards = 0;
        rows.forEach((r) => {
          totalCost += Number(r.estimated_cost_tnd || 0);
          totalCards += Number(r.quantity || 0);
          if (r.zone_from === 'capteur1') zone1 += Number(r.quantity || 0);
          if (r.zone_from === 'capteur2') zone2 += Number(r.quantity || 0);
        });
        setData({ totalCost, totalCards, zone1, zone2 });
      }
      setLoading(false);
    };

    fetchLosses();
    const channel = supabase
      .channel('losses_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_losses' }, fetchLosses)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { ...data, loading };
}
