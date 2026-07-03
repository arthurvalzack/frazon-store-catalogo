alter table public.orders
add column if not exists customer_name text,
add column if not exists customer_whatsapp text;

notify pgrst, 'reload schema';
