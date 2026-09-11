-- Kunci guardrail template watcher (selaras PLAN.md §9 + preset pack CLI):
-- direction long-only saja, risk maks 1%, max concurrent maks 5.
-- (Seed awal 8 template sudah ada — file ini hanya mengencangkan batasnya.)
update public.strategy_templates
set params_schema = params_schema
  || jsonb_build_object('properties',
       (params_schema->'properties')
       || '{"direction": {"type": "string", "enum": ["long_only"], "default": "long_only", "description": "Arah (dikunci long-only)"}}'
       || '{"risk_per_trade_pct": {"type": "number", "default": 1.0, "minimum": 0.1, "maximum": 1.0}}'
       || '{"max_concurrent": {"type": "integer", "default": 5, "minimum": 1, "maximum": 5}}')
where name in ('Donchian Breakout', 'SMA Crossover', 'RSI Mean-Reversion',
  'Custom', 'Bollinger Bands', 'MACD Crossover', 'Ichimoku Cloud', 'VWAP Strategy');
