-- Frazon Store - security hardening before production deploy
-- Run this in the Supabase SQL Editor.

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.site_settings enable row level security;
alter table public.orders enable row level security;

revoke all on table public.orders from public;
revoke all on table public.orders from anon;
revoke all on table public.orders from authenticated;
grant insert on table public.orders to anon;
grant select, update, delete on table public.orders to authenticated;

revoke all on table public.products from public;
revoke all on table public.products from anon;
revoke all on table public.products from authenticated;
grant select on table public.products to anon;
grant select, insert, update, delete on table public.products to authenticated;

revoke all on table public.categories from public;
revoke all on table public.categories from anon;
revoke all on table public.categories from authenticated;
grant select on table public.categories to anon;
grant select, insert, update, delete on table public.categories to authenticated;

revoke all on table public.site_settings from public;
revoke all on table public.site_settings from anon;
revoke all on table public.site_settings from authenticated;
grant select on table public.site_settings to anon;
grant select, insert, update, delete on table public.site_settings to authenticated;

drop policy if exists "Public can create orders" on public.orders;
drop policy if exists "Public can read orders" on public.orders;
drop policy if exists "Public can update orders" on public.orders;
drop policy if exists "Public can delete orders" on public.orders;
drop policy if exists "Anon can insert orders" on public.orders;
drop policy if exists "Authenticated can read orders" on public.orders;
drop policy if exists "Authenticated can update orders" on public.orders;
drop policy if exists "Authenticated can delete orders" on public.orders;
drop policy if exists "Admins can read orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Admins can delete orders" on public.orders;

create policy "Anon can insert orders" on public.orders
  for insert to anon
  with check (true);

create policy "Authenticated can read orders" on public.orders
  for select to authenticated
  using (true);

create policy "Authenticated can update orders" on public.orders
  for update to authenticated
  using (true)
  with check (true);

create policy "Authenticated can delete orders" on public.orders
  for delete to authenticated
  using (true);

drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Authenticated can manage products" on public.products;

create policy "Public can read active products" on public.products
  for select to anon, authenticated
  using (is_active = true or auth.role() = 'authenticated');

create policy "Authenticated can manage products" on public.products
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "Public can read active categories" on public.categories;
drop policy if exists "Admins can manage categories" on public.categories;
drop policy if exists "Authenticated can manage categories" on public.categories;

create policy "Public can read active categories" on public.categories
  for select to anon, authenticated
  using (is_active = true or auth.role() = 'authenticated');

create policy "Authenticated can manage categories" on public.categories
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "Public can read site settings" on public.site_settings;
drop policy if exists "Admins can manage site settings" on public.site_settings;
drop policy if exists "Authenticated can manage site settings" on public.site_settings;

create policy "Public can read site settings" on public.site_settings
  for select to anon, authenticated
  using (true);

create policy "Authenticated can manage site settings" on public.site_settings
  for all to authenticated
  using (true)
  with check (true);

revoke execute on function public.confirm_order_sale(uuid) from public;
revoke execute on function public.confirm_order_sale(uuid) from anon;
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

create policy "Authenticated can upload product images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and lower((storage.foldername(name))[1]) in ('products', 'categories', 'site')
  );

create policy "Authenticated can update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images')
  with check (
    bucket_id = 'product-images'
    and lower((storage.foldername(name))[1]) in ('products', 'categories', 'site')
  );

create policy "Authenticated can delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images');

notify pgrst, 'reload schema';
