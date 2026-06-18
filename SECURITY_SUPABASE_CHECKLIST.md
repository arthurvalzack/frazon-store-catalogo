# Frazon Store - checklist de seguranca Supabase

Use este arquivo apenas como revisao manual antes de producao. Nao execute nada automaticamente sem conferir o projeto no painel do Supabase.

## Variaveis e chaves

- Configure na Vercel apenas valores reais de producao.
- No frontend, use somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Chaves service role devem existir apenas em backend/funcoes server-side, nunca em codigo importado pelo React/Vite.
- Se a sincronizacao de inventario estiver ativa, configure as variaveis server-side da funcao em Vercel, nao no bundle frontend.

## Database RLS

- `products`: RLS habilitado.
- `categories`: RLS habilitado.
- `site_settings`: RLS habilitado.
- `orders`: RLS habilitado.

## Policies esperadas

- `products`: leitura publica apenas de produtos ativos; escrita apenas para `authenticated`.
- `categories`: leitura publica apenas de categorias ativas; escrita apenas para `authenticated`.
- `site_settings`: leitura publica permitida; escrita apenas para `authenticated`.
- `orders`: `anon` pode inserir pedido; leitura/update/delete apenas para `authenticated`.

## Storage

- Bucket `product-images` publico para leitura.
- Upload/update/delete no bucket apenas para `authenticated`.
- Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`.
- Limite recomendado: 5MB.
- Pastas esperadas: `products`, `categories`, `site`.

## Confirmacao de venda

Confirme que a RPC `confirm_order_sale(uuid)`:

- exige usuario autenticado;
- bloqueia pedido inexistente;
- nao confirma pedido cancelado;
- nao baixa estoque duas vezes;
- valida pedido sem itens;
- valida quantidade positiva;
- valida produto e variacao;
- impede estoque negativo;
- marca `stock_deducted = true` e `completed_at`.

## Arquivos SQL existentes

- `supabase/schema.sql` contem a estrutura principal e policies base.
- `supabase/security_hardening.sql` contem endurecimento de grants, policies, storage e RPC.
- Revise e rode no SQL Editor apenas apos backup e validacao no ambiente correto.
