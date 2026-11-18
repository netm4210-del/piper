import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownUp,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Clock3,
  ExternalLink,
  Globe2,
  Hotel,
  Luggage,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Plane,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { FlightBookingOption, FlightCalendarPrice, FlightDeal, FlightSearchInput, NormalizedFlightOffer } from "../../../server/services/flights/types";
import AirbnbResults from "@/components/AirbnbResults";
import type { AirbnbSearchResult } from "../../../server/services/hotels/airbnb-serpapi";
import {
  DestinationAnimation,
  FlightCardAnimation,
  HeroAnimation,
  LoadingAnimation,
  MicroInteractions,
  PageTransition,
  ScrollReveal,
  SearchAnimation,
} from "@/components/animations";

type SearchMode = "flights" | "stays";
type TripType = "roundtrip" | "oneway" | "multi";
type SearchStatus = "idle" | "loading" | "pending" | "results" | "error";
type RouteSegment = { origin: LocationOption | null; destination: LocationOption | null; departure: string };

const WHATSAPP_URL = "https://w.app/ltziws";

type LocationOption = {
  city: string;
  airport: string;
  code: string;
  country: string;
};

const destinations = [
  { city: "Lisboa", country: "Portugal", image: "/assets/lisbon.webp", eyebrow: "Europa solar", code: "LIS" },
  { city: "Paris", country: "França", image: "/assets/paris.jpg", eyebrow: "Clássicos que ficam", code: "CDG" },
  { city: "Tóquio", country: "Japão", image: "/assets/tokyo.jpg", eyebrow: "Ritmo do futuro", code: "HND" },
];

const faqs = [
  ["Como pesquisar uma passagem?", "Escolha origem, destino, datas, passageiros e classe. A PIPER consulta o Google Flights via SerpApi e organiza os resultados retornados pela fonte."],
  ["Os preços são atualizados?", "A pesquisa usa a fonte SerpApi e mostra a data retornada. Preços e disponibilidade precisam ser revalidados no vendedor antes de comprar; a PIPER não processa o pagamento."],
  ["Posso pesquisar voos internacionais?", "Sim. A busca aceita códigos IATA de aeroportos nacionais e internacionais, com preços solicitados em reais."],
  ["Como encontro hospedagens?", "Abra Hospedagens, informe destino, datas e hóspedes. A PIPER consulta resultados Airbnb via SerpApi e mantém preços, avaliações, fotos e links somente quando retornados pela fonte."],
  ["Como funciona a confirmação?", "A PIPER não confirma nem processa reservas. A compra/estadia é concluída no endereço oficial do vendedor e depende da disponibilidade e do preço final informados lá."],
];

function formatDate(date: string) {
  if (!date) return "Selecionar";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function LocationField({
  label,
  value,
  onChange,
  icon,
  idPrefix,
}: {
  label: string;
  value: LocationOption | null;
  onChange: (value: LocationOption | null) => void;
  icon: "from" | "to";
  idPrefix?: string;
}) {
  const [query, setQuery] = useState(value ? `${value.city} (${value.code})` : "");
  const [open, setOpen] = useState(false);
  const normalizedQuery = query.replace(/\s*\([^)]*\)/, "").trim();
  const [debouncedQuery, setDebouncedQuery] = useState(normalizedQuery);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(normalizedQuery), 250);
    return () => window.clearTimeout(timer);
  }, [normalizedQuery]);
  const airportQuery = trpc.flights.airports.useQuery(
    { query: debouncedQuery, limit: 6, market: "BR" },
    { enabled: open && debouncedQuery.length >= 2, staleTime: 60_000, retry: false },
  );
  const remoteLocations = useMemo(
    () => airportQuery.data?.map((item) => ({ city: item.city, airport: item.name, code: item.code, country: item.country })) ?? [],
    [airportQuery.data],
  );

  return (
    <div className="search-field location-field">
      <div className="field-icon"><MapPin size={17} strokeWidth={1.8} /></div>
      <label htmlFor={`${idPrefix ?? icon}-location`}>{label}</label>
      <input
        id={`${idPrefix ?? icon}-location`}
        value={query}
        placeholder={icon === "from" ? "Cidade ou aeroporto" : "Para onde?"}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); onChange(null); setOpen(true); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {value && <span className="field-code">{value.code}</span>}
      {open && remoteLocations.length > 0 && (
        <div className="autocomplete-panel">
          {remoteLocations.map((item) => (
            <button key={item.code} type="button" className="suggestion" onMouseDown={() => { onChange(item); setQuery(`${item.city} (${item.code})`); setOpen(false); }}>
              <span className="suggestion-icon"><Navigation size={15} /></span>
              <span><strong>{item.city}</strong><small>{item.airport}{item.country ? ` · ${item.country}` : ""}</small></span>
              <b>{item.code}</b>
            </button>
          ))}
        </div>
      )}
      {open && debouncedQuery.length >= 2 && remoteLocations.length === 0 && (
        <div className="autocomplete-panel autocomplete-message">
          {airportQuery.isLoading ? "Buscando aeroportos…" : airportQuery.error ? airportQuery.error.message : "A fonte não retornou aeroportos para esta busca."}
        </div>
      )}
    </div>
  );
}

