-- ============================================================================
-- TrendSentry: add Stripe billing columns to profiles
-- ============================================================================

alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists plan_expires_at timestamptz;
