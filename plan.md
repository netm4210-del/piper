# Plano de implementação — PIPER

## Escopo aprovado

Substituir as integrações ativas Ignav e StayingAPI por engines SerpApi no backend, mantendo o site, identidade visual, navegação e funções não dependentes dos fornecedores. O módulo de passagens usará Google Flights, Autocomplete, Calendar e Deals. O módulo de hospedagens usará o engine Airbnb via SerpApi. Usar `SERPAPI_API_KEY` como segredo único no backend, moeda BRL e localização/idioma `gl=br` e `hl=pt-BR` nos engines compatíveis.

A API de pagamento é um fluxo separado. O material informa apenas `POST /api/v1/charges` e cabeçalhos, mas não identifica o provedor, URL-base, documentação, sandbox nem protocolo de testes. Preparar os nomes de variáveis solicitados sem enviar requisições nem apresentar o checkout como funcional. Deals de voos são apenas resultados de viagem e não processam cobranças.

## Abordagem

Manter React/Express/tRPC/TypeScript e a estrutura visual existente. Alterar somente contratos e adapters de voos/hospedagem que dependem de Ignav/StayingAPI, componentes que nomeiam explicitamente os fornecedores removidos e pontos de integração necessários para expor autocomplete, busca, calendário, ofertas e Airbnb. Remover caminhos antigos e credenciais Ignav/StayingAPI. Segredos permanecem em configuração protegida de backend, nunca no frontend ou Git.

O adapter de voos deve normalizar somente campos retornados pela SerpApi, mostrar preço e moeda recebidos (esperando BRL) e gerar links apenas via booking tokens/opções legítimos da fonte. Não afirmar que preço foi verificado pela companhia nem que uma reserva foi feita. O fluxo de ida/volta e múltiplos trechos deve respeitar o mecanismo documentado da API, sem omitir trechos nem criar tokens/links.

O Calendar deve mostrar preços retornados por data e, ao selecionar um dia, atualizar o formulário e refazer a busca. Deals devem permanecer numa seção de descoberta de passagens. O autocomplete deve priorizar sugestões e códigos IATA vindos da API, sem apresentar fallback estático como resultado da SerpApi.

O adapter Airbnb deve aceitar destino, datas, hóspedes e filtros suportados, solicitar o domínio brasileiro/moeda BRL e rejeitar respostas em outra moeda antes de exibir preço. Fotos, descrição, avaliações, total, diária, disponibilidade e link só podem ser mostrados quando vierem da fonte; nenhum checkout de hospedagem é criado pela PIPER.

## Diagnóstico e validação

Revisar endpoints, parâmetros, segredos, parsing JSON, datas, moedas, links e conexão tRPC/frontend. O histórico registrado para StayingAPI indica autenticação aceita, mas falha upstream `all_actors_failed` num job live (sem créditos cobrados); tratar isso como indisponibilidade da fonte, não mascarar como sucesso. Confirmar o estado anterior de segredo/credencial de Ignav e o erro exato nos logs disponíveis, sem expor chaves.

Criar testes automatizados de contrato para os engines, normalização, segurança de URL, moeda, erros e ausência de chaves. Fazer chamadas reais limitadas para testar individualmente os quatro engines de voos, cinco rotas GRU→GIG/SDU/MIA/LIS (incluindo ida e volta e somente ida) e hospedagem em São Paulo, Rio, Florianópolis e Orlando. A quantidade de chamadas deve respeitar limites/créditos. Registrar precisamente respostas vazias, 401/403, 429 ou falhas upstream; não repetir indiscriminadamente.

Executar `pnpm check`, testes, build, health check e testes tRPC/live permitidos. Não publicar o site. O checkout permanece bloqueado até ser fornecida documentação oficial do provedor, host/API base, credenciais e ambiente de teste autorizável.

## Design — Azure Editorial Aviation

- Movimento: editorial de aviação contemporâneo, com azul cobalto, branco e fotografia ampla.
- Princípios: clareza antes do ornamento; confiança visual; conversão sem pressão; hierarquia firme em mobile.
- Paleta: `#1764CE`, `#10366B`, `#EAF2FF` e branco; preservar o logo oficial PIPER enviado pelo usuário.
- Manter layout e responsividade atuais; adicionar apenas controles necessários ao calendário/ofertas e remover rótulos antigos de fornecedor.
- Feedback de carregamento, vazio e erro deve ser explícito e acessível, sem ocultar mensagens de fonte.

## Atualização solicitada no site publicado — 18/11/2026

A configuração protegida de SerpApi deve existir para desenvolvimento e produção; a chave foi fornecida na superfície segura e será lida apenas por processos de servidor. Reiniciar os serviços antigos para carregar o ambiente novo e validar chamadas reais limitadas dos fluxos existentes, distinguindo falhas de credencial, quotas e indisponibilidade upstream. Não criar outra integração de pagamento ou conversão sem provedor identificado.

A hero usava uma URL `/manus-storage/` de outro projeto não disponível no site importado. Substituir por imagem de aviação gerada no projeto atual, como fotografia panorâmica full-bleed com avião, nuvens e litoral e overlay azul para contraste. Manter cores, logo e tipografia Piper. Reorganizar `.hero-copy` e `.hero-search` em fluxo normal para eliminar alturas fixas e deslocamentos negativos no mobile; texto e formulário devem permanecer visíveis e o restante da página seguir a altura real do conteúdo.

Estrutura mantida: `client/src/pages/Home.tsx` e `client/src/index.css` para a página; `server/services` e `config/integrations` para APIs; configuração protegida e hosting no plano de configuração Webdev. O pedido de operação residente 24h depende do modo Reserved (`always_on`), com exigência de plano pago; nenhum gerador de tráfego será criado para contornar esse limite. Esta atualização pede correção do site, não habilita publicação automática permanente.
