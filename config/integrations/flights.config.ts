const hasSerpApiKey = Boolean(process.env.SERPAPI_API_KEY?.trim());

export const flightsIntegrationConfig = {
  provider: "serpapi",
  enabled: hasSerpApiKey,
  endpoint: "https://serpapi.com/search.json",
  market: "br",
  language: "pt-BR",
  currency: "BRL",
  engines: {
    search: "google_flights",
    autocomplete: "google_flights_autocomplete",
    calendar: "google_flights_calendar",
    deals: "google_flights_deals",
  },
  capabilities: {
    airportSearch: true,
    oneWaySearch: true,
    roundTripSearch: true,
    multiCitySearch: true,
    bookingOptions: true,
    priceCalendar: true,
    travelDeals: true,
  },
} as const;

export type FlightProviderCapability = keyof typeof flightsIntegrationConfig.capabilities;
