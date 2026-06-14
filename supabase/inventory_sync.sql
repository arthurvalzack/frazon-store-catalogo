alter table public.products
add column if not exists external_source text,
add column if not exists external_id text;

create unique index if not exists products_external_source_id_uidx
on public.products (external_source, external_id)
where external_source is not null and external_id is not null;

notify pgrst, 'reload schema';
