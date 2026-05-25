import { getSupabaseClient } from '@/lib/supabase'
import { useState, useEffect } from 'react'

export function useMachineConfig() {
  const [config, setConfig] = useState({
    expected: 10,
    cycleTime: 5,
    lossThreshold: 1,
    shiftStart: '08:00',
    shiftEnd: '16:00'
  })

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return

    supabase
      .from('configuration')
      .select('expected_daily_production, cycle_time_seconds, loss_threshold, shift_start, shift_end')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setConfig({
            expected: data.expected_daily_production || 10,
            cycleTime: data.cycle_time_seconds || 5,
            lossThreshold: data.loss_threshold || 1,
            shiftStart: data.shift_start?.toString().slice(0,5) || '08:00',
            shiftEnd: data.shift_end?.toString().slice(0,5) || '16:00'
          })
        }
      })
  }, [])

  return config
}
