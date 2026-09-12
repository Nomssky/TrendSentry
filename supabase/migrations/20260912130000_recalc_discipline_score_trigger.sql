-- P3-5: discipline_scores jadi turunan deviation_log. Tanpa ini, skor bisa basi
-- kalau deviasi dihapus/diubah di luar alur API (mis. koreksi manual).
--
-- Skor dihitung ulang tiap kali deviation_log berubah untuk (user_id, strategy_id,
-- tanggal detected_at). Rumus HARUS sama dengan monitoring/web/lib/deviation.ts:
--   score = 100 - critical*25 - (total-critical)*10, dijepit 0..100.
--
-- SECURITY DEFINER + search_path kosong (praktik aman untuk trigger function).

create or replace function public.recalc_discipline_score()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_strategy bigint;
  v_date date;
  v_total int;
  v_critical int;
  v_score int;
begin
  v_user := coalesce(new.user_id, old.user_id);
  v_strategy := coalesce(new.strategy_id, old.strategy_id);
  v_date := (coalesce(new.detected_at, old.detected_at))::date;

  -- Hanya untuk strategi yang teratribusi (bukan null).
  if v_user is null or v_strategy is null then
    return coalesce(new, old);
  end if;

  select count(*), count(*) filter (where severity = 'critical')
    into v_total, v_critical
    from public.deviation_log
   where user_id = v_user
     and strategy_id = v_strategy
     and detected_at >= v_date::timestamptz
     and detected_at < (v_date + 1)::timestamptz;

  v_score := greatest(0, least(100, 100 - v_critical * 25 - (v_total - v_critical) * 10));

  insert into public.discipline_scores (user_id, strategy_id, date, score, total_trades, deviations)
  values (
    v_user, v_strategy, v_date, v_score,
    (select count(*) from public.user_trades
      where user_id = v_user and strategy_id = v_strategy
        and executed_at >= v_date::timestamptz and executed_at < (v_date + 1)::timestamptz),
    v_total
  )
  on conflict (user_id, strategy_id, date)
  do update set score = excluded.score,
                total_trades = excluded.total_trades,
                deviations = excluded.deviations;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalc_discipline on public.deviation_log;
create trigger trg_recalc_discipline
  after insert or update or delete on public.deviation_log
  for each row execute function public.recalc_discipline_score();
