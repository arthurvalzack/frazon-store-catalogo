# Integração Meta — implantação da Frazon Store

## Pré-requisitos

- Aplicar `schema.sql` e `security_hardening_final.sql` no projeto Supabase correto.
- Ter o Pixel Meta e o domínio de produção definidos.
- Manter `.env` real fora do Git e nunca colocar service role ou token Meta no frontend.

## Variáveis e secrets

Frontend, em `.env` local e não versionado:

```text
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY
VITE_META_PIXEL_ID=SEU_PIXEL_ID
VITE_ADMIN_EMAILS=admin@SEU-DOMINIO.example
```

Secrets da Edge Function, somente no Supabase:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SEU_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=SEU_SERVICE_ROLE_KEY
META_ALLOWED_ORIGINS=https://SEU-DOMINIO.example
META_PIXEL_ID=SEU_PIXEL_ID
META_CAPI_ACCESS_TOKEN=SEU_TOKEN_CAPI
META_GRAPH_API_VERSION=vXX.X
META_TEST_EVENT_CODE=SEU_TEST_CODE
```

`META_TEST_EVENT_CODE` é temporário. Os demais secrets nunca devem aparecer em
arquivos versionados. `supabase/config.toml` usa `verify_jwt = false`, pois a
Edge Function valida JWT e admin internamente para `Purchase`.

## Ordem de implantação

1. Aplicar `meta_conversions_expand.sql`.
2. Configurar os secrets e publicar a Edge Function `meta-conversions`.
3. Publicar o frontend.
4. Executar os testes abaixo e validar os eventos no Events Manager.
5. Aplicar `meta_conversions_lockdown.sql`.
6. Executar os testes finais.

## Expand

O expand é transacional e idempotente. Cria as colunas Meta, as RPCs e a
confirmação administrativa segura. Mantém temporariamente o grant `INSERT` e
a policy pública, mas a policy só permite pedido com `status = 'whatsapp'`,
estoque não descontado, pedido não concluído, itens válidos, subtotal não
negativo, `marketing_consent = false` e todas as colunas `meta_*` nulas.

Isso mantém o frontend antigo disponível sem permitir que o caminho legado
preencha atribuição Meta ou controle valores comerciais. `create_public_order`
recebe somente IDs, variantes, quantidades, dados do cliente e atribuição;
consulta produtos ativos e calcula os valores canônicos no banco.

`whatsapp_message` permanece vazio no banco. Ele não é usado como fonte de
verdade pelo painel ou pelo atendimento; o frontend monta a mensagem a partir
dos itens, preços e subtotal retornados pela RPC.

Rollback do expand: reverta o frontend se necessário e execute, em transação,
o bloco de rollback ao final de `meta_conversions_expand.sql`. Ele restaura o
caminho legado e remove os objetos Meta somente após confirmar que não estão
mais sendo utilizados.

## Edge Function e eventos

A função aceita somente `eventName`, `orderId` e `eventId`, limita CORS às
origens de `META_ALLOWED_ORIGINS`, usa timeout e não registra secrets, PII ou a
resposta completa da Meta. Busca o pedido com service role, valida consentimento,
status, estoque e IDs persistidos, usa `claim_meta_conversion` para idempotência
e `finish_meta_conversion` tanto em sucesso quanto em falha.

O Pixel só é carregado após consentimento aceito e não funciona em `/admin`.
PageView acompanha o React Router. ViewContent contém produto, ID, preço e BRL.
AddToCart contém produto, variante, quantidade, preço e BRL. InitiateCheckout só
é enviado depois da criação bem-sucedida do pedido. Purchase nunca é enviado
diretamente pelo navegador: o painel chama a Edge Function, que envia a CAPI.

O mesmo identificador é usado para deduplicação navegador/servidor quando o
evento possui correspondência. A CAPI envia BRL, valor, `content_ids`,
`contents`, `num_items` e, quando persistidos, `fbp`, `fbc`, URL e user agent.

## Testes antes do lockdown

- Navegar pela home, catálogo e produto sem consentimento: nenhum evento Meta.
- Aceitar cookies: um PageView da rota atual e nenhum carregamento duplicado.
- Trocar de rota e recarregar: um PageView por rota; nenhum evento em `/admin`.
- Abrir produto: ViewContent com ID, nome, preço e moeda BRL.
- Adicionar e aumentar uma variante: AddToCart com cor, tamanho, quantidade,
  preço e moeda BRL.
- Criar pedido: exatamente um pedido, valores calculados pelo banco e mensagem
  WhatsApp formada pelos itens canônicos retornados.
- Confirmar venda no painel: estoque descontado uma vez e Purchase enviado pela
  CAPI; repetir a ação deve deduplicar.
- Rejeitar cookies: nenhum evento de marketing.

Use `META_TEST_EVENT_CODE` apenas no Events Manager durante esses testes.

## Lockdown e rollback

Depois de publicar e testar o frontend novo, aplique `meta_conversions_lockdown.sql`.
Ele verifica `create_public_order`, revoga o INSERT direto de `anon` e
`authenticated`, remove apenas as policies públicas de INSERT e preserva a RPC,
`confirm_order_sale` e as policies administrativas. É transacional e idempotente.

Rollback do lockdown: execute o bloco ao final de
`meta_conversions_lockdown.sql`; ele restaura exatamente o grant e a policy
restrita da fase expand. Reverta o frontend antes de executar esse rollback.

Depois dos testes, remova `META_TEST_EVENT_CODE` dos secrets e publique a Edge
Function novamente.

## Verificações finais

- Confirmar que nenhum `.env` real, service role ou token Meta foi versionado.
- Confirmar que `orders` não tem SELECT público.
- Confirmar que funções administrativas não são executáveis por `anon`.
- Confirmar que as funções Meta internas só são executáveis por `service_role`.
- Confirmar que `confirm_order_sale` exige `public.is_admin()` e usa
  `SECURITY DEFINER` com `search_path` seguro.
