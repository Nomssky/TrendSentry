-- ============================================================================
-- TrendSentry: fix RLS policies (security audit)
-- 1. Drop paper_* write policies (service role bypasses RLS, policies unnecessary)
-- 2. Restrict user-scoped table policies to authenticated role
-- 3. Add set search_path to rls_auto_enable
-- ============================================================================

-- 1. Drop overly permissive paper_* write policies
-- Service role bypasses RLS by design, so these policies grant write access to
-- all roles (including anon), which is a security hole.
DROP POLICY IF EXISTS "Service role can insert paper_signals" ON public.paper_signals;
DROP POLICY IF EXISTS "Service role can insert paper_positions" ON public.paper_positions;
DROP POLICY IF EXISTS "Service role can upsert paper_equity_log" ON public.paper_equity_log;
DROP POLICY IF EXISTS "Service role can update paper_equity_log" ON public.paper_equity_log;
DROP POLICY IF EXISTS "Service role can upsert paper_meta" ON public.paper_meta;
DROP POLICY IF EXISTS "Service role can update paper_meta" ON public.paper_meta;

-- 2. Restrict user-scoped table policies to authenticated role only
-- "to public" is technically safe (anon users have null auth.uid()) but
-- "to authenticated" is more explicit and provides defense-in-depth.
ALTER POLICY "user_strategies_self" ON public.user_strategies TO authenticated;
ALTER POLICY "user_api_keys_self" ON public.user_api_keys TO authenticated;
ALTER POLICY "user_trades_self" ON public.user_trades TO authenticated;
ALTER POLICY "deviation_log_self" ON public.deviation_log TO authenticated;
ALTER POLICY "discipline_scores_self" ON public.discipline_scores TO authenticated;

-- 3. Add set search_path to rls_auto_enable (security definer best practice)
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schema_name, r.object_name);
  END LOOP;
END;
$$;
