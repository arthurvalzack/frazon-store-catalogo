# Frazon Store - Catálogo com Admin e Supabase

Projeto ajustado para catálogo masculino mobile-first com painel administrativo, Supabase como fonte principal, upload de imagens e finalização no WhatsApp.

## O que foi implementado

- Nome e WhatsApp da loja: Frazon Store / 5561998273587.
- Catálogo público responsivo para celular e desktop.
- Admin seguro via Supabase Auth, sem senha fixa no código.
- Produtos editáveis: nome, descrição, preço, promoção, etiqueta, fotos, categoria, status e estoque por cor/tamanho.
- Categorias editáveis: criar, editar, ordenar, ativar/desativar e imagem.
- Site editável pelo admin: textos da home, banners, contato, Instagram, e-mail, endereço, horários e rodapé.
- Upload de até 3 fotos por produto usando Supabase Storage.
- Compressão de imagens grandes no navegador antes do upload.
- Carrinho salva o pedido no Supabase e abre WhatsApp com mensagem completa.
- Produtos sem estoque não aparecem para o cliente; produtos com até 4 unidades mostram aviso de últimas unidades.
- Build de produção validado com `npm run build`.

## Como rodar localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Preencha `.env` com os dados do Supabase:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

Para testar a sincronizacao de inventario localmente com o Vite, rode tambem a API da Vercel em outro terminal:

```bash
npx vercel dev --listen 3001
```

E adicione no `.env.local` usado pelo Vite:

```env
VITE_API_BASE_URL=http://localhost:3001
CATALOG_SUPABASE_URL=https://SEU-PROJETO-CATALOGO.supabase.co
CATALOG_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA_DO_CATALOGO
INVENTORY_SUPABASE_URL=https://SEU-PROJETO-INVENTARIO.supabase.co
INVENTORY_SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_DO_INVENTARIO
```

`INVENTORY_SUPABASE_SERVICE_ROLE_KEY` deve ficar somente no ambiente da API/Vercel. Nunca use essa chave com prefixo `VITE_`.

## Como configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Cole e rode o arquivo `supabase/schema.sql`.
4. Vá em **Authentication > Users**.
5. Crie manualmente o único usuário admin com e-mail e senha.
6. Use esse e-mail e senha na rota `/admin`.

## Deploy na Vercel

No painel da Vercel, adicione as variáveis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Depois faça deploy normalmente.

## Observações importantes

- Sem Supabase configurado, o site usa dados demo apenas para visualização local. Em produção, configure o Supabase para não depender de cache/localStorage.
- A chave `anon` do Supabase é pública por natureza. A segurança vem das políticas RLS no SQL.
- Não coloque senha no código. O login do admin deve ser criado no Supabase Auth.
- O pedido é salvo antes de abrir o WhatsApp. Se o navegador bloquear popup, o cliente pode precisar tocar no botão de novo.
