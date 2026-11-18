const hasSerpApiKey = Boolean(process.env.SERPAPI_API_KEY?.trim());

export const hotelsIntegrationConfig = {
  provider: "airbnb-serpapi",
  enabled: hasSerpApiKey,
  engine: "airbnb",
  endpoint: "https://serpapi.com/search.json",
  airbnbDomain: "airbnb.com.br",
  currency: "BRL",
  market: "br",
  language: "pt-BR",
  cacheTtlMs: 3 * 60_000,
  requestTimeoutMs: 20_000,
  capabilities: {
    search: true,
    listingDetails: false,
    priceCalendar: false,
    externalListingLinks: true,
    directReservation: false,
    paymentProcessing: false,
  },
  policy: "A PIPER consulta resultados do engine Airbnb via SerpApi, mostra apenas dados e URLs retornados e encaminha ao anúncio Airbnb. Não cria reservas nem processa pagamentos.",
} as const;
