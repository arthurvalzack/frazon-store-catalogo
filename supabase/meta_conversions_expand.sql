-- Frazon Store: Meta Conversions expansion phase.
-- Apply after schema.sql and security_hardening_final.sql. Safe to rerun.
begin;

alter table public.orders add column if not exists marketing_consent boolean not null default false;
alter table public.orders add column if not exists meta_fbp text;
alter table public.orders add column if not exists meta_fbc text;
alter table public.orders add column if not exists meta_event_source_url text;
alter table public.orders add column if not exists meta_client_user_agent text;
alter table public.orders add column if not exists meta_initiate_checkout_event_id text;
alter table public.orders add column if not exists meta_initiate_checkout_sent_at timestamptz;
alter table public.orders add column if not exists meta_initiate_checkout_processing_at timestamptz;
alter table public.orders add column if not exists meta_purchase_event_id text;
alter table public.orders add column if not exists meta_purchase_sent_at timestamptz;
alter table public.orders add column if not exists meta_purchase_processing_at timestamptz;
alter table public.orders add column if not exists meta_purchase_last_error text;

-- Compatibility bridge: preserve the legacy direct-write path until lockdown.
grant insert on table public.orders to anon, authenticated;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'orders'
      and policyname = 'Public can create orders'
  ) then
    execute $policy$
      create policy "Public can create orders" on public.orders
      for insert to anon, authenticated
      with check (
        status = 'whatsapp'
        and not coalesce(stock_deducted, false)
        and completed_at is null
        and jsonb_typeof(items) = 'array'
        and jsonb_array_length(items) between 1 and 50
        and subtotal >= 0
        and marketing_consent = false
        and meta_fbp is null
        and meta_fbc is null
        and meta_event_source_url is null
        and meta_client_user_agent is null
        and meta_initiate_checkout_event_id is null
        and meta_initiate_checkout_sent_at is null
        and meta_initiate_checkout_processing_at is null
        and meta_purchase_event_id is null
        and meta_purchase_sent_at is null
        and meta_purchase_processing_at is null
        and meta_purchase_last_error is null
      )
    $policy$;
  end if;
  execute $policy$
    alter policy "Public can create orders" on public.orders
    to anon, authenticated
    with check (
      status = 'whatsapp'
      and not coalesce(stock_deducted, false)
      and completed_at is null
      and jsonb_typeof(items) = 'array'
      and jsonb_array_length(items) between 1 and 50
      and subtotal >= 0
      and marketing_consent = false
      and meta_fbp is null
      and meta_fbc is null
      and meta_event_source_url is null
      and meta_client_user_agent is null
      and meta_initiate_checkout_event_id is null
      and meta_initiate_checkout_sent_at is null
      and meta_initiate_checkout_processing_at is null
      and meta_purchase_event_id is null
      and meta_purchase_sent_at is null
      and meta_purchase_processing_at is null
      and meta_purchase_last_error is null
    )
  $policy$;
end;
$$;

