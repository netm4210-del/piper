# Piper — correção de APIs e landing page

## Causas encontradas

O ZIP importado continha o código das integrações, mas não o segredo protegido SerpApi. A mensagem do site refletia essa ausência. A chave foi cadastrada pelo proprietário na superfície segura e está disponível em todos os ambientes (`all`), sem ser incluída no código-fonte ou bundle do navegador. Os serviços antigos foram reiniciados para carregar o novo ambiente.

A imagem original da hero apontava para `/manus-storage/async-images/0axVjx0zCz6AVrAB4druDe/image-1.webp`, de um projeto anterior. Ela foi substituída pela imagem gerada neste projeto, `/manus-storage/async-images/bn5xM3vLPW3u5iOGRrVjRT/image-1.webp`. Não é necessário existir um arquivo local: a entrega de geração foi em Managed Storage. As capturas do Preview em 390×844 e 1440×1000 mostraram a nova paisagem com avião. A hero agora usa fluxo normal de conteúdo e formulário, eliminando os deslocamentos negativos e a enorme área vazia no celular.

## Servidor e segurança

- Timeout de SerpApi mantido até terminar leitura/validação do corpo JSON, inclusive aborto durante leitura.
- Status de integração verifica a presença da chave em tempo de execução.
- Validação de ida/volta rejeita volta na mesma data da ida.
- Chamadas de fornecedor continuam no backend; caches e limites existentes foram preservados.
- Nenhuma reserva, cobrança ou pagamento foi criado nos testes.

## Testes reais limitados

Verificações HTTP do backend concluídas em 18/11/2026. Ida em 02/01/2027 e volta/check-out em 06/01/2027. A primeira tentativa teve aeroportos/ida/calendário aprovados e foi interrompida por hot reload do desenvolvimento. A continuação ocorreu após encerrar as alterações do backend; os testes aprovados de aeroportos/calendário foram preservados.

| Fluxo | Resultado observado |
|---|---|
| Saúde do servidor | HTTP 200, status ok |
| Configuração de voos e Airbnb | Ativa |
| Autocomplete de São Paulo | 5 códigos de aeroporto |
| Voos GRU–GIG, somente ida | 16 resultados em BRL |
| Calendário GRU–GIG | 31 datas em BRL |
| Ofertas a partir de GRU | 30 resultados em BRL |
| Airbnb no Rio de Janeiro | 18 resultados em BRL |
| Voos GRU–GIG, ida e volta | 20 resultados em BRL |
| Opções de compra com token retornado | 1 opção; nenhum link direto nesta resposta |

Isso comprova conexão e resposta destes fluxos nesse momento, não disponibilidade contínua de fornecedores ou garantia de reserva/preço. O frontend mantém feedback honesto quando não há link direto.

`pnpm check`, `pnpm test` (7 arquivos, 21 testes), `pnpm build` e `git diff --check` aprovados. O relatório JSON de contagens está em `SERVER_API_VERIFICATION.json`. O script `scripts/verify-server-apis.mjs` é deliberado, não agendado: sua execução pode consumir a quota do proprietário e não deve ser usado como keep-alive.

## Limites e estado da publicação

A tentativa de habilitar hosting Reserved (`always_on`) foi recusada com `requires_membership`. Operação residente sem pausa 24h não está habilitada no plano atual; não foi criado pinger para contornar essa restrição. O hosting já existente não foi alterado.

Checkout interno, conversão cambial e analytics externo permanecem não configurados, pois não há provedor/credenciais/implementação funcional identificados para eles. A hospedagem e a passagem são pesquisadas; a reserva é externa, quando houver um endereço oficial retornado.

A versão está preparada para checkpoint e Preview. O proprietário recebeu um cartão separado para confirmar a republicação no site atual. Não houve nova publicação nesta execução enquanto a confirmação permanece pendente.
