import { getSupabaseClient } from '@/lib/supabase'
import { useState, useEffect } from 'react'

export function useMachineConfig() {
  const [config, setConfig] = useState({
    expected: 10,
    cycleTime: 5,
    lossThreshold: 1,
  })

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return

    supabase
      .from('configuration')
      .select('expected_cards, cycle_time_seconds, loss_threshold, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          setConfig({
            expected: data.expected_cards ?? 10,
            cycleTime: data.cycle_time_seconds || 5,
            lossThreshold: data.loss_threshold || 1,
          })
        }
      })
  }, [])

  return config
}
