-- Frazon Store - final security hardening
-- Run manually in the Supabase SQL Editor after replacing the admin email below.
-- This script is non-destructive: it does not drop tables or delete data.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- REQUIRED BOOTSTRAP STEP:
-- Replace the email before running, or insert your admin email with the service_role key.
-- insert into public.admin_users (email)
-- values ('admin@example.com')
-- on conflict (email) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.site_settings enable row level security;
alter table public.orders enable row level security;

revoke all on table public.admin_users from public, anon, authenticated;
revoke all on table public.orders from public, anon, authenticated;
revoke all on table public.products from public, anon, authenticated;
revoke all on table public.categories from public, anon, authenticated;
revoke all on table public.site_settings from public, anon, authenticated;

grant select on table public.products to anon, authenticated;
grant select on table public.categories to anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert on table public.orders to anon, authenticated;

grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.site_settings to authenticated;
grant select, update, delete on table public.orders to authenticated;

drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Authenticated can manage products" on public.products;

create policy "Public can read active products" on public.products
  for select to anon, authenticated
  using (is_active = true or public.is_admin());

create policy "Admins can manage products" on public.products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public can read active categories" on public.categories;
drop policy if exists "Admins can manage categories" on public.categories;
drop policy if exists "Authenticated can manage categories" on public.categories;

create policy "Public can read active categories" on public.categories
  for select to anon, authenticated
  using (is_active = true or public.is_admin());

create policy "Admins can manage categories" on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public can read site settings" on public.site_settings;
drop policy if exists "Admins can manage site settings" on public.site_settings;
drop policy if exists "Authenticated can manage site settings" on public.site_settings;

create policy "Public can read site settings" on public.site_settings
  for select to anon, authenticated
  using (true);

create policy "Admins can manage site settings" on public.site_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public can create orders" on public.orders;
drop policy if exists "Anon can insert orders" on public.orders;
drop policy if exists "Authenticated can read orders" on public.orders;
drop policy if exists "Authenticated can update orders" on public.orders;
drop policy if exists "Authenticated can delete orders" on public.orders;
drop policy if exists "Admins can read orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Admins can delete orders" on public.orders;

create policy "Public can create orders" on public.orders
  for insert to anon, authenticated
  with check (
    status = 'whatsapp'
    and coalesce(stock_deducted, false) = false
    and completed_at is null
    and jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) between 1 and 50
    and subtotal >= 0
  );

create policy "Admins can read orders" on public.orders
  for select to authenticated
  using (public.is_admin());

create policy "Admins can update orders" on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete orders" on public.orders
  for delete to authenticated
  using (public.is_admin());

revoke execute on function public.confirm_order_sale(uuid) from public, anon;
grant execute on function public.confirm_order_sale(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read product images" on storage.objects;
drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;
drop policy if exists "Authenticated can upload product images" on storage.objects;
drop policy if exists "Authenticated can update product images" on storage.objects;
drop policy if exists "Authenticated can delete product images" on storage.objects;

create policy "Public can read product images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy "Admins can upload product images" on storage.objects
  for insert to authenticated
  with check (
    public.is_admin()
    and bucket_id = 'product-images'
    and lower((storage.foldername(name))[1]) in ('products', 'categories', 'site')
  );

create policy "Admins can update product images" on storage.objects
  for update to authenticated
  using (public.is_admin() and bucket_id = 'product-images')
  with check (
    public.is_admin()
    and bucket_id = 'product-images'
    and lower((storage.foldername(name))[1]) in ('products', 'categories', 'site')
  );

create policy "Admins can delete product images" on storage.objects
  for delete to authenticated
  using (public.is_admin() and bucket_id = 'product-images');

notify pgrst, 'reload schema';
