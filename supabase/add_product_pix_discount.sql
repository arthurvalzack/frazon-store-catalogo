alter table public.products
add column if not exists pix_discount_percent numeric check (pix_discount_percent is null or pix_discount_percent >= 0);

notify pgrst, 'reload schema';
