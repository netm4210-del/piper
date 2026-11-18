# Nota técnica — revisão e migração das APIs da PIPER

## Diagnóstico e decisão

A implementação anterior usava adapters da Ignav para passagens e da StayingAPI para hospedagens. O pedido atualizado especificou SerpApi. Os adapters, rotas, configurações e chaves dessas duas integrações foram removidos para que não continuem ativos em paralelo.

As consultas atuais usam o endpoint `search.json` da SerpApi no servidor, com uma única credencial protegida (`SERPAPI_API_KEY`). As rotas e engines são separadas por módulo e tratam erros, moedas e formatos de resposta próprios. Uma chave ausente, erro HTTP, limite, timeout ou JSON inválido não é convertido em resultado de demonstração.

A autorização de Airbnb cobre o engine de busca `airbnb` da SerpApi; não é uma credencial de API direta da Airbnb. O adapter de hospedagem usa esse engine exclusivamente na área de hospedagens. A resposta de busca não confirma disponibilidade, preço final nem reserva.

## Escopo de APIs

- Voos: `google_flights`, com ida, volta e até dois trechos multi-cidade continuados por `departure_token`.
- Autocomplete: `google_flights_autocomplete`, com os aeroportos e códigos IATA que vierem da fonte. Não são usadas sugestões de aeroportos estáticas/fictícias.
- Calendário: `google_flights_calendar`, com datas e preços que vierem em `prices`; selecionar um resultado atualiza datas e inicia nova busca.
- Ofertas: `google_flights_deals`, acessado por ação explícita; é exploração de ofertas e não um checkout.
- Hospedagens: `airbnb` via SerpApi, com domínio brasileiro e moeda solicitada `BRL`.
- Credenciais: chave SerpApi somente no backend, fora de arquivos versionáveis; as antigas `IGNAV_API_KEY` e `STAYINGAPI_KEY` foram removidas do template de ambiente.
- Pagamento: `PAYMENT_CLIENT_ID` e `PAYMENT_CLIENT_SECRET` estão preparados, mas o checkout permanece desativado.

## Checkout ainda bloqueado

O texto recebido especifica `POST /api/v1/charges`, cabeçalhos e um corpo, mas não identifica o provedor, domínio/base URL, documentação oficial ou sandbox. A PIPER não inventa esses detalhes nem envia cobranças. Para terminar, faltam: nome do provedor, URL-base correta, documentação oficial dos endpoints e credenciais de sandbox. Não foi realizado teste de pagamento.

## Fontes oficiais consultadas

Os contratos e URLs por engine estão documentados em [SERPAPI_RESEARCH.md](./SERPAPI_RESEARCH.md): Google Flights, Autocomplete, Calendar, Deals, Airbnb Search, domínios e moedas. A busca Airbnb é da SerpApi, separada da API direta e dos programas de parceiros Airbnb.
