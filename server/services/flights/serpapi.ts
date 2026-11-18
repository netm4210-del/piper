import { createHash } from "node:crypto";
import { flightsIntegrationConfig } from "../../../config/integrations/flights.config";
import {
  isRecord,
  readCurrency,
  requestSerpApi,
  SerpApiRequestError,
  sourceTimestamp,
} from "../serpapi/client";
import type {
  FlightBookingOption,
  FlightCalendarPrice,
  FlightDeal,
  FlightSearchInput,
  NormalizedFlightLeg,
  NormalizedFlightOffer,
  NormalizedFlightSegment,
} from "./types";

const CACHE_TTL_MS = 5 * 60_000;
const MAX_SEARCH_RESULTS = 20;
const MAX_CONTINUATION_REQUESTS = 3;
const SERP_API_TIMEOUT_MS = 20_000;
const BOOKING_OPTIONS_TIMEOUT_MS = 60_000;
const flightCache = new Map<string, { expiresAt: number; value: NormalizedFlightOffer[] }>();
const flightPending = new Map<string, Promise<NormalizedFlightOffer[]>>();
const autocompleteCache = new Map<string, { expiresAt: number; value: AirportSuggestion[] }>();
const calendarCache = new Map<string, { expiresAt: number; value: FlightCalendarPrice[] }>();
const dealsCache = new Map<string, { expiresAt: number; value: FlightDeal[] }>();

