import { afterEach, describe, expect, it, vi } from "vitest";
import { SerpApiNotConfiguredError, SerpApiRequestError } from "../serpapi/client";
import { SerpApiFlightProvider } from "./serpapi";
import type { FlightSearchInput } from "./types";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function flight(origin: string, destination: string, date: string, airline = "LATAM") {
  return {
    departure_airport: { id: origin, time: `${date} 10:00` },
    arrival_airport: { id: destination, time: `${date} 11:30` },
    airline,
    airline_logo: "https://www.gstatic.com/flights/airline_logo/LA.png",
    flight_number: "LA 1234",
    travel_class: "Economy",
    duration: 90,
    airplane: "Airbus A320",
  };
}

const oneWayInput: FlightSearchInput = {
  tripType: "oneway", origin: "GRU", destination: "GIG", departureDate: "2026-12-14",
  adults: 2, children: 1, infants: 0, cabin: "economy", market: "BR",
};

afterEach(() => {
  delete process.env.SERPAPI_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Google Flights engines via SerpApi", () => {
  it("searches one-way flights in BRL and maps only source-returned segments", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    const fetchMock = vi.fn().mockResolvedValue(response({
      search_parameters: { currency: "BRL" },
      search_metadata: { processed_at: "2026-11-18T01:00:00Z" },
      best_flights: [{ flights: [flight("GRU", "GIG", oneWayInput.departureDate)], total_duration: 90, price: 550.75, layovers: [], booking_token: "one-way-token" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const offers = await new SerpApiFlightProvider().search(oneWayInput);
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as URL);
    expect(requestUrl.origin + requestUrl.pathname).toBe("https://serpapi.com/search.json");
    expect(requestUrl.searchParams.get("engine")).toBe("google_flights");
    expect(requestUrl.searchParams.get("departure_id")).toBe("GRU");
    expect(requestUrl.searchParams.get("arrival_id")).toBe("GIG");
    expect(requestUrl.searchParams.get("outbound_date")).toBe(oneWayInput.departureDate);
    expect(requestUrl.searchParams.get("type")).toBe("2");
    expect(requestUrl.searchParams.get("currency")).toBe("BRL");
    expect(requestUrl.searchParams.get("gl")).toBe("br");
    expect(requestUrl.searchParams.get("hl")).toBe("pt-BR");
    expect(requestUrl.searchParams.get("travel_class")).toBe("1");
    expect(requestUrl.searchParams.get("api_key")).toBe("test-key-only");
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ provider: "google_flights", outbound: { origin: "GRU", destination: "GIG", carrier: "LATAM", durationMinutes: 90 }, price: { amount: 550.75, currency: "BRL", status: "unverified", passengerCount: 3 }, bookingToken: "one-way-token" });
    expect(offers[0].price.lastCheckedAt).toBe("2026-11-18T01:00:00.000Z");
  });

  it("uses autocomplete results only and filters invalid/non-IATA airport IDs", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    const fetchMock = vi.fn().mockResolvedValue(response({ suggestions: [{ name: "São Paulo", country: "Brazil", airports: [
      { id: "GRU", name: "Guarulhos International Airport", city: "São Paulo" },
      { id: "CGH", name: "Congonhas Airport", city: "São Paulo" },
      { id: "GRU2", name: "Invalid airport identifier", city: "São Paulo" },
    ] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const results = await new SerpApiFlightProvider().searchAirports("São Paulo", 8, "BR");
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as URL);
    expect(requestUrl.searchParams.get("engine")).toBe("google_flights_autocomplete");
    expect(requestUrl.searchParams.get("q")).toBe("São Paulo");
    expect(requestUrl.searchParams.has("currency")).toBe(false);
    expect(requestUrl.searchParams.has("exclude_regions")).toBe(false);
    expect(results.map((item) => item.code)).toEqual(["GRU", "CGH"]);
    expect(results[0].country).toBe("Brazil");
  });

  it("maps Calendar dates/prices in BRL and uses the selected round-trip duration", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    const fetchMock = vi.fn().mockResolvedValue(response({ search_parameters: { currency: "BRL" }, prices: [
      { outbound_date: "2026-12-14", return_date: "2026-12-21", price: 780, low_price: true },
      { outbound_date: "2026-12-18", return_date: "2026-12-25", price: 920, low_price: false },
    ] }));
    vi.stubGlobal("fetch", fetchMock);
    const results = await new SerpApiFlightProvider().calendar({
      origin: "GRU", destination: "LIS", tripType: "roundtrip", departureDate: "2026-12-14", returnDate: "2026-12-21",
      adults: 1, children: 0, infants: 0, cabin: "economy", market: "BR",
    });
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as URL);
    expect(requestUrl.searchParams.get("engine")).toBe("google_flights_calendar");
    expect(requestUrl.searchParams.get("currency")).toBe("BRL");
    expect(requestUrl.searchParams.get("date_range_start")).toBe("2026-12-14");
    expect(requestUrl.searchParams.get("round_trip_days")).toBe("7");
    expect(requestUrl.searchParams.has("travel_class")).toBe(false);
    expect(results).toEqual([
      { departureDate: "2026-12-14", returnDate: "2026-12-21", amount: 780, currency: "BRL", lowPrice: true },
      { departureDate: "2026-12-18", returnDate: "2026-12-25", amount: 920, currency: "BRL", lowPrice: false },
    ]);
  });

  it("maps Deals only from the documented response without turning it into checkout", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    const fetchMock = vi.fn().mockResolvedValue(response({ search_parameters: { currency: "BRL" }, deals: [{
      name: "Rio de Janeiro", country: "Brazil", price: 640.5, start_date: "2026-12-14", end_date: "2026-12-21",
      airline: "LATAM", flight_link: "https://www.google.com/travel/flights", discount_percentage: 20,
    }] }));
    vi.stubGlobal("fetch", fetchMock);
    const deals = await new SerpApiFlightProvider().deals({ origin: "GRU", market: "BR" });
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as URL);
    expect(requestUrl.searchParams.get("engine")).toBe("google_flights_deals");
    expect(requestUrl.searchParams.get("departure_id")).toBe("GRU");
    expect(requestUrl.searchParams.get("currency")).toBe("BRL");
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({ destination: "Rio de Janeiro", amount: 640.5, currency: "BRL", airline: "LATAM", discountPercent: 20 });
  });

  it("follows the official departure token for round-trip and exposes inbound only when returned", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ search_parameters: { currency: "BRL" }, best_flights: [{
        flights: [flight("GRU", "GIG", "2026-12-14")], total_duration: 90, price: 1200, departure_token: "departure-token",
      }] }))
      .mockResolvedValueOnce(response({ search_parameters: { currency: "BRL" }, best_flights: [{
        flights: [flight("GIG", "GRU", "2026-12-21")], total_duration: 95, price: 1200, booking_token: "roundtrip-booking-token",
      }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new SerpApiFlightProvider().search({ ...oneWayInput, tripType: "roundtrip", returnDate: "2026-12-21" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const continuationUrl = new URL(fetchMock.mock.calls[1][0] as URL);
    expect(continuationUrl.searchParams.get("departure_token")).toBe("departure-token");
    expect(continuationUrl.searchParams.get("engine")).toBe("google_flights");
    expect(continuationUrl.searchParams.get("currency")).toBe("BRL");
    expect(continuationUrl.searchParams.get("departure_id")).toBe("GRU");
    expect(continuationUrl.searchParams.get("arrival_id")).toBe("GIG");
    expect(continuationUrl.searchParams.get("outbound_date")).toBe("2026-12-14");
    expect(continuationUrl.searchParams.get("return_date")).toBe("2026-12-21");
    expect(continuationUrl.searchParams.get("type")).toBe("1");
    expect(continuationUrl.searchParams.get("adults")).toBe("2");
    expect(continuationUrl.searchParams.get("travel_class")).toBe("1");
    expect(result).toHaveLength(1);
    expect(result[0].outbound.destination).toBe("GIG");
    expect(result[0].inbound).toMatchObject({ origin: "GIG", destination: "GRU" });
    expect(result[0].bookingToken).toBe("roundtrip-booking-token");
  });

  it("continues a two-segment multi-city search without mixing or dropping the requested routes", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ search_parameters: { currency: "BRL" }, best_flights: [{
        flights: [flight("GRU", "GIG", "2026-12-14")], total_duration: 90, price: 700, departure_token: "multi-token",
      }] }))
      .mockResolvedValueOnce(response({ search_parameters: { currency: "BRL" }, best_flights: [{
        flights: [flight("GIG", "MIA", "2026-12-17")], total_duration: 520, price: 700, booking_token: "multi-booking-token",
      }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new SerpApiFlightProvider().search({
      ...oneWayInput, tripType: "multi", origin: "GRU", destination: "MIA", departureDate: "2026-12-14",
      segments: [{ origin: "GRU", destination: "GIG", departureDate: "2026-12-14" }, { origin: "GIG", destination: "MIA", departureDate: "2026-12-17" }],
    });
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as URL);
    expect(requestUrl.searchParams.get("type")).toBe("3");
    expect(JSON.parse(requestUrl.searchParams.get("multi_city_json") ?? "[]")).toHaveLength(2);
    const continuationUrl = new URL(fetchMock.mock.calls[1][0] as URL);
    expect(continuationUrl.searchParams.get("departure_token")).toBe("multi-token");
    expect(continuationUrl.searchParams.get("type")).toBe("3");
    expect(JSON.parse(continuationUrl.searchParams.get("multi_city_json") ?? "[]")).toHaveLength(2);
    expect(continuationUrl.searchParams.get("adults")).toBe("2");
    expect(result).toHaveLength(1);
    expect(result[0].legs?.map((leg) => [leg.origin, leg.destination])).toEqual([["GRU", "GIG"], ["GIG", "MIA"]]);
  });

  it("returns only safe GET deeplinks from booking_options and never exposes POST booking requests", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    const fetchMock = vi.fn().mockResolvedValue(response({ search_parameters: { currency: "BRL" }, booking_options: [{
      together: { book_with: "Authorized Airline", price: 1000, booking_request: { url: "https://airline.example/book" } },
      departing: { book_with: "External seller", price: 400, booking_request: { url: "https://seller.example/book", post_data: "opaque" } },
      returning: { book_with: "Unsafe seller", price: 600, booking_request: { url: "https://evil.invalid/path" } },
    }] }));
    vi.stubGlobal("fetch", fetchMock);
    const options = await new SerpApiFlightProvider().bookingOptions("booking-token", oneWayInput);
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as URL);
    expect(requestUrl.searchParams.get("booking_token")).toBe("booking-token");
    expect(requestUrl.searchParams.get("departure_id")).toBe("GRU");
    expect(requestUrl.searchParams.get("arrival_id")).toBe("GIG");
    expect(requestUrl.searchParams.get("outbound_date")).toBe("2026-12-14");
    expect(requestUrl.searchParams.get("type")).toBe("2");
    expect(options).toHaveLength(3);
    expect(options[0]).toMatchObject({ providerName: "Authorized Airline", url: "https://airline.example/book", price: { amount: 1000, currency: "BRL", status: "unverified" } });
    expect(options[1].url).toBeUndefined();
    expect(options[2].url).toBe("https://evil.invalid/path");
  });

  it("rejects a non-BRL response and fails clearly without the shared key", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ search_parameters: { currency: "USD" }, best_flights: [] })));
    await expect(new SerpApiFlightProvider().search({ ...oneWayInput, destination: "SDU" })).rejects.toBeInstanceOf(SerpApiRequestError);
    delete process.env.SERPAPI_API_KEY;
    await expect(new SerpApiFlightProvider().search({ ...oneWayInput, destination: "MIA" })).rejects.toBeInstanceOf(SerpApiNotConfiguredError);
  });
});
