-- Hardening RLS profiles: user hanya boleh baca barisnya sendiri.
-- Sebelumnya "profiles_self" FOR ALL tanpa WITH CHECK → user login bisa
-- PATCH plan/stripe_customer_id sendiri lewat publishable key (bypass billing).
-- Kolom billing hanya boleh diubah service role (webhook Stripe, bypass RLS).
-- Insert profil saat signup tetap jalan via handle_new_user() SECURITY DEFINER.

DROP POLICY IF EXISTS "profiles_self" ON public.profiles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_select_self'
  ) THEN
    CREATE POLICY "profiles_select_self" ON public.profiles
      FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = id);
  END IF;
END
$$;
