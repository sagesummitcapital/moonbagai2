-- 2026-10-18 · Secure 2R at TP1 on Moonbag limit setups + A+ push tracking (already live). Apply after 20261018130000.

-- add column if not exists notified_at
alter table public.limit_orders add column if not exists notified_at timestamptz;

-- lev_limit_plan(text[],boolean)
do $do$
declare d text; n int := 0;
begin
  d := pg_get_functiondef('public.lev_limit_plan(text[],boolean)'::regprocedure);
  -- Stavros 2026-10-18: "if i put tp at 2r i would have secured ... shoot to secure 2r+ on all A+ limit setups": TP1 = exactly 2R (70%), TP2 = the level target (runner); grade still from the room to the level
  if position($a$'limit', public.mb_px(v_entry), 'stop', public.mb_px(v_stop), 'tp1', public.mb_px(v_tgt), 'tp2', public.mb_px(v_tgt2),
        'plan_r', round(v_plan, 2),$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$'limit', public.mb_px(v_entry), 'stop', public.mb_px(v_stop), 'tp1', public.mb_px(v_tgt), 'tp2', public.mb_px(v_tgt2),
        'plan_r', round(v_plan, 2),$a$, $b$'limit', public.mb_px(v_entry), 'stop', public.mb_px(v_stop), 'tp1', public.mb_px(v_entry + sg * 2 * v_risk), 'tp2', public.mb_px(v_tgt),
        'plan_r', 2, 'room_r', round(v_plan, 2),$b$);
  if position($a$case when (best ->> 'plan_r')::numeric >= 3 then 'A+' else 'A' end$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$case when (best ->> 'plan_r')::numeric >= 3 then 'A+' else 'A' end$a$, $b$case when (best ->> 'room_r')::numeric >= 3 then 'A+' else 'A' end$b$);
  if position($a$format('%s %s limit %s, 0.5 x 1h ATR through the %s %s; stop %s (%s%%); TP1 %s (%sR)', a, best ->> 'side', best ->> 'limit',
          best ->> 'level_kind', best ->> 'level', best ->> 'stop', best ->> 'stop_pct', best ->> 'tp1', best ->> 'plan_r'))$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$format('%s %s limit %s, 0.5 x 1h ATR through the %s %s; stop %s (%s%%); TP1 %s (%sR)', a, best ->> 'side', best ->> 'limit',
          best ->> 'level_kind', best ->> 'level', best ->> 'stop', best ->> 'stop_pct', best ->> 'tp1', best ->> 'plan_r'))$a$, $b$format('%s %s limit %s, 0.5 x 1h ATR through the %s %s; stop %s (%s%%); TP1 %s (2R — secure 70%%) · runner TP2 %s (%sR room to the level)', a, best ->> 'side', best ->> 'limit',
          best ->> 'level_kind', best ->> 'level', best ->> 'stop', best ->> 'stop_pct', best ->> 'tp1', best ->> 'tp2', best ->> 'room_r'))$b$);
  if n <> 3 then raise exception 'anchors %', n; end if;
  execute d;
end $do$;

-- lev_fib_plan(text[],boolean)
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.lev_fib_plan(text[],boolean)'::regprocedure);
  if position($a$v_tp1 := v_ext; v_tp2 := v_ext + sg * 0.272 * leg;$a$ in d) = 0 then raise exception 'anchor'; end if;
  -- 2026-10-18: secure 2R at TP1 when the extreme is at least 2R away; the extreme becomes the runner target
  d := replace(d, $a$v_tp1 := v_ext; v_tp2 := v_ext + sg * 0.272 * leg;$a$, $b$if abs(v_ext - v_entry) > 2 * abs(v_entry - v_stop) then v_tp1 := v_entry + sg * 2 * abs(v_entry - v_stop); v_tp2 := v_ext;
    else v_tp1 := v_ext; v_tp2 := v_ext + sg * 0.272 * leg; end if;$b$);
  execute d;
end $do$;

-- SECURE 2R (Stavros 2026-10-18
do $do$
declare d text; n int := 0;
begin
  d := pg_get_functiondef('public.woods_scan(boolean)'::regprocedure);
  if position($a$cb jsonb; cb_dir text;$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$cb jsonb; cb_dir text;$a$, $b$cb jsonb; cb_dir text; rm numeric; room_r numeric;$b$);
  if position($a$        t2 := case when q2 is null then e + sg * greatest(3 * rk, sg * (t1 - e) + rk) else e + sg * (q2 - 0.1 * atr1) end;$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$        t2 := case when q2 is null then e + sg * greatest(3 * rk, sg * (t1 - e) + rk) else e + sg * (q2 - 0.1 * atr1) end;$a$, $b$        t2 := case when q2 is null then e + sg * greatest(3 * rk, sg * (t1 - e) + rk) else e + sg * (q2 - 0.1 * atr1) end;
        -- SECURE 2R (Stavros 2026-10-18: "if i put tp at 2r i would have secured ... shoot to secure 2r+ on all A+ limit setups"):
        -- when the first opposing pool is 2R+ away, TP1 = exactly 2R (70% off) and the pool becomes the runner target; under 2R the pool stays TP1 (flagged)
        rm := sg * (t1 - e) / rk;
        if rm >= 2 then t2 := case when rm >= 3 then t1 else greatest(sg * t2, sg * (e + sg * 3 * rk)) * sg end; t1 := e + sg * 2 * rk; end if;$b$);
  if position($a$best := p; v_entry := e; v_stop := s; v_tp1 := t1; v_tp2 := t2; risk := rk; blocked := why;$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$best := p; v_entry := e; v_stop := s; v_tp1 := t1; v_tp2 := t2; risk := rk; blocked := why;$a$, $b$best := p; v_entry := e; v_stop := s; v_tp1 := t1; v_tp2 := t2; risk := rk; blocked := why; room_r := rm;$b$);
  if position($a$'rr', case when rr1 is null then 0 when rr1 >= 3 then 20 when rr1 >= 2 then 15 when rr1 >= 1.5 then 10 when rr1 >= 1 then 5 else 0 end,$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$'rr', case when rr1 is null then 0 when rr1 >= 3 then 20 when rr1 >= 2 then 15 when rr1 >= 1.5 then 10 when rr1 >= 1 then 5 else 0 end,$a$, $b$'rr', case when room_r is null then 0 when room_r >= 3 then 20 when room_r >= 2 then 15 when room_r >= 1.5 then 10 when room_r >= 1 then 5 else 0 end,$b$);
  if n <> 4 then raise exception 'anchors %', n; end if;
  execute d;
end $do$;
