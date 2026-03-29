ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'single_day';

UPDATE public.events
SET schedule_type = CASE
    WHEN COALESCE(end_date::date, start_date::date) <> start_date::date THEN 'multi_day_daily'
    ELSE 'single_day'
END
WHERE schedule_type IS NULL OR schedule_type = 'single_day';

ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_schedule_type_check;

ALTER TABLE public.events
ADD CONSTRAINT events_schedule_type_check
CHECK (schedule_type IN ('single_day', 'multi_day_daily', 'multi_day_continuous'));

COMMENT ON COLUMN public.events.schedule_type IS
'Controls how event timing is interpreted: single_day, multi_day_daily, or multi_day_continuous.';
