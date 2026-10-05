-- Moonbag — let a trade's targets be adjusted after entry (Stavros, 2026-10-05).
-- The original stop / tp1-3 stay write-once (they are the plan that gets graded);
-- adjustments go in current_stop (already existed) and current_tp1-3.
alter table public.trades add column if not exists current_tp1 numeric;
alter table public.trades add column if not exists current_tp2 numeric;
alter table public.trades add column if not exists current_tp3 numeric;
comment on column public.trades.current_tp1 is 'Live TP1 after an adjustment. The original tp1 stays write-once for grading; null = unchanged.';
