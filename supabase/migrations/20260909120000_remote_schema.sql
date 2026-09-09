-- ============================================================================
-- TrendSentry: remote schema capture (2026-09-09)
-- Generated via Supabase MCP — covers all tables, RLS, functions, triggers.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_stat_statements" with schema extensions;
create extension if not exists "moddatetime";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- profiles (linked to auth.users)
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- strategy_templates (shared, read-only for all users)
create table public.strategy_templates (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  description  text,
  params_schema jsonb not null
);

-- user_strategies
create table public.user_strategies (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  template_id bigint references public.strategy_templates(id),
  params     jsonb not null default '{}',
  rules_json jsonb,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- user_api_keys (encrypted at rest)
create table public.user_api_keys (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  exchange       text not null default 'bitget',
  api_key_enc    text not null,
  api_secret_enc text not null,
  passphrase_enc text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique(user_id, exchange)
);

-- user_trades
create table public.user_trades (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  strategy_id  bigint references public.user_strategies(id),
  exchange     text not null default 'bitget',
  pair         text not null,
  side         text not null,
  price        real not null,
  amount       real not null,
  fee          real,
  fee_currency text,
  executed_at  timestamptz not null,
  ingested_at  timestamptz not null default now()
);

-- deviation_log
create table public.deviation_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  strategy_id bigint references public.user_strategies(id),
  trade_id    bigint references public.user_trades(id),
  rule_key    text not null,
  expected    text,
  actual      text,
  severity    text not null default 'warning',
  detected_at timestamptz not null default now()
);

-- discipline_scores
create table public.discipline_scores (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  strategy_id  bigint references public.user_strategies(id),
  date         date not null,
  score        smallint not null check (score >= 0 and score <= 100),
  total_trades integer not null default 0,
  deviations   integer not null default 0,
  unique(user_id, strategy_id, date)
);

-- paper_signals (shared paper trading data)
create table public.paper_signals (
  id           bigint generated always as identity primary key,
  candle_date  text not null,
  processed_at text not null,
  pair         text not null,
  close_price  real not null,
  donchian_hi  real,
  donchian_lo  real,
  atr          real,
  signal       text not null,
  decision     text not null,
  reason       text,
  unique(candle_date, pair)
);

-- paper_positions
create table public.paper_positions (
  id           bigint generated always as identity primary key,
  pair         text not null,
  entry_date   text not null,
  entry_price  real not null,
  units        real not null,
  stop_price   real not null,
  risk_amount  real not null,
  status       text not null default 'open',
  exit_date    text,
  exit_price   real,
  exit_reason  text,
  pnl          real,
  r_multiple   real
);

-- paper_equity_log
create table public.paper_equity_log (
  date          text primary key,
  cash          real not null,
  positions_mtm real not null,
  n_open        integer not null default 0,
  total_equity  real not null
);

-- paper_meta
create table public.paper_meta (
  key   text primary key,
  value text not null
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_user_strategies_user_id on public.user_strategies(user_id);
create index idx_user_trades_user_id on public.user_trades(user_id);
create index idx_user_trades_executed_at on public.user_trades(executed_at desc);
create index idx_user_api_keys_user_id on public.user_api_keys(user_id);
create index idx_deviation_log_user_id on public.deviation_log(user_id);
create index idx_discipline_scores_user_id on public.discipline_scores(user_id);
create index idx_paper_signals_pair on public.paper_signals(pair);
create index idx_paper_signals_candle_date on public.paper_signals(candle_date);

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.strategy_templates enable row level security;
alter table public.user_strategies enable row level security;
alter table public.user_api_keys enable row level security;
alter table public.user_trades enable row level security;
alter table public.deviation_log enable row level security;
alter table public.discipline_scores enable row level security;
alter table public.paper_signals enable row level security;
alter table public.paper_positions enable row level security;
alter table public.paper_equity_log enable row level security;
alter table public.paper_meta enable row level security;

-- profiles: owner read/write
create policy "profiles_self" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id);

-- strategy_templates: public read only
create policy "strategy_templates_read" on public.strategy_templates
  for select to public using (true);

-- user_strategies: owner read/write
create policy "user_strategies_self" on public.user_strategies
  for all to public using (auth.uid() = user_id);

-- user_api_keys: owner read/write
create policy "user_api_keys_self" on public.user_api_keys
  for all to public using (auth.uid() = user_id);

-- user_trades: owner read/write
create policy "user_trades_self" on public.user_trades
  for all to public using (auth.uid() = user_id);

-- deviation_log: owner read/write
create policy "deviation_log_self" on public.deviation_log
  for all to public using (auth.uid() = user_id);

-- discipline_scores: owner read/write
create policy "discipline_scores_self" on public.discipline_scores
  for all to public using (auth.uid() = user_id);

-- paper_signals: public read, service role write
create policy "Public read access on paper_signals" on public.paper_signals
  for select to public using (true);
create policy "Service role can insert paper_signals" on public.paper_signals
  for insert to public with check (true);

-- paper_positions: public read, service role write
create policy "Public read access on paper_positions" on public.paper_positions
  for select to public using (true);
create policy "Service role can insert paper_positions" on public.paper_positions
  for insert to public with check (true);

-- paper_equity_log: public read, service role write
create policy "Public read access on paper_equity_log" on public.paper_equity_log
  for select to public using (true);
create policy "Service role can upsert paper_equity_log" on public.paper_equity_log
  for insert to public with check (true);
create policy "Service role can update paper_equity_log" on public.paper_equity_log
  for update to public using (true);

-- paper_meta: public read, service role write
create policy "Public read access on paper_meta" on public.paper_meta
  for select to public using (true);
create policy "Service role can upsert paper_meta" on public.paper_meta
  for insert to public with check (true);
create policy "Service role can update paper_meta" on public.paper_meta
  for update to public using (true);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Handle new user signup: create profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Auto-enable RLS on new tables
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in select * from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE TABLE'
      and schema_name = 'public'
  loop
    execute format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schema_name, r.object_name);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Auto-create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-enable RLS on new tables
create event trigger rls_auto_enable on ddl_command_end
  when tag in ('CREATE TABLE')
  execute function public.rls_auto_enable();
