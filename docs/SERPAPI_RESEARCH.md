# Contratos SerpApi verificados para a PIPER

Pesquisa feita nas páginas oficiais SerpApi durante a migração. Foram verificados os engines Google Flights, Autocomplete, Calendar, Deals e Airbnb Search. A documentação descreve engines de busca expostos pela SerpApi, não APIs transacionais diretas de Google/Airbnb. Esta etapa foi documental; não consumiu créditos.

## Google Flights — `google_flights`

Usar `engine=google_flights`, `api_key`, IDs de origem/destino, `type`, datas, `currency`, `gl` e `hl` conforme a operação. A documentação define `type=1` como ida e volta, `type=2` como somente ida e `type=3` como múltiplas cidades. Ida/volta requer data de ida e volta; somente ida requer data de ida. Classe: 1 econômica, 2 premium economy, 3 executiva, 4 primeira classe. `BRL` consta entre as moedas suportadas em [Google Travel Currencies](https://serpapi.com/google-travel-currencies).

Resultados podem conter `best_flights` e/ou `other_flights`; não se deve depender exclusivamente de `best_flights`. Cada itinerário pode ter `flights`, `layovers`, `total_duration`, `price`, companhia, `departure_token` e `booking_token`. Em ida/volta, `departure_token` dá continuidade à busca da volta. Para opções de compra, use o `booking_token` do itinerário selecionado. Os tokens são opacos; a documentação consultada não confirma TTL nem renovação. A resposta de opções pode incluir vendedores, preços, `booking_options` e `booking_request` (url e, se fornecido, post_data). Isso não significa que a SerpApi processa pagamento, confirma ou emite a passagem.

Fontes: [Google Flights API](https://serpapi.com/google-flights-api), [Google Flights Results](https://serpapi.com/google-flights-results), [Google Flights Booking Options](https://serpapi.com/google-flights-booking-options), [Search API](https://serpapi.com/search-api).

## Google Flights Autocomplete — `google_flights_autocomplete`

O parâmetro obrigatório é `q`; `gl` (país) e `hl` (idioma) são independentes. A resposta exemplificada contém `suggestions`, com nome, tipo, descrição e ID de localização, mais aeroportos com `name`, `id`, `city`, `city_id` e distância. O `id` do aeroporto no exemplo é código IATA; o ID da cidade/localização não deve ser confundido com IATA. A página não documenta `currency`, limites máximos de sugestões ou quantidade de caracteres. Tratar lista vazia/campos ausentes com segurança.

Fontes: [Google Flights Autocomplete API](https://serpapi.com/google-flights-autocomplete-api), [Google Countries](https://serpapi.com/google-countries), [Google Languages](https://serpapi.com/google-languages).

## Google Flights Calendar — `google_flights_calendar`

Parâmetros relevantes: `departure_id`, `arrival_id`, `currency`, `gl`, `hl`, `type`, `date_range_start` e `date_range_end`. `type=1` é ida/volta, `type=2` somente ida. A resposta contém `prices`, uma lista de datas com preço inteiro na moeda pedida; ida/volta pode incluir `outbound_date` e `return_date`, e ida apenas `outbound_date`. `low_price` é opcional. A lista não garante cobertura de todas as datas nem é uma grade completa; as datas relativas padrão mudam com o tempo, portanto janelas explícitas são preferíveis. `round_trip_days` e `fixed_outbound_date` são incompatíveis.

Fonte: [Google Flights Calendar API](https://serpapi.com/google-flights-calendar-api).

## Google Flights Deals — `google_flights_deals`

Busca de ofertas por origem e filtros de viagem. A resposta exemplificada pode conter uma lista `deals` com destino, preço, duração, paradas, companhia, datas, thumbnail, `flight_link` e `serpapi_flight_link`; campos podem faltar. `currency`, `gl` e `hl` têm papéis distintos. A documentação descreve links para explorar voos, não endpoint de checkout/pagamento, reserva ou emissão. Não usar Deals para cobrar o cliente.

Fonte: [Google Flights Deals API](https://serpapi.com/google-flights-deals-api).

## Airbnb Search via SerpApi — `airbnb`

Usar `engine=airbnb` e `q` (ou `map_bounds`). Datas `check_in_date` e `check_out_date` devem ser enviadas juntas; checkout após check-in. Hóspedes podem ser informados por `adults`, `children`, `infants` e `pets`. `bedrooms`, `beds` e `bathrooms` são filtros mínimos, não igualdade exata. `airbnb_domain` e `currency` são parâmetros distintos; BRL está na lista oficial suportada. Resultados aparecem em `organic_results`; podem conter nome, link, avaliação, descrição, fotos, preço total, detalhamento, datas, quartos e coordenadas. Campos individuais podem faltar. A documentação indica até 18 resultados por página e até 15 páginas.

O escopo validado é o mecanismo de busca SerpApi para Airbnb. Isso não prova uma API direta pública operada pela Airbnb, nem garante preço final/disponibilidade de reserva. A PIPER não cria reserva.

Fontes: [Airbnb Search API](https://serpapi.com/airbnb-search-api), [Airbnb Currencies](https://serpapi.com/airbnb-currencies), [Airbnb Domains](https://serpapi.com/airbnb-domains).

## Erros, cache, segurança e limites

As páginas específicas não fornecem um catálogo universal de códigos de erro ou limites numéricos de uso aplicáveis a todos os engines; cotas dependem do plano/conta. A documentação menciona cache de uma hora e consultas cacheadas gratuitas para alguns endpoints, além de `async`/Searches Archive. `async` e `no_cache` não devem ser combinados e há restrições para contas com Ludicrous Speed. A implementação deve manter `api_key` exclusivamente no backend, fazer parsing defensivo, validar datas/combinações documentadas e não inventar limite, resultado ou mensagem específica.

Fontes: [Search API](https://serpapi.com/search-api), [Searches Archive API](https://serpapi.com/search-archive-api).

## Múltiplos trechos

`type=3` exige `multi_city_json`, uma string JSON com objetos `{departure_id, arrival_id, date}` e `times` opcional por trecho. Não se usa `outbound_date`/`return_date` junto ao modo multi-city; cada objeto leva sua data. `departure_token` serve para obter a próxima perna da viagem. A implementação deve consultar a continuação por token opaco e exibir todos os trechos retornados, sem presumir que a primeira resposta contenha a viagem completa. Fonte: [Google Flights API](https://serpapi.com/google-flights-api).

## Opções de compra e deeplinks de voos

`booking_options` pode ter `together` ou campos `departing`/`returning` quando há bilhetes separados. Um grupo pode informar vendedor, preço, moeda local, bagagem e `booking_request`. Se `post_data` estiver presente, a documentação exige POST do corpo exatamente como retornado para o endpoint Google indicado; não é um link GET comum. A PIPER não enviará esses POSTs nem executará checkout. Só apresentará uma âncora externa quando a resposta contiver um deeplink direto HTTPS sem `post_data`; caso contrário, mostrará vendedor/preço sem botão que simule compra. Fonte: [Google Flights Booking Options](https://serpapi.com/google-flights-booking-options).

Os exemplos oficiais para `booking_token` incluem também o contexto da viagem (origem, destino e datas); a continuação de ida/volta deve preservar o tipo e os parâmetros originais, e multi-city deve reenviar `type=3` e `multi_city_json` junto de `departure_token`. O token, por si só, não substitui os parâmetros de consulta exigidos pelo engine. Fontes: [Google Flights API](https://serpapi.com/google-flights-api) e [Booking Options](https://serpapi.com/google-flights-booking-options).

### Verificação operacional — 18 de novembro de 2026

Na consulta ao [status oficial da SerpApi](https://status.serpapi.com), Google Flights constava como degradado e Google como em grande incidente. O incidente específico de [opções de compra intermitentemente ausentes](https://status.serpapi.com/incidents/2gns2kdcg20p) permanecia em investigação. Nos testes ao vivo do backend PIPER, ida simples, Autocomplete, Calendar, Deals, Airbnb e ida/volta responderam; booking options expirou o limite de 20 s vigente no primeiro teste e multi-city retornou 503. O limite de booking options foi elevado para 60 s. Como o incidente upstream continuava aberto, não se repetiram cegamente as consultas de booking/multi-city; esses dois fluxos permanecem sem confirmação ao vivo nesta data, embora tenham testes de contrato locais.

O filtro Airbnb `property_types` aceita `house`, `apartment`, `guesthouse` e `hotel`; `bedrooms` é quantidade mínima. Fonte: [Airbnb Search API](https://serpapi.com/airbnb-search-api).

## Calendário, classe e passageiros

O Calendar aceita `round_trip_days` como número de dias para a viagem de ida e volta; ele não pode ser combinado com `fixed_outbound_date`. `fixed_outbound_date=true` fixa a data de saída em `date_range_start` e devolve preços por data de retorno; sem isso, o calendário varia a saída e usa o tamanho de viagem informado. Para bebês, Google Flights separa `infants_in_seat` de `infants_on_lap`; a PIPER usa a categoria visível “bebês no colo” para não confundir as duas. Classe de viagem usa 1 econômica, 2 econômica premium, 3 executiva e 4 primeira classe. Fonte: [Google Flights Calendar API](https://serpapi.com/google-flights-calendar-api) e [Google Flights API](https://serpapi.com/google-flights-api).
