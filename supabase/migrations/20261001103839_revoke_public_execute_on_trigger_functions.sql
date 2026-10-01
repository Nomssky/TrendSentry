-- ============================================================================
-- Revoke EXECUTE publik pada trigger functions SECURITY DEFINER.
--
-- Latar: advisor Supabase (2026-10-01) menandai
--   public.reject_config_version_update() dan public.recalc_discipline_score()
-- sebagai SECURITY DEFINER yang bisa dieksekusi role anon/authenticated via
-- /rest/v1/rpc/. Keduanya RETURNS trigger dan hanya bermakna dalam konteks
-- trigger (dipanggil via RPC tanpa NEW/OLD: yang satu raise exception, yang
-- satu return awal tanpa write) — jadi ini hygiene issue, bukan vuln aktif.
--
-- Perbaikan minimal: cabut EXECUTE dari PUBLIC/anon/authenticated.
-- Trigger tetap jalan: firing trigger TIDAK membutuhkan grant EXECUTE pada
-- fungsi. service_role/postgres tidak disentuh (backend + trigger owner).
-- handle_new_user() tidak disentuh (sudah hanya postgres + service_role).
-- ============================================================================

revoke execute on function public.reject_config_version_update() from public, anon, authenticated;
revoke execute on function public.recalc_discipline_score() from public, anon, authenticated;