type RawRecord = Record<string, unknown>;
export type AirportSuggestion = { code: string; name: string; city: string; country: string };
export type FlightCalendarInput = {
  origin: string;
  destination: string;
  tripType: "oneway" | "roundtrip";
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: FlightSearchInput["cabin"];
  market?: string;
};
export type FlightDealsInput = { origin: string; market?: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function asRecord(value: unknown): RawRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function dateIsValid(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function marketCode(market?: string): string {
  return market && /^[a-z]{2}$/i.test(market) ? market.toLowerCase() : flightsIntegrationConfig.market;
}

function cabinCode(cabin: FlightSearchInput["cabin"]): string {
  return ({ economy: "1", premium_economy: "2", business: "3", first: "4" } as const)[cabin];
}

function commonSearchParams(engine: string, market?: string): URLSearchParams {
  const params = new URLSearchParams({
    engine,
    gl: marketCode(market),
    hl: flightsIntegrationConfig.language,
  });
  if (engine !== flightsIntegrationConfig.engines.autocomplete) {
    params.set("currency", flightsIntegrationConfig.currency);
  }
  return params;
}

function passengerParams(params: URLSearchParams, input: Pick<FlightSearchInput, "adults" | "children" | "infants" | "cabin">): void {
  params.set("adults", String(input.adults));
  params.set("children", String(input.children));
  params.set("infants_on_lap", String(input.infants));
  params.set("travel_class", cabinCode(input.cabin));
}

function assertRequestedCurrency(payload: RawRecord): void {
  const currency = readCurrency(payload);
  if (currency !== flightsIntegrationConfig.currency) throw new SerpApiRequestError(502);
}

function safeHttpsUrl(value: unknown): string | undefined {
  const raw = text(value);
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function rawGroups(payload: RawRecord): RawRecord[] {
  const groups = [
    ...asArray(payload.best_flights),
    ...asArray(payload.other_flights),
  ].filter(isRecord);
  const seen = new Set<string>();
  return groups.filter((group) => {
    const signature = [
      text(group.booking_token),
      text(group.departure_token),
      text(group.price),
      JSON.stringify(group.flights ?? []),
    ].join("|");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function airportCode(value: unknown): string {
  const record = asRecord(value);
  const code = text(record?.id).toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "";
}

function mapRawSegment(value: unknown): NormalizedFlightSegment | undefined {
  const segment = asRecord(value);
  if (!segment) return undefined;
  const departureAirport = asRecord(segment.departure_airport);
  const arrivalAirport = asRecord(segment.arrival_airport);
  const origin = airportCode(departureAirport);
  const destination = airportCode(arrivalAirport);
  const departure = text(departureAirport?.time);
  const arrival = text(arrivalAirport?.time);
  if (!origin || !destination || !departure || !arrival) return undefined;

  const flightNumber = text(segment.flight_number) || undefined;
  const carrier = text(segment.airline);
  const carrierMatch = flightNumber?.match(/^([A-Z0-9]{2})\s*\d/);
  const carrierCode = carrierMatch?.[1] ?? "";
  const durationMinutes = finiteNumber(segment.duration);
  const aircraft = text(segment.airplane) || undefined;
  return {
    departure,
    arrival,
    origin,
    destination,
    carrier,
    carrierCode,
    ...(flightNumber ? { flightNumber } : {}),
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    ...(aircraft ? { aircraft } : {}),
  };
}

function legFromSegments(segments: NormalizedFlightSegment[], layovers?: unknown[]): NormalizedFlightLeg | undefined {
  if (segments.length === 0) return undefined;
  const first = segments[0];
  const last = segments[segments.length - 1];
  const durationMinutes = segments.reduce((total, segment) => total + (segment.durationMinutes ?? 0), 0);
  const carrier = first.carrier;
  return {
    departure: first.departure,
    arrival: last.arrival,
    durationMinutes,
    stops: Array.isArray(layovers) ? layovers.length : Math.max(0, segments.length - 1),
    origin: first.origin,
    destination: last.destination,
    carrier,
    carrierCode: first.carrierCode,
    segments,
  };
}

function mapSingleLeg(group: RawRecord): NormalizedFlightLeg | undefined {
  const rawFlights = asArray(group.flights);
  const segments = rawFlights.map(mapRawSegment).filter((segment): segment is NormalizedFlightSegment => Boolean(segment));
  if (segments.length !== rawFlights.length) return undefined;
  const leg = legFromSegments(segments, Array.isArray(group.layovers) ? group.layovers : undefined);
  if (!leg) return undefined;
  const totalDuration = finiteNumber(group.total_duration);
  if (totalDuration !== undefined) leg.durationMinutes = totalDuration;
  return leg;
}

function mapMultiCityLegs(group: RawRecord, requested: NonNullable<FlightSearchInput["segments"]>): NormalizedFlightLeg[] | undefined {
  const rawFlights = asArray(group.flights);
  const segments = rawFlights.map(mapRawSegment).filter((segment): segment is NormalizedFlightSegment => Boolean(segment));
  if (segments.length !== rawFlights.length || segments.length === 0) return undefined;
  const legs: NormalizedFlightLeg[] = [];
  let cursor = 0;

  for (const route of requested) {
    const expectedOrigin = route.origin.toUpperCase();
    const expectedDestination = route.destination.toUpperCase();
    let end = -1;
    for (let index = cursor; index < segments.length; index += 1) {
      if (segments[index].destination === expectedDestination) {
        end = index;
        break;
      }
    }
    if (end < cursor || segments[cursor].origin !== expectedOrigin) return undefined;
    const chunk = segments.slice(cursor, end + 1);
    if (chunk[chunk.length - 1]?.destination !== expectedDestination) return undefined;
    const leg = legFromSegments(chunk);
    if (!leg) return undefined;
    legs.push(leg);
    cursor = end + 1;
  }

  return cursor === segments.length ? legs : undefined;
}

function stableId(input: FlightSearchInput, group: RawRecord, suffix = ""): string {
  const signature = JSON.stringify({
    origin: input.origin,
    destination: input.destination,
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    segments: input.segments,
    flights: group.flights,
    price: group.price,
    bookingToken: group.booking_token,
    suffix,
  });
  return `serpapi-${createHash("sha256").update(signature).digest("hex").slice(0, 20)}`;
}

function offerFromLegs(
  input: FlightSearchInput,
  fareGroup: RawRecord,
  legs: NormalizedFlightLeg[],
  checkedAt: string,
  suffix = "",
): NormalizedFlightOffer | undefined {
  const amount = finiteNumber(fareGroup.price);
  if (amount === undefined || amount < 0 || legs.length === 0) return undefined;
  const firstSegment = legs[0].segments?.[0];
  const airlineName = firstSegment?.carrier || legs[0].carrier || "";
  if (!airlineName) return undefined;

  const airlineCode = firstSegment?.carrierCode ?? "";
  const airlineLogo = safeHttpsUrl(asRecord(asArray(fareGroup.flights)[0])?.airline_logo);
  const bookingToken = text(fareGroup.booking_token) || undefined;
  const offer: NormalizedFlightOffer = {
    id: stableId(input, fareGroup, suffix),
    provider: "google_flights",
    airline: {
      name: airlineName,
      code: airlineCode,
      ...(airlineLogo ? { logoUrl: airlineLogo } : {}),
    },
    outbound: legs[0],
    ...(legs[1] ? { inbound: legs[1] } : {}),
    legs,
    ...(bookingToken ? { bookingToken } : {}),
    price: {
      amount,
      currency: flightsIntegrationConfig.currency,
      status: "unverified",
      passengerCount: input.adults + input.children + input.infants,
      lastCheckedAt: checkedAt,
    },
    booking: { mode: "redirect", revalidationRequired: true },
  };
  return offer;
}

function validateLegRoute(leg: NormalizedFlightLeg | undefined, origin: string, destination: string): leg is NormalizedFlightLeg {
  return Boolean(leg && leg.origin === origin.toUpperCase() && leg.destination === destination.toUpperCase());
}

function searchParamsFor(input: FlightSearchInput): URLSearchParams {
  const params = commonSearchParams(flightsIntegrationConfig.engines.search, input.market);
  passengerParams(params, input);
  if (input.tripType === "multi") {
    if (!input.segments?.length) throw new Error("Informe pelo menos um trecho para a viagem multi-cidade.");
    params.set("type", "3");
    params.set("multi_city_json", JSON.stringify(input.segments.map((segment) => ({
      departure_id: segment.origin.toUpperCase(),
      arrival_id: segment.destination.toUpperCase(),
      date: segment.departureDate,
    }))));
    return params;
  }

  params.set("departure_id", input.origin.toUpperCase());
  params.set("arrival_id", input.destination.toUpperCase());
  params.set("outbound_date", input.departureDate);
  params.set("type", input.tripType === "roundtrip" ? "1" : "2");
  if (input.tripType === "roundtrip" && input.returnDate) params.set("return_date", input.returnDate);
  return params;
}

function continuationParams(token: string, input: FlightSearchInput): URLSearchParams {
  const params = searchParamsFor(input);
  params.set("departure_token", token);
  return params;
}

function cacheGet<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string, value: T, ttl = CACHE_TTL_MS): void {
  if (cache.size > 300) {
    const now = Date.now();
    for (const [entryKey, entry] of cache) if (entry.expiresAt <= now) cache.delete(entryKey);
    while (cache.size > 300) cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, { expiresAt: Date.now() + ttl, value });
}

async function fetchAndValidate(params: URLSearchParams, timeoutMs = SERP_API_TIMEOUT_MS): Promise<RawRecord> {
  const payload = await requestSerpApi(params, timeoutMs);
  assertRequestedCurrency(payload);
  return payload;
}

async function buildOneWayOffers(input: FlightSearchInput, payload: RawRecord): Promise<NormalizedFlightOffer[]> {
  const checkedAt = sourceTimestamp(payload);
  return rawGroups(payload)
    .map((group) => {
      const leg = mapSingleLeg(group);
      return leg && validateLegRoute(leg, input.origin, input.destination)
        ? offerFromLegs(input, group, [leg], checkedAt)
        : undefined;
    })
    .filter((offer): offer is NormalizedFlightOffer => Boolean(offer));
}

async function buildRoundTripOffers(input: FlightSearchInput, payload: RawRecord): Promise<NormalizedFlightOffer[]> {
  const outboundGroups = rawGroups(payload).filter((group) => text(group.departure_token)).slice(0, MAX_CONTINUATION_REQUESTS);
  const offers: NormalizedFlightOffer[] = [];

  for (const outboundGroup of outboundGroups) {
    const outbound = mapSingleLeg(outboundGroup);
    if (!validateLegRoute(outbound, input.origin, input.destination)) continue;
    const continuation = await fetchAndValidate(continuationParams(text(outboundGroup.departure_token), input));
    const checkedAt = sourceTimestamp(continuation);
    for (const returnGroup of rawGroups(continuation)) {
      const inbound = mapSingleLeg(returnGroup);
      if (!validateLegRoute(inbound, input.destination, input.origin)) continue;
      const offer = offerFromLegs(input, returnGroup, [outbound, inbound], checkedAt, text(outboundGroup.departure_token));
      if (offer) offers.push(offer);
    }
  }
  return offers;
}

async function buildMultiCityOffers(input: FlightSearchInput, payload: RawRecord): Promise<NormalizedFlightOffer[]> {
  const requested = input.segments ?? [];
  const checkedAt = sourceTimestamp(payload);
  const offers: NormalizedFlightOffer[] = [];
  const groups = rawGroups(payload);

  for (const group of groups) {
    const completeLegs = mapMultiCityLegs(group, requested);
    if (completeLegs) {
      const offer = offerFromLegs(input, group, completeLegs, checkedAt);
      if (offer) offers.push(offer);
      continue;
    }

    if (requested.length < 2 || !text(group.departure_token) || offers.length >= MAX_SEARCH_RESULTS) continue;
    const firstLeg = mapSingleLeg(group);
    if (!validateLegRoute(firstLeg, requested[0].origin, requested[0].destination)) continue;

    const continuation = await fetchAndValidate(continuationParams(text(group.departure_token), input));
    const continuationCheckedAt = sourceTimestamp(continuation);
    for (const nextGroup of rawGroups(continuation)) {
      const nextLeg = mapSingleLeg(nextGroup);
      if (!validateLegRoute(nextLeg, requested[1].origin, requested[1].destination)) continue;
      const offer = offerFromLegs(input, nextGroup, [firstLeg, nextLeg], continuationCheckedAt, text(group.departure_token));
      if (offer) offers.push(offer);
    }
    if (offers.length >= MAX_SEARCH_RESULTS) break;
  }
  return offers;
}

export class SerpApiFlightProvider {
  async search(input: FlightSearchInput): Promise<NormalizedFlightOffer[]> {
    const params = searchParamsFor(input);
    const key = params.toString();
    const cached = cacheGet(flightCache, key);
    if (cached) return cached;
    const pending = flightPending.get(key);
    if (pending) return pending;

    const request = (async () => {
      const payload = await fetchAndValidate(params);
      let offers: NormalizedFlightOffer[];
      if (input.tripType === "roundtrip") offers = await buildRoundTripOffers(input, payload);
      else if (input.tripType === "multi") offers = await buildMultiCityOffers(input, payload);
      else offers = await buildOneWayOffers(input, payload);
      const unique = [...new Map(offers.map((offer) => [offer.id, offer])).values()]
        .sort((left, right) => left.price.amount - right.price.amount)
        .slice(0, MAX_SEARCH_RESULTS);
      cacheSet(flightCache, key, unique);
      return unique;
    })();

    flightPending.set(key, request);
    try {
      return await request;
    } finally {
      flightPending.delete(key);
    }
  }

  async searchAirports(query: string, limit = 8, market?: string): Promise<AirportSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const params = commonSearchParams(flightsIntegrationConfig.engines.autocomplete, market);
    params.set("q", trimmed);
    const key = params.toString();
    const cached = cacheGet(autocompleteCache, key);
    if (cached) return cached.slice(0, limit);

    const payload = await requestSerpApi(params, SERP_API_TIMEOUT_MS);
    const suggestions = asArray(payload.suggestions).filter(isRecord);
    const mapped: AirportSuggestion[] = [];
    const seen = new Set<string>();
    for (const suggestion of suggestions) {
      const suggestionName = text(suggestion.name);
      const country = text(suggestion.country) || text(suggestion.description);
      for (const airport of asArray(suggestion.airports).filter(isRecord)) {
        const code = text(airport.id).toUpperCase();
        if (!/^[A-Z]{3}$/.test(code) || seen.has(code)) continue;
        const airportName = text(airport.name);
        const city = text(airport.city) || suggestionName;
        if (!airportName || !city) continue;
        seen.add(code);
        mapped.push({ code, name: airportName, city, country });
      }
      const directId = text(suggestion.id).toUpperCase();
      if (!Array.isArray(suggestion.airports) && /^[A-Z]{3}$/.test(directId) && suggestionName && !seen.has(directId)) {
        seen.add(directId);
        mapped.push({ code: directId, name: suggestionName, city: suggestionName, country });
      }
    }

    cacheSet(autocompleteCache, key, mapped, 10 * 60_000);
    return mapped.slice(0, limit);
  }

  async calendar(input: FlightCalendarInput): Promise<FlightCalendarPrice[]> {
    if (!dateIsValid(input.departureDate)) throw new Error("A data inicial do calendário deve estar no formato YYYY-MM-DD.");
    const start = new Date(`${input.departureDate}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 30);
    const endDate = end.toISOString().slice(0, 10);

    const params = commonSearchParams(flightsIntegrationConfig.engines.calendar, input.market);
    params.set("departure_id", input.origin.toUpperCase());
    params.set("arrival_id", input.destination.toUpperCase());
    params.set("type", input.tripType === "roundtrip" ? "1" : "2");
    params.set("date_range_start", input.departureDate);
    params.set("date_range_end", endDate);
    if (input.tripType === "roundtrip") {
      const departureTime = Date.parse(`${input.departureDate}T00:00:00Z`);
      const returnTime = input.returnDate && dateIsValid(input.returnDate) ? Date.parse(`${input.returnDate}T00:00:00Z`) : Number.NaN;
      const days = Number.isFinite(returnTime) && returnTime > departureTime
        ? Math.ceil((returnTime - departureTime) / 86_400_000)
        : 7;
      params.set("round_trip_days", String(Math.min(30, Math.max(1, days))));
    }

    const key = params.toString();
    const cached = cacheGet(calendarCache, key);
    if (cached) return cached;
    const payload = await fetchAndValidate(params);
    const prices = asArray(payload.prices).flatMap((value) => {
      const item = asRecord(value);
      if (!item) return [];
      const departureDate = text(item.outbound_date);
      const amount = finiteNumber(item.price);
      const returnDate = text(item.return_date) || undefined;
      if (!dateIsValid(departureDate) || amount === undefined || amount < 0) return [];
      return [{
        departureDate,
        ...(returnDate && dateIsValid(returnDate) ? { returnDate } : {}),
        amount,
        currency: flightsIntegrationConfig.currency,
        ...(typeof item.low_price === "boolean" ? { lowPrice: item.low_price } : {}),
      } satisfies FlightCalendarPrice];
    }).sort((left, right) => left.departureDate.localeCompare(right.departureDate));
    cacheSet(calendarCache, key, prices, 5 * 60_000);
    return prices;
  }

  async deals(input: FlightDealsInput): Promise<FlightDeal[]> {
    const params = commonSearchParams(flightsIntegrationConfig.engines.deals, input.market);
    params.set("departure_id", input.origin.toUpperCase());
    params.set("type", "1");
    const key = params.toString();
    const cached = cacheGet(dealsCache, key);
    if (cached) return cached;

    const payload = await fetchAndValidate(params);
    const deals = asArray(payload.deals).flatMap((value, index) => {
      const item = asRecord(value);
      if (!item) return [];
      const destination = text(item.name) || text(item.destination_id);
      const amount = finiteNumber(item.price);
      if (!destination || amount === undefined || amount < 0) return [];
      const url = safeHttpsUrl(item.flight_link) ?? safeHttpsUrl(item.serpapi_flight_link);
      const thumbnail = safeHttpsUrl(item.thumbnail);
      const country = text(item.country) || undefined;
      const airline = text(item.airline) || undefined;
      const departureDate = text(item.start_date) || undefined;
      const returnDate = text(item.end_date) || undefined;
      const durationMinutes = finiteNumber(item.flight_duration);
      const stops = finiteNumber(item.stops);
      const discountPercent = finiteNumber(item.discount_percentage);
      const id = `deal-${createHash("sha256").update(`${destination}|${amount}|${departureDate}|${index}`).digest("hex").slice(0, 16)}`;
      return [{
        id,
        destination,
        ...(country ? { country } : {}),
        amount,
        currency: flightsIntegrationConfig.currency,
        ...(discountPercent !== undefined ? { discountPercent } : {}),
        ...(departureDate && dateIsValid(departureDate) ? { departureDate } : {}),
        ...(returnDate && dateIsValid(returnDate) ? { returnDate } : {}),
        ...(durationMinutes !== undefined ? { durationMinutes } : {}),
        ...(stops !== undefined ? { stops } : {}),
        ...(airline ? { airline } : {}),
        ...(thumbnail ? { thumbnail } : {}),
        ...(url ? { url } : {}),
      } satisfies FlightDeal];
    });
    cacheSet(dealsCache, key, deals, 10 * 60_000);
    return deals;
  }

  async bookingOptions(bookingToken: string, input: FlightSearchInput): Promise<FlightBookingOption[]> {
    const params = searchParamsFor(input);
    params.set("booking_token", bookingToken);
    const payload = await fetchAndValidate(params, BOOKING_OPTIONS_TIMEOUT_MS);
    const rawOptions = asArray(payload.booking_options).filter(isRecord);
    const actualCurrency = readCurrency(payload);
    const options: FlightBookingOption[] = [];

    for (const rawOption of rawOptions) {
      const separateTickets = rawOption.separate_tickets === true;
      const groups: Array<{ key: "together" | "departing" | "returning"; value: RawRecord }> = [];
      for (const key of ["together", "departing", "returning"] as const) {
        const value = asRecord(rawOption[key]);
        if (value) groups.push({ key, value });
      }
      for (const { key, value } of groups) {
        const providerName = text(value.book_with) || text(value.option_title) || "Vendedor informado pela fonte";
        const request = asRecord(value.booking_request);
        const hasPostData = Boolean(text(request?.post_data));
        const url = !hasPostData ? safeHttpsUrl(request?.url) : undefined;
        const localPrices = asArray(value.local_prices).filter(isRecord);
        const localPrice = localPrices.find((price) => text(price.currency).toUpperCase() === flightsIntegrationConfig.currency);
        const amount = finiteNumber(localPrice?.price) ?? finiteNumber(value.price);
        const fareName = key === "departing" ? "Trecho de ida" : key === "returning" ? "Trecho de volta" : text(value.option_title) || undefined;
        options.push({
          providerName,
          ...(fareName ? { fareName } : {}),
          ...(url ? { url } : {}),
          ...(amount !== undefined && actualCurrency === flightsIntegrationConfig.currency ? { price: { amount, currency: actualCurrency, status: "unverified" } } : {}),
          ...(separateTickets ? { separateTickets: true } : {}),
        });
      }
    }

    const seen = new Set<string>();
    return options.filter((option) => {
      const key = `${option.providerName}|${option.fareName ?? ""}|${option.url ?? ""}|${option.price?.amount ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);
  }
}

export const serpApiFlightProvider = new SerpApiFlightProvider();
