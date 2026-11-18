import { afterEach, describe, expect, it, vi } from "vitest";
import { SerpApiNotConfiguredError, SerpApiRequestError } from "../serpapi/client";
import { AirbnbSerpApiProvider } from "./airbnb-serpapi";

const input = {
  location: "PIPER mock city",
  checkIn: "2026-12-14",
  checkOut: "2026-12-18",
  adults: 2,
  children: 1,
  infants: 0,
  propertyTypes: ["apartment" as const],
  bedrooms: 2,
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  delete process.env.SERPAPI_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Airbnb Search via SerpApi", () => {
  it("uses the shared SerpApi key, sends the documented parameters, keeps BRL and maps source listing fields", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    const fetchMock = vi.fn().mockResolvedValue(response({
      search_parameters: { engine: "airbnb", q: input.location, airbnb_domain: "airbnb.com.br", currency: "BRL", check_in_date: input.checkIn, check_out_date: input.checkOut },
      search_metadata: { processed_at: "2026-11-18T00:00:00Z" },
      organic_results: [{
        position: 1,
        listing_id: "39029322",
        title: "Apartment in Pinheiros",
        name: "Mock listing",
        link: "https://www.airbnb.com.br/rooms/39029322?check_in=2026-12-14&check_out=2026-12-18",
        rating: 4.93,
        reviews: 440,
        badges: ["Guest favorite"],
        price: "R$ 792,00",
        extracted_price: 792,
        price_qualifier: "for 4 nights",
        price_breakdown: [{ description: "4 noites x R$ 198,00", price: "R$ 792,00", extracted_price: 792 }],
        bedrooms: 2,
        beds: 2,
        bathrooms: 1,
        highlights: ["Free cancellation"],
        free_cancellation: true,
        gps_coordinates: { latitude: -23.56, longitude: -46.67 },
        thumbnail: "https://a0.muscache.com/im/pictures/mock.jpeg",
        images: ["https://a0.muscache.com/im/pictures/mock.jpeg"],
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AirbnbSerpApiProvider().search(input);
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as URL);
    expect(requestUrl.origin + requestUrl.pathname).toBe("https://serpapi.com/search.json");
    expect(requestUrl.searchParams.get("engine")).toBe("airbnb");
    expect(requestUrl.searchParams.get("q")).toBe(input.location);
    expect(requestUrl.searchParams.get("check_in_date")).toBe(input.checkIn);
    expect(requestUrl.searchParams.get("check_out_date")).toBe(input.checkOut);
    expect(requestUrl.searchParams.get("adults")).toBe("2");
    expect(requestUrl.searchParams.get("children")).toBe("1");
    expect(requestUrl.searchParams.get("currency")).toBe("BRL");
    expect(requestUrl.searchParams.get("airbnb_domain")).toBe("airbnb.com.br");
    expect(requestUrl.searchParams.get("property_types")).toBe("apartment");
    expect(requestUrl.searchParams.get("bedrooms")).toBe("2");
    expect(requestUrl.searchParams.get("api_key")).toBe("test-key-only");
    expect(result.currency).toBe("BRL");
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toMatchObject({ listingId: "39029322", name: "Mock listing", totalPrice: 792, nightlyPrice: 198, rating: 4.93, reviewCount: 440, bedrooms: 2, freeCancellation: true });
    expect(result.listings[0].link).toContain("airbnb.com.br/rooms/");
    expect(result.lastCheckedAt).toBe("2026-11-18T00:00:00.000Z");
  });

  it("rejects rather than relabeling a non-BRL response", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ search_parameters: { currency: "USD" }, organic_results: [] })));
    await expect(new AirbnbSerpApiProvider().search({ ...input, location: "PIPER currency test" })).rejects.toBeInstanceOf(SerpApiRequestError);
  });

  it("fails clearly when the single shared secret is missing", async () => {
    await expect(new AirbnbSerpApiProvider().search({ ...input, location: "PIPER secret test" })).rejects.toBeInstanceOf(SerpApiNotConfiguredError);
  });

  it("drops non-Airbnb links instead of returning an unsafe URL", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      search_parameters: { currency: "BRL" },
      organic_results: [{ listing_id: "unsafe-1", name: "Unsafe mock", link: "https://example.com/rooms/1", extracted_price: 100 }],
    })));
    const result = await new AirbnbSerpApiProvider().search({ ...input, location: "PIPER unsafe URL test" });
    expect(result.listings).toEqual([]);
  });
});
