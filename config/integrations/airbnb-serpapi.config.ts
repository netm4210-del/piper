const hasSerpApiKey = Boolean(process.env.SERPAPI_API_KEY?.trim());

export const airbnbSearchIntegrationConfig = {
  name: "Airbnb Search via SerpApi",
  provider: "serpapi",
  engine: "airbnb",
  endpoint: "https://serpapi.com/search.json",
  domain: "airbnb.com.br",
  currency: "BRL",
  market: "br",
  language: "pt-BR",
  enabled: hasSerpApiKey,
  cacheTtlMs: 3 * 60_000,
  requestTimeoutMs: 20_000,
} as const;
