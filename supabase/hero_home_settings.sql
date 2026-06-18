-- Frazon Store - Home hero settings
-- Rode no SQL Editor do Supabase para habilitar os novos controles do banner.

alter table public.site_settings
  add column if not exists hero_image_mobile text,
  add column if not exists hero_image_desktop text,
  add column if not exists hero_title_line_1 text not null default 'VISTA SUA',
  add column if not exists hero_title_line_2 text not null default 'ESSÊNCIA',
  add column if not exists hero_subtitle_line_1 text not null default 'ROUPAS PARA HOMENS',
  add column if not exists hero_subtitle_line_2 text not null default 'QUE IMPÕEM PRESENÇA',
  add column if not exists hero_button_text text not null default 'EXPLORAR CATÁLOGO',
  add column if not exists hero_topbar_text_1 text not null default 'NOVIDADES EXCLUSIVAS',
  add column if not exists hero_topbar_text_2 text not null default 'PEDIDO DIRETO NO WHATSAPP',
  add column if not exists hero_topbar_text_3 text not null default 'ENVIO PARA TODO BRASIL';

notify pgrst, 'reload schema';
