# PIPER — instalação

## Rodar localmente

O projeto usa Node.js, pnpm 10.18.0 e o starter React/Express/tRPC/Drizzle. Instale as dependências com `pnpm install`, copie `.env.example` para `.env` somente em ambiente local e inicie o servidor com `pnpm dev`. O preview usa a porta definida pelo ambiente, com 3000 como padrão.

Os comandos principais são `pnpm check` para TypeScript, `pnpm test` para testes, `pnpm build` para build de frontend e backend e `pnpm start` para servir o build. O endpoint `/api/health` deve responder com `{ "status": "ok" }`.

## Banco de dados

O banco gerenciado é provisionado pelo ambiente Manus quando o recurso Database está habilitado. O schema base contém usuários para o fluxo de autenticação. Mudanças futuras devem ser acompanhadas de migração Drizzle e nunca devem registrar credenciais de fornecedor.

## Segurança

Todas as chaves privadas ficam no backend. Não use `NEXT_PUBLIC_` ou `VITE_` para credenciais. O arquivo `.env` está ignorado pelo Git e `.env.example` contém apenas nomes. Logs devem registrar códigos e tempos de consulta, nunca tokens, segredos ou payloads completos de viajantes.

## Integrações

Configure apenas `SERPAPI_API_KEY` como segredo de pesquisa no backend. A mesma chave atende aos engines Google Flights, Autocomplete, Calendar, Deals e Airbnb. Passagens solicitam `currency=BRL`, `gl=br` e `hl=pt-BR`; hospedagens solicitam o domínio brasileiro e BRL. Respostas em outra moeda não são exibidas como reais. Preços e disponibilidade precisam ser revalidados no vendedor.

Ignav e StayingAPI não são chamadas nem configuradas pelos fluxos ativos. Os adapters antigos foram removidos. O checkout permanece desativado até que sejam informados o provedor, a URL-base, documentação oficial, sandbox e credenciais de teste; os nomes `PAYMENT_CLIENT_ID` e `PAYMENT_CLIENT_SECRET` ficam preparados no exemplo.

A UI não exibe preço fictício, avaliação inventada, disponibilidade simulada, reserva falsa ou confirmação criada localmente. Quando a fonte não retorna imagem, preço, avaliação, descrição ou URL, o campo fica ausente. A PIPER não processa pagamentos nem envia dados de cobrança.
