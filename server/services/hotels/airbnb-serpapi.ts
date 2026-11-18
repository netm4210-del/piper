import { airbnbSearchIntegrationConfig } from "../../../config/integrations/airbnb-serpapi.config";
import {
  isRecord,
  readCurrency,
  requestSerpApi,
  SerpApiRequestError,
  sourceTimestamp,
} from "../serpapi/client";

const CACHE_TTL_MS = airbnbSearchIntegrationConfig.cacheTtlMs;
const cache = new Map<string, { expiresAt: number; value: AirbnbSearchResult }>();

export type AirbnbSearchInput = {
  location: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number;
  propertyTypes?: Array<"house" | "apartment" | "guesthouse" | "hotel">;
  bedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
};

export type AirbnbPriceBreakdownItem = { description: string; priceText?: string; amount?: number };
export type AirbnbListing = {
  id: string;
  listingId: string;
  title: string;
  name: string;
  description?: string;
  propertyType?: string;
  nightlyPrice?: number;
  link: string;
  rating?: number;
  reviewCount?: number;
  badges: string[];
  priceText?: string;
  totalPrice?: number;
  priceQualifier?: string;
  priceBreakdown: AirbnbPriceBreakdownItem[];
  checkInDate?: string;
  checkOutDate?: string;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  highlights: string[];
  freeCancellation?: boolean;
  latitude?: number;
  longitude?: number;
  thumbnail?: string;
  images: string[];
};
export type AirbnbSearchResult = { listings: AirbnbListing[]; currency: "BRL"; queriedLocation: string; lastCheckedAt: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function safeAirbnbUrl(value: unknown): string | undefined {
  const raw = text(value);
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const isAirbnb = /(^|\.)airbnb\.com$/.test(host)
      || /(^|\.)airbnb\.(?:com|co)\.[a-z]{2,3}$/.test(host)
      || /(^|\.)airbnb\.[a-z]{2,3}$/.test(host);
    return url.protocol === "https:" && !url.username && !url.password && isAirbnb ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function safeImageUrl(value: unknown): string | undefined {
  const raw = text(value);
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseLocalizedAmount(value: string): number | undefined {
  let normalized = value.replace(/[^0-9,.]/g, "");
  if (!normalized) return undefined;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    normalized = /,\d{3}$/.test(normalized) ? normalized.replace(/,/g, "") : normalized.replace(",", ".");
  } else if (/\.\d{3}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractNightlyPrice(value: unknown): number | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const part of value) {
    if (!isRecord(part)) continue;
    const description = text(part.description);
    const match = description.match(/\b\d+\s*(?:nights?|noites?)\s*[x×]\s*(?:(?:R\$|US\$|\$|€|£)\s*)?([\d.,]+)/i);
    if (match) return parseLocalizedAmount(match[1]);
  }
  return undefined;
}

function mapListing(value: unknown): AirbnbListing | undefined {
  if (!isRecord(value)) return undefined;
  const listingId = text(value.listing_id);
  const link = safeAirbnbUrl(value.link);
  if (!listingId || !link) return undefined;
  const breakdown = Array.isArray(value.price_breakdown) ? value.price_breakdown.flatMap((part) => {
    if (!isRecord(part)) return [];
    const description = text(part.description);
    if (!description) return [];
    const priceText = text(part.price);
    const amount = number(part.extracted_price);
    return [{ description, ...(priceText ? { priceText } : {}), ...(amount !== undefined ? { amount } : {}) }];
  }) : [];
  const coordinates = isRecord(value.gps_coordinates) ? value.gps_coordinates : {};
  const title = text(value.title);
  const name = text(value.name) || title;
  if (!name) return undefined;
  const totalPrice = number(value.extracted_price);
  const images = (Array.isArray(value.images) ? value.images : []).map(safeImageUrl).filter((image): image is string => Boolean(image));
  const thumbnail = safeImageUrl(value.thumbnail) ?? images[0];
  const propertyType = title || undefined;
  const description = text(value.description);
  const nightlyPrice = extractNightlyPrice(value.price_breakdown);
  const rating = number(value.rating);
  const reviewCount = number(value.reviews);
  const bedrooms = number(value.bedrooms);
  const beds = number(value.beds);
  const bathrooms = number(value.bathrooms);
  const latitude = number(coordinates.latitude);
  const longitude = number(coordinates.longitude);
  const freeCancellation = typeof value.free_cancellation === "boolean" ? value.free_cancellation : undefined;
  return {
    id: `airbnb-${listingId}`,
    listingId,
    title,
    name,
    ...(propertyType ? { propertyType } : {}),
    ...(description ? { description } : {}),
    ...(nightlyPrice !== undefined ? { nightlyPrice } : {}),
    link,
    ...(rating !== undefined ? { rating } : {}),
    ...(reviewCount !== undefined ? { reviewCount } : {}),
    badges: stringArray(value.badges),
    ...(text(value.price) ? { priceText: text(value.price) } : {}),
    ...(totalPrice !== undefined ? { totalPrice } : {}),
    ...(text(value.price_qualifier) ? { priceQualifier: text(value.price_qualifier) } : {}),
    priceBreakdown: breakdown,
    ...(text(value.check_in_date) ? { checkInDate: text(value.check_in_date) } : {}),
    ...(text(value.check_out_date) ? { checkOutDate: text(value.check_out_date) } : {}),
    ...(bedrooms !== undefined ? { bedrooms } : {}),
    ...(beds !== undefined ? { beds } : {}),
    ...(bathrooms !== undefined ? { bathrooms } : {}),
    highlights: stringArray(value.highlights),
    ...(freeCancellation !== undefined ? { freeCancellation } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    images,
  };
}

function cacheGet(key: string): AirbnbSearchResult | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet(key: string, value: AirbnbSearchResult): void {
  if (cache.size > 300) {
    const now = Date.now();
    for (const [entryKey, entry] of cache) if (entry.expiresAt <= now) cache.delete(entryKey);
    while (cache.size > 300) cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

export class AirbnbSerpApiProvider {
  async search(input: AirbnbSearchInput): Promise<AirbnbSearchResult> {
    const params = new URLSearchParams({
      engine: airbnbSearchIntegrationConfig.engine,
      q: input.location.trim(),
      airbnb_domain: airbnbSearchIntegrationConfig.domain,
      currency: airbnbSearchIntegrationConfig.currency,
      check_in_date: input.checkIn,
      check_out_date: input.checkOut,
      adults: String(input.adults),
      children: String(input.children),
      infants: String(input.infants),
    });
    if (input.propertyTypes?.length) params.set("property_types", input.propertyTypes.join(","));
    if (input.bedrooms !== undefined && input.bedrooms > 0) params.set("bedrooms", String(input.bedrooms));
    if (input.minPrice !== undefined) params.set("min_price", String(input.minPrice));
    if (input.maxPrice !== undefined) params.set("max_price", String(input.maxPrice));

    const key = params.toString();
    const cached = cacheGet(key);
    if (cached) return cached;

    const payload = await requestSerpApi(params, airbnbSearchIntegrationConfig.requestTimeoutMs);
    const actualCurrency = readCurrency(payload);
    if (actualCurrency !== airbnbSearchIntegrationConfig.currency) throw new SerpApiRequestError(502);

    const rawResults = Array.isArray(payload.organic_results) ? payload.organic_results : [];
    const listings = rawResults.slice(0, 18).map(mapListing).filter((listing): listing is AirbnbListing => Boolean(listing));
    const result: AirbnbSearchResult = {
      listings,
      currency: "BRL",
      queriedLocation: input.location.trim(),
      lastCheckedAt: sourceTimestamp(payload),
    };
    cacheSet(key, result);
    return result;
  }
}

export const airbnbSerpApiProvider = new AirbnbSerpApiProvider();
