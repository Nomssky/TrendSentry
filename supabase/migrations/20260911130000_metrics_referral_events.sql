-- Metrik eksperimen Milestone 4: sumber referral + event page-view first-party (tanpa PII).
alter table public.profiles add column if not exists referral_source text;

create table if not exists public.analytics_events (
  id         bigint generated always as identity primary key,
  path       text not null,
  ref        text,
  created_at timestamptz not null default now()
);
alter table public.analytics_events enable row level security;
drop policy if exists "events_insert" on public.analytics_events;
create policy "events_insert" on public.analytics_events
  for insert to anon, authenticated with check (true);

-- Salin referral_source dari user_metadata saat signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, referral_source)
  values (new.id, new.email, nullif(new.raw_user_meta_data->>'referral_source', ''));
  return new;
end;
$$;
