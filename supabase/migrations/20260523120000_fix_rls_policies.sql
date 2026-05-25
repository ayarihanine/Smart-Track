-- production_losses: Allow anon + authenticated reads
DROP POLICY IF EXISTS "losses_anon_read" ON public.production_losses;
CREATE POLICY "losses_read_all" ON public.production_losses
  FOR SELECT TO anon, authenticated USING (true);

-- sensor_events: Allow anon + authenticated reads
DROP POLICY IF EXISTS "sensor_events_anon_read" ON public.sensor_events;
CREATE POLICY "sensor_events_read_all" ON public.sensor_events
  FOR SELECT TO anon, authenticated USING (true);

-- alerts: Allow anon + authenticated reads
DROP POLICY IF EXISTS "alerts_anon_read" ON public.alerts;
CREATE POLICY "alerts_read_all" ON public.alerts
  FOR SELECT TO anon, authenticated USING (true);

-- Keep INSERT restricted to service_role only (Pi5 script)
DROP POLICY IF EXISTS "losses_service_insert" ON public.production_losses;
CREATE POLICY "losses_service_insert" ON public.production_losses
  FOR INSERT TO service_role WITH CHECK (true);
