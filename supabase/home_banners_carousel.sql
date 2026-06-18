alter table public.site_settings
add column if not exists home_banners jsonb default '[]'::jsonb;

notify pgrst, 'reload schema';