create or replace function public.create_public_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_whatsapp text,
  p_marketing_consent boolean default false,
  p_meta_fbp text default null,
  p_meta_fbc text default null,
  p_event_source_url text default null,
  p_client_user_agent text default null
)
returns table(order_id uuid, items jsonb, subtotal numeric, created_at timestamptz, initiate_checkout_event_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := pg_catalog.gen_random_uuid();
  v_created_at timestamptz := now();
  v_customer_name text := btrim(regexp_replace(coalesce(p_customer_name, ''), '\s+', ' ', 'g'));
  v_customer_whatsapp text := regexp_replace(coalesce(p_customer_whatsapp, ''), '\D', '', 'g');
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric(12,2) := 0;
  v_event_id text;
  v_input record;
  v_product public.products%rowtype;
  v_stock integer;
  v_image text;
  v_line_subtotal numeric(12,2);
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'O pedido deve conter entre 1 e 50 itens.';
  end if;
  if char_length(v_customer_name) not between 1 and 80 then raise exception 'Nome inválido.'; end if;
  if char_length(v_customer_whatsapp) not between 10 and 15 then raise exception 'WhatsApp inválido.'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) value
    where jsonb_typeof(value) <> 'object'
      or coalesce(value->>'productId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(value->>'quantity', '') !~ '^[0-9]+$'
      or (value->>'quantity')::integer not between 1 and 99
      or char_length(btrim(coalesce(value->>'color', ''))) not between 1 and 80
      or char_length(btrim(coalesce(value->>'size', ''))) not between 1 and 30
  ) then raise exception 'Existem itens inválidos no pedido.'; end if;

  -- Aggregate equal variants so split lines cannot bypass the stock check.
  for v_input in
    select value->>'productId' as product_id, btrim(value->>'color') as color,
      btrim(value->>'size') as size, sum((value->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) value
    where jsonb_typeof(value) = 'object'
      and coalesce(value->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and coalesce(value->>'quantity', '') ~ '^[0-9]+$'
      and (value->>'quantity')::integer between 1 and 99
      and char_length(btrim(coalesce(value->>'color', ''))) between 1 and 80
      and char_length(btrim(coalesce(value->>'size', ''))) between 1 and 30
    group by value->>'productId', btrim(value->>'color'), btrim(value->>'size')
  loop
    if v_input.quantity > 99 then raise exception 'Quantidade total inválida para uma variante.'; end if;
    select * into v_product from public.products
      where id = v_input.product_id::uuid and is_active = true;
    if not found then raise exception 'Produto inválido ou inativo.'; end if;
    if v_product.price <= 0 then raise exception 'Produto com preço inválido.'; end if;

    select nullif(variant->>'stock', '')::integer into v_stock
    from jsonb_array_elements(v_product.variants) variant
    where variant->'color'->>'name' = v_input.color and variant->>'size' = v_input.size
      and coalesce(variant->>'stock', '') ~ '^[0-9]+$'
    limit 1;
    if v_stock is null then raise exception 'Variação inválida.'; end if;
    if v_stock < v_input.quantity then raise exception 'Estoque insuficiente.'; end if;

    v_image := case
      when jsonb_typeof(v_product.images->0) = 'object' then left(v_product.images->0->>'url', 2048)
      when jsonb_typeof(v_product.images->0) = 'string' then left(v_product.images->>0, 2048)
      else null end;
    v_line_subtotal := round(v_product.price * v_input.quantity, 2);
    v_subtotal := v_subtotal + v_line_subtotal;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id::text, 'productName', left(v_product.name, 200),
      'color', v_input.color, 'size', v_input.size, 'quantity', v_input.quantity,
      'unitPrice', v_product.price, 'subtotal', v_line_subtotal,
      'pixDiscountPercent', v_product.pix_discount_percent, 'image', v_image
    ));
  end loop;

  if jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) <> (
    select count(*) from (select value->>'productId', btrim(value->>'color'), btrim(value->>'size')
      from jsonb_array_elements(p_items) value group by 1,2,3) grouped_items
  ) then raise exception 'Existem itens inválidos no pedido.'; end if;
  if v_subtotal <= 0 then raise exception 'Subtotal inválido.'; end if;

  v_event_id := case when coalesce(p_marketing_consent, false) then 'initiate-checkout-' || v_order_id::text else null end;
  insert into public.orders(id, items, subtotal, customer_name, customer_whatsapp, whatsapp_message,
    status, stock_deducted, completed_at, created_at, marketing_consent, meta_fbp, meta_fbc,
    meta_event_source_url, meta_client_user_agent, meta_initiate_checkout_event_id)
  values(v_order_id, v_items, v_subtotal, v_customer_name, v_customer_whatsapp, '',
    'whatsapp', false, null, v_created_at, coalesce(p_marketing_consent, false),
    case when p_marketing_consent then left(nullif(p_meta_fbp, ''), 255) end,
    case when p_marketing_consent then left(nullif(p_meta_fbc, ''), 255) end,
    case when p_marketing_consent then left(nullif(p_event_source_url, ''), 2048) end,
    case when p_marketing_consent then left(nullif(p_client_user_agent, ''), 1024) end,
    v_event_id);

  return query select v_order_id, v_items, v_subtotal, v_created_at, v_event_id;
end;
$$;

