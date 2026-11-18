# PIPER — integrações

## Passagens aéreas

Os fluxos ativos usam a chave protegida `SERPAPI_API_KEY`, acessada exclusivamente pelo backend através de `server/services/serpapi/client.ts`. O módulo `server/services/flights/serpapi.ts` usa os engines `google_flights`, `google_flights_autocomplete`, `google_flights_calendar` e `google_flights_deals`. A configuração é independente em `config/integrations/flights.config.ts`.

As buscas de voos usam `currency=BRL`, `gl=br` e `hl=pt-BR`. O autocomplete retorna apenas aeroportos com código IATA válido. Ida/volta e multi-cidade continuam pelo `departure_token` devolvido pela fonte. A implementação valida rota, datas, moeda e estrutura da resposta; não cria segmentos ou preços quando a fonte não os retorna. Todos os preços da pesquisa são marcados como não verificados e devem ser revalidados no vendedor.

O Calendar é uma pesquisa separada, apresenta somente datas/preços contidos em `prices` e permite selecionar a data e repetir a busca. Deals é explorado explicitamente pelo usuário e abre somente URLs HTTPS devolvidas pela fonte. A SerpApi é um mecanismo de busca; não reserva nem emite passagens.

Opções de compra são consultadas pelo `booking_token`. A interface mostra vendedor/preço retornados. Só cria um link clicável quando a fonte devolve um deeplink HTTPS sem `post_data`; a PIPER não envia `booking_request` com POST, não simula checkout e não inicia reserva.

## Hospedagens

O fluxo ativo usa exclusivamente o engine `airbnb` da SerpApi através de `hotels.search`; não chama diretamente a API Airbnb. A configuração independente está em `config/integrations/hotels.config.ts` e `config/integrations/airbnb-serpapi.config.ts`. A mesma `SERPAPI_API_KEY` é mantida no servidor.

A busca envia destino, datas, hóspedes, filtros documentados, `airbnb_domain=airbnb.com.br` e `currency=BRL`. A interface exibe apenas dados retornados por `organic_results`, incluindo fotos, avaliação, preço total e, quando a resposta permitir, preço por diária. O adapter rejeita URLs que não sejam HTTPS do domínio Airbnb. Os valores são formatados em reais com centavos e não são convertidos manualmente.

O engine de busca não oferece, na documentação consultada, uma API separada de detalhes, revalidação de preço ou reserva. Por isso a PIPER não afirma disponibilidade garantida nem mostra um checkout próprio. O link de anúncio leva ao endereço HTTPS retornado pela SerpApi. Campos ausentes permanecem ausentes.

## Checkout

O template contém `PAYMENT_CLIENT_ID` e `PAYMENT_CLIENT_SECRET`, mas a integração permanece desabilitada. O material recebido só especifica `POST /api/v1/charges` e os cabeçalhos/body; não identifica domínio/base URL, provedor, documentação oficial ou ambiente sandbox. A PIPER não inventa host, endpoint, credenciais ou payload adicional e não executa cobranças. Para concluir a integração, é necessário fornecer o nome do provedor, a URL-base e a documentação oficial, além de credenciais de sandbox. Um teste de produção ou cobrança real não foi feito.

## Erros e causa das substituições

O código antigo chamava endpoints específicos de Ignav e StayingAPI, com contratos e segredos próprios. A migração remove esses adapters e seus procedimentos ativos. Agora a SerpApi usa o endpoint oficial de busca e os nomes de engine/parâmetros documentados. Erros de autenticação, limite, timeout e resposta JSON inválida são mapeados para respostas tRPC explícitas; resultados vazios não são substituídos por fixtures.

## Moeda e analytics

`CURRENCY_API_KEY` habilita o adaptador futuro de conversão. A interface não converte preços de voo/hospedagem sem uma cotação validada; exibe somente o valor retornado na moeda solicitada. `ANALYTICS_ID` habilita eventos de jornada. `purchase` só pode ser emitido depois de confirmação positiva do fornecedor.

## WhatsApp

Configure `WHATSAPP_NUMBER` no backend e gere um link oficial com o número sanitizado. O placeholder atual não afirma que existe um canal ativo enquanto o número não estiver configurado.
