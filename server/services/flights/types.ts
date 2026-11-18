export type FlightTripType = "roundtrip" | "oneway" | "multi";
export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export type FlightSearchInput = {
  tripType: FlightTripType;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  segments?: Array<{ origin: string; destination: string; departureDate: string }>;
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
  market?: string;
};

export type NormalizedFlightSegment = {
  departure: string;
  arrival: string;
  origin: string;
  destination: string;
  carrier: string;
  carrierCode: string;
  flightNumber?: string;
  durationMinutes?: number;
  aircraft?: string;
};

export type NormalizedFlightLeg = {
  departure: string;
  arrival: string;
  durationMinutes: number;
  stops: number;
  origin: string;
  destination: string;
  carrier: string;
  carrierCode: string;
  segments?: NormalizedFlightSegment[];
};

export type NormalizedFlightOffer = {
  id: string;
  provider: string;
  airline: { name: string; code: string; logoUrl?: string };
  outbound: NormalizedFlightLeg;
  inbound?: NormalizedFlightLeg;
  legs?: NormalizedFlightLeg[];
  bookingToken?: string;
  baggage?: string;
  fareFamily?: string;
  cancellationPolicy?: string;
  requiresSelfTransfer?: boolean;
  price: { amount: number; currency: string; status: "verified" | "unverified"; passengerCount: number; lastCheckedAt: string };
  booking: { mode: "checkout" | "redirect"; url?: string; revalidationRequired: boolean };
};

export type FlightBookingOption = {
  providerName: string;
  fareName?: string;
  url?: string;
  price?: { amount: number; currency: string; status: "unverified" };
  separateTickets?: boolean;
};

export type FlightCalendarPrice = {
  departureDate: string;
  returnDate?: string;
  amount: number;
  currency: "BRL";
  lowPrice?: boolean;
};

export type FlightDeal = {
  id: string;
  destination: string;
  country?: string;
  amount: number;
  currency: "BRL";
  discountPercent?: number;
  departureDate?: string;
  returnDate?: string;
  durationMinutes?: number;
  stops?: number;
  airline?: string;
  thumbnail?: string;
  url?: string;
};

export interface FlightProvider {
  search(input: FlightSearchInput): Promise<NormalizedFlightOffer[]>;
  price(offerId: string): Promise<NormalizedFlightOffer>;
  createOrder?(offerId: string, travelerData: unknown): Promise<{ confirmationId: string; status: "confirmed" }>;
}

export class FlightIntegrationNotConfiguredError extends Error {
  code = "FLIGHT_INTEGRATION_NOT_CONFIGURED" as const;
  constructor() {
    super("A integração de voos via SerpApi não está configurada no servidor.");
    this.name = "FlightIntegrationNotConfiguredError";
  }
}