create or replace function public.confirm_order_sale(order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_item jsonb; v_line record;
  v_product public.products%rowtype; v_index integer; v_stock integer; v_variants jsonb;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  if order_id is null then raise exception 'Pedido inválido.'; end if;
  select * into v_order from public.orders where id = order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if v_order.status = 'cancelled' then raise exception 'Pedido cancelado não pode ser confirmado.'; end if;
  if v_order.status in ('completed', 'completed_sale') and v_order.stock_deducted then return; end if;
  if jsonb_typeof(v_order.items) <> 'array' or jsonb_array_length(v_order.items) not between 1 and 50 then raise exception 'Pedido sem itens válidos.'; end if;

  for v_item in select value from jsonb_array_elements(v_order.items) loop
    if jsonb_typeof(v_item) <> 'object' or coalesce(v_item->>'productId','') !~* '^[0-9a-f-]{36}$'
      or coalesce(v_item->>'quantity','') !~ '^[0-9]+$' or (v_item->>'quantity')::integer not between 1 and 99
      or btrim(coalesce(v_item->>'color','')) = '' or btrim(coalesce(v_item->>'size','')) = '' then
      raise exception 'Item inválido no pedido.';
    end if;
  end loop;

  for v_line in select value->>'productId' product_id, value->>'color' color, value->>'size' size,
      sum((value->>'quantity')::integer)::integer quantity from jsonb_array_elements(v_order.items) value group by 1,2,3
  loop
    if v_line.quantity > 99 then raise exception 'Quantidade total inválida.'; end if;
    select * into v_product from public.products where id = v_line.product_id::uuid for update;
    if not found then raise exception 'Produto do pedido não encontrado.'; end if;
    select ordinality::integer - 1, (variant->>'stock')::integer into v_index, v_stock
      from jsonb_array_elements(v_product.variants) with ordinality as variants(variant, ordinality)
      where variant->'color'->>'name' = v_line.color and variant->>'size' = v_line.size
        and coalesce(variant->>'stock','') ~ '^[0-9]+$' limit 1;
    if v_index is null then raise exception 'Variação do pedido não encontrada.'; end if;
    if v_stock < v_line.quantity then raise exception 'Estoque insuficiente.'; end if;
    v_variants := jsonb_set(v_product.variants, array[v_index::text, 'stock'], to_jsonb(v_stock - v_line.quantity), false);
    update public.products set variants = v_variants, updated_at = now() where id = v_product.id;
  end loop;
  update public.orders set status = 'completed', stock_deducted = true, completed_at = now() where id = order_id;
end;
$$;

create or replace function public.claim_meta_conversion(p_order_id uuid, p_event_name text, p_event_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare affected_rows integer := 0;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then raise exception 'Acesso negado.'; end if;
  if p_event_name = 'InitiateCheckout' then
    update public.orders set meta_initiate_checkout_processing_at = now() where id = p_order_id and marketing_consent
      and meta_initiate_checkout_event_id = p_event_id and meta_initiate_checkout_sent_at is null
      and (meta_initiate_checkout_processing_at is null or meta_initiate_checkout_processing_at < now() - interval '5 minutes');
  elsif p_event_name = 'Purchase' then
    update public.orders set meta_purchase_event_id = coalesce(meta_purchase_event_id,p_event_id), meta_purchase_processing_at=now(), meta_purchase_last_error=null
      where id=p_order_id and marketing_consent and stock_deducted and status in ('completed','completed_sale')
      and coalesce(meta_purchase_event_id,p_event_id)=p_event_id and meta_purchase_sent_at is null
      and (meta_purchase_processing_at is null or meta_purchase_processing_at < now()-interval '5 minutes');
  else raise exception 'Evento não permitido.'; end if;
  get diagnostics affected_rows = row_count; return affected_rows = 1;
end; $$;

create or replace function public.finish_meta_conversion(p_order_id uuid,p_event_name text,p_success boolean,p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception 'Acesso negado.'; end if;
  if p_event_name='InitiateCheckout' then update public.orders set meta_initiate_checkout_sent_at=case when p_success then now() else meta_initiate_checkout_sent_at end,meta_initiate_checkout_processing_at=null where id=p_order_id;
  elsif p_event_name='Purchase' then update public.orders set meta_purchase_sent_at=case when p_success then now() else meta_purchase_sent_at end,meta_purchase_processing_at=null,meta_purchase_last_error=case when p_success then null else left(coalesce(p_error,'Falha não especificada'),500) end where id=p_order_id;
  else raise exception 'Evento não permitido.'; end if;
end; $$;

revoke all on function public.create_public_order(jsonb,text,text,boolean,text,text,text,text) from public;
grant execute on function public.create_public_order(jsonb,text,text,boolean,text,text,text,text) to anon, authenticated;
revoke all on function public.confirm_order_sale(uuid) from public, anon;
grant execute on function public.confirm_order_sale(uuid) to authenticated;
revoke all on function public.claim_meta_conversion(uuid,text,text) from public,anon,authenticated;
revoke all on function public.finish_meta_conversion(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.claim_meta_conversion(uuid,text,text) to service_role;
grant execute on function public.finish_meta_conversion(uuid,text,boolean,text) to service_role;
commit;

-- Application order:
-- 1. Apply this expansion; 2. configure/publish Edge Function; 3. publish frontend;
-- 4. test orders/events; 5. apply meta_conversions_lockdown.sql.
-- The direct INSERT grant and public INSERT policy intentionally remain in this phase,
-- so the existing frontend continues to work during the transition.

-- Rollback outline (run separately after reverting the application):
-- begin;
-- drop function if exists public.create_public_order(jsonb,text,text,boolean,text,text,text,text);
-- grant insert on table public.orders to anon, authenticated;
-- alter policy "Public can create orders" on public.orders to anon
--   with check (status='whatsapp' and not coalesce(stock_deducted,false)
--     and completed_at is null and jsonb_typeof(items)='array'
--     and jsonb_array_length(items) between 1 and 50 and subtotal>=0);
-- The previous confirm_order_sale body must be restored from the reviewed pre-migration revision before commit.
-- drop function if exists public.finish_meta_conversion(uuid,text,boolean,text);
-- drop function if exists public.claim_meta_conversion(uuid,text,text);
-- alter table public.orders drop column if exists meta_purchase_last_error,drop column if exists meta_purchase_processing_at,
-- drop column if exists meta_purchase_sent_at,drop column if exists meta_purchase_event_id,drop column if exists meta_initiate_checkout_processing_at,
-- drop column if exists meta_initiate_checkout_sent_at,drop column if exists meta_initiate_checkout_event_id,drop column if exists meta_client_user_agent,
-- drop column if exists meta_event_source_url,drop column if exists meta_fbc,drop column if exists meta_fbp,drop column if exists marketing_consent;
-- commit;
