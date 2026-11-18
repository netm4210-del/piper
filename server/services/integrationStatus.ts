import { analyticsConfig } from "../../config/integrations/analytics.config";
import { currencyIntegrationConfig } from "../../config/integrations/currency.config";
import { flightsIntegrationConfig } from "../../config/integrations/flights.config";
import { hotelsIntegrationConfig } from "../../config/integrations/hotels.config";

export function getIntegrationStatus() {
  return {
    flights: {
      provider: flightsIntegrationConfig.provider,
      enabled: flightsIntegrationConfig.enabled,
      currency: flightsIntegrationConfig.currency,
      market: flightsIntegrationConfig.market,
      language: flightsIntegrationConfig.language,
      engines: flightsIntegrationConfig.engines,
      capabilities: flightsIntegrationConfig.capabilities,
    },
    hotels: {
      provider: hotelsIntegrationConfig.provider,
      enabled: hotelsIntegrationConfig.enabled,
      engine: hotelsIntegrationConfig.engine,
      currency: hotelsIntegrationConfig.currency,
      airbnbDomain: hotelsIntegrationConfig.airbnbDomain,
      capabilities: hotelsIntegrationConfig.capabilities,
    },
    checkout: {
      enabled: false,
      reason: "O provedor e a documentação-base da API de pagamento ainda não foram identificados.",
    },
    currency: { enabled: currencyIntegrationConfig.enabled },
    analytics: { enabled: analyticsConfig.enabled },
  } as const;
}
