import { flightsIntegrationConfig } from "../../../config/integrations/flights.config";
import { FlightIntegrationNotConfiguredError, type FlightProvider, type FlightSearchInput, type NormalizedFlightOffer } from "./types";

/** Adapter boundary for Amadeus. Keep provider-specific payload mapping inside this module. */
export class AmadeusFlightProvider implements FlightProvider {
  async search(_input: FlightSearchInput): Promise<NormalizedFlightOffer[]> {
    this.assertConfigured();
    throw new Error("Amadeus Flight Offers Search adapter is ready for credentialed implementation.");
  }

  async price(_offerId: string): Promise<NormalizedFlightOffer> {
    this.assertConfigured();
    throw new Error("Amadeus Flight Offers Price adapter is ready for credentialed implementation.");
  }

  private assertConfigured() {
    if (!flightsIntegrationConfig.enabled) throw new FlightIntegrationNotConfiguredError();
  }
}
