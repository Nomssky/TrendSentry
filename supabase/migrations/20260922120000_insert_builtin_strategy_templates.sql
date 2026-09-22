-- Seed kanonik 8 built-in strategy_templates (Phase 2C-3).
--
-- Sumber otoritatif: output database yang disuplai owner (id, name, description,
-- params_schema persis — jangan dinormalisasi/disederhanakan).
-- Forward-only: migration history TIDAK ditulis ulang; migration UPDATE guardrail
-- 20260911120000 tetap utuh (pada DB segar ia berjalan SEBELUM file ini dan jadi
-- no-op 0 baris — karena itu payload di sini sudah berbentuk pasca-guardrail).
--
-- Keamanan DB terisi: ON CONFLICT (name) DO NOTHING → produksi yang sudah punya
-- 8 nama kanonik = no-op total (tanpa duplikat, tanpa overwrite deskripsi/schema,
-- tanpa menyentuh user_strategies/FK). ID 1..8 dipertahankan (owner menyuplai ID
-- eksplisit; user_strategies.template_id dapat merujuknya); kolom id GENERATED
-- ALWAYS sehingga perlu OVERRIDING SYSTEM VALUE, lalu sequence disinkronkan ke
-- max(id) agar insert berikutnya tidak bentrok (cegah bug sequence).

