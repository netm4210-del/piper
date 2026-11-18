# TODO — PIPER

## Identidade visual e funcionalidades gerais — preservar

- Preservar identidade visual PIPER, logo, cores, tipografia, layout, rotas, navegação, responsividade, animações e funcionalidades que não dependam das APIs substituídas.
- Alterar apenas integrações, estado e textos que dependem diretamente de Ignav/StayingAPI ou controles necessários para APIs SerpApi solicitadas.
- Não publicar o site sem pedido separado.

## Voos — substituir Ignav por SerpApi

- Remover adapter, rotas de booking-links, chave, dependência e referências Ignav.
- Integrar no backend os engines `google_flights`, `google_flights_autocomplete`, `google_flights_calendar` e `google_flights_deals`, sob configuração modular de voos.
- Usar `SERPAPI_API_KEY` somente no servidor; parâmetros de busca com `currency=BRL`, `gl=br`, `hl=pt-BR` quando suportados/documentados.
- Autocomplete: sugerir cidades/aeroportos e códigos IATA da resposta da API; validar e tratar respostas vazias/erros sem simular sugestões remotas.
- Flights: ida, ida e volta, passageiros, classe, companhia, aeroportos, horários, duração, escalas e preço somente conforme payload real. Ordenar por preço retornado.
- Booking: usar apenas booking tokens/opções de compra retornados pela fonte; informar que o preço requer revalidação e que a PIPER não cria reservas nem processa pagamento.
- Calendar: mostrar preços por data da fonte; seleção de uma data atualiza o formulário e refaz a busca.
- Deals: disponibilizar descoberta de ofertas de viagem num fluxo separado; não usar endpoint Deals como checkout ou processamento de cobrança.
- Preservar múltiplos trechos somente se o contrato documentado suportar o fluxo sem perder segmentos; caso contrário, bloquear com mensagem verdadeira até a implementação segura.

## Hospedagens — substituir StayingAPI por Airbnb via SerpApi

- Remover adapter/rotas/credencial e referências StayingAPI; deixar de enviar chamadas em background para seus endpoints.
- Manter hospedagens exclusivamente pelo engine `airbnb` da SerpApi no módulo de hospedagens, com a mesma chave protegida `SERPAPI_API_KEY`.
- Solicitar domínio/mercado brasileiro e `currency=BRL` quando suportados; nunca chamar `$`, USD ou moeda não identificada de R$ sem conversão confiável e explicitamente identificada.
- Permitir destino, check-in/check-out, hóspedes e filtros documentados; exibir apenas nome, texto, localização, fotos, avaliações, diária, total, disponibilidade e URL presentes na resposta.
- Abrir apenas links HTTPS genuínos de anúncio Airbnb retornados pela fonte; nenhuma reserva ou disponibilidade é inventada.

## Checkout — separado e ainda não configurado

- Preparar apenas `PAYMENT_CLIENT_ID` e `PAYMENT_CLIENT_SECRET` no exemplo de ambiente.
- Não chamar `POST /api/v1/charges` enquanto não houver identificação do provedor, base URL, documentação oficial, sandbox e autorização para teste.
- Não ligar Google Flights Deals a cobranças. Não marcar checkout funcional sem teste autorizado em ambiente do provedor.

## Segurança, erros e limites

- Remover nomes/valores de segredo antigos Ignav/StayingAPI; nenhuma credencial no cliente, logs ou Git.
- Aplicar validação de entrada, timeout, rate limit, cache apropriado, tratamento real de 401/403, 429, erros upstream e respostas JSON inválidas.
- Não repetir pesquisas de forma indiscriminada; respeitar créditos e quotas SerpApi.
- Diagnosticar a causa das falhas anteriores com evidência: StayingAPI havia aceitado autenticação, mas um job live terminou em `all_actors_failed/upstream_unavailable` sem créditos cobrados. Verificar e relatar credencial/configuração Ignav conforme evidência local.

## Testes e critérios de conclusão

- Testes automatizados de contrato para cada engine, parâmetros BRL, normalização, segurança de links, erros, timeout e ausência de segredo.
- Testar individualmente Flights, Autocomplete, Calendar, Deals e Airbnb por chamada real via backend, registrando o resultado exato e sem reutilizar fixtures como prova de conexão.
- Testar GRU→GIG, GRU→SDU, GRU→MIA e GRU→LIS; cobrir ida e volta e somente ida. Validar datas, valores/moeda BRL, companhia, horários, escalas e opções/links de compra somente se retornados.
- Testar hospedagens de São Paulo, Rio de Janeiro, Florianópolis e Orlando com datas e hóspedes; verificar preços em BRL, campos e links efetivamente retornados.
- Não exceder limites/créditos nem insistir após 401/403/429 ou erro upstream; relatar casos sem resultado.
- Rodar `pnpm check`, `pnpm test`, `pnpm build`, health check e verificação dos endpoints tRPC.
- Exibir tabela final com status reais de Ignav removida, StayingAPI removida, os quatro engines de voos, Airbnb e checkout (bloqueado se faltar provedor/credenciais/docs).

## Estado da execução — 18 de novembro de 2026

- `pnpm check`, `pnpm test` (18 testes) e `pnpm build`: concluídos com sucesso. O Preview responde no health check (`status: ok`) e a home retorna HTTP 200.
- O runtime tem `SERPAPI_API_KEY` protegida; a busca de voos e hospedagens não inclui credencial no código-fonte.
- Smoke test live após a correção de contexto: ida simples GRU→GIG retornou 16 ofertas em BRL; ida/volta GRU→GIG retornou 20 ofertas com trecho de volta em BRL. Autocomplete, Calendar, Deals e Airbnb também responderam em testes live anteriores.
- Pendentes de confirmação live: booking options expirou o timeout antigo de 20 s e o multi-city retornou 503. O timeout de booking options foi aumentado para 60 s; ambos não foram repetidos durante o incidente ativo da SerpApi. A implementação multi-city e os parâmetros de tokens têm cobertura de contrato local.
- O status oficial da SerpApi reportou Google Flights degradado e investigação de opções de compra intermitentes; consultar [SERPAPI_RESEARCH.md](./docs/SERPAPI_RESEARCH.md) antes de novos testes live.
- O site permanece sem publicação/deploy.

## Estado da atualização visual e do modal — 18 de novembro de 2026

- [x] Todos os links de WhatsApp da interface apontam para `https://w.app/ltziws`.
- [x] Resultados de voos exibidos em modal centralizado, com `max-height: 90dvh`, rolagem interna, cabeçalho acessível, botão X visível, fechamento por ESC/clique fora e suporte a safe area.
- [x] Preços continuam sendo apresentados em BRL conforme o valor retornado; não foi adicionada conversão cambial.
- [x] Relatório detalhado registrado em [docs/UPDATE_REPORT.md](./docs/UPDATE_REPORT.md).
- [ ] Repetir a pesquisa live em dispositivos móveis com `SERPAPI_API_KEY` disponível e créditos autorizados; fixtures locais não substituem essa validação.