function PassengerPopover({
  passengers,
  setPassengers,
}: {
  passengers: { adults: number; children: number; infants: number };
  setPassengers: (next: { adults: number; children: number; infants: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = passengers.adults + passengers.children + passengers.infants;
  const change = (key: keyof typeof passengers, delta: number) => {
    const nextValue = Math.max(key === "adults" ? 1 : 0, passengers[key] + delta);
    setPassengers({ ...passengers, [key]: nextValue });
  };
  return (
    <div className="search-field passengers-field">
      <div className="field-icon"><Users size={17} strokeWidth={1.8} /></div>
      <button type="button" className="passenger-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span><small>Passageiros</small><strong>{total} {total === 1 ? "passageiro" : "passageiros"}</strong></span><ChevronDown size={15} />
      </button>
      {open && (
        <div className="passenger-panel">
          <div className="passenger-panel-heading"><strong>Quem vai viajar?</strong><button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={15} /></button></div>
          {([["adults", "Adultos", "12 anos ou mais"], ["children", "Crianças", "2 a 11 anos"], ["infants", "Bebês no colo", "Menos de 2 anos"]] as const).map(([key, title, note]) => (
            <div className="passenger-row" key={key}><span><strong>{title}</strong><small>{note}</small></span><div className="stepper"><button type="button" onClick={() => change(key, -1)} disabled={key === "adults" && passengers.adults === 1}>−</button><b>{passengers[key]}</b><button type="button" onClick={() => change(key, 1)}>+</button></div></div>
          ))}
          <button type="button" className="passenger-done" onClick={() => setOpen(false)}>Concluir</button>
        </div>
      )}
    </div>
  );
}

function formatClock(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDuration(minutes: number) {
  if (!minutes) return "Duração não informada";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${rest ? ` ${String(rest).padStart(2, "0")}m` : ""}`;
}

function formatMoney(amount: number, currency: string) {
  // O backend só aceita BRL; esta função apenas apresenta o valor recebido, sem conversão.
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function ResultLeg({ leg, label }: { leg: NonNullable<NormalizedFlightOffer["outbound"]>; label: string }) {
  const flightNumbers = leg.segments?.map((segment) => segment.flightNumber).filter(Boolean) ?? [];
  return <div className="result-leg"><span className="result-leg-label">{label}</span><div className="result-time"><strong>{formatClock(leg.departure)}</strong><small>{leg.origin}</small></div><div className="result-line"><span /> <i /> <span /></div><div className="result-time arrival"><strong>{formatClock(leg.arrival)}</strong><small>{leg.destination}</small></div><div className="result-leg-meta"><Clock3 size={13} /> {formatDuration(leg.durationMinutes)} <span /> {leg.stops === 0 ? "Direto" : `${leg.stops} escala${leg.stops > 1 ? "s" : ""}`}</div>{flightNumbers.length > 0 && <small className="result-segment-details">{flightNumbers.join(" · ")}</small>}</div>;
}

function FlightResults({
  results,
  sort,
  setSort,
  bookingLinks,
  bookingPendingId,
  onBookingLinks,
  copiedId,
  onCopy,
  international,
}: {
  results: NormalizedFlightOffer[];
  sort: "price" | "duration" | "best";
  setSort: (value: "price" | "duration" | "best") => void;
  bookingLinks: Record<string, FlightBookingOption[]>;
  bookingPendingId: string;
  onBookingLinks: (id: string) => void;
  copiedId: string;
  onCopy: (offer: NormalizedFlightOffer) => void;
  international: boolean;
}) {
  const totalDuration = (offer: NormalizedFlightOffer) => (offer.legs?.length ? offer.legs : [offer.outbound, ...(offer.inbound ? [offer.inbound] : [])]).reduce((sum, leg) => sum + leg.durationMinutes, 0);
  const lowestPrice = Math.min(...results.map((offer) => offer.price.amount));
  const fastest = Math.min(...results.map(totalDuration));
  const sorted = [...results].sort((a, b) => {
    if (sort === "price") return a.price.amount - b.price.amount;
    if (sort === "duration") return totalDuration(a) - totalDuration(b);
    return (a.price.amount + totalDuration(a) * 0.18) - (b.price.amount + totalDuration(b) * 0.18);
  });
  const checkedAt = results[0]?.price.lastCheckedAt;

  return <section className="flight-results" aria-live="polite"><div className="results-heading"><div><span className="eyebrow">GOOGLE FLIGHTS · SERPAPI</span><h3>{results.length} {results.length === 1 ? "opção encontrada" : "opções encontradas"}</h3><p>{checkedAt ? `Dados consultados pela fonte em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(checkedAt))}.` : "Dados retornados pela fonte."} Revalide o valor no vendedor.</p></div><label className="sort-control"><ArrowDownUp size={14} /> Ordenar<select value={sort} onChange={(event) => setSort(event.target.value as "price" | "duration" | "best")}><option value="best">Melhor opção</option><option value="price">Menor preço</option><option value="duration">Menor duração</option></select></label></div><div className="flight-table-head"><span>Companhia e rota</span><span>Detalhes da tarifa</span><span>Preço total</span><span>Ações</span></div><div className="result-list">{sorted.map((offer) => {
    const legs = offer.legs?.length ? offer.legs : [offer.outbound, ...(offer.inbound ? [offer.inbound] : [])];
    const duration = totalDuration(offer);
    const options = bookingLinks[offer.id];
    const isLowest = offer.price.amount === lowestPrice;
    const isFastest = duration === fastest;
    const legLabel = (index: number) => offer.inbound ? (index === 0 ? "Ida" : "Volta") : (legs.length > 1 ? `Trecho ${index + 1}` : "Ida");
    return <article className="flight-result-card" key={offer.id}><div className="result-card-top"><div className="result-airline"><div className="airline-mark"><Plane size={17} /></div><span><strong>{offer.airline.name}</strong><small>{offer.airline.code || "Companhia aérea"} · {offer.fareFamily ?? "Classe não informada"}</small></span></div><div className="result-tags">{isLowest && <b className="result-tag blue">MENOR PREÇO</b>}{isFastest && !isLowest && <b className="result-tag navy">MENOR DURAÇÃO</b>}{international ? <b className="result-tag pale">OFERTA INTERNACIONAL</b> : <b className="result-tag pale">OFERTA NACIONAL</b>}</div></div><div className={`result-legs ${legs.length === 1 ? "single-leg" : ""}`}>{legs.map((leg, index) => <ResultLeg key={`${leg.origin}-${leg.destination}-${index}`} leg={leg} label={legLabel(index)} />)}</div><div className="result-bottom"><div className="result-details"><span><Luggage size={14} /> {offer.baggage ?? "Bagagem não informada pela fonte"}</span>{offer.requiresSelfTransfer && <span className="warning-detail"><CircleAlert size={14} /> Autotransferência possível</span>}<small>Consulta: {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(offer.price.lastCheckedAt))}</small></div><div className="result-price"><small>Preço informado pela fonte</small><strong>{formatMoney(offer.price.amount, offer.price.currency)}</strong><span>total · {offer.price.passengerCount} passageiro{offer.price.passengerCount !== 1 ? "s" : ""}</span></div></div><div className="result-actions"><button type="button" className="copy-offer" onClick={() => onCopy(offer)}><Copy size={14} /> {copiedId === offer.id ? "Oferta copiada" : "Copiar oferta PIPER"}</button>{options === undefined ? (offer.bookingToken ? <button type="button" className="booking-button" onClick={() => onBookingLinks(offer.id)} disabled={bookingPendingId === offer.id}>{bookingPendingId === offer.id ? "Consultando opções…" : <>Ver opções de compra <ArrowRight size={15} /></>}</button> : <span className="booking-option-label">A fonte não retornou token de compra</span>) : options.length > 0 ? <div className="booking-links">{options.map((option, index) => { const label = `${option.providerName}${option.fareName ? ` · ${option.fareName}` : ""}${option.price ? ` · ${formatMoney(option.price.amount, option.price.currency)}` : ""}`; return option.url ? <a href={option.url} target="_blank" rel="noopener noreferrer" key={`${option.providerName}-${option.url}-${index}`}><ExternalLink size={14} /> {label}</a> : <span className="booking-option-label" key={`${option.providerName}-${option.fareName ?? ""}-${index}`}>{label}{option.separateTickets ? " · bilhete separado" : " · link direto não retornado"}</span>; })}</div> : <span className="booking-option-label">A fonte não retornou opções de compra.</span>}</div></article>;
  })}</div></section>;
}

function SearchPanel({ initialMode = "flights" }: { initialMode?: SearchMode }) {
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [airbnbBedrooms, setAirbnbBedrooms] = useState(0);
  const [airbnbPropertyType, setAirbnbPropertyType] = useState<"all" | "house" | "apartment" | "guesthouse" | "hotel">("all");
  const [tripType, setTripType] = useState<TripType>("roundtrip");
  const [origin, setOrigin] = useState<LocationOption | null>(null);
  const [destination, setDestination] = useState<LocationOption | null>(null);
  const [segments, setSegments] = useState<RouteSegment[]>([
    { origin: null, destination: null, departure: "" },
    { origin: null, destination: null, departure: "" },
  ]);
  const [departure, setDeparture] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [passengers, setPassengers] = useState({ adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState<"economy" | "premium_economy" | "business" | "first">("economy");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [notice, setNotice] = useState("");
  const [flightResults, setFlightResults] = useState<NormalizedFlightOffer[]>([]);
  const [lastFlightSearchInput, setLastFlightSearchInput] = useState<FlightSearchInput | null>(null);
  const [airbnbResult, setAirbnbResult] = useState<AirbnbSearchResult | null>(null);
  const [sort, setSort] = useState<"price" | "duration" | "best">("best");
  const [bookingLinks, setBookingLinks] = useState<Record<string, FlightBookingOption[]>>({});
  const [bookingPendingId, setBookingPendingId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const searchMutation = trpc.flights.search.useMutation();
  const bookingLinksMutation = trpc.flights.bookingLinks.useMutation();
  const calendarMutation = trpc.flights.calendar.useMutation();
  const dealsMutation = trpc.flights.deals.useMutation();
  const hotelSearchMutation = trpc.hotels.search.useMutation();

  useEffect(() => {
    if (!resultsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setResultsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [resultsOpen]);

  const runFlightSearch = (input: FlightSearchInput) => {
    setNotice("");
    setFlightResults([]);
    setLastFlightSearchInput(input);
    setStatus("loading");
    searchMutation.mutate(input, {
      onSuccess: (results) => {
        setFlightResults(results);
        setStatus("results");
        setResultsOpen(true);
        if (results.length === 0) setNotice("A fonte Google Flights não retornou itinerários para estes critérios. Tente outras datas ou aeroportos.");
      },
      onError: (error) => {
        setStatus("error");
        setNotice(error.message || "A SerpApi não conseguiu concluir a pesquisa de voos.");
      },
    });
  };

  const runHotelSearch = () => {
    setNotice("");
    setAirbnbResult(null);
    setStatus("loading");
    hotelSearchMutation.mutate({
      location: city,
      checkIn,
      checkOut,
      adults: passengers.adults,
      children: passengers.children,
      infants: passengers.infants,
      propertyTypes: airbnbPropertyType === "all" ? undefined : [airbnbPropertyType],
      bedrooms: airbnbBedrooms || undefined,
    }, {
      onSuccess: (result) => {
        setAirbnbResult(result);
        setStatus("results");
        if (result.listings.length === 0) setNotice("O engine Airbnb via SerpApi não retornou anúncios para este destino e período.");
      },
      onError: (error) => {
        setStatus("error");
        setNotice(error.message || "Não foi possível consultar hospedagens Airbnb via SerpApi.");
      },
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "flights" && tripType !== "multi" && (!origin || !destination || !departure || (tripType === "roundtrip" && !returnDate))) {
      setNotice("Selecione origem, destino e as datas da viagem nos resultados do autocomplete.");
      setStatus("idle");
      return;
    }
    if (mode === "flights" && tripType === "multi" && segments.some((segment) => !segment.origin || !segment.destination || !segment.departure)) {
      setNotice("Complete a origem, o destino e a data de cada trecho.");
      setStatus("idle");
      return;
    }
    if (mode === "flights" && tripType === "multi") {
      for (let index = 1; index < segments.length; index += 1) {
        if (segments[index - 1].destination?.code !== segments[index].origin?.code) {
          setNotice("A origem de cada trecho precisa ser o destino do trecho anterior.");
          setStatus("idle");
          return;
        }
        if (segments[index].departure < segments[index - 1].departure) {
          setNotice("As datas dos trechos precisam estar em ordem.");
          setStatus("idle");
          return;
        }
      }
    }
    if (mode === "flights" && tripType === "roundtrip" && returnDate <= departure) {
      setNotice("A volta precisa acontecer depois da ida.");
      setStatus("idle");
      return;
    }
    if (mode === "stays" && (!city.trim() || !checkIn || !checkOut)) {
      setNotice("Informe cidade, check-in e check-out para continuar.");
      setStatus("idle");
      return;
    }
    if (mode === "stays" && checkOut <= checkIn) {
      setNotice("O check-out precisa acontecer depois do check-in.");
      setStatus("idle");
      return;
    }
    if (mode === "stays" && passengers.adults + passengers.children + passengers.infants > 20) {
      setNotice("A PIPER permite até 20 hóspedes por pesquisa.");
      setStatus("idle");
      return;
    }
    if (mode === "flights" && passengers.adults + passengers.children + passengers.infants > 9) {
      setNotice("A PIPER permite até 9 passageiros por pesquisa.");
      setStatus("idle");
      return;
    }
    if (passengers.infants > passengers.adults) {
      setNotice("A quantidade de bebês no colo não pode exceder a de adultos.");
      setStatus("idle");
      return;
    }

    if (mode === "stays") {
      runHotelSearch();
      return;
    }

    const multiSegments = tripType === "multi" ? segments.map((segment) => ({
      origin: segment.origin!.code,
      destination: segment.destination!.code,
      departureDate: segment.departure,
    })) : undefined;
    runFlightSearch({
      tripType,
      origin: tripType === "multi" ? multiSegments![0].origin : origin!.code,
      destination: tripType === "multi" ? multiSegments![multiSegments!.length - 1].destination : destination!.code,
      departureDate: tripType === "multi" ? multiSegments![0].departureDate : departure,
      returnDate: tripType === "roundtrip" ? returnDate : undefined,
      segments: multiSegments,
      adults: passengers.adults,
      children: passengers.children,
      infants: passengers.infants,
      cabin,
      market: "BR",
    });
  };

  const switchMode = (next: SearchMode) => {
    setMode(next);
    setStatus("idle");
    setNotice("");
    setFlightResults([]);
    setAirbnbResult(null);
    setLastFlightSearchInput(null);
    setCalendarOpen(false);
    setResultsOpen(false);
    dealsMutation.reset();
  };

  const handleBookingLinks = (id: string) => {
    const offer = flightResults.find((item) => item.id === id);
    if (!offer?.bookingToken || !lastFlightSearchInput) {
      setNotice("A fonte não retornou token para consultar opções de compra deste voo.");
      return;
    }
    setBookingPendingId(id);
    bookingLinksMutation.mutate({ ...lastFlightSearchInput, bookingToken: offer.bookingToken }, {
      onSuccess: (options) => { setBookingLinks((current) => ({ ...current, [id]: options })); setBookingPendingId(""); },
      onError: (error) => { setBookingLinks((current) => ({ ...current, [id]: [] })); setBookingPendingId(""); setNotice(error.message || "Não foi possível consultar as opções de compra."); },
    });
  };

  const copyOffer = async (offer: NormalizedFlightOffer) => {
    const legs = offer.legs?.length ? offer.legs : [offer.outbound, ...(offer.inbound ? [offer.inbound] : [])];
    const route = legs.map((leg) => `${leg.origin} → ${leg.destination}`).join("\n");
    const label = offer.inbound ? "PIPER | OFERTA DE IDA E VOLTA" : legs.length > 1 ? "PIPER | OFERTA MULTI-CIDADE" : "PIPER | OFERTA DE IDA";
    const text = `${label}\n\n${route}\n\n(Preço informado pela fonte: ${formatMoney(offer.price.amount, offer.price.currency)})\n\nRevalide preço e disponibilidade no vendedor.\n\nPIPER — Viaje mais. Pague menos.`;
    await navigator.clipboard?.writeText(text);
    setCopiedId(offer.id);
    window.setTimeout(() => setCopiedId(""), 1800);
  };

  const loadCalendar = () => {
    if (!origin || !destination || !departure || (tripType === "roundtrip" && !returnDate)) {
      setNotice("Selecione origem, destino e datas antes de consultar o calendário.");
      return;
    }
    setNotice("");
    setCalendarOpen(true);
    calendarMutation.mutate({
      origin: origin.code,
      destination: destination.code,
      tripType: tripType === "oneway" ? "oneway" : "roundtrip",
      departureDate: departure,
      returnDate: tripType === "roundtrip" ? returnDate : undefined,
      adults: passengers.adults,
      children: passengers.children,
      infants: passengers.infants,
      cabin,
      market: "BR",
    }, { onError: (error) => setNotice(error.message || "Não foi possível consultar o calendário de preços.") });
  };

  const selectCalendarPrice = (price: FlightCalendarPrice) => {
    if (tripType === "roundtrip" && !price.returnDate) {
      setNotice("A fonte não retornou a data de volta para esta opção do calendário.");
      return;
    }
    const nextReturn = tripType === "roundtrip" ? price.returnDate : undefined;
    setDeparture(price.departureDate);
    if (nextReturn) setReturnDate(nextReturn);
    setCalendarOpen(false);
    runFlightSearch({
      tripType: tripType === "oneway" ? "oneway" : "roundtrip",
      origin: origin!.code,
      destination: destination!.code,
      departureDate: price.departureDate,
      returnDate: nextReturn,
      adults: passengers.adults,
      children: passengers.children,
      infants: passengers.infants,
      cabin,
      market: "BR",
    });
  };

  const loadDeals = () => {
    const selectedOrigin = tripType === "multi" ? segments[0]?.origin : origin;
    if (!selectedOrigin) {
      setNotice("Selecione uma origem no autocomplete antes de explorar ofertas.");
      return;
    }
    setNotice("");
    dealsMutation.mutate({ origin: selectedOrigin.code, market: "BR" }, {
      onError: (error) => setNotice(error.message || "Não foi possível consultar ofertas de voos."),
      onSuccess: (items) => { if (items.length === 0) setNotice("A fonte não retornou ofertas para esta origem."); },
    });
  };

  const isInternational = tripType === "multi"
    ? Boolean(segments[0]?.origin && segments[segments.length - 1]?.destination && segments[0].origin?.country !== segments[segments.length - 1].destination?.country)
    : Boolean(origin && destination && origin.country !== destination.country);

  return (
    <div className="search-shell" id="busca">
      {mode === "stays" && <div className="hotel-search-intro"><span className="eyebrow">PIPER HOTÉIS · AIRBNB VIA SERPAPI</span><h2>ENCONTRE SUA HOSPEDAGEM</h2><p>Pesquise anúncios Airbnb com dados e valores retornados pela fonte em reais. Confirme preço e disponibilidade no Airbnb.</p></div>}
      <div className="search-tabs" role="tablist" aria-label="Tipo de pesquisa">
        <button type="button" className={mode === "flights" ? "active" : ""} onClick={() => switchMode("flights")}><Plane size={17} /> Passagens</button>
        <button type="button" className={mode === "stays" ? "active" : ""} onClick={() => switchMode("stays")}><Hotel size={17} /> Hospedagens</button>
        <span className="search-tab-note"><Sparkles size={14} /> Pesquisa clara, sem surpresas</span>
      </div>
      <form className="search-form" onSubmit={submit}>
        {mode === "flights" ? (
          <>
            <div className="trip-toggle" aria-label="Tipo de viagem">
              <button type="button" className={tripType === "roundtrip" ? "active" : ""} onClick={() => setTripType("roundtrip")}>Ida e volta</button>
              <button type="button" className={tripType === "oneway" ? "active" : ""} onClick={() => setTripType("oneway")}>Somente ida</button>
              <button type="button" className={tripType === "multi" ? "active" : ""} onClick={() => setTripType("multi")}>Múltiplos destinos</button>
            </div>
            {tripType === "multi" ? (
              <div className="multi-segments">
                {segments.map((segment, index) => (
                  <div className="multi-segment" key={index}>
                    <span className="segment-label">Trecho {String(index + 1).padStart(2, "0")}</span>
                    <LocationField label="Origem" value={segment.origin} onChange={(value) => setSegments(segments.map((item, itemIndex) => itemIndex === index ? { ...item, origin: value } : item))} icon="from" idPrefix={`segment-${index}-from`} />
                    <LocationField label="Destino" value={segment.destination} onChange={(value) => setSegments(segments.map((item, itemIndex) => itemIndex === index ? { ...item, destination: value } : item))} icon="to" idPrefix={`segment-${index}-to`} />
                    <label className="search-field date-field"><div className="field-icon"><CalendarDays size={17} strokeWidth={1.8} /></div><span>Data</span><input type="date" value={segment.departure} onChange={(event) => setSegments(segments.map((item, itemIndex) => itemIndex === index ? { ...item, departure: event.target.value } : item))} /><b>{formatDate(segment.departure)}</b></label>
                  </div>
                ))}
                <div className="multi-segment-actions"><span>Até 2 trechos · continuação pela fonte SerpApi</span></div>
                <div className="field-row multi-details-row"><PassengerPopover passengers={passengers} setPassengers={setPassengers} /><label className="search-field select-field"><div className="field-icon"><Luggage size={17} strokeWidth={1.8} /></div><span>Classe</span><select value={cabin} onChange={(event) => setCabin(event.target.value as typeof cabin)}><option value="economy">Econômica</option><option value="premium_economy">Econômica Premium</option><option value="business">Executiva</option><option value="first">Primeira classe</option></select></label></div>
              </div>
            ) : (
              <>
                <div className="field-row origin-row">
                  <LocationField label="Origem" value={origin} onChange={setOrigin} icon="from" />
                  <button type="button" className="swap-button" onClick={() => { const next = origin; setOrigin(destination); setDestination(next); }} aria-label="Trocar origem e destino"><ArrowRight size={15} /></button>
                  <LocationField label="Destino" value={destination} onChange={setDestination} icon="to" />
                </div>
                <div className="field-row details-row">
                  <label className="search-field date-field"><div className="field-icon"><CalendarDays size={17} strokeWidth={1.8} /></div><span>Ida</span><input type="date" value={departure} onChange={(event) => setDeparture(event.target.value)} /><b>{formatDate(departure)}</b></label>
                  <label className={`search-field date-field ${tripType === "oneway" ? "disabled-field" : ""}`}><div className="field-icon"><CalendarDays size={17} strokeWidth={1.8} /></div><span>Volta</span><input type="date" value={returnDate} disabled={tripType === "oneway"} onChange={(event) => setReturnDate(event.target.value)} /><b>{tripType === "oneway" ? "Não preciso" : formatDate(returnDate)}</b></label>
                  <PassengerPopover passengers={passengers} setPassengers={setPassengers} />
                  <label className="search-field select-field"><div className="field-icon"><Luggage size={17} strokeWidth={1.8} /></div><span>Classe</span><select value={cabin} onChange={(event) => setCabin(event.target.value as typeof cabin)}><option value="economy">Econômica</option><option value="premium_economy">Econômica Premium</option><option value="business">Executiva</option><option value="first">Primeira classe</option></select></label>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="field-row hotel-row">
            <label className="search-field text-field"><div className="field-icon"><MapPin size={17} strokeWidth={1.8} /></div><span>Destino</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="País ou cidade" /></label>
            <label className="search-field date-field"><div className="field-icon"><CalendarDays size={17} strokeWidth={1.8} /></div><span>Check-in</span><input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /><b>{formatDate(checkIn)}</b></label>
            <label className="search-field date-field"><div className="field-icon"><CalendarDays size={17} strokeWidth={1.8} /></div><span>Check-out</span><input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /><b>{formatDate(checkOut)}</b></label>
            <PassengerPopover passengers={passengers} setPassengers={setPassengers} />
            <label className="search-field select-field"><div className="field-icon"><Hotel size={17} strokeWidth={1.8} /></div><span>Quartos (mín.)</span><select value={airbnbBedrooms} onChange={(event) => setAirbnbBedrooms(Number(event.target.value))}><option value={0}>Qualquer</option>{[1, 2, 3, 4, 5].map((bedroom) => <option key={bedroom} value={bedroom}>{bedroom}+</option>)}</select></label>
            <label className="search-field select-field"><div className="field-icon"><Hotel size={17} strokeWidth={1.8} /></div><span>Tipo de imóvel</span><select value={airbnbPropertyType} onChange={(event) => setAirbnbPropertyType(event.target.value as typeof airbnbPropertyType)}><option value="all">Todos</option><option value="house">Casa</option><option value="apartment">Apartamento</option><option value="guesthouse">Pousada</option><option value="hotel">Hotel</option></select></label>
          </div>
        )}
        <div className="search-action-row">
          <span className={`form-notice ${notice ? "show" : ""}`}><CircleAlert size={15} /> {notice}</span>
          <MicroInteractions><Button className="search-submit" type="submit"><Search size={18} /> {status === "loading" ? "Consultando fonte…" : mode === "flights" ? "Buscar passagens" : "Buscar hospedagens"}</Button></MicroInteractions>
        </div>
      </form>

      {mode === "flights" && <div className="flight-tool-actions">
        {tripType !== "multi" && <button type="button" className="secondary-search-action" onClick={loadCalendar} disabled={calendarMutation.isPending}>{calendarMutation.isPending ? "Consultando calendário…" : "Ver calendário de preços"}</button>}
        <button type="button" className="secondary-search-action" onClick={loadDeals} disabled={dealsMutation.isPending}>{dealsMutation.isPending ? "Consultando ofertas…" : "Explorar ofertas de voos"}</button>
      </div>}
      {calendarOpen && <section className="flight-calendar-results" aria-live="polite"><div className="flight-tool-heading"><div><span className="eyebrow">CALENDÁRIO GOOGLE FLIGHTS</span><h3>Preços por data</h3><p>Selecione uma data retornada para atualizar a busca de voos.</p></div><button type="button" onClick={() => setCalendarOpen(false)}>Fechar</button></div>{calendarMutation.isPending ? <p className="flight-tool-message">Consultando calendário…</p> : calendarMutation.error ? <p className="flight-tool-message error">{calendarMutation.error.message}</p> : calendarMutation.data?.length ? <div className="calendar-price-grid">{calendarMutation.data.map((price) => <button type="button" className={price.lowPrice ? "calendar-price-card low-price" : "calendar-price-card"} key={`${price.departureDate}-${price.returnDate ?? "oneway"}`} onClick={() => selectCalendarPrice(price)}><span>{formatDate(price.departureDate)}{price.returnDate ? ` – ${formatDate(price.returnDate)}` : ""}</span><strong>{formatMoney(price.amount, price.currency)}</strong>{price.lowPrice && <small>Menor preço indicado pela fonte</small>}</button>)}</div> : <p className="flight-tool-message">A fonte não retornou preços para este intervalo.</p>}</section>}
      {dealsMutation.data && dealsMutation.data.length > 0 && <section className="flight-deals-results" aria-live="polite"><div className="flight-tool-heading"><div><span className="eyebrow">GOOGLE FLIGHTS DEALS · SERPAPI</span><h3>Ofertas retornadas pela fonte</h3><p>São opções para pesquisar; a compra é feita no vendedor após conferir o preço final.</p></div><button type="button" onClick={() => dealsMutation.reset()}>Fechar</button></div><div className="flight-deals-grid">{dealsMutation.data.map((deal) => <article className="flight-deal-card" key={deal.id}>{deal.thumbnail && <img src={deal.thumbnail} alt="" loading="lazy" />}<div><strong>{deal.destination}{deal.country ? ` · ${deal.country}` : ""}</strong><p>{deal.airline ?? "Companhia não informada"}{deal.departureDate ? ` · ${formatDate(deal.departureDate)}` : ""}{deal.returnDate ? `–${formatDate(deal.returnDate)}` : ""}</p><b>{formatMoney(deal.amount, deal.currency)}</b>{deal.url && <a href={deal.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Consultar voo na fonte</a>}</div></article>)}</div></section>}
      {dealsMutation.data && dealsMutation.data.length === 0 && <p className="flight-tool-message">A fonte não retornou ofertas para esta origem.</p>}

      {status === "loading" && <div className="search-feedback loading-feedback"><LoadingAnimation /> {mode === "stays" ? "Consultando Airbnb via SerpApi…" : "Consultando Google Flights via SerpApi…"}</div>}
      {status === "error" && <div className="search-feedback error-feedback"><div className="feedback-icon"><CircleAlert size={20} /></div><div><strong>Não foi possível concluir a pesquisa</strong><p>{notice}</p><button type="button" className="retry-search" onClick={() => document.querySelector<HTMLFormElement>(".search-form")?.requestSubmit()}>Tentar novamente</button></div></div>}
      {status === "results" && flightResults.length > 0 && <>
        <button type="button" className="reopen-results" onClick={() => setResultsOpen(true)}><Plane size={14} /> Ver resultados da pesquisa <ArrowRight size={14} /></button>
        {resultsOpen && <div className="flight-results-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResultsOpen(false); }}>
          <section className="flight-results-modal" role="dialog" aria-modal="true" aria-labelledby="flight-results-title">
            <header className="flight-results-modal-header"><div><span className="eyebrow">PIPER · RESULTADOS</span><h2 id="flight-results-title">Opções para sua viagem</h2><p>Confira os detalhes e revalide o preço no vendedor antes de comprar.</p></div><button type="button" className="flight-results-close" onClick={() => setResultsOpen(false)} aria-label="Fechar resultados"><X size={19} /></button></header>
            <div className="flight-results-modal-body"><FlightResults results={flightResults} sort={sort} setSort={setSort} bookingLinks={bookingLinks} bookingPendingId={bookingPendingId} onBookingLinks={handleBookingLinks} copiedId={copiedId} onCopy={copyOffer} international={isInternational} /></div>
          </section>
        </div>}
      </>}
      {status === "results" && mode === "stays" && airbnbResult && <AirbnbResults result={airbnbResult} />}
      {status === "results" && mode === "flights" && flightResults.length === 0 && <div className="empty-results"><div className="feedback-icon"><Search size={20} /></div><div><strong>Nenhum voo encontrado</strong><p>A fonte Google Flights via SerpApi não retornou itinerários para os critérios informados. Tente outras datas, cidades ou aeroportos.</p></div></div>}
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <a href="#top" className={`logo-lockup ${compact ? "compact" : ""}`} aria-label="PIPER, voltar ao topo"><img src="/assets/piper-logo.jpeg" alt="PIPER" /><span><strong>PIPER</strong>{!compact && <small>VIAGENS SEM FRONTEIRAS</small>}</span></a>;
}

export default function Home() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [language, setLanguage] = useState("pt");
  const [currency, setCurrency] = useState("BRL");
  const isSearchPage = location === "/buscar";
  const isHotelsPage = location === "/hoteis";

  useEffect(() => {
    if (isSearchPage || isHotelsPage) window.setTimeout(() => document.getElementById("busca")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, [isHotelsPage, isSearchPage]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  return (
    <PageTransition>
      <div id="top" className="site-frame">
        <header className="site-header">
          <div className="header-inner">
            <Logo />
            <nav className={`main-nav ${mobileOpen ? "open" : ""}`}>
              <a href="/buscar" onClick={() => setMobileOpen(false)}>Passagens aéreas</a>
              <a href="/hoteis" onClick={() => setMobileOpen(false)}>Hotéis</a>
              <a href="#destinos" onClick={() => setMobileOpen(false)}>Pacotes</a>
              <button type="button" onClick={() => scrollTo("vantagens")}>Sobre a PIPER</button>
              <button type="button" onClick={() => scrollTo("faq")}>Ajuda</button>
            </nav>
            <div className="header-actions"><select aria-label="Idioma" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="pt">PT</option><option value="en">EN</option><option value="es">ES</option><option value="fr">FR</option><option value="de">DE</option></select><span className="header-divider" /><select aria-label="Moeda" value={currency} onChange={(event) => setCurrency(event.target.value)}><option>BRL</option><option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option></select><button type="button" className="menu-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Abrir menu">{mobileOpen ? <X size={21} /> : <Menu size={21} />}</button></div>
          </div>
        </header>

        <main>
          <section className="hero-section">
            <div className="hero-copy"><div className="hero-kicker"><span /> {isHotelsPage ? "PIPER / SINTA-SE EM CASA, EM QUALQUER LUGAR" : "PIPER / O MUNDO ESPERA POR VOCÊ"}</div><HeroAnimation><h1>{isHotelsPage ? "Encontre sua hospedagem." : "Seu próximo destino está mais perto do que você imagina."}</h1></HeroAnimation><p>{isHotelsPage ? "Pesquise hotéis e hospedagens com dados, preços e links de parceiros retornados na hora." : "Compare passagens aéreas, encontre hospedagens e descubra as melhores oportunidades para viajar pelo mundo."}</p><div className="hero-proof"><span><ShieldCheck size={16} /> Pesquisa com transparência</span><span><Globe2 size={16} /> Mais de um caminho para chegar</span></div></div>
            <div className="hero-visual">
              <img
                src="/manus-storage/async-images/bn5xM3vLPW3u5iOGRrVjRT/image-1.webp"
                alt="Avião sobre nuvens e uma paisagem de litoral ao pôr do sol"
                fetchPriority="high"
                decoding="async"
                onError={(event) => { event.currentTarget.style.display = "none"; }}
              />
              <div className="hero-visual-caption"><span className="caption-dot" /> Seu mapa começa aqui</div>
            </div>
            <div className="hero-search"><SearchAnimation><SearchPanel initialMode={isHotelsPage ? "stays" : "flights"} /></SearchAnimation></div>
          </section>

          <section className="signal-strip"><div><strong>Uma busca mais leve.</strong><span>Mais clareza para escolher. Menos ruído entre você e a viagem.</span></div><div className="signal-items"><span><Check size={15} /> Condições visíveis</span><span><Check size={15} /> Fornecedores autorizados</span><span><Check size={15} /> Sem checkout falso</span></div></section>

          <section className="content-section intro-section" id="vantagens"><ScrollReveal><div className="section-heading split-heading"><div><span className="eyebrow">DO PRIMEIRO CLIQUE AO PORTÃO DE EMBARQUE</span><h2>Viajar bem começa antes de sair de casa.</h2></div><p>A PIPER foi desenhada para transformar uma decisão complexa em um caminho simples. Você define o que importa. A plataforma organiza as opções sem esconder as condições.</p></div></ScrollReveal><div className="benefit-grid"><ScrollReveal><article className="benefit-card primary-benefit"><span className="benefit-number">01</span><div className="benefit-icon"><SlidersHorizontal size={21} /></div><h3>Compare com contexto</h3><p>Veja preço, duração, escalas, bagagem e regras no mesmo lugar — quando o fornecedor retornar esses dados.</p><a href="#busca" onClick={() => document.getElementById("busca")?.scrollIntoView({ behavior: "smooth" })}>Começar uma busca <ArrowRight size={16} /></a></article></ScrollReveal><ScrollReveal><article className="benefit-card"><span className="benefit-number">02</span><div className="benefit-icon"><Globe2 size={21} /></div><h3>Pesquise o mundo</h3><p>Origem, destino, cidade ou aeroporto. Uma experiência preparada para diferentes países, idiomas e moedas.</p><a href="#destinos">Explorar destinos <ArrowRight size={16} /></a></article></ScrollReveal><ScrollReveal><article className="benefit-card"><span className="benefit-number">03</span><div className="benefit-icon"><ShieldCheck size={21} /></div><h3>Escolha com confiança</h3><p>Sem números inventados. Sem promessa de disponibilidade. A oferta só existe quando a fonte oficial confirma.</p><a href="#integracoes">Entender a tecnologia <ArrowRight size={16} /></a></article></ScrollReveal></div></section>

          <section className="destinations-section" id="destinos"><div className="content-section"><ScrollReveal><div className="section-heading split-heading"><div><span className="eyebrow">ROTAS QUE INSPIRAM</span><h2>O mundo cabe em uma próxima busca.</h2></div><a className="text-link" href="#busca">Ver todas as rotas <ArrowUpRight size={16} /></a></div></ScrollReveal><div className="destination-grid">{destinations.map((destination, index) => <DestinationAnimation key={destination.code} className={`destination-card destination-${index + 1}`}><img src={destination.image} alt={`${destination.city}, ${destination.country}`} /><div className="destination-overlay" /><div className="destination-content"><span>{destination.eyebrow}</span><h3>{destination.city}</h3><p>{destination.country} <b>{destination.code}</b></p><a href="#busca" onClick={() => document.getElementById("busca")?.scrollIntoView({ behavior: "smooth" })}>Explorar <ArrowUpRight size={17} /></a></div></DestinationAnimation>)}</div></div></section>

          <section className="stays-section"><div className="content-section stays-layout"><ScrollReveal><div className="stays-copy"><span className="eyebrow">ALÉM DO VOO</span><h2>Seu endereço no destino também importa.</h2><p>Pesquise hotéis, apartamentos e experiências de hospedagem com espaço para ver localização, comodidades, políticas e condições reais.</p><a className="outline-link" href="#busca" onClick={() => document.getElementById("busca")?.scrollIntoView({ behavior: "smooth" })}>Encontrar hospedagem <ArrowRight size={16} /></a></div></ScrollReveal><ScrollReveal><div className="stay-card"><div className="stay-card-top"><div className="stay-image"><img src="/assets/lisbon.webp" alt="Hospedagem em Lisboa" /><span className="stay-badge">Pesquisa internacional</span></div><div className="stay-card-meta"><span className="eyebrow">HOSPEDAGENS</span><h3>Escolha onde a sua história continua.</h3><div className="stay-meta-row"><span><MapPin size={15} /> Cidade ou país</span><span><ShieldCheck size={15} /> Políticas visíveis</span></div></div></div><div className="stay-card-bottom"><span><Clock3 size={15} /> Disponibilidade consultada na hora</span><a href="#busca" onClick={() => document.getElementById("busca")?.scrollIntoView({ behavior: "smooth" })}>Pesquisar <ArrowRight size={15} /></a></div></div></ScrollReveal></div></section>

          <section className="trust-section"><div className="content-section trust-layout"><ScrollReveal><div><span className="eyebrow">CONSTRUÍDA PARA ESCALAR</span><h2>Uma experiência premium não precisa esconder o que acontece nos bastidores.</h2></div></ScrollReveal><ScrollReveal><div className="trust-copy"><p>A PIPER está preparada para conectar fornecedores oficiais de voos, hospedagens, moeda e analytics sem misturar responsabilidades. Assim, cada integração pode evoluir sem reconstruir toda a experiência.</p><div className="trust-points"><span><span className="trust-point-mark">01</span> APIs em camadas independentes</span><span><span className="trust-point-mark">02</span> Dados sensíveis só no servidor</span><span><span className="trust-point-mark">03</span> Revalidação antes da reserva</span></div></div></ScrollReveal></div></section>

          <section className="faq-section" id="faq"><div className="content-section faq-layout"><ScrollReveal><div className="faq-heading"><span className="eyebrow">PRECISA DE UMA DIREÇÃO?</span><h2>As perguntas que aparecem antes da viagem.</h2><p>Se a sua dúvida não estiver aqui, fale com a equipe da PIPER.</p><a className="text-link" href="#integracoes">Ativar canal de atendimento <ArrowUpRight size={16} /></a></div></ScrollReveal><ScrollReveal><div className="faq-list">{faqs.map(([question, answer], index) => <div className={`faq-item ${openFaq === index ? "open" : ""}`} key={question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><span>{question}</span><ChevronDown size={18} /></button>{openFaq === index && <p>{answer}</p>}</div>)}</div></ScrollReveal></div></section>

          <section className="final-cta" id="integracoes"><div className="final-cta-inner"><div><span className="eyebrow">O PRÓXIMO PASSO É SEU</span><h2>Não deixe sua próxima viagem apenas nos planos.</h2><p>A PIPER consulta passagens via Google Flights e hospedagens via Airbnb pela SerpApi. A reserva é concluída no endereço oficial do vendedor; a PIPER não processa pagamentos.</p></div><div className="final-cta-actions"><a href="#busca" className="solid-link" onClick={() => document.getElementById("busca")?.scrollIntoView({ behavior: "smooth" })}>Encontrar minha viagem <ArrowRight size={17} /></a><span className="cta-note"><CircleAlert size={15} /> Preços e disponibilidade precisam ser revalidados na fonte.</span></div></div></section>
        </main>

        <footer className="site-footer"><div className="footer-main"><Logo compact /><p>A tecnologia que aproxima você do próximo lugar.</p><div className="footer-links"><a href="#destinos">Destinos</a><a href="#vantagens">Por que a PIPER</a><a href="#faq">Ajuda</a><a href="#integracoes">Integrações</a></div><a className="whatsapp-link" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> Falar no WhatsApp</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} PIPER. Todos os direitos reservados.</span><span>Pesquisa clara para viajar mais longe.</span></div></footer><a className="whatsapp-float" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label="Falar com a PIPER pelo WhatsApp"><MessageCircle size={20} /></a>
      </div>
    </PageTransition>
  );
}
