-- Frazon Store - Supabase schema
-- Rode este arquivo no SQL Editor do Supabase antes de publicar o site.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  brand text not null default 'Frazon Store',
  category_id uuid references public.categories(id) on delete set null,
  category text not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  original_price numeric(12,2) check (original_price is null or original_price >= 0),
  pix_discount_percent numeric check (pix_discount_percent is null or pix_discount_percent >= 0),
  colors jsonb not null default '[]'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  badge text check (badge is null or badge in ('new', 'sale', 'bestseller')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id text primary key default 'main' check (id = 'main'),
  store_name text not null default 'Frazon Store',
  whatsapp_number text not null default '5561998273587',
  hero_eyebrow text not null default 'Streetwear masculino',
  hero_title text not null default 'Vista sua',
  hero_italic_title text not null default 'atitude',
  hero_subtitle text not null default 'Catálogo masculino com peças selecionadas para quem busca presença, conforto e estilo no dia a dia.',
  hero_image text,
  hero_image_mobile text,
  hero_image_desktop text,
  hero_title_line_1 text not null default 'VISTA SUA',
  hero_title_line_2 text not null default 'ESSÊNCIA',
  hero_subtitle_line_1 text not null default 'ROUPAS PARA HOMENS',
  hero_subtitle_line_2 text not null default 'QUE IMPÕEM PRESENÇA',
  hero_button_text text not null default 'EXPLORAR CATÁLOGO',
  hero_topbar_text_1 text not null default 'NOVIDADES EXCLUSIVAS',
  hero_topbar_text_2 text not null default 'PEDIDO DIRETO NO WHATSAPP',
  hero_topbar_text_3 text not null default 'ENVIO PARA TODO BRASIL',
  home_banners jsonb not null default '[]'::jsonb,
  about_eyebrow text not null default 'Sobre a Frazon Store',
  about_title text not null default 'Streetwear com',
  about_italic_word text not null default 'presença',
  about_text text not null default 'Peças masculinas selecionadas para quem valoriza caimento, identidade e praticidade. Escolha no catálogo e finalize direto pelo WhatsApp.',
  editorial_eyebrow text not null default 'Nova seleção',
  editorial_title text not null default 'Essenciais',
  editorial_italic_title text not null default 'urbanos',
  editorial_text text not null default 'Oversized, dry fit, moletom, corta vento e conjuntos para montar combinações fortes sem complicação.',
  editorial_image text,
  instagram_url text not null default '',
  email text not null default '',
  address text not null default 'Brasília, DF — Brasil',
  week_hours text not null default 'Seg — Sex: 10h às 20h',
  saturday_hours text not null default 'Sáb: 10h às 18h',
  footer_note text not null default 'Atendimento rápido pelo WhatsApp.',
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  customer_name text,
  customer_whatsapp text,
  whatsapp_message text not null default '',
  status text not null default 'whatsapp' check (status in ('whatsapp', 'contacted', 'completed', 'cancelled')),
  stock_deducted boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists stock_deducted boolean not null default false;

alter table public.orders
  add column if not exists completed_at timestamptz;

alter table public.orders
  add column if not exists customer_name text;

alter table public.orders
  add column if not exists customer_whatsapp text;

alter table public.products
  add column if not exists pix_discount_percent numeric check (pix_discount_percent is null or pix_discount_percent >= 0);

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create index if not exists products_active_idx on public.products(is_active);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.site_settings enable row level security;
alter table public.orders enable row level security;

-- Limpa políticas antigas com os mesmos nomes, se você rodar o SQL mais de uma vez.
drop policy if exists "Public can read active categories" on public.categories;
drop policy if exists "Admins can manage categories" on public.categories;
drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Public can read site settings" on public.site_settings;
drop policy if exists "Admins can manage site settings" on public.site_settings;
drop policy if exists "Public can create orders" on public.orders;
drop policy if exists "Admins can read orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;

create policy "Public can read active categories" on public.categories
  for select using (is_active = true or auth.role() = 'authenticated');

create policy "Admins can manage categories" on public.categories
  for all to authenticated using (true) with check (true);

create policy "Public can read active products" on public.products
  for select using (is_active = true or auth.role() = 'authenticated');

create policy "Admins can manage products" on public.products
  for all to authenticated using (true) with check (true);

create policy "Public can read site settings" on public.site_settings
  for select using (true);

create policy "Admins can manage site settings" on public.site_settings
  for all to authenticated using (true) with check (true);

create policy "Public can create orders" on public.orders
  for insert to anon with check (true);

create policy "Admins can read orders" on public.orders
  for select to authenticated using (true);

create policy "Admins can update orders" on public.orders
  for update to authenticated using (true) with check (true);

create or replace function public.confirm_order_sale(order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
  order_item jsonb;
  product_record public.products%rowtype;
  variant_index integer;
  current_stock integer;
  requested_quantity integer;
  updated_variants jsonb;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;

  select *
    into order_record
    from public.orders
    where id = order_id
    for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if order_record.status = 'cancelled' then
    raise exception 'Pedido cancelado não pode ser confirmado.';
  end if;

  if order_record.status = 'completed' and coalesce(order_record.stock_deducted, false) then
    return;
  end if;

  if order_record.items is null or jsonb_array_length(order_record.items) = 0 then
    raise exception 'Pedido sem itens.';
  end if;

  for order_item in select value from jsonb_array_elements(order_record.items)
  loop
    requested_quantity := coalesce(nullif(order_item->>'quantity', '')::integer, 0);

    if requested_quantity <= 0 then
      raise exception 'Quantidade inválida no pedido.';
    end if;

    select *
      into product_record
      from public.products
      where id = (order_item->>'productId')::uuid
      for update;

    if not found then
      raise exception 'Produto do pedido não encontrado: %', order_item->>'productName';
    end if;

    select ordinality::integer - 1, coalesce(nullif(value->>'stock', '')::integer, 0)
      into variant_index, current_stock
      from jsonb_array_elements(product_record.variants) with ordinality
      where value->'color'->>'name' = order_item->>'color'
        and value->>'size' = order_item->>'size'
      limit 1;

    if variant_index is null then
      raise exception 'Variação sem estoque encontrada: % / % / %', order_item->>'productName', order_item->>'color', order_item->>'size';
    end if;

    if current_stock < requested_quantity then
      raise exception 'Estoque insuficiente para % (% / %). Disponível: %, pedido: %',
        order_item->>'productName',
        order_item->>'color',
        order_item->>'size',
        current_stock,
        requested_quantity;
    end if;
  end loop;

  for order_item in select value from jsonb_array_elements(order_record.items)
  loop
    requested_quantity := coalesce(nullif(order_item->>'quantity', '')::integer, 0);

    select *
      into product_record
      from public.products
      where id = (order_item->>'productId')::uuid
      for update;

    select ordinality::integer - 1, coalesce(nullif(value->>'stock', '')::integer, 0)
      into variant_index, current_stock
      from jsonb_array_elements(product_record.variants) with ordinality
      where value->'color'->>'name' = order_item->>'color'
        and value->>'size' = order_item->>'size'
      limit 1;

    updated_variants := jsonb_set(
      product_record.variants,
      array[variant_index::text, 'stock'],
      to_jsonb(greatest(0, current_stock - requested_quantity)),
      false
    );

    update public.products
      set variants = updated_variants,
          updated_at = now()
      where id = product_record.id;
  end loop;

  update public.orders
    set status = 'completed',
        stock_deducted = true,
        completed_at = now()
    where id = order_id;
end;
$$;

grant execute on function public.confirm_order_sale(uuid) to authenticated;

insert into public.site_settings (id, store_name, whatsapp_number)
values ('main', 'Frazon Store', '5561998273587')
on conflict (id) do update set
  store_name = excluded.store_name,
  whatsapp_number = excluded.whatsapp_number,
  updated_at = now();

insert into public.categories (name, slug, sort_order, is_active)
values
  ('Oversized', 'oversized', 1, true),
  ('Camisetas', 'camisetas', 2, true),
  ('Moletom', 'moletom', 3, true),
  ('Corta Vento', 'corta-vento', 4, true),
  ('Bermuda Cargo', 'bermuda-cargo', 5, true),
  ('Dry Fit', 'dry-fit', 6, true),
  ('Conjuntos', 'conjuntos', 7, true)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- Storage público para fotos do catálogo. O upload só é permitido para usuário autenticado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read product images" on storage.objects;
drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;

create policy "Public can read product images" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "Admins can upload product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

create policy "Admins can update product images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images') with check (bucket_id = 'product-images');

create policy "Admins can delete product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');
