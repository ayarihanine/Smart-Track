-- ============================================================
-- Lost Card Alert Trigger — matches actual alerts table schema
-- alerts columns: id (UUID auto), type, title, message, severity, is_read, card_id, created_at
-- ============================================================
-- First, add card_id column to alerts table if it doesn't exist
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS card_id text;

CREATE OR REPLACE FUNCTION fn_lost_card_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('cancelled', 'blocked', 'removed') THEN

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

DROP TRIGGER IF EXISTS tg_lost_card_alert ON public.electronic_cards;

CREATE TRIGGER tg_lost_card_alert
  AFTER UPDATE OF status ON public.electronic_cards
  FOR EACH ROW
  EXECUTE FUNCTION fn_lost_card_alert();
