-- ============================================================
-- SmartTrack: Automated Production Metrics & Sensor Triggers
-- Path: supabase/migrations/20260610220000_automatic_perf_and_sensor_triggers.sql
-- ============================================================

-- 1. Ensure production_performance has a unique constraint on (date, machine_name)
-- Delete any duplicate rows keeping only the latest one per day per machine first
DELETE FROM public.production_performance a
WHERE a.id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY date, machine_name ORDER BY timestamp DESC) as rn
    FROM public.production_performance
  ) t
  WHERE t.rn > 1
);

ALTER TABLE public.production_performance DROP CONSTRAINT IF EXISTS unique_perf_date_machine;
ALTER TABLE public.production_performance ADD CONSTRAINT unique_perf_date_machine UNIQUE (date, machine_name);

-- 2. Update Lost Card Alert Trigger function to include 'lost' status
CREATE OR REPLACE FUNCTION fn_lost_card_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('cancelled', 'blocked', 'removed', 'lost') THEN

    INSERT INTO public.alerts (type, title, message, severity, is_read, card_id)
    VALUES (
      'loss',
      'Card ' || NEW.card_id || ' lost',
      'Card ' || NEW.card_id || ' has been marked as ' || NEW.status || '.',
      'high',
      FALSE,
      NEW.card_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Trigger function to automatically recalculate production performance metrics (OEE / OOE)
CREATE OR REPLACE FUNCTION fn_recalculate_production_performance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_machine text;
  v_date date;
  v_target int;
  v_actual int;
  v_good int;
  v_loss int;
  v_ooe float;
  v_oee float;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_machine := OLD.current_machine;
    v_date := COALESCE(OLD.created_at::date, CURRENT_DATE);
  ELSE
    v_machine := NEW.current_machine;
    v_date := COALESCE(NEW.created_at::date, CURRENT_DATE);
  END IF;

  -- Default machine reference
  IF v_machine IS NULL THEN
    v_machine := 'NPM-DX-1';
  END IF;

  -- Fetch expected cards target count from machine configuration
  SELECT COALESCE(expected_cards, 100) INTO v_target
  FROM public.configuration
  WHERE machine_name = v_machine
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_target IS NULL THEN
    v_target := 100;
  END IF;

  -- Count actual started cards (not pending) for today
  SELECT COUNT(*) INTO v_actual
  FROM public.electronic_cards
  WHERE current_machine = v_machine
    AND created_at::date = v_date
    AND status != 'pending';

  -- Count completed cards for today
  SELECT COUNT(*) INTO v_good
  FROM public.electronic_cards
  WHERE current_machine = v_machine
    AND created_at::date = v_date
    AND status = 'completed';

  -- Count lost/cancelled/removed/blocked cards for today
  SELECT COUNT(*) INTO v_loss
  FROM public.electronic_cards
  WHERE current_machine = v_machine
    AND created_at::date = v_date
    AND status IN ('cancelled', 'blocked', 'removed', 'lost');

  -- Calculate OOE (trg) and OEE (trs)
  IF v_target > 0 THEN
    v_ooe := ROUND((v_actual::float / v_target) * 100);
  ELSE
    v_ooe := 0;
  END IF;

  IF v_actual > 0 THEN
    v_oee := ROUND((v_good::float / v_actual) * 100);
  ELSE
    v_oee := 0;
  END IF;

  -- Upsert production_performance row
  INSERT INTO public.production_performance (
    machine_name, target_count, actual_count, good_count, loss_count,
    trg_percentage, trs_percentage, "OOE_percentage", "OEE_percentage", date, timestamp
  )
  VALUES (
    v_machine, v_target, v_actual, v_good, v_loss,
    v_ooe, v_oee, v_ooe, v_oee, v_date, NOW()
  )
  ON CONFLICT (date, machine_name) DO UPDATE
  SET
    target_count = EXCLUDED.target_count,
    actual_count = EXCLUDED.actual_count,
    good_count = EXCLUDED.good_count,
    loss_count = EXCLUDED.loss_count,
    trg_percentage = EXCLUDED.trg_percentage,
    trs_percentage = EXCLUDED.trs_percentage,
    "OOE_percentage" = EXCLUDED."OOE_percentage",
    "OEE_percentage" = EXCLUDED."OEE_percentage",
    timestamp = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_recalculate_production_performance ON public.electronic_cards;
CREATE TRIGGER tg_recalculate_production_performance
  AFTER INSERT OR UPDATE OR DELETE ON public.electronic_cards
  FOR EACH ROW
  EXECUTE FUNCTION fn_recalculate_production_performance();


-- 4. Trigger function to automatically maintain sensor_data (Live status & counters) from sensor_events
CREATE OR REPLACE FUNCTION fn_recalculate_sensor_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_date date;
  v_node_id text := 'PI5-NODE-01';
  v_c1 int;
  v_c2 int;
  v_c3 int;
  v_s1 bool := false;
  v_s2 bool := false;
  v_s3 bool := false;
BEGIN
  v_date := NEW.timestamp::date;

  -- Get total count of each event type for today
  SELECT COUNT(*) INTO v_c1 FROM public.sensor_events WHERE event_type = 'sensor_1_passed' AND timestamp::date = v_date;
  SELECT COUNT(*) INTO v_c2 FROM public.sensor_events WHERE event_type = 'sensor_2_passed' AND timestamp::date = v_date;
  SELECT COUNT(*) INTO v_c3 FROM public.sensor_events WHERE event_type = 'sensor_3_passed' AND timestamp::date = v_date;

  -- The triggered event defines which sensor is active (HIGH)
  v_s1 := (NEW.event_type = 'sensor_1_passed');
  v_s2 := (NEW.event_type = 'sensor_2_passed');
  v_s3 := (NEW.event_type = 'sensor_3_passed');

  -- Insert/update sensor_data row
  INSERT INTO public.sensor_data (
    node_id, sensor_1_status, sensor_2_status, sensor_3_status,
    sensor_1_counter, sensor_2_counter, sensor_3_counter, timestamp
  )
  VALUES (
    v_node_id, v_s1, v_s2, v_s3, v_c1, v_c2, v_c3, NEW.timestamp
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_recalculate_sensor_data ON public.sensor_events;
CREATE TRIGGER tg_recalculate_sensor_data
  AFTER INSERT ON public.sensor_events
  FOR EACH ROW
  EXECUTE FUNCTION fn_recalculate_sensor_data();
