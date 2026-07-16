-- Frazon Store: Meta Conversions lockdown phase.
-- Apply only after the new frontend is published and order/event tests pass.
-- Idempotent and transactional. This phase does not remove create_public_order.
begin;

do $$
begin
  if to_regprocedure('public.create_public_order(jsonb,text,text,boolean,text,text,text,text)') is null then
    raise exception 'create_public_order não existe; aplique meta_conversions_expand.sql primeiro.';
  end if;
end;
$$;

revoke insert on table public.orders from anon, authenticated;
drop policy if exists "Public can create orders" on public.orders;
drop policy if exists "Anon can insert orders" on public.orders;

commit;

-- Rollback (run separately, only if the new frontend is reverted):
-- begin;
-- grant insert on table public.orders to anon, authenticated;
-- create policy "Public can create orders" on public.orders
--   for insert to anon, authenticated
--   with check (status = 'whatsapp' and not coalesce(stock_deducted, false)
--     and completed_at is null and jsonb_typeof(items) = 'array'
--     and jsonb_array_length(items) between 1 and 50 and subtotal >= 0
--     and marketing_consent = false and meta_fbp is null and meta_fbc is null
--     and meta_event_source_url is null and meta_client_user_agent is null
--     and meta_initiate_checkout_event_id is null and meta_initiate_checkout_sent_at is null
--     and meta_initiate_checkout_processing_at is null and meta_purchase_event_id is null
--     and meta_purchase_sent_at is null and meta_purchase_processing_at is null
--     and meta_purchase_last_error is null);
-- commit;