insert into public.strategy_templates (id, name, description, params_schema)
overriding system value
values
  (1, 'Donchian Breakout', 'Classic Turtle Trading: entry on 20-day high breakout, exit on 10-day low breakout or ATR stop.', '{"type":"object","properties":{"direction":{"enum":["long_only"],"type":"string","default":"long_only","description":"Arah (dikunci long-only)"},"atr_period":{"max":50,"min":5,"type":"integer","default":14},"exit_period":{"max":50,"min":2,"type":"integer","default":10},"entry_period":{"max":100,"min":5,"type":"integer","default":20},"max_concurrent":{"type":"integer","default":5,"maximum":5,"minimum":1},"risk_per_trade_pct":{"type":"number","default":1,"maximum":1,"minimum":0.1},"atr_stop_multiplier":{"max":5,"min":0.5,"type":"number","default":2}}}'::jsonb),
  (2, 'SMA Crossover', 'Entry when fast SMA crosses above slow SMA, exit on cross below or stop loss.', '{"type":"object","properties":{"direction":{"enum":["long_only"],"type":"string","default":"long_only","description":"Arah (dikunci long-only)"},"atr_period":{"max":50,"min":5,"type":"integer","default":14},"fast_period":{"max":200,"min":2,"type":"integer","default":20},"slow_period":{"max":500,"min":5,"type":"integer","default":50},"max_concurrent":{"type":"integer","default":5,"maximum":5,"minimum":1},"risk_per_trade_pct":{"type":"number","default":1,"maximum":1,"minimum":0.1},"atr_stop_multiplier":{"max":5,"min":0.5,"type":"number","default":2}}}'::jsonb),
  (3, 'RSI Mean-Reversion', 'Entry when RSI crosses below oversold threshold, exit when above overbought or stop loss.', '{"type":"object","properties":{"oversold":{"max":45,"min":10,"type":"integer","default":30},"direction":{"enum":["long_only"],"type":"string","default":"long_only","description":"Arah (dikunci long-only)"},"atr_period":{"max":50,"min":5,"type":"integer","default":14},"overbought":{"max":90,"min":55,"type":"integer","default":70},"rsi_period":{"max":50,"min":5,"type":"integer","default":14},"max_concurrent":{"type":"integer","default":5,"maximum":5,"minimum":1},"risk_per_trade_pct":{"type":"number","default":1,"maximum":1,"minimum":0.1},"atr_stop_multiplier":{"max":5,"min":0.5,"type":"number","default":1.5}}}'::jsonb),
  (4, 'Custom', 'Define your own entry, exit, sizing, and stop loss rules.', '{"type":"object","properties":{"direction":{"enum":["long_only"],"type":"string","default":"long_only","description":"Arah (dikunci long-only)"},"rules_text":{"type":"string","default":""},"max_concurrent":{"type":"integer","default":5,"maximum":5,"minimum":1},"risk_per_trade_pct":{"type":"number","default":1,"maximum":1,"minimum":0.1}}}'::jsonb),
  (5, 'Bollinger Bands', 'Trade breakouts from Bollinger Bands (20-period, 2 std dev)', '{"type":"object","properties":{"period":{"max":50,"min":5,"type":"integer","default":20},"std_dev":{"max":3,"min":1,"type":"number","default":2},"direction":{"enum":["long_only"],"type":"string","default":"long_only","description":"Arah (dikunci long-only)"},"atr_period":{"max":50,"min":5,"type":"integer","default":14},"max_concurrent":{"type":"integer","default":5,"maximum":5,"minimum":1},"risk_per_trade_pct":{"type":"number","default":1,"maximum":1,"minimum":0.1},"atr_stop_multiplier":{"max":5,"min":0.5,"type":"number","default":2}}}'::jsonb),
  (6, 'MACD Crossover', 'Trade MACD signal line crossovers with trend filter', '{"type":"object","properties":{"direction":{"enum":["long_only"],"type":"string","default":"long_only","description":"Arah (dikunci long-only)"},"atr_period":{"max":50,"min":5,"type":"integer","default":14},"fast_period":{"max":50,"min":5,"type":"integer","default":12},"slow_period":{"max":100,"min":10,"type":"integer","default":26},"signal_period":{"max":20,"min":5,"type":"integer","default":9},"max_concurrent":{"type":"integer","default":5,"maximum":5,"minimum":1},"risk_per_trade_pct":{"type":"number","default":1,"maximum":1,"minimum":0.1},"atr_stop_multiplier":{"max":5,"min":0.5,"type":"number","default":2}}}'::jsonb),
  (7, 'Ichimoku Cloud', 'Trade breakouts from Ichimoku Kumo cloud', '{"type":"object","properties":{"direction":{"enum":["long_only"],"type":"string","default":"long_only","description":"Arah (dikunci long-only)"},"atr_period":{"max":50,"min":5,"type":"integer","default":14},"kijun_period":{"max":60,"min":10,"type":"integer","default":26},"tenkan_period":{"max":20,"min":5,"type":"integer","default":9},"max_concurrent":{"type":"integer","default":5,"maximum":5,"minimum":1},"senkou_b_period":{"max":120,"min":20,"type":"integer","default":52},"risk_per_trade_pct":{"type":"number","default":1,"maximum":1,"minimum":0.1},"atr_stop_multiplier":{"max":5,"min":0.5,"type":"number","default":2}}}'::jsonb),
  (8, 'VWAP Strategy', 'Trade deviations from Volume Weighted Average Price', '{"type":"object","properties":{"direction":{"enum":["long_only"],"type":"string","default":"long_only","description":"Arah (dikunci long-only)"},"atr_period":{"max":50,"min":5,"type":"integer","default":14},"deviation_pct":{"max":5,"min":0.1,"type":"number","default":1},"max_concurrent":{"type":"integer","default":5,"maximum":5,"minimum":1},"risk_per_trade_pct":{"type":"number","default":1,"maximum":1,"minimum":0.1},"atr_stop_multiplier":{"max":5,"min":0.5,"type":"number","default":2}}}'::jsonb)
on conflict (name) do nothing;

-- Sinkronkan sequence identity id ke max(id) — idempoten, aman diulang;
-- mencegah nextval bentrok dengan ID eksplisit yang baru disisipkan.
select setval(
  pg_get_serial_sequence('public.strategy_templates', 'id'),
  (select coalesce(max(id), 0) from public.strategy_templates),
  true
);
