# Relatório de atualização — PIPER

## Correções realizadas

- O mecanismo de pesquisa e as integrações SerpApi foram preservados.
- O backend continua enviando `currency=BRL` para os engines de voos e hospedagens, rejeitando respostas cuja moeda efetiva não seja BRL. Não foi adicionada conversão cambial, nem multiplicação por 100 ou 1.000.
- A apresentação de preços no frontend mantém o valor numérico recebido e usa `Intl.NumberFormat` com locale `pt-BR`, sem converter novamente o preço.
- Os resultados de voos agora abrem em um modal centralizado, com `max-height: 90dvh`, rolagem vertical interna, cabeçalho sempre visível, botão de fechar acessível, clique fora para fechar e tecla ESC.
- O modal considera áreas seguras de aparelhos com notch e evita ficar atrás do cabeçalho por meio de camada própria de z-index.
- Depois de fechar o modal, um botão permite reabri-lo sem repetir a pesquisa.
- Todos os links de WhatsApp do rodapé e do botão flutuante apontam para `https://w.app/ltziws`, abrindo em nova aba com proteção `noopener noreferrer`.
- O carregamento de imagens e as animações existentes foram preservados; as novas transições respeitam `prefers-reduced-motion`.
- Corrigida a pluralização exibida para a quantidade de passageiros.

## Auditoria de preços

A inspeção do adapter `server/services/flights/serpapi.ts` confirmou que os valores são lidos diretamente dos campos numéricos retornados pela SerpApi. A aplicação valida a moeda retornada por `search_parameters.currency` antes de normalizar ofertas, calendário, deals e opções de compra. Portanto, não há evidência no código de conversão USD→BRL duplicada ou de multiplicadores indevidos. O cache usa a URL completa dos parâmetros, incluindo moeda, mercado e datas.

## Verificação executada

A validação automatizada final deve ser executada com `pnpm install --frozen-lockfile`, seguida de `pnpm check`, `pnpm test` e `pnpm build`. Uma pesquisa real depende da disponibilidade de `SERPAPI_API_KEY` e de créditos da SerpApi; por isso, resultados reais não são inventados neste relatório.

## Arquivos principais alterados

- `client/src/pages/Home.tsx`
- `client/src/index.css`
- `docs/UPDATE_REPORT.md`
